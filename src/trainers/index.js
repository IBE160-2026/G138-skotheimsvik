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
  createCapitalTrainer,
  createFlagTrainer,
  createOutlineTrainer,
} from './geography/index.js';
import { createFamousPeopleTrainer, validatePeople } from './people/index.js';

export const CATEGORIES = [
  {
    id: 'math',
    name: 'Math',
    tagline: 'Arithmetic you can actually use, from sums to algebra.',
    icon: '∑',
  },
  {
    id: 'memory',
    name: 'Memory',
    tagline: 'Patterns and pairs. No difficulty — just bigger boards.',
    icon: '◧',
  },
  {
    id: 'geography',
    name: 'Geography',
    tagline: 'Flags, shapes and capitals for all 195 countries.',
    icon: '◴',
  },
  {
    id: 'people',
    name: 'People',
    tagline: 'Fifteen clues a day. Music, film, sport, science or history.',
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

  registry.registerTrainer(mentalMathTrainer);
  registry.registerTrainer(patternMemoryTrainer);
  registry.registerTrainer(figurePairsTrainer);

  // Geography trainers close over the shared content, so they are built rather
  // than declared.
  registry.registerTrainer(createFlagTrainer(validated));
  registry.registerTrainer(createOutlineTrainer(validated, outlines));
  registry.registerTrainer(createCapitalTrainer(validated));

  registry.registerTrainer(
    createFamousPeopleTrainer(validatePeople(people, logger), portraits, portraitBase),
  );

  return registry;
}
