/**
 * Daily difficulty assignment.
 *
 * FR-26..FR-31: the date decides the band, identically for every player, with no
 * player input able to reach the computation. The band is a pure function of the
 * puzzle date, so it is trivially reproducible and testable.
 */

import { createRng, difficultySeedFor } from './rng.js';

/** @typedef {'beginner'|'intermediate'|'advanced'|'expert'} Band */

/** Ordered easiest to hardest. Index doubles as a difficulty rank. */
export const BANDS = /** @type {Band[]} */ ([
  'beginner',
  'intermediate',
  'advanced',
  'expert',
]);

export const BAND_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
};

/**
 * Target distribution across dates — resolves PRD §9 Q5.
 *
 * Weighted towards the middle so that most days are playable for most people,
 * while still guaranteeing genuinely easy and genuinely brutal days. Expert is
 * rarest because an expert day is meant to feel like an event.
 */
export const BAND_DISTRIBUTION = Object.freeze({
  beginner: 0.2,
  intermediate: 0.4,
  advanced: 0.25,
  expert: 0.15,
});

/**
 * The difficulty band for a puzzle date.
 *
 * Note the seed excludes the trainer: one band per date, shared by every trainer
 * and every player (FR-27).
 * @param {string} puzzleDate ISO date
 * @returns {Band}
 */
export function difficultyForDate(puzzleDate) {
  const rng = createRng(difficultySeedFor(puzzleDate));
  const entries = BANDS.map((band) => [band, BAND_DISTRIBUTION[band]]);
  return rng.weighted(/** @type {Array<[Band, number]>} */ (entries));
}

/**
 * Numeric rank of a band, 0 (beginner) to 3 (expert).
 * @param {Band} band
 * @returns {number}
 */
export function bandRank(band) {
  return BANDS.indexOf(band);
}

/**
 * Human-readable band name.
 * @param {Band} band
 * @returns {string}
 */
export function bandLabel(band) {
  return BAND_LABELS[band] ?? band;
}

/**
 * Pick the value matching a band from a lookup object.
 * @template T
 * @param {Band} band
 * @param {Record<Band, T>} table
 * @returns {T}
 */
export function byBand(band, table) {
  return table[band];
}
