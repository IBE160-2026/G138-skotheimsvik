/**
 * Pattern Memory — the Memory category's endless trainer.
 *
 * FR-113 to FR-124. A pattern lights up, hides, and the player reproduces it.
 * Every level adds one tile and the round only ends on a mistake, so prompts
 * are generated lazily and without limit.
 *
 * The board never grows mid-round (FR-119): the player picked that size, and
 * overriding the choice halfway through would be rude. The round instead ends
 * naturally as the pattern approaches the board's capacity.
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';
import { parseBoardSize } from '../../core/variants.js';

export const BOARD_SIZES = Object.freeze(['3x3', '4x4', '5x5', '6x6']);

/** Level 1 starts here; every level adds one tile (FR-117). */
export const STARTING_TILES = 3;

/**
 * A pattern may fill at most this share of the board.
 *
 * Past roughly half, "remember the lit tiles" quietly becomes "remember the
 * unlit ones", which is a different and much easier task.
 */
export const MAX_FILL_RATIO = 0.55;

export const DISPLAY_MS = Object.freeze({
  '3x3': 1800,
  '4x4': 2200,
  '5x5': 2600,
  '6x6': 3000,
});

/** Tiles shown at a given level. */
export function tilesForLevel(level) {
  return STARTING_TILES + (level - 1);
}

/** The last level a board can hold before the pattern covers too much of it. */
export function maxLevelFor(boardSize) {
  const board = parseBoardSize(boardSize);
  if (!board) return 0;
  const maxTiles = Math.floor(board.cells * MAX_FILL_RATIO);
  return Math.max(1, maxTiles - STARTING_TILES + 1);
}

/**
 * Build one level.
 *
 * Pure in seed and level number (NFR-5), so level 50 can be asserted without
 * playing the 49 before it.
 */
export function buildLevel(rng, boardSize, level) {
  const board = parseBoardSize(boardSize);
  const tileCount = tilesForLevel(level);
  if (!board || tileCount > Math.floor(board.cells * MAX_FILL_RATIO)) return null;

  const indices = rng.sample(
    Array.from({ length: board.cells }, (_, index) => index),
    tileCount,
  );

  return {
    kind: 'grid',
    key: `level-${level}`,
    question: `Level ${level}`,
    answer: indices.slice().sort((a, b) => a - b),
    level,
    tileCount,
    columns: board.columns,
    rows: board.rows,
    cellCount: board.cells,
    displayMs: DISPLAY_MS[boardSize] ?? 2200,
  };
}

export const patternMemoryTrainer = {
  id: 'pattern-memory',
  categoryId: 'memory',
  name: 'Pattern Memory',
  description:
    'A pattern lights up on a grid. Reproduce it. Every level adds one tile, and it never stops.',
  roundMode: 'lives',
  variantKind: 'boardSize',
  variants: [...BOARD_SIZES],
  scoreDirection: 'higher',
  headlineScore: 'maxLevel',
  renderer: 'grid',
  scoreLabel: 'Level reached',
  modeParam: 1,
  topics: [],

  practiceFilters: {
    boardSize: {
      label: 'Board size',
      kind: 'single',
      options: BOARD_SIZES.map((id) => ({ id, label: id.replace('x', '×') })),
      default: '4x4',
    },
    displayMs: {
      label: 'Display time',
      kind: 'single',
      options: [
        { id: 1200, label: 'Fast — 1.2 s' },
        { id: 2200, label: 'Normal — 2.2 s' },
        { id: 3500, label: 'Slow — 3.5 s' },
      ],
      default: 2200,
    },
  },

  createGenerator({ puzzleDate, variantKey, practice = false, filters = null }) {
    const boardSize = practice ? (filters?.boardSize ?? variantKey) : variantKey;
    const rng = createRng(
      practice ? practiceSeed() : seedFor(this.id, variantKey, puzzleDate),
    );
    let level = 0;

    return {
      next() {
        level += 1;
        const prompt = buildLevel(rng, boardSize, level);
        if (!prompt) return null;
        if (practice && filters?.displayMs) prompt.displayMs = filters.displayMs;
        return prompt;
      },
    };
  },
};
