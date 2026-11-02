/**
 * Mental Math Sprint — the Math category's timed trainer.
 *
 * FR-103 to FR-112. Prompts are generated lazily from the round's seed, so a
 * round is bounded only by the clock. Nothing here is imported by the engine;
 * the engine only sees the object exported at the bottom (FR-7).
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';

export const TOPICS = Object.freeze({
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
  percentages: 'Percentages',
  fractions: 'Fractions',
  powers: 'Powers and roots',
  algebra: 'Algebra',
  trigonometry: 'Trigonometry',
});

/**
 * Which topics each band may draw, and how heavily (FR-105).
 * Each band keeps the earlier ones, so difficulty accumulates rather than swaps.
 */
const TOPIC_WEIGHTS = Object.freeze({
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
    ['fractions', 2],
    ['powers', 2],
  ],
  expert: [
    ['subtraction', 1],
    ['multiplication', 2],
    ['division', 2],
    ['percentages', 2],
    ['fractions', 3],
    ['powers', 2],
    ['algebra', 3],
    ['trigonometry', 2],
  ],
});

/** Operand ranges per band (FR-105). */
const RANGES = Object.freeze({
  beginner: { min: 0, max: 20, factorMax: 5 },
  intermediate: { min: 0, max: 50, factorMax: 10 },
  advanced: { min: 10, max: 200, factorMax: 12 },
  expert: { min: 10, max: 500, factorMax: 20 },
});

/**
 * Exact trigonometric values (FR-110).
 *
 * Only angles whose sine, cosine and tangent are expressible exactly appear, so
 * there is never a rounding argument. tan 90° is absent because it is undefined.
 */
const TRIG_TABLE = Object.freeze([
  { angle: 0, sin: '0', cos: '1', tan: '0' },
  { angle: 30, sin: '1/2', cos: '√3/2', tan: '√3/3' },
  { angle: 45, sin: '√2/2', cos: '√2/2', tan: '1' },
  { angle: 60, sin: '√3/2', cos: '1/2', tan: '√3' },
  { angle: 90, sin: '1', cos: '0', tan: null },
]);

const TRIG_VALUES = ['0', '1/2', '√2/2', '√3/2', '1', '√3/3', '√3'];

function gcd(a, b) {
  return b === 0 ? a : gcd(b, a % b);
}

