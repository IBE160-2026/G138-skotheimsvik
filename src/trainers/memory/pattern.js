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

/**
 * Level 1 starts here; every level adds one tile (FR-117).
 *
 * Two, following the Corsi block-tapping test — the standard visuo-spatial
 * memory task since 1972, which also starts at two blocks.
 */
export const STARTING_TILES = 2;

/**
 * A pattern may fill at most this share of the board.
 *
 * Corsi uses nine blocks and reports an average span of five to six, so a
 * ceiling below roughly two thirds would cut a 3×3 board off before an average
 * player had even reached their limit. An earlier 55 % cap did exactly that:
 * it left the smallest board with four tiles and barely two levels.
 */
export const MAX_FILL_RATIO = 0.67;

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
 * Deterministically pick today's starting board size from the daily seed so the
 * grid size varies each day (3×3, 4×4, 5×5 or 6×6).
 */
export function dailyBoardSizeFor(puzzleDate = '2026-11-15') {
  const rng = createRng(seedFor('pattern-memory-board', 'daily', puzzleDate));
  return rng.pick(BOARD_SIZES);
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
    question: `Level ${level} (${board.columns}×${board.rows})`,
    answer: indices.slice().sort((a, b) => a - b),
    level,
    tileCount,
    boardSize,
    columns: board.columns,
    rows: board.rows,
    cellCount: board.cells,
    displayMs: DISPLAY_MS[boardSize] ?? 2200,
  };
}

export const patternMemoryTrainer = {
  id: 'pattern-memory',
  categoryId: 'pattern-memory',
  name: 'Pattern Memory',
  description:
    'One daily run with zero mistakes allowed. The grid size varies each day (3×3 to 6×6) — memorize the lit pattern and reproduce as many levels as possible!',
  roundMode: 'lives',
  variantKind: 'pool',
  variants: ['daily'],
  variantLabels: {
    daily: 'Daily Pattern Memory',
  },
  noPractice: true,
  scoreDirection: 'higher',
  headlineScore: 'maxLevel',
  renderer: 'grid',
  scoreLabel: 'Level reached',
  modeParam: 1,
  topics: [],

  createGenerator({ puzzleDate, variantKey = 'daily', practice = false, filters = null }) {
    const explicitBoard = parseBoardSize(variantKey) ? variantKey : null;
    const baseBoardSize = explicitBoard ?? (practice ? (filters?.boardSize ?? '4x4') : dailyBoardSizeFor(puzzleDate));
    const boardStartIndex = Math.max(0, BOARD_SIZES.indexOf(baseBoardSize));
    const rng = createRng(
      practice ? practiceSeed() : seedFor(this.id, variantKey, puzzleDate),
    );
    let level = 0;

    return {
      next() {
        level += 1;
        // If the round uses an explicit board size (e.g. unit tests for '3x3'), respect its capacity cap.
        if (explicitBoard) {
          const prompt = buildLevel(rng, explicitBoard, level);
          if (!prompt) return null;
          if (practice && filters?.displayMs) prompt.displayMs = filters.displayMs;
          return prompt;
        }

        // In the daily endless run, start at today's daily board size and step up if the player exceeds its capacity.
        let activeIdx = boardStartIndex;
        while (
          activeIdx < BOARD_SIZES.length - 1 &&
          level > maxLevelFor(BOARD_SIZES[activeIdx])
        ) {
          activeIdx += 1;
        }
        const activeBoard = BOARD_SIZES[activeIdx];
        const effectiveTileCount = Math.min(
          tilesForLevel(level),
          Math.floor((parseBoardSize(activeBoard)?.cells ?? 36) * MAX_FILL_RATIO),
        );
        const board = parseBoardSize(activeBoard);
        const indices = rng.sample(
          Array.from({ length: board.cells }, (_, index) => index),
          effectiveTileCount,
        );
        return {
          kind: 'grid',
          key: `level-${level}`,
          question: `Level ${level} (${board.columns}×${board.rows} Grid)`,
          answer: indices.slice().sort((a, b) => a - b),
          level,
          tileCount: effectiveTileCount,
          boardSize: activeBoard,
          columns: board.columns,
          rows: board.rows,
          cellCount: board.cells,
          displayMs: DISPLAY_MS[activeBoard] ?? 2200,
        };
      },
    };
  },
};
