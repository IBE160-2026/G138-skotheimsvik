/**
 * Memory — lives trainer with one life and no ceiling.
 *
 * FR-96..FR-108. Each level is one prompt, so "highest level completed" is
 * exactly the engine's correct-answer count. Level n is seeded independently of
 * every other level, which is what makes NFR-5 hold at arbitrary depth without
 * generating the levels before it.
 */

import { createRng, hashString, seedFor } from '../../core/rng.js';

/** Starting tile count per band (FR-103). */
export const START_TILES_BY_BAND = Object.freeze({
  beginner: 3,
  intermediate: 4,
  advanced: 5,
  expert: 6,
});

/** How long the pattern stays visible, in milliseconds (FR-103). */
export const DISPLAY_MS_BY_BAND = Object.freeze({
  beginner: 1400,
  intermediate: 1150,
  advanced: 950,
  expert: 750,
});

/** The grid starts here and grows as needed. */
export const BASE_GRID_SIZE = 4;

/**
 * The grid grows once the pattern would occupy more than this share of the
 * cells, which keeps a large pattern legible rather than a near-solid block
 * (FR-102). Resolves PRD §9 Q8.
 */
export const MAX_FILL_RATIO = 0.4;

/**
 * Smallest square grid that holds `tileCount` at or below the fill ratio.
 * @param {number} tileCount
 * @returns {number} grid edge length
 */
export function gridSizeFor(tileCount) {
  let size = BASE_GRID_SIZE;
  while (tileCount > size * size * MAX_FILL_RATIO) {
    size += 1;
  }
  return size;
}

/**
 * Build level `level` as a pure function of the day's seed and the level number.
 * @param {number} baseSeed
 * @param {string} difficulty
 * @param {number} level 1-based
 */
export function buildLevel(baseSeed, difficulty, level) {
  const tileCount = START_TILES_BY_BAND[difficulty] + (level - 1);
  const gridSize = gridSizeFor(tileCount);
  const cellCount = gridSize * gridSize;

  // Seeded per level, so level 50 does not require levels 1..49 to be generated.
  const rng = createRng(hashString(`${baseSeed}:level:${level}`));
  const cells = Array.from({ length: cellCount }, (_, index) => index);
  const tiles = rng.sample(cells, tileCount).sort((a, b) => a - b);

  return {
    kind: 'grid',
    key: `level-${level}`,
    level,
    gridSize,
    tileCount,
    displayMs: DISPLAY_MS_BY_BAND[difficulty],
    answer: tiles,
    question: `Level ${level} — reproduce ${tileCount} tiles`,
  };
}

export const memoryTrainer = {
  id: 'memory',
  name: 'Memory',
  description: 'A pattern lights up on a grid. Reproduce it. Every level adds one tile, and it never stops.',
  roundMode: 'lives',
  headlineScore: 'maxLevel',
  renderer: 'grid',
  supportsCategories: false,
  scoreLabel: 'Level reached',

  /** Exactly one life: the first mistake ends the round (FR-97). */
  modeParam() {
    return 1;
  },

  describeMode(difficulty) {
    return `1 life · starts at ${START_TILES_BY_BAND[difficulty]} tiles`;
  },

  /** Endless lazy supply — a level exists for every n (FR-101, NFR-5). */
  createGenerator({ puzzleDate, difficulty }) {
    const baseSeed = seedFor(this.id, puzzleDate);

    return {
      next(context) {
        // The next level is one past however many have been completed.
        const level = (context?.correctCount ?? 0) + 1;
        return buildLevel(baseSeed, difficulty, level);
      },
    };
  },
};