function makePrompt(topicId, question, answer, extra = {}) {
  return {
    kind: 'numeric',
    key: `${topicId}:${question}`,
    topicId,
    topicLabel: TOPICS[topicId],
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
  // Beginners never meet a negative answer (FR-108).
  if (band === 'beginner' && b > a) [a, b] = [b, a];
  return makePrompt('subtraction', `${a} − ${b}`, a - b);
}

function makeMultiplication(rng, range) {
  const a = rng.int(2, range.factorMax);
  const b = rng.int(2, range.factorMax);
  return makePrompt('multiplication', `${a} × ${b}`, a * b);
}

function makeDivision(rng, range) {
  // Built from the answer outwards, so the divisor is never zero (FR-106) and
  // the result is always a whole number (FR-107).
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

  return makePrompt(
    'fractions',
    `${left}/${denominator} + ${right}/${denominator}`,
    sumNumerator / denominator,
    {
      displayAnswer: `${sumNumerator / divisor}/${denominator / divisor}`,
      formatHint: 'Answer as a fraction (3/4) or a decimal (0.75).',
      tolerance: 1e-6,
    },
  );
}

/** Squares, cubes and exact square roots — always whole-number answers. */
function makePowers(rng, range) {
  const style = rng.int(0, 2);
  if (style === 0) {
    const base = rng.int(2, Math.min(20, range.factorMax + 8));
    return makePrompt('powers', `${base}²`, base * base);
  }
  if (style === 1) {
    const base = rng.int(2, 9);
    return makePrompt('powers', `${base}³`, base * base * base);
  }
  const root = rng.int(2, 20);
  return makePrompt('powers', `√${root * root}`, root);
}

/**
 * A linear equation with one unknown and an integer solution (FR-109).
 *
 * Built from the solution outwards so the answer is integral by construction
 * rather than by luck.
 */
function makeAlgebra(rng) {
  const x = rng.int(-12, 12);
  const a = rng.pick([2, 3, 4, 5, 6, 7, 8, 9]);
  const b = rng.int(-20, 20);

  if (rng.float() < 0.5) {
    const c = a * x + b;
    const sign = b < 0 ? '−' : '+';
    return makePrompt('algebra', `${a}x ${sign} ${Math.abs(b)} = ${c}`, x, {
      formatHint: 'Solve for x.',
    });
  }

  // (x + b) / a = c, again arranged so x lands on an integer.
  const c = x + b;
  const sign = b < 0 ? '−' : '+';
  return makePrompt('algebra', `(x ${sign} ${Math.abs(b)}) ÷ ${a} = ${c / a}`, x, {
    formatHint: 'Solve for x.',
  });
}

/**
 * Exact-value trigonometry, asked as multiple choice (FR-110).
 *
 * Free-text would mean arguing about whether "0.866" counts as √3/2, so the
 * exact values are offered as options instead.
 */
function makeTrigonometry(rng) {
  const functions = ['sin', 'cos', 'tan'];
  let entry = rng.pick(TRIG_TABLE);
  let fn = rng.pick(functions);
  // tan 90° is undefined, so re-roll rather than ask it.
  while (entry.tan === null && fn === 'tan') {
    entry = rng.pick(TRIG_TABLE);
    fn = rng.pick(functions);
  }

  const answer = entry[fn];
  const distractors = TRIG_VALUES.filter((value) => value !== answer);
  const options = [answer];
  while (options.length < 4 && distractors.length > 0) {
    const index = rng.int(0, distractors.length - 1);
    options.push(distractors.splice(index, 1)[0]);
  }

  return {
    kind: 'choice',
    key: `trigonometry:${fn}${entry.angle}`,
    topicId: 'trigonometry',
    topicLabel: TOPICS.trigonometry,
    question: `${fn} ${entry.angle}°`,
    answer,
    options: rng.shuffle(options),
    formatHint: 'Pick the exact value.',
  };
}

const BUILDERS = {
  addition: (rng, range) => makeAddition(rng, range),
  subtraction: (rng, range, band) => makeSubtraction(rng, range, band),
  multiplication: (rng, range) => makeMultiplication(rng, range),
  division: (rng, range) => makeDivision(rng, range),
  percentages: (rng) => makePercentage(rng),
  fractions: (rng) => makeFraction(rng),
  powers: (rng, range) => makePowers(rng, range),
  algebra: (rng) => makeAlgebra(rng),
  trigonometry: (rng) => makeTrigonometry(rng),
};

/** Topic ids a band draws from, in weight order. */
export function topicsForBand(band) {
  return (TOPIC_WEIGHTS[band] ?? []).map(([topicId]) => topicId);
}

export const mentalMathTrainer = {
  id: 'mental-math',
  categoryId: 'math',
  name: 'Mental Math Sprint',
  description: 'Answer as many arithmetic prompts as you can before the clock runs out.',
  roundMode: 'timed',
  variantKind: 'band',
  scoreDirection: 'higher',
  headlineScore: 'correct',
  renderer: 'prompt',
  scoreLabel: 'Correct answers',
  topics: Object.entries(TOPICS).map(([id, label]) => ({ id, label })),

  /** Practice may switch any topic on or off (FR-52). */
  practiceFilters: {
    topics: {
      label: 'Topics',
      kind: 'multi',
      options: Object.entries(TOPICS).map(([id, label]) => ({ id, label })),
      default: topicsForBand('intermediate'),
    },
    durationSec: {
      label: 'Round length',
      kind: 'single',
      options: [
        { id: 30, label: '30 seconds' },
        { id: 60, label: '60 seconds' },
        { id: 120, label: '2 minutes' },
      ],
      default: 60,
    },
  },

  /** A practice round with no topics selected cannot produce prompts (FR-56). */
  validateFilters(filters) {
    const topics = filters?.topics ?? [];
    if (topics.length === 0) {
      return { ok: false, reason: 'Pick at least one topic to practise.' };
    }
    return { ok: true };
  },

  /** Lazy, seeded prompt supply (FR-23, FR-30). */
  createGenerator({ puzzleDate, variantKey, practice = false, filters = null }) {
    const rng = createRng(
      practice ? practiceSeed() : seedFor(this.id, variantKey, puzzleDate),
    );
    const range = RANGES[variantKey] ?? RANGES.intermediate;

    // Daily rounds use the band's weights untouched; practice narrows them to
    // the chosen topics, keeping each topic's relative weight where it has one.
    let weights = TOPIC_WEIGHTS[variantKey] ?? TOPIC_WEIGHTS.intermediate;
    if (practice && Array.isArray(filters?.topics)) {
      const chosen = new Set(filters.topics);
      weights = [...chosen].map((topicId) => {
        const banded = weights.find(([id]) => id === topicId);
        return [topicId, banded ? banded[1] : 2];
      });
    }

    return {
      next() {
        if (weights.length === 0) return null;
        const topicId = rng.weighted(weights);
        return BUILDERS[topicId](rng, range, variantKey);
      },
    };
  },
};
