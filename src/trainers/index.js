/**
 * Category and trainer registration.
 *
 * The one place that knows the full catalogue. src/core/ imports nothing from
 * here, which is what keeps FR-7 honest: adding a trainer means editing this
 * file and adding a module, never touching the engine.
 */

import { createRegistry } from '../core/registry.js';
import { mentalMathTrainer } from './math/mental-math.js';
import { patternMemoryTrainer } from './memory/pattern.js';
import { figurePairsTrainer } from './memory/pairs.js';
import { validateCountries } from './geography/content.js';
import {
  createBorderHopTrainer,
  createCapitalTrainer,
  createFlagTrainer,
  createOutlineTrainer,
} from './geography/index.js';
import { createFamousPeopleTrainer, validatePeople } from './people/index.js';
import { createWordRushTrainer } from './word-rush/index.js';
import { createWordChainTrainer } from './word-chain/index.js';
import { timelineSortTrainer } from './timeline/index.js';
import { connectionGridTrainer } from './connections/index.js';

export const CATEGORIES = [
  {
    id: 'word-rush',
    name: 'Word Rush',
    tagline: '2 minutes. Daily category & starting letter. Name as many as you can.',
    icon: '⚡',
  },
  {
    id: 'word-chain',
    name: 'Word Chain',
    tagline: '90-second last-letter word relay. Chain words together without repeating.',
    icon: '⛓',
  },
  {
    id: 'timeline-sort',
    name: 'Timeline Sort',
    tagline: 'Place historical milestones, inventions and releases in chronological order.',
    icon: '⏳',
  },
  {
    id: 'connection-grid',
    name: 'ConnectionGrid',
    tagline: 'Group 16 words into 4 hidden categories of 4 before running out of lives.',
    icon: '⊞',
  },
  {
    id: 'math',
    name: 'Math Blitz',
    tagline: '3 lives, 20 seconds per question. Escalating arithmetic, algebra & trig streak.',
    icon: '∑',
  },
  {
    id: 'pattern-memory',
    name: 'Pattern Memory',
    tagline: '1 daily run, zero mistakes allowed. Daily grid size varies — memorize as many levels as possible.',
    icon: '◧',
  },
  {
    id: 'figure-pairs',
    name: 'Figure Pairs',
    tagline: '1 daily run. Daily board size varies — match every figure pair in as few attempts as possible.',
    icon: '🎴',
  },
  {
    id: 'flag-guesser',
    name: 'Flag Guesser',
    tagline: '1 daily flag with 3 lives. Difficulty varies each day across all 195 countries.',
    icon: '🏳',
  },
  {
    id: 'outline-guesser',
    name: 'Country Guesser',
    tagline: '1 daily country outline with 6 lives. Distance & compass hints guide each guess.',
    icon: '🗺',
  },
  {
    id: 'capital-guesser',
    name: 'Capital Guesser',
    tagline: '1 daily capital city photo. Wrong guesses unlock closest city, fun fact & country hints.',
    icon: '🏛',
  },
  {
    id: 'border-hop',
    name: 'Border Hop',
    tagline: '1 daily overland route with 3 lives. Connect the start and destination country outlines.',
    icon: '🧭',
  },
  {
    id: 'people',
    name: 'People Guesser',
    tagline: 'One daily run across music, film, sport, science & history. 3 lives — how many people can you guess?',
    icon: '☺',
  },
];

/**
 * Build the registry.
 *
 * @param {object} content
 * @param {unknown} content.countries parsed countries.json
 * @param {object} content.outlines parsed outlines.json
 * @param {unknown} content.people parsed people.json
 * @param {{warn: Function}} [logger]
 */
export function buildRegistry({ countries, outlines, people, portraits, portraitBase = '' }, logger = console) {
  const registry = createRegistry();
  for (const category of CATEGORIES) registry.registerCategory(category);

  const validated = validateCountries(countries, logger);
  const validatedPeople = people ? validatePeople(people, logger) : { people: [], categories: {} };

  registry.registerTrainer(
    createWordRushTrainer({
      countries: validated,
      people: validatedPeople.people,
    }),
  );

  registry.registerTrainer(
    createWordChainTrainer({
      countries: validated,
      people: validatedPeople.people,
    }),
  );

  registry.registerTrainer(timelineSortTrainer);
  registry.registerTrainer(connectionGridTrainer);

  registry.registerTrainer(mentalMathTrainer);
  registry.registerTrainer(patternMemoryTrainer);
  registry.registerTrainer(figurePairsTrainer);

  // Geography trainers close over the shared content, so they are built rather
  // than declared.
  registry.registerTrainer(createFlagTrainer(validated));
  registry.registerTrainer(createOutlineTrainer(validated, outlines));
  registry.registerTrainer(createCapitalTrainer(validated));
  registry.registerTrainer(createBorderHopTrainer(validated, outlines));

  if (people) {
    registry.registerTrainer(
      createFamousPeopleTrainer(validatedPeople, portraits, portraitBase),
    );
  }

  return registry;
}
