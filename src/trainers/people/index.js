/**
 * Famous People — the People category's guessing trainer.
 *
 * A clue, three lives, and fifteen people a day. Pick the category before you
 * start: Everything, or just music, film, sport, science or history. Each
 * category is its own daily puzzle with its own record, which is what the
 * `pool` variant axis is for.
 *
 * Answers are free text rather than multiple choice. With four options a clue
 * this specific would give itself away, and the whole point of "you get to see
 * the name" after a wrong guess is that you did not already have it in front
 * of you.
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';

/** Fifteen people a day, as the round length. */
export const PEOPLE_PER_ROUND = 15;

const LIVES = 3;

/**
 * Names with a lowercase particle get no automatic surname.
 *
 * "Leonardo da Vinci" would otherwise accept "Vinci" and "Alexander the Great"
 * would accept "Great", which is not a name anybody would offer.
 */
function autoShortForms(name) {
  const tokens = name.split(' ').filter(Boolean);
  if (tokens.length < 2) return [];
  if (tokens.some((token, index) => index > 0 && token === token.toLocaleLowerCase() && /^[a-zà-ÿ]+$/i.test(token) && token[0] === token[0].toLocaleLowerCase())) {
    return [];
  }
  const withoutSuffix = tokens.filter((token) => !/^(jr\.?|sr\.?|i{1,3}|iv|v)$/i.test(token));
  const surname = withoutSuffix[withoutSuffix.length - 1];
  return surname && surname.length >= 3 ? [surname] : [];
}

/**
 * Validate the content file, skipping malformed entries rather than crashing
 * the trainer (FR-136).
 * @param {unknown} raw
 * @param {{warn: Function}} [logger]
 */
export function validatePeople(raw, logger = console) {
  const list = Array.isArray(raw) ? raw : raw?.people;
  const categories = raw?.categories ?? {};
  if (!Array.isArray(list)) {
    logger.warn('[people] Content file has no people array; trainer will be unavailable.');
    return { people: [], categories };
  }

  const people = [];
  for (const [index, entry] of list.entries()) {
    const problems = [];
    if (typeof entry?.name !== 'string' || entry.name.trim() === '') problems.push('name');
    if (typeof entry?.clue !== 'string' || entry.clue.trim() === '') problems.push('clue');
    if (typeof entry?.category !== 'string' || !categories[entry.category]) problems.push('category');

    if (problems.length > 0) {
      logger.warn(`[people] Skipping entry ${index}: invalid ${problems.join(', ')}.`);
      continue;
    }

    // A clue that contains the answer gives the game away.
    if (entry.clue.toLocaleLowerCase().includes(entry.name.toLocaleLowerCase())) {
      logger.warn(`[people] Skipping "${entry.name}": the clue contains the answer.`);
      continue;
    }

    people.push({
      name: entry.name,
      category: entry.category,
      categoryLabel: categories[entry.category],
      clue: entry.clue,
      alternatives: [...(entry.accept ?? []), ...autoShortForms(entry.name)],
    });
  }

  return { people, categories };
}

/** The people a variant draws from; `all` means every category. */
export function poolFor(people, variantKey) {
  return variantKey === 'all' ? people : people.filter((entry) => entry.category === variantKey);
}

/**
 * @param {{people: Array, categories: Record<string, string>}} content
 * @param {{portraits: Record<string, object>}} [portraits] credits file
 * @param {string} [portraitBase] URL prefix for the image files
 */
export function createFamousPeopleTrainer({ people, categories }, portraits = null, portraitBase = '') {
  const categoryKeys = Object.keys(categories);
  const credits = portraits?.portraits ?? {};

  return {
    id: 'famous-people',
    categoryId: 'people',
    name: 'Famous People',
    description:
      'Fifteen clues, fifteen people. Three lives — guess wrong and you find out who it was before moving on.',
    roundMode: 'lives',
    variantKind: 'pool',
    variants: ['all', ...categoryKeys],
    scoreDirection: 'higher',
    headlineScore: 'correct',
    renderer: 'portrait',
    scoreLabel: 'Correct answers',
    modeParam: LIVES,
    topics: categoryKeys.map((id) => ({ id, label: categories[id] })),
    variantLabels: { all: 'Everything', ...categories },

    practiceFilters: {
      categories: {
        label: 'Categories',
        kind: 'multi',
        options: categoryKeys.map((id) => ({ id, label: categories[id] })),
        default: categoryKeys,
      },
    },

    validateFilters(filters) {
      const chosen = filters?.categories ?? [];
      if (chosen.length === 0) {
        return { ok: false, reason: 'Pick at least one category to practise.' };
      }
      return { ok: true };
    },

    createGenerator({ puzzleDate, variantKey, practice = false, filters = null }) {
      const rng = createRng(practice ? practiceSeed() : seedFor(this.id, variantKey, puzzleDate));

      let pool = poolFor(people, variantKey);
      if (practice && Array.isArray(filters?.categories)) {
        const allowed = new Set(filters.categories);
        pool = people.filter((entry) => allowed.has(entry.category));
      }

      // The day's fifteen are drawn up front so nobody appears twice in a round.
      const order = rng.shuffle(pool).slice(0, PEOPLE_PER_ROUND);
      let index = 0;

      return {
        next() {
          if (index >= order.length) return null;
          const subject = order[index];
          index += 1;
          const credit = credits[subject.name] ?? null;

          return {
            kind: 'text',
            key: `person:${subject.name}`,
            topicId: subject.category,
            topicLabel: subject.categoryLabel,
            question: subject.clue,
            prefix: 'Who is this?',
            // A handful of people have no freely licensed portrait, so the clue
            // has to carry the round on its own.
            image: credit ? `${portraitBase}${credit.file}` : null,
            imageCredit: credit
              ? { artist: credit.artist, licence: credit.licence, source: credit.source }
              : null,
            answer: subject.name,
            alternatives: subject.alternatives,
            formatHint: 'Type the name. A surname on its own is usually enough.',
          };
        },
      };
    },
  };
}
