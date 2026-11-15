/**
 * The four standalone Geography trainers:
 *   1. Flag Guesser (flag-guesser): 1 daily flag, 3 lives, difficulty varies by day.
 *   2. Country Guesser (outline-guesser): 1 daily country outline, 6 lives, distance/direction hints on wrong guess, difficulty varies by day.
 *   3. Capital Guesser (capital-guesser): 1 daily capital with a city photo at start, 3 progressive hints on wrong guesses (1: closest other city in same country, 2: fun fact about the city, 3: country name) + 1 final guess, difficulty varies by day.
 *   4. Border Hop (border-hop): 1 daily overland route, 3 lives, displays outlines for both the starting country and endpoint country, difficulty varies by day.
 *
 * All four are 1 attempt per day with no practice mode.
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';
import { normaliseText } from '../../core/answer.js';
import { continentsIn } from './content.js';
import { describeGuess } from './geo.js';
import { buildBorderGraph, findShortestBorderPath, findRoutePairs } from './borders.js';
import { CAPITAL_HINTS } from './capitals-data.js';

const DIFFICULTY_LABELS = Object.freeze({
  1: 'Easy',
  2: 'Medium',
  3: 'Hard',
});

function makeRng(trainerId, { puzzleDate, variantKey = 'daily', practice = false }) {
  return createRng(practice ? practiceSeed() : seedFor(trainerId, variantKey, puzzleDate));
}

/**
 * Pick a daily country whose difficulty (tier 1, 2 or 3) varies deterministically by day.
 */
function pickDailyCountry(rng, countries) {
  if (!countries || countries.length === 0) return null;
  const targetTier = rng.pick([1, 2, 3]);
  const tierPool = countries.filter((entry) => entry.tier === targetTier);
  return rng.pick(tierPool.length > 0 ? tierPool : countries);
}

// --- 1. Flag Guesser --------------------------------------------------------

export function createFlagTrainer(countries) {
  const countrySuggestions = countries.map((entry) => ({
    label: entry.name,
    alternatives: entry.alternatives ?? [],
  }));

  return {
    id: 'flag-guesser',
    categoryId: 'flag-guesser',
    name: 'Flag Guesser',
    description:
      'One daily flag with 3 lives. Difficulty varies each day from well-known nations to rare island states — identify today’s flag before you run out of lives!',
    roundMode: 'lives',
    modeParam: 3,
    variantKind: 'pool',
    variants: ['daily'],
    variantLabels: {
      daily: 'Daily Flag Challenge',
    },
    noPractice: true,
    scoreDirection: 'higher',
    headlineScore: 'correct',
    scoreLabel: 'Solved',
    renderer: 'flag',
    topics: continentsIn(countries).map((id) => ({ id, label: id })),

    createGenerator(context) {
      const rng = makeRng('flag-guesser', context);
      const subject = pickDailyCountry(rng, countries);
      let solved = false;

      return {
        next(turnContext) {
          if (!subject) return null;
          if (turnContext?.lastCorrect || solved) {
            solved = true;
            return null;
          }

          const difficultyLabel = DIFFICULTY_LABELS[subject.tier] ?? 'Medium';
          return {
            kind: 'text',
            key: `flag:${subject.code}`,
            topicId: subject.continent,
            topicLabel: subject.continent,
            difficultyLabel,
            question: 'Which country does this flag belong to?',
            flag: subject.flag,
            code: subject.code,
            answer: subject.name,
            alternatives: subject.alternatives,
            suggestions: countrySuggestions,
            stayOnWrongGuess: true,
            hideExpectedOnWrong: true,
          };
        },
      };
    },
  };
}

