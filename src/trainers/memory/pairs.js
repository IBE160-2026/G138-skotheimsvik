/**
 * Figure Pairs — the Memory category's completion trainer.
 *
 * FR-125 to FR-134. A board of face-down figures; turn two at a time until
 * every pair is matched. The round ends only when the board is clear, and the
 * score is how many wrong turns it took — so lower is better.
 *
 * Scoring mistakes rather than time is deliberate: a timer would reward fast
 * clicking, whereas the thing being measured is whether you remember where you
 * already saw a figure. Time only breaks ties (FR-131).
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';
import { parseBoardSize } from '../../core/variants.js';

export const BOARD_SIZES = Object.freeze(['4x3', '4x4', '6x4', '6x6']);

/**
 * Figures are picked so that no two share a silhouette, which keeps the board
 * playable for colour-blind players and in monochrome (FR-132).
 */
export const FIGURES = Object.freeze([
  '🍎', '🍌', '🍇', '🍓', '🍒', '🥕',
  '🐶', '🐱', '🐧', '🐸', '🐢', '🦊',
  '🚗', '🚀', '⚽', '🏀', '🎸', '🎲',
  '🎁', '🔑', '🌞', '🌙', '⭐', '🍕',
]);

export function pairsFor(boardSize) {
  const board = parseBoardSize(boardSize);
  return board ? board.cells / 2 : 0;
}

/**
 * Deterministically pick today's board size for Figure Pairs so the grid
 * varies each day (4×3, 4×4, 6×4, or 6×6).
 */
export function dailyPairsBoardSizeFor(puzzleDate = '2026-11-15') {
  const rng = createRng(seedFor('figure-pairs-board', 'daily', puzzleDate));
  return rng.pick(BOARD_SIZES);
}

/**
 * Deal a board: every figure appears exactly twice (FR-125, FR-126).
 */
export function dealBoard(rng, boardSize) {
  const board = parseBoardSize(boardSize);
  if (!board || board.cells % 2 !== 0) return null;

  const pairCount = board.cells / 2;
  const chosen = rng.sample(FIGURES, pairCount);
  const faces = rng.shuffle([...chosen, ...chosen]);

  return { columns: board.columns, rows: board.rows, cells: board.cells, faces };
}

export const figurePairsTrainer = {
  id: 'figure-pairs',
  categoryId: 'figure-pairs',
  name: 'Figure Pairs',
  description:
    'One daily run. The board size varies each day (4×3 to 6×6) — match all figure pairs in as few attempts as possible!',
  roundMode: 'completion',
  variantKind: 'pool',
  variants: ['daily'],
  variantLabels: {
    daily: 'Daily Figure Pairs',
  },
  noPractice: true,
  scoreDirection: 'lower',
  headlineScore: 'mistakes',
  renderer: 'pairs',
  scoreLabel: 'Mistakes',
  topics: [],

  /** Pairs to clear, which is the completion target for this board. */
  modeParamFor(variantKey, puzzleDate) {
    if (parseBoardSize(variantKey)) {
      return pairsFor(variantKey);
    }
    return pairsFor(dailyPairsBoardSizeFor(puzzleDate ?? new Date().toISOString().slice(0, 10)));
  },

  createGenerator({ puzzleDate, variantKey = 'daily', practice = false, filters = null }) {
    const boardSize = parseBoardSize(variantKey)
      ? variantKey
      : practice
        ? (filters?.boardSize ?? '4x4')
        : dailyPairsBoardSizeFor(puzzleDate);
    const rng = createRng(
      practice ? practiceSeed() : seedFor(this.id, variantKey, puzzleDate),
    );
    const board = dealBoard(rng, boardSize);
    /** Indices already matched and left face up. */
    const matched = new Set();

    return {
      next(context) {
        if (!board) return null;

        // The engine reports what was just submitted, which is how a stateful
        // board learns that two cards should stay face up (FR-127).
        if (context?.lastCorrect && Array.isArray(context.lastSubmission)) {
          for (const index of context.lastSubmission) matched.add(index);
        }

        if (matched.size >= board.cells) return null;

        return {
          kind: 'pairs',
          key: `turn-${matched.size}-${context?.index ?? 0}`,
          question: `Turn two cards (${board.columns}×${board.rows} Board)`,
          boardSize,
          faces: board.faces,
          matched: [...matched],
          columns: board.columns,
          rows: board.rows,
          cellCount: board.cells,
          pairsTotal: board.cells / 2,
          pairsMatched: matched.size / 2,
        };
      },
    };
  },
};
