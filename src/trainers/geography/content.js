/**
 * Shared Geography content.
 *
 * All three Geography trainers draw from one validated country list (FR-135),
 * so a malformed entry is reported once rather than three times, and the band
 * pools behave identically across flags, outlines and capitals.
 */

/** Offset from 'A' to the Unicode regional indicator block. */
const REGIONAL_INDICATOR_A = 0x1f1e6;

/** Highest tier included per band (FR-137). */
export const MAX_TIER_BY_BAND = Object.freeze({
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 3,
});

/** Bands that answer by picking rather than typing (FR-138). */
export const CHOICE_BANDS = Object.freeze(['beginner', 'intermediate', 'advanced']);

export const CHOICE_COUNT = 4;

/**
 * The flag glyph for a country, built from its ISO 3166-1 alpha-2 code.
 *
 * Deriving it beats storing 195 emoji by hand, and still needs no image files
 * and no network request (FR-135a, FR-143).
 */
export function flagFor(entry) {
  const code = typeof entry?.code === 'string' ? entry.code.trim().toUpperCase() : '';
  if (/^[A-Z]{2}$/.test(code)) {
    return String.fromCodePoint(
      ...[...code].map((letter) => REGIONAL_INDICATOR_A + letter.charCodeAt(0) - 65),
    );
  }
  return typeof entry?.flag === 'string' ? entry.flag : '';
}

/**
 * Validate the content file, skipping malformed entries rather than crashing
 * the trainer (FR-136).
 * @param {unknown} raw parsed JSON
 * @param {{warn: Function}} [logger]
 */
export function validateCountries(raw, logger = console) {
  const list = Array.isArray(raw) ? raw : raw?.countries;
  if (!Array.isArray(list)) {
    logger.warn('[geography] Content file has no countries array; trainers will be unavailable.');
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
      code: typeof entry.code === 'string' ? entry.code.toUpperCase() : '',
      capital: entry.capital,
      continent: entry.continent,
      tier: entry.tier,
      flag: flagFor(entry),
      alternatives: Array.isArray(entry.alternatives) ? entry.alternatives : [],
    });
  }

  return valid;
}

/**
 * The countries a band may draw from, optionally narrowed by practice filters.
 *
 * @param {Array} countries
 * @param {string} band
 * @param {{continents?: string[]}} [filters]
 */
export function poolFor(countries, band, filters = null) {
  const maxTier = MAX_TIER_BY_BAND[band] ?? 3;
  let pool = countries.filter((entry) => entry.tier <= maxTier);

  if (Array.isArray(filters?.continents) && filters.continents.length > 0) {
    const allowed = new Set(filters.continents);
    pool = pool.filter((entry) => allowed.has(entry.continent));
  }

  return pool;
}

/** Does this band answer by picking from options? */
export function usesChoices(band, filters = null) {
  if (filters?.answerFormat === 'choice') return true;
  if (filters?.answerFormat === 'text') return false;
  return CHOICE_BANDS.includes(band);
}

/**
 * Build distractors, preferring the same continent so they are plausible, and
 * never repeating the correct answer (FR-139).
 *
 * @param {object} rng
 * @param {Array} pool
 * @param {object} subject
 * @param {(entry: object) => string} label
 */
export function buildChoices(rng, pool, subject, label) {
  const correct = label(subject);
  const sameContinent = pool.filter(
    (entry) => entry.continent === subject.continent && label(entry) !== correct,
  );
  const elsewhere = pool.filter(
    (entry) => entry.continent !== subject.continent && label(entry) !== correct,
  );

  const picked = [];
  const seen = new Set([correct]);
  for (const candidate of [...rng.shuffle(sameContinent), ...rng.shuffle(elsewhere)]) {
    if (picked.length >= CHOICE_COUNT - 1) break;
    const value = label(candidate);
    if (seen.has(value)) continue;
    seen.add(value);
    picked.push(value);
  }

  return rng.shuffle([correct, ...picked]);
}

/** Continent names present in the content, for the practice filter. */
export function continentsIn(countries) {
  return [...new Set(countries.map((entry) => entry.continent))].sort();
}
