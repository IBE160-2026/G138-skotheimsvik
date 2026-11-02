/**
 * The three Geography trainers: flags, outlines and capitals.
 *
 * FR-140 to FR-155. They share one content file and one set of band rules, and
 * differ only in what they show and what they ask — which is exactly the test
 * of whether the engine abstraction holds (S21): all three were added without
 * touching a single file in src/core/.
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';
import { buildChoices, continentsIn, poolFor, usesChoices } from './content.js';
import { describeGuess } from './geo.js';

const LIVES = 3;

/** Shared practice filters: all three ask about the same countries. */
function geographyFilters(continents) {
  return {
    continents: {
      label: 'Continents',
      kind: 'multi',
      options: continents.map((id) => ({ id, label: id })),
      default: continents,
    },
    answerFormat: {
      label: 'Answer format',
      kind: 'single',
      options: [
        { id: 'choice', label: 'Multiple choice' },
        { id: 'text', label: 'Type the answer' },
      ],
      default: 'choice',
    },
  };
}

function baseTrainer(countries) {
  return {
    categoryId: 'geography',
    roundMode: 'lives',
    variantKind: 'band',
    scoreDirection: 'higher',
    headlineScore: 'correct',
    scoreLabel: 'Correct answers',
    modeParam: LIVES,
    practiceFilters: geographyFilters(continentsIn(countries)),

    validateFilters(filters) {
      const chosen = filters?.continents ?? [];
      if (chosen.length === 0) {
        return { ok: false, reason: 'Pick at least one continent to practise.' };
      }
      return { ok: true };
    },
  };
}

/** Pick the round's subject and decide how it will be answered. */
function prepare({ rng, countries, variantKey, practice, filters }) {
  const pool = poolFor(countries, variantKey, practice ? filters : null);
  if (pool.length < 4) return null;
  return {
    pool,
    subject: rng.pick(pool),
    choices: usesChoices(variantKey, practice ? filters : null),
  };
}

function makeRng(trainerId, { puzzleDate, variantKey, practice }) {
  return createRng(practice ? practiceSeed() : seedFor(trainerId, variantKey, puzzleDate));
}

// --- Flag Guesser -----------------------------------------------------------

export function createFlagTrainer(countries) {
  return {
    ...baseTrainer(countries),
    id: 'flag-guesser',
    name: 'Flag Guesser',
    description: 'Identify the country from its flag. Three mistakes allowed.',
    renderer: 'flag',
    topics: continentsIn(countries).map((id) => ({ id, label: id })),

    createGenerator(context) {
      const rng = makeRng('flag-guesser', context);
      const { variantKey, practice = false, filters = null } = context;

      return {
        next() {
          const setup = prepare({ rng, countries, variantKey, practice, filters });
          if (!setup) return null;
          const { pool, subject, choices } = setup;

          return {
            kind: choices ? 'choice' : 'text',
            key: `flag:${subject.code}`,
            topicId: subject.continent,
            topicLabel: subject.continent,
            question: 'Which country does this flag belong to?',
            flag: subject.flag,
            answer: subject.name,
            alternatives: subject.alternatives,
            options: choices ? buildChoices(rng, pool, subject, (entry) => entry.name) : null,
          };
        },
      };
    },
  };
}

// --- Outline Guesser --------------------------------------------------------

export function createOutlineTrainer(countries, outlines) {
  // Only countries with a silhouette can be asked here (FR-135b).
  const withOutline = countries.filter((entry) => outlines.outlines?.[entry.name]);
  const byName = new Map(countries.map((entry) => [entry.name, entry]));
  const normalise = (value) => String(value ?? '').trim().toLocaleLowerCase();

  return {
    ...baseTrainer(withOutline),
    id: 'outline-guesser',
    name: 'Outline Guesser',
    description: 'Identify the country from its shape. Wrong guesses tell you how far off you are.',
    renderer: 'outline',
    topics: continentsIn(withOutline).map((id) => ({ id, label: id })),

    /**
     * Distance, direction and proximity for a wrong guess (FR-148 to FR-150).
     * Returns null when the guess is not a country we recognise.
     */
    hintFor(guessName, answerName) {
      const guess = [...byName.values()].find(
        (entry) =>
          normalise(entry.name) === normalise(guessName) ||
          entry.alternatives.some((alt) => normalise(alt) === normalise(guessName)),
      );
      const target = byName.get(answerName);
      const guessCentroid = guess && outlines.outlines?.[guess.name]?.centroid;
      const targetCentroid = target && outlines.outlines?.[target.name]?.centroid;
      if (!guessCentroid || !targetCentroid) return null;
      return { guess: guess.name, ...describeGuess(guessCentroid, targetCentroid) };
    },

    createGenerator(context) {
      const rng = makeRng('outline-guesser', context);
      const { variantKey, practice = false, filters = null } = context;

      return {
        next() {
          const setup = prepare({ rng, countries: withOutline, variantKey, practice, filters });
          if (!setup) return null;
          const { pool, subject, choices } = setup;
          const outline = outlines.outlines[subject.name];

          return {
            kind: choices ? 'choice' : 'text',
            key: `outline:${subject.code}`,
            topicId: subject.continent,
            topicLabel: subject.continent,
            question: 'Which country has this shape?',
            outline: outline.d,
            viewBox: outlines.viewBox,
            answer: subject.name,
            alternatives: subject.alternatives,
            options: choices ? buildChoices(rng, pool, subject, (entry) => entry.name) : null,
            // Hints only make sense where the player types a country name (FR-152).
            hintable: !choices,
          };
        },
      };
    },
  };
}

// --- Capital Guesser --------------------------------------------------------

export function createCapitalTrainer(countries) {
  return {
    ...baseTrainer(countries),
    id: 'capital-guesser',
    name: 'Capital Guesser',
    description: 'Name the capital, or the country it belongs to. Three mistakes allowed.',
    renderer: 'prompt',
    topics: [
      { id: 'country-capital', label: 'Country → capital' },
      { id: 'capital-country', label: 'Capital → country' },
    ],

    createGenerator(context) {
      const rng = makeRng('capital-guesser', context);
      const { variantKey, practice = false, filters = null } = context;

      return {
        next() {
          const setup = prepare({ rng, countries, variantKey, practice, filters });
          if (!setup) return null;
          const { pool, subject, choices } = setup;

          // Both directions appear, as separate topics (FR-153, FR-154).
          if (rng.float() < 0.5) {
            return {
              kind: choices ? 'choice' : 'text',
              key: `capital-of:${subject.code}`,
              topicId: 'country-capital',
              topicLabel: 'Country → capital',
              question: `What is the capital of ${subject.name}?`,
              answer: subject.capital,
              options: choices ? buildChoices(rng, pool, subject, (entry) => entry.capital) : null,
            };
          }

          return {
            kind: choices ? 'choice' : 'text',
            key: `country-of:${subject.code}`,
            topicId: 'capital-country',
            topicLabel: 'Capital → country',
            question: `${subject.capital} is the capital of which country?`,
            answer: subject.name,
            alternatives: subject.alternatives,
            options: choices ? buildChoices(rng, pool, subject, (entry) => entry.name) : null,
          };
        },
      };
    },
  };
}