// --- 2. Country Guesser (formerly Outline Guesser) --------------------------

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
    id: 'outline-guesser',
    categoryId: 'outline-guesser',
    name: 'Country Guesser',
    description:
      'One daily country outline with 6 lives. Difficulty varies each day — every wrong guess reveals the distance and direction to today’s mystery country!',
    roundMode: 'lives',
    modeParam: 6,
    variantKind: 'pool',
    variants: ['daily'],
    variantLabels: {
      daily: 'Daily Country Outline',
    },
    noPractice: true,
    scoreDirection: 'higher',
    headlineScore: 'correct',
    scoreLabel: 'Solved',
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
      const subject = pickDailyCountry(rng, withOutline);
      let solved = false;

      return {
        next(turnContext) {
          if (!subject) return null;
          if (turnContext?.lastCorrect || solved) {
            solved = true;
            return null;
          }

          const outline = outlines.outlines[subject.name];
          const difficultyLabel = DIFFICULTY_LABELS[subject.tier] ?? 'Medium';

          return {
            kind: 'text',
            key: `outline:${subject.code}`,
            topicId: subject.continent,
            topicLabel: subject.continent,
            difficultyLabel,
            question: 'Which country has this shape?',
            outline: outline.d,
            viewBox: outlines.viewBox,
            answer: subject.name,
            alternatives: subject.alternatives,
            suggestions: countrySuggestions,
            hintable: true,
            stayOnWrongGuess: true,
            hideExpectedOnWrong: true,
          };
        },
      };
    },
  };
}

// --- 3. Capital Guesser -----------------------------------------------------

export function createCapitalTrainer(countries) {
  const capitalSuggestions = countries.map((entry) => ({
    label: entry.capital,
    alternatives: [],
  }));

  return {
    id: 'capital-guesser',
    categoryId: 'capital-guesser',
    name: 'Capital Guesser',
    description:
      'One daily capital city photo. Guess the capital (not the country)! Each mistake unlocks a progressive hint: 1st mistake reveals the closest other city in the same country, 2nd mistake reveals a fun fact about the city, and 3rd mistake reveals which country the capital belongs to for your final guess!',
    roundMode: 'lives',
    // 4 lives = 3 mistakes allowed (unlocking Hints 1, 2 and 3) + 1 final attempt with all 3 hints visible.
    modeParam: 4,
    variantKind: 'pool',
    variants: ['daily'],
    variantLabels: {
      daily: 'Daily Capital Challenge',
    },
    noPractice: true,
    scoreDirection: 'higher',
    headlineScore: 'correct',
    scoreLabel: 'Solved',
    renderer: 'capital',
    topics: continentsIn(countries).map((id) => ({ id, label: id })),

    createGenerator(context) {
      const rng = makeRng('capital-guesser', context);
      const subject = pickDailyCountry(rng, countries);
      let solved = false;

      return {
        next(turnContext) {
          if (!subject) return null;
          if (turnContext?.lastCorrect || solved) {
            solved = true;
            return null;
          }

          const meta = CAPITAL_HINTS[subject.name] ?? {
            city: `Another major city in ${subject.name}`,
            fact: `Serves as the national capital and cultural heart of its country in ${subject.continent}.`,
          };
          const difficultyLabel = DIFFICULTY_LABELS[subject.tier] ?? 'Medium';

          return {
            kind: 'text',
            key: `capital-of:${subject.code}`,
            topicId: subject.continent,
            topicLabel: subject.continent,
            difficultyLabel,
            question: 'Which capital city is pictured here?',
            formatHint: 'Guess the capital city — wrong guesses unlock up to 3 progressive clues.',
            answer: subject.capital,
            countryName: subject.name,
            countryCode: subject.code,
            capitalName: subject.capital,
            capitalHints: [
              {
                step: 1,
                label: 'Hint 1 · Closest / Major Other City in Country',
                text: meta.city,
              },
              {
                step: 2,
                label: 'Hint 2 · City Fun Fact',
                text: meta.fact,
              },
              {
                step: 3,
                label: 'Hint 3 · Country',
                text: subject.name,
              },
            ],
            suggestions: capitalSuggestions,
            stayOnWrongGuess: true,
            hideExpectedOnWrong: true,
          };
        },
      };
    },
  };
}

// --- 4. Border Hop ----------------------------------------------------------

