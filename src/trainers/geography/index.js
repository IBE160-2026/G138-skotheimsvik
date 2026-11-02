/**
 * Geography Speed — lives trainer with three lives.
 *
 * FR-109..FR-116. Content comes from countries.json rather than code, and the
 * trainer was written after the engine was finished without requiring a single
 * change to src/core/ — which is the point of US-6.8.
 */

import { createRng, seedFor } from '../../core/rng.js';

export const CATEGORIES = Object.freeze({
  'country-capital': 'Country → capital',
  'capital-country': 'Capital → country',
  'flag-country': 'Flag → country',
  'country-continent': 'Country → continent',
});

/** Highest tier included per band (FR-112). */
const MAX_TIER_BY_BAND = Object.freeze({
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 3,
});

const CHOICE_COUNT = 4;

/**
 * Validate the content file, skipping malformed entries rather than crashing
 * the trainer (FR-115).
 * @param {unknown} raw parsed JSON
 * @param {{warn: Function}} [logger]
 */
export function validateCountries(raw, logger = console) {
  const list = Array.isArray(raw) ? raw : raw?.countries;
  if (!Array.isArray(list)) {
    logger.warn('[geography] Content file has no countries array; trainer will be unavailable.');
    return [];
  }

  const valid = [];
  for (const [index, entry] of list.entries()) {
    const problems = [];
    if (typeof entry?.name !== 'string' || entry.name.trim() === '') problems.push('name');
    if (typeof entry?.capital !== 'string' || entry.capital.trim() === '') problems.push('capital');
    if (typeof entry?.continent !== 'string' || entry.continent.trim() === '') problems.push('continent');
    if (!Number.isInteger(entry?.tier) || entry.tier < 1 || entry.tier > 3) problems.push('tier');

    if (problems.length > 0) {
      logger.warn(`[geography] Skipping entry ${index}: invalid ${problems.join(', ')}.`);
      continue;
    }

    valid.push({
      name: entry.name,
      capital: entry.capital,
      continent: entry.continent,
      tier: entry.tier,
      flag: typeof entry.flag === 'string' ? entry.flag : '',
      alternatives: Array.isArray(entry.alternatives) ? entry.alternatives : [],
    });
  }

  return valid;
}

/**
 * Build the four distractors, preferring the same continent so they are
 * plausible, and never repeating the correct answer (FR-113).
 */
function buildChoices(rng, correct, pool, valueOf) {
  const sameContinent = pool.filter(
    (entry) => entry.continent === correct.continent && valueOf(entry) !== valueOf(correct),
  );
  const elsewhere = pool.filter(
    (entry) => entry.continent !== correct.continent && valueOf(entry) !== valueOf(correct),
  );

  const distractors = [];
  const seen = new Set([valueOf(correct)]);

  for (const candidate of [...rng.shuffle(sameContinent), ...rng.shuffle(elsewhere)]) {
    if (distractors.length >= CHOICE_COUNT - 1) break;
    const value = valueOf(candidate);
    if (seen.has(value)) continue;
    seen.add(value);
    distractors.push(value);
  }

  return rng.shuffle([valueOf(correct), ...distractors]);
}

function buildContinentChoices(rng, correct, pool) {
  const continents = [...new Set(pool.map((entry) => entry.continent))];
  const others = rng.shuffle(continents.filter((name) => name !== correct.continent));
  return rng.shuffle([correct.continent, ...others.slice(0, CHOICE_COUNT - 1)]);
}

/**
 * Build one prompt.
 * @param {object} rng
 * @param {Array} pool
 * @param {string} categoryId
 * @param {boolean} freeText expert bands answer by typing (FR-112)
 */
export function buildPrompt(rng, pool, categoryId, freeText) {
  const subject = rng.pick(pool);

  const specs = {
    'country-capital': {
      question: `What is the capital of ${subject.name}?`,
      answer: subject.capital,
      valueOf: (entry) => entry.capital,
      alternatives: [],
    },
    'capital-country': {
      question: `${subject.capital} is the capital of which country?`,
      answer: subject.name,
      valueOf: (entry) => entry.name,
      alternatives: subject.alternatives,
    },
    'flag-country': {
      question: 'Which country does this flag belong to?',
      answer: subject.name,
      valueOf: (entry) => entry.name,
      alternatives: subject.alternatives,
      flag: subject.flag,
    },
    'country-continent': {
      question: `Which continent is ${subject.name} in?`,
      answer: subject.continent,
      valueOf: (entry) => entry.continent,
      alternatives: [],
    },
  };

  const spec = specs[categoryId];

  const prompt = {
    key: `${categoryId}:${subject.name}`,
    categoryId,
    categoryLabel: CATEGORIES[categoryId],
    question: spec.question,
    answer: spec.answer,
    alternatives: spec.alternatives,
    flag: spec.flag ?? null,
  };

  // Continent prompts stay multiple choice even at expert: free-typing one of
  // six fixed continents tests spelling, not geography.
  if (freeText && categoryId !== 'country-continent') {
    return { ...prompt, kind: 'text' };
  }

  const choices =
    categoryId === 'country-continent'
      ? buildContinentChoices(rng, subject, pool)
      : buildChoices(rng, subject, pool, spec.valueOf);

  return { ...prompt, kind: 'choice', choices };
}

export function createGeographyTrainer(rawContent, logger = console) {
  const countries = validateCountries(rawContent, logger);

  return {
    id: 'geography',
    name: 'Geography Speed',
    description: 'Capitals, countries, flags and continents. Three mistakes allowed.',
    roundMode: 'lives',
    headlineScore: 'correct',
    renderer: 'choice',
    supportsCategories: true,
    scoreLabel: 'Correct answers',
    available: countries.length >= CHOICE_COUNT,

    /** Three lives, always (FR-109). */
    modeParam() {
      return 3;
    },

    describeMode() {
      return '3 lives — one mistake costs a life';
    },

    createGenerator({ puzzleDate, difficulty }) {
      const rng = createRng(seedFor(this.id, puzzleDate));
      const maxTier = MAX_TIER_BY_BAND[difficulty];
      const pool = countries.filter((entry) => entry.tier <= maxTier);
      const freeText = difficulty === 'expert';
      const categoryIds = Object.keys(CATEGORIES);

      return {
        next() {
          if (pool.length < CHOICE_COUNT) return null;
          const categoryId = rng.pick(categoryIds);
          return buildPrompt(rng, pool, categoryId, freeText);
        },
      };
    },
  };
}
