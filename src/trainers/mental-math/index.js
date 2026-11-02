/**
 * Mental Math Sprint — timed trainer.
 *
 * FR-87..FR-95. Prompts are generated lazily from the day's seed, so a round is
 * bounded only by the clock. Nothing here is imported by the engine; the engine
 * only sees the object returned at the bottom (FR-11).
 */

import { createRng, seedFor } from '../../core/rng.js';

/** Round duration per band, in seconds (PRD §3.2, FR-29). */
export const DURATION_BY_BAND = Object.freeze({
  beginner: 45,
  intermediate: 60,
  advanced: 75,
  expert: 90,
});

export const CATEGORIES = Object.freeze({
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
  percentages: 'Percentages',
  fractions: 'Fractions',
});

/**
 * Which categories each band may draw, and how heavily (FR-89).
 * Each band keeps the earlier ones so difficulty accumulates rather than swaps.
 */
const CATEGORY_WEIGHTS = Object.freeze({
  beginner: [
    ['addition', 5],
    ['subtraction', 5],
  ],
  intermediate: [
    ['addition', 3],
    ['subtraction', 3],
    ['multiplication', 3],
    ['division', 2],
  ],
  advanced: [
    ['addition', 2],
    ['subtraction', 2],
    ['multiplication', 3],
    ['division', 3],
    ['percentages', 3],
  ],
  expert: [
    ['addition', 1],
    ['subtraction', 1],
    ['multiplication', 2],
    ['division', 2],
    ['percentages', 3],
    ['fractions', 3],
  ],
});

/** Operand ranges per band (FR-89). */
const RANGES = Object.freeze({
  beginner: { min: 0, max: 20, factorMax: 5 },
  intermediate: { min: 0, max: 50, factorMax: 10 },
  advanced: { min: 10, max: 200, factorMax: 12 },
  expert: { min: 10, max: 500, factorMax: 20 },
});

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function makePrompt(categoryId, question, answer, extra = {}) {
  return {
    kind: 'numeric',
    key: `${categoryId}:${question}`,
    categoryId,
    categoryLabel: CATEGORIES[categoryId],
    question,
    answer,
    ...extra,
  };
}

function makeAddition(rng, range) {
  const a = rng.int(range.min, range.max);
  const b = rng.int(range.min, range.max);
  return makePrompt('addition', `${a} + ${b}`, a + b);
}

function makeSubtraction(rng, range, band) {
  let a = rng.int(range.min, range.max);
  let b = rng.int(range.min, range.max);
  // Beginners never meet a negative answer (FR-92).
  if (band === 'beginner' && b > a) [a, b] = [b, a];
  return makePrompt('subtraction', `${a} − ${b}`, a - b);
}

function makeMultiplication(rng, range) {
  const a = rng.int(2, range.factorMax);
  const b = rng.int(2, range.factorMax);
  return makePrompt('multiplication', `${a} × ${b}`, a * b);
}

function makeDivision(rng, range) {
  // Built from the answer outwards, so the divisor is never zero (FR-90) and the
  // result is always a whole number (FR-91).
  const divisor = rng.int(2, range.factorMax);
  const quotient = rng.int(2, range.factorMax);
  return makePrompt('division', `${divisor * quotient} ÷ ${divisor}`, quotient);
}

function makePercentage(rng) {
  const percent = rng.pick([5, 10, 20, 25, 50, 75]);
  const base = rng.int(1, 20) * 20;
  return makePrompt('percentages', `${percent}% of ${base}`, (percent / 100) * base);
}

function makeFraction(rng) {
  const denominator = rng.pick([2, 3, 4, 5, 6, 8, 10]);
  const left = rng.int(1, denominator - 1);
  const right = rng.int(1, denominator - 1);
  const sumNumerator = left + right;
  const divisor = gcd(sumNumerator, denominator);

  return makePrompt('fractions', `${left}/${denominator} + ${right}/${denominator}`, sumNumerator / denominator, {
    displayAnswer: `${sumNumerator / divisor}/${denominator / divisor}`,
    formatHint: 'Answer as a fraction (3/4) or a decimal (0.75).',
    tolerance: 1e-6,
  });
}

function makeMultiStep(rng, range) {
  const a = rng.int(2, range.factorMax);
  const b = rng.int(2, range.factorMax);
  const c = rng.int(1, range.factorMax);
  const plus = rng.float() < 0.5;
  const question = plus ? `${a} × ${b} + ${c}` : `${a} × ${b} − ${c}`;
  return makePrompt('multiplication', question, plus ? a * b + c : a * b - c);
}

const BUILDERS = {
  addition: (rng, range) => makeAddition(rng, range),
  subtraction: (rng, range, band) => makeSubtraction(rng, range, band),
  multiplication: (rng, range, band) =>
    band === 'expert' && rng.float() < 0.4 ? makeMultiStep(rng, range) : makeMultiplication(rng, range),
  division: (rng, range) => makeDivision(rng, range),
  percentages: (rng) => makePercentage(rng),
  fractions: (rng) => makeFraction(rng),
};

export const mentalMathTrainer = {
  id: 'mental-math',
  name: 'Mental Math Sprint',
  description: 'Answer as many arithmetic prompts as you can before the clock runs out.',
  roundMode: 'timed',
  headlineScore: 'correct',
  renderer: 'numeric',
  supportsCategories: true,
  scoreLabel: 'Correct answers',

  /** Round duration in seconds, derived from the day's band (FR-29, FR-87). */
  modeParam(difficulty) {
    return DURATION_BY_BAND[difficulty];
  },

  describeMode(difficulty) {
    return `${this.modeParam(difficulty)} seconds`;
  },

  /** Lazy, seeded prompt supply (FR-24, FR-32). */
  createGenerator({ puzzleDate, difficulty }) {
    const rng = createRng(seedFor(this.id, puzzleDate));
    const weights = CATEGORY_WEIGHTS[difficulty];
    const range = RANGES[difficulty];

    return {
      next() {
        const categoryId = rng.weighted(weights);
        return BUILDERS[categoryId](rng, range, difficulty);
      },
    };
  },
};