const DAILY_HOP_RANGES = Object.freeze([
  { min: 1, max: 1, label: 'Easy (1 intermediate country)' },
  { min: 2, max: 2, label: 'Medium (2 intermediate countries)' },
  { min: 3, max: 4, label: 'Hard (3–4 intermediate countries)' },
]);

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
    id: 'border-hop',
    categoryId: 'border-hop',
    name: 'Border Hop',
    description:
      'One daily overland route with 3 lives. See the outlines of the starting country and destination country, then connect them step by step through bordering countries!',
    roundMode: 'lives',
    modeParam: 3,
    variantKind: 'pool',
    variants: ['daily'],
    variantLabels: {
      daily: 'Daily Border Route',
    },
    noPractice: true,
    scoreDirection: 'higher',
    headlineScore: 'correct',
    scoreLabel: 'Border hops',
    renderer: 'border-hop',
    topics: continentsIn(countries).map((id) => ({ id, label: id })),

    createGenerator(context) {
      const rng = makeRng('border-hop', context);
      const hopDifficulty = rng.pick(DAILY_HOP_RANGES);
      let routePairs = findRoutePairs(graph, hopDifficulty.min, hopDifficulty.max);
      if (routePairs.length === 0) {
        routePairs = findRoutePairs(graph, 1, 3);
      }

      let activeRoute = null;
      let pathTaken = [];
      let wrongGuesses = [];
      let routeCompleted = false;

      if (routePairs.length > 0) {
        const picked = rng.pick(routePairs);
        const swap = rng.float() < 0.5;
        const start = swap ? picked.target : picked.start;
        const target = swap ? picked.start : picked.target;
        const shortest = findShortestBorderPath(graph, start, target) ?? [start, target];
        activeRoute = {
          start,
          target,
          shortestPath: shortest,
          optimalSteps: shortest.length - 1,
          difficultyLabel: hopDifficulty.label,
        };
        pathTaken = [start];
      }

      return {
        next(turnContext) {
          if (!activeRoute || routeCompleted) return null;

          if (turnContext?.lastSubmission) {
            const resolved = resolveCountryName(turnContext.lastSubmission);
            if (turnContext.lastCorrect) {
              if (resolved && resolved !== pathTaken[pathTaken.length - 1]) {
                pathTaken.push(resolved);
                wrongGuesses = wrongGuesses.filter((n) => n !== resolved);
              }
            } else if (
              resolved &&
              resolved !== activeRoute.start &&
              resolved !== activeRoute.target &&
              !pathTaken.includes(resolved) &&
              !wrongGuesses.includes(resolved)
            ) {
              wrongGuesses.push(resolved);
            }
          }

          const current = pathTaken[pathTaken.length - 1];
          // Once the player reaches the target or a country that directly borders the target, today's route is solved!
          if (current === activeRoute.target) {
            routeCompleted = true;
            return null;
          }
          const currentNeighbors = graph.get(current) ?? new Set();
          if (currentNeighbors.has(activeRoute.target) && pathTaken.length > 1) {
            routeCompleted = true;
            return null;
          }

          const visited = new Set(pathTaken);
          const neighbors = [...(graph.get(current) ?? [])].filter(
            (n) => !visited.has(n) && n !== activeRoute.target,
          );

          // If player walked into a dead-end peninsula with no unvisited neighbors, allow all neighbors
          const validNextCountries =
            neighbors.length > 0
              ? neighbors
              : [...(graph.get(current) ?? [])].filter((n) => n !== activeRoute.target);

          const remainingShortest =
            findShortestBorderPath(graph, current, activeRoute.target) ?? [
              current,
              activeRoute.target,
            ];
          const optimalNext = remainingShortest[1] ?? validNextCountries[0] ?? activeRoute.target;

          const startMeta = byName.get(activeRoute.start);
          const targetMeta = byName.get(activeRoute.target);
          const currentMeta = byName.get(current);

          // Build accepted answers: any valid bordering country (and its aliases)
          const acceptedNames = [];
          for (const name of validNextCountries) {
            acceptedNames.push(name);
            const meta = byName.get(name);
            if (meta?.alternatives) acceptedNames.push(...meta.alternatives);
          }

          // Build the Travle-style live regional map viewBox & country geometries
          const mapFocusNames = new Set([
            ...(activeRoute.shortestPath ?? [activeRoute.start, activeRoute.target]),
            ...pathTaken,
            ...wrongGuesses,
          ]);
          let minLon = Infinity;
          let minLat = Infinity;
          let maxLon = -Infinity;
          let maxLat = -Infinity;
          for (const name of mapFocusNames) {
            const bbox = outlines?.outlines?.[name]?.bbox;
            if (Array.isArray(bbox) && bbox.length === 4) {
              if (bbox[0] < minLon) minLon = bbox[0];
              if (bbox[1] < minLat) minLat = bbox[1];
              if (bbox[2] > maxLon) maxLon = bbox[2];
              if (bbox[3] > maxLat) maxLat = bbox[3];
            }
          }
          if (!Number.isFinite(minLon)) {
            minLon = -20;
            minLat = -20;
            maxLon = 40;
            maxLat = 40;
          }
          const spanLon = Math.max(maxLon - minLon, 4);
          const spanLat = Math.max(maxLat - minLat, 4);
          const padX = Math.max(spanLon * 0.16, 1.8);
          const padY = Math.max(spanLat * 0.16, 1.8);
          const vbMinX = Number((minLon - padX).toFixed(2));
          const vbMinY = Number((-(maxLat + padY)).toFixed(2));
          const vbWidth = Number((spanLon + padX * 2).toFixed(2));
          const vbHeight = Number((spanLat + padY * 2).toFixed(2));
          const mapViewBox = `${vbMinX} ${vbMinY} ${vbWidth} ${vbHeight}`;

          const mapCountries = [];
          const addMapCountry = (countryName, role) => {
            const entry = outlines?.outlines?.[countryName];
            const meta = byName.get(countryName);
            if (!entry?.worldPath) return;
            mapCountries.push({
              name: countryName,
              code: meta?.code ?? '',
              role,
              worldPath: entry.worldPath,
              centroid: entry.centroid ?? null,
            });
          };

          for (const wrongName of wrongGuesses) {
            if (!pathTaken.includes(wrongName) && wrongName !== activeRoute.target) {
              addMapCountry(wrongName, 'wrong');
            }
          }
          for (let i = 0; i < pathTaken.length; i += 1) {
            const stepName = pathTaken[i];
            const role =
              i === 0
                ? 'start'
                : i === pathTaken.length - 1
                  ? 'current'
                  : 'step';
            addMapCountry(stepName, role);
          }
          addMapCountry(activeRoute.target, 'target');

          return {
            kind: 'border-hop',
            key: `border-hop:${activeRoute.start}->${activeRoute.target}:${pathTaken.length}:${turnContext?.index ?? 0}`,
            topicId: startMeta?.continent ?? 'Europe',
            topicLabel: `${activeRoute.start} → ${activeRoute.target}`,
            difficultyLabel: activeRoute.difficultyLabel,
            question: `Connect ${activeRoute.start} to ${activeRoute.target} overland`,
            startCountry: activeRoute.start,
            targetCountry: activeRoute.target,
            currentCountry: current,
            startCode: startMeta?.code ?? '',
            targetCode: targetMeta?.code ?? '',
            currentCode: currentMeta?.code ?? '',
            startOutline: outlines?.outlines?.[activeRoute.start]?.d ?? null,
            targetOutline: outlines?.outlines?.[activeRoute.target]?.d ?? null,
            currentOutline: outlines?.outlines?.[current]?.d ?? null,
            viewBox: outlines?.viewBox ?? '0 0 200 200',
            mapViewBox,
            mapCountries,
            wrongGuesses: [...wrongGuesses],
            pathTaken: [...pathTaken],
            optimalSteps: activeRoute.optimalSteps,
            optimalNext,
            validNextCountries,
            answer: optimalNext,
            displayAnswer: `One of: ${validNextCountries.slice(0, 4).join(', ')}`,
            alternatives: acceptedNames,
            suggestions: countrySuggestions,
            stayOnWrongGuess: true,
            hideExpectedOnWrong: true,
          };
        },
      };
    },
  };
}
