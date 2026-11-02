/**
 * The archive of previous days' puzzles.
 *
 * FR-39..FR-43. The archive reaches back to a fixed earliest date and no
 * further, which resolves PRD §9 Q6 and keeps the list bounded.
 */

import { addDays, daysBetween } from './clock.js';
import { difficultyForDate } from './difficulty.js';

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
 * List archive entries, newest first, excluding today.
 *
 * @param {object} options
 * @param {string} options.today
 * @param {Array} options.trainers
 * @param {{hasAttempt: (trainerId: string, date: string) => boolean, forTrainer: Function}} options.progress
 * @param {number} [options.limit]
 */
export function listArchive({ today, trainers, progress, limit = ARCHIVE_PAGE_SIZE }) {
  const entries = [];
  let cursor = addDays(today, -1);

  while (entries.length < limit && daysBetween(EARLIEST_PUZZLE_DATE, cursor) >= 0) {
    const difficulty = difficultyForDate(cursor);
    const trainerStates = trainers.map((trainer) => {
      const played = progress.hasAttempt(trainer.id, cursor);
      const attempt = progress.forTrainer(trainer.id).attempts[cursor] ?? null;
      return {
        trainerId: trainer.id,
        name: trainer.name,
        played,
        score: attempt?.score ?? null,
      };
    });

    entries.push({
      puzzleDate: cursor,
      difficulty,
      trainers: trainerStates,
      anyUnplayed: trainerStates.some((entry) => !entry.played),
    });

    cursor = addDays(cursor, -1);
  }

  return entries;
}
