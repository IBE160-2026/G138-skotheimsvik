/**
 * The three Geography trainers: flags, outlines and capitals.
 *
 * FR-140 to FR-155. They share one content file and one set of band rules, and
 * differ only in what they show and what they ask — which is exactly the test
 * of whether the engine abstraction holds (S21): all three were added without
 * touching a single file in src/core/.
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';
import { normaliseText } from '../../core/answer.js';
import { buildChoices, continentsIn, poolFor, usesChoices } from './content.js';
import { describeGuess } from './geo.js';
import { buildBorderGraph, findShortestBorderPath, findRoutePairs } from './borders.js';

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
  const countrySuggestions = countries.map((entry) => ({
    label: entry.name,
    alternatives: entry.alternatives ?? [],
  }));

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
            code: subject.code,
            answer: subject.name,
            alternatives: subject.alternatives,
            suggestions: choices ? null : countrySuggestions,
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
  const countrySuggestions = countries.map((entry) => ({
    label: entry.name,
    alternatives: entry.alternatives ?? [],
  }));

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
            suggestions: choices ? null : countrySuggestions,
            options: choices ? buildChoices(rng, pool, subject, (entry) => entry.name) : null,
            // Hints only make sense where the player types a country name (FR-152),
            // and only help if there is another guess left to spend on them.
            hintable: !choices,
            maxGuesses: choices ? 1 : 3,
          };
        },
      };
    },
  };
}

// --- Capital Guesser --------------------------------------------------------

export function createCapitalTrainer(countries) {
  const countrySuggestions = countries.map((entry) => ({
    label: entry.name,
    alternatives: entry.alternatives ?? [],
  }));
  const capitalSuggestions = countries.map((entry) => ({
    label: entry.capital,
    alternatives: [],
  }));

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
              suggestions: choices ? null : capitalSuggestions,
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
            suggestions: choices ? null : countrySuggestions,
            options: choices ? buildChoices(rng, pool, subject, (entry) => entry.name) : null,
          };
        },
      };
    },
  };
}

// --- Border Hop -------------------------------------------------------------

const HOP_RANGE_BY_BAND = Object.freeze({
  beginner: [1, 1],
  intermediate: [1, 2],
  advanced: [2, 3],
  expert: [2, 4],
});

export function createBorderHopTrainer(countries, outlines) {
  const validCountryNames = new Set(countries.map((c) => c.name));
  const byName = new Map(countries.map((c) => [c.name, c]));
  const graph = buildBorderGraph(validCountryNames);
  const countrySuggestions = countries
    .filter((entry) => graph.has(entry.name))
    .map((entry) => ({
      label: entry.name,
      alternatives: entry.alternatives ?? [],
    }));

  // Resolve any country name or alias to canonical country name in the border graph
  function resolveCountryName(input) {
    const norm = normaliseText(input);
    if (!norm) return null;
    for (const c of countries) {
      if (!graph.has(c.name)) continue;
      if (normaliseText(c.name) === norm) return c.name;
      if ((c.alternatives ?? []).some((alt) => normaliseText(alt) === norm)) {
        return c.name;
      }
    }
    return null;
  }

  return {
    ...baseTrainer(countries),
    id: 'border-hop',
    name: 'Border Hop',
    description:
      'Travel overland from the starting country to the target country by naming bordering countries step by step.',
    renderer: 'border-hop',
    scoreLabel: 'Border hops',
    topics: continentsIn(countries).map((id) => ({ id, label: id })),

    createGenerator(context) {
      const rng = makeRng('border-hop', context);
      const { variantKey = 'beginner', practice = false, filters = null } = context;
      const [minInter, maxInter] = HOP_RANGE_BY_BAND[variantKey] ?? [1, 2];

      let routePairs = findRoutePairs(graph, minInter, maxInter);
      if (practice && Array.isArray(filters?.continents) && filters.continents.length > 0) {
        const allowed = new Set(filters.continents);
        const filtered = routePairs.filter((pair) => {
          const s = byName.get(pair.start);
          const t = byName.get(pair.target);
          return s && t && (allowed.has(s.continent) || allowed.has(t.continent));
        });
        if (filtered.length > 0) routePairs = filtered;
      }

      let activeRoute = null;
      let pathTaken = [];

      function startNewRoute() {
        if (routePairs.length === 0) return false;
        const picked = rng.pick(routePairs);
        const swap = rng.float() < 0.5;
        const start = swap ? picked.target : picked.start;
        const target = swap ? picked.start : picked.target;
        const shortest = findShortestBorderPath(graph, start, target) ?? [start, target];
        activeRoute = {
          start,
          target,
          optimalSteps: shortest.length - 1,
        };
        pathTaken = [start];
        return true;
      }

      return {
        next(turnContext) {
          if (turnContext?.lastCorrect && turnContext?.lastSubmission && activeRoute) {
            const resolved = resolveCountryName(turnContext.lastSubmission);
            if (resolved && resolved !== pathTaken[pathTaken.length - 1]) {
              pathTaken.push(resolved);
            }
          }

          const current = pathTaken[pathTaken.length - 1];
          // Check if the previous step reached a neighbor of target (or target itself)
          if (!activeRoute || current === activeRoute.target) {
            if (!startNewRoute()) return null;
          } else {
            const currentNeighbors = graph.get(current) ?? new Set();
            if (currentNeighbors.has(activeRoute.target)) {
              // Automatically complete the route and start a fresh one!
              if (!startNewRoute()) return null;
            }
          }

          const currentCountry = pathTaken[pathTaken.length - 1];
          const visited = new Set(pathTaken);
          const neighbors = [...(graph.get(currentCountry) ?? [])].filter(
            (n) => !visited.has(n) && n !== activeRoute.target,
          );

          // If player walked into a dead-end peninsula with no unvisited neighbors, allow all neighbors
          const validNextCountries =
            neighbors.length > 0
              ? neighbors
              : [...(graph.get(currentCountry) ?? [])].filter((n) => n !== activeRoute.target);

          const remainingShortest =
            findShortestBorderPath(graph, currentCountry, activeRoute.target) ?? [
              currentCountry,
              activeRoute.target,
            ];
          const optimalNext = remainingShortest[1] ?? validNextCountries[0] ?? activeRoute.target;

          const startMeta = byName.get(activeRoute.start);
          const targetMeta = byName.get(activeRoute.target);
          const currentMeta = byName.get(currentCountry);

          // Build accepted answers: any valid bordering country (and its aliases)
          const acceptedNames = [];
          for (const name of validNextCountries) {
            acceptedNames.push(name);
            const meta = byName.get(name);
            if (meta?.alternatives) acceptedNames.push(...meta.alternatives);
          }

          return {
            kind: 'border-hop',
            key: `border-hop:${activeRoute.start}->${activeRoute.target}:${pathTaken.length}:${turnContext?.index ?? 0}`,
            topicId: startMeta?.continent ?? 'Europe',
            topicLabel: `${activeRoute.start} → ${activeRoute.target}`,
            question: `Connect ${activeRoute.start} to ${activeRoute.target} overland`,
            startCountry: activeRoute.start,
            targetCountry: activeRoute.target,
            currentCountry,
            startCode: startMeta?.code ?? '',
            targetCode: targetMeta?.code ?? '',
            currentCode: currentMeta?.code ?? '',
            startOutline: outlines?.outlines?.[activeRoute.start]?.d ?? null,
            targetOutline: outlines?.outlines?.[activeRoute.target]?.d ?? null,
            viewBox: outlines?.viewBox ?? '0 0 200 200',
            pathTaken: [...pathTaken],
            optimalSteps: activeRoute.optimalSteps,
            optimalNext,
            validNextCountries,
            answer: optimalNext,
            displayAnswer: `One of: ${validNextCountries.slice(0, 4).join(', ')}`,
            alternatives: acceptedNames,
            suggestions: countrySuggestions,
          };
        },
      };
    },
  };
}
