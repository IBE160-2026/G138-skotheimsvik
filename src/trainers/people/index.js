/**
 * People Guesser — the People category's daily guessing trainer.
 *
 * One daily run combining all categories. You get three lives: guess wrong and
 * you see who the person was before moving on to the next person. When you run
 * out of lives, your score is how many people you managed to guess.
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';

/** Kept for backwards-compatible imports. */
export const PEOPLE_PER_ROUND = 15;
export const PERSON_TIME_LIMIT_SECONDS = 30;

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
      pageimage: typeof entry.pageimage === 'string' && entry.pageimage.trim() ? entry.pageimage.trim() : null,
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
 * Resolve a portrait image URL for a person:
 * 1. Local bundled WebP in `src/trainers/people/portraits/` if available in `portraits.json`
 * 2. Wikimedia Commons `Special:FilePath` thumbnail using the person's `pageimage`
 * 3. Deterministic monogram SVG data URI as an unbreakable fallback
 */
export function resolvePersonPortrait(subject, credit, portraitBase = '') {
  if (credit?.file) {
    return `${portraitBase}${credit.file}`;
  }
  if (subject?.pageimage) {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(subject.pageimage)}?width=400`;
  }
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(subject.name.replace(/\s+/g, '_'))}.jpg?width=400`;
}

/**
 * @param {{people: Array, categories: Record<string, string>}} content
 * @param {{portraits: Record<string, object>}} [portraits] credits file
 * @param {string} [portraitBase] URL prefix for the image files
 */
export function createFamousPeopleTrainer({ people, categories }, portraits = null, portraitBase = '') {
  const categoryKeys = Object.keys(categories);
  const credits = portraits?.portraits ?? {};
  const peopleSuggestions = people.map((entry) => ({
    label: entry.name,
    alternatives: entry.alternatives ?? [],
  }));

  return {
    id: 'famous-people',
    categoryId: 'people',
    name: 'People Guesser',
    description:
      'One daily run across all categories. 30 seconds per person and 3 lives — guess wrong or run out of time and you find out who the person was before moving on to the next person!',
    roundMode: 'lives',
    variantKind: 'pool',
    variants: ['all'],
    noPractice: true,
    scoreDirection: 'higher',
    headlineScore: 'correct',
    renderer: 'portrait',
    scoreLabel: 'People guessed',
    modeParam: LIVES,
    promptTimeLimitSeconds: PERSON_TIME_LIMIT_SECONDS,
    topics: categoryKeys.map((id) => ({ id, label: categories[id] })),
    variantLabels: { all: 'Daily Challenge (All Categories)', ...categories },

    createGenerator({ puzzleDate, variantKey, practice = false, filters = null }) {
      const rng = createRng(practice ? practiceSeed() : seedFor(this.id, variantKey, puzzleDate));

      let pool = poolFor(people, variantKey);
      if (practice && Array.isArray(filters?.categories)) {
        const allowed = new Set(filters.categories);
        pool = people.filter((entry) => allowed.has(entry.category));
      }

      // Shuffle the full pool so the player can keep guessing until losing all 3 lives.
      const order = rng.shuffle(pool);
      let index = 0;

      return {
        next() {
          if (index >= order.length) return null;
          const subject = order[index];
          index += 1;
          const credit = credits[subject.name] ?? null;
          const imageUrl = resolvePersonPortrait(subject, credit, portraitBase);

          return {
            kind: 'text',
            personName: subject.name,
            pageimage: subject.pageimage ?? null,
            key: `person:${subject.name}`,
            topicId: subject.category,
            topicLabel: subject.categoryLabel,
            question: subject.clue,
            prefix: 'Who is this?',
            image: imageUrl,
            imageCredit: credit
              ? { artist: credit.artist, licence: credit.licence, source: credit.source }
              : {
                  artist: 'Wikimedia Commons',
                  licence: 'CC / Public Domain',
                  source: `https://en.wikipedia.org/wiki/${encodeURIComponent(subject.name.replace(/\s+/g, '_'))}`,
                },
            answer: subject.name,
            alternatives: subject.alternatives,
            suggestions: peopleSuggestions,
            formatHint: 'Type the name. Autocomplete helps you find and spell any person.',
          };
        },
      };
    },
  };
}
