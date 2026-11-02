/**
 * The archive of previous days' puzzles.
 *
 * FR-39 to FR-43. The archive reaches back to a fixed earliest date and no
 * further, which keeps the list bounded.
 *
 * Every trainer now offers several variants, so an archive day is not simply
 * "played" or "unplayed" — it holds one attempt slot per trainer per variant.
 * The list reports how many of those slots remain.
 */

import { addDays, daysBetween } from './clock.js';
import { variantsFor } from './variants.js';

/** The first day LearningHub had puzzles. Nothing before this exists. */
export const EARLIEST_PUZZLE_DATE = '2026-10-01';

/** How many past days the archive view shows at once. */
export const ARCHIVE_PAGE_SIZE = 60;

/**
 * Is this date a real, playable puzzle date?
 * @param {string} puzzleDate
 * @param {string} today
 */
export function isValidPuzzleDate(puzzleDate, today) {
  return (
    daysBetween(EARLIEST_PUZZLE_DATE, puzzleDate) >= 0 && daysBetween(puzzleDate, today) >= 0
  );
}

/**
 * State of every variant slot for one trainer on one date.
 *
 * @param {object} trainer
 * @param {string} puzzleDate
 * @param {object} progress
 */
export function trainerDayState(trainer, puzzleDate, progress) {
  const variants = variantsFor(trainer).map((key) => {
    const attempt = progress.forVariant(trainer.id, key).attempts[puzzleDate] ?? null;
    return { key, played: Boolean(attempt), score: attempt?.score ?? null };
  });

  return {
    trainerId: trainer.id,
    categoryId: trainer.categoryId,
    name: trainer.name,
    variantKind: trainer.variantKind,
    variants,
    remaining: variants.filter((entry) => !entry.played).length,
  };
}

/**
 * List archive entries, newest first, excluding today.
 *
 * @param {object} options
 * @param {string} options.today
 * @param {Array} options.trainers
 * @param {object} options.progress
 * @param {number} [options.limit]
 */
export function listArchive({ today, trainers, progress, limit = ARCHIVE_PAGE_SIZE }) {
  const entries = [];
  let cursor = addDays(today, -1);

  while (entries.length < limit && daysBetween(EARLIEST_PUZZLE_DATE, cursor) >= 0) {
    const trainerStates = trainers.map((trainer) => trainerDayState(trainer, cursor, progress));
    const remaining = trainerStates.reduce((sum, entry) => sum + entry.remaining, 0);

    entries.push({
      puzzleDate: cursor,
      trainers: trainerStates,
      remaining,
      anyUnplayed: remaining > 0,
    });

    cursor = addDays(cursor, -1);
  }

  return entries;
}
