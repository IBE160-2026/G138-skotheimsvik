/**
 * Progress: attempt records, personal bests and result comparison.
 *
 * Covers FR-35..FR-38, FR-60, FR-61, FR-65..FR-67, FR-70, FR-83, FR-85.
 * Attempts are keyed by puzzle date, which enforces the one-attempt-per-day rule
 * structurally — a date either has a result or it does not.
 */

import { STORAGE_KEYS } from './storage.js';
import { packResult, unpackResult, createLabelDictionary } from './result-codec.js';

/** @typedef {{trainerId: string, attempts: Record<string, object>, personalBest: number}} TrainerProgress */

function emptyTrainerProgress(trainerId) {
  return { trainerId, attempts: {}, personalBest: 0 };
}

/**
 * Compare a score against the previous attempt (FR-65, FR-67).
 * @param {number} score
 * @param {object|null} previous
 */
export function compareToPrevious(score, previous) {
  if (!previous) {
    return {
      status: 'first',
      delta: 0,
      message: 'This is your first attempt — nothing to compare against yet.',
    };
  }

  const delta = score - previous.score;
  if (delta > 0) {
    return { status: 'better', delta, message: `You beat your previous attempt by ${delta}.` };
  }
  if (delta < 0) {
    return {
      status: 'worse',
      delta,
      message: `You fell short of your previous attempt by ${Math.abs(delta)}.`,
    };
  }
  return { status: 'equal', delta: 0, message: 'You matched your previous attempt exactly.' };
}

/**
 * Compare a score against the all-time best (FR-66).
 * A best is only beaten when strictly greater (FR-61).
 * @param {number} score
 * @param {number} best
 * @param {boolean} hasHistory
 */
export function compareToBest(score, best, hasHistory) {
  if (!hasHistory) {
    return { status: 'first', delta: 0, isNewBest: true, message: 'Your first score — a new personal best by default.' };
  }
  if (score > best) {
    return {
      status: 'new-best',
      delta: score - best,
      isNewBest: true,
      message: `New personal best — ${score}, beating ${best}.`,
    };
  }
  if (score === best) {
    return { status: 'equal', delta: 0, isNewBest: false, message: `You matched your personal best of ${best}.` };
  }
  return {
    status: 'below',
    delta: score - best,
    isNewBest: false,
    message: `${best - score} short of your personal best of ${best}.`,
  };
}

/**
 * @param {object} options
 * @param {object} options.storage
 */
export function createProgressStore({ storage }) {
  // On disk: { labels: [[id, label], ...], trainers: { id: { a: {date: packed}, b: best } } }
  const stored = storage.read(STORAGE_KEYS.progress, { labels: [], trainers: {} });
  const labels = createLabelDictionary(stored.labels ?? []);

  /** @type {Record<string, TrainerProgress>} */
  let progress = {};
  for (const [trainerId, entry] of Object.entries(stored.trainers ?? {})) {
    const attempts = {};
    for (const [puzzleDate, packed] of Object.entries(entry.a ?? {})) {
      attempts[puzzleDate] = unpackResult(packed, trainerId, puzzleDate, labels);
    }
    progress[trainerId] = { trainerId, attempts, personalBest: entry.b ?? 0 };
  }

  function persist() {
    const trainers = {};
    for (const [trainerId, entry] of Object.entries(progress)) {
      const packedAttempts = {};
      for (const [puzzleDate, result] of Object.entries(entry.attempts)) {
        packedAttempts[puzzleDate] = packResult(result, labels);
      }
      trainers[trainerId] = { a: packedAttempts, b: entry.personalBest };
    }
    // The dictionary is serialised after packing, so it includes any new labels.
    return storage.write(STORAGE_KEYS.progress, { labels: labels.serialise(), trainers });
  }

  /** @returns {TrainerProgress} */
  function forTrainer(trainerId) {
    return progress[trainerId] ?? emptyTrainerProgress(trainerId);
  }

  /** Every result for a trainer, oldest puzzle date first. */
  function history(trainerId) {
    return Object.values(forTrainer(trainerId).attempts).sort((a, b) =>
      a.puzzleDate < b.puzzleDate ? -1 : a.puzzleDate > b.puzzleDate ? 1 : 0,
    );
  }

  /** Has this trainer already been attempted on this date? (FR-35, FR-41) */
  function hasAttempt(trainerId, puzzleDate) {
    return Boolean(forTrainer(trainerId).attempts[puzzleDate]);
  }

  /**
   * The most recently played round by puzzle date, optionally excluding one date.
   * @param {string} trainerId
   * @param {string} [excludeDate]
   */
  function previousAttempt(trainerId, excludeDate) {
    const entries = history(trainerId).filter((entry) => entry.puzzleDate !== excludeDate);
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }

  /**
   * Record a finished round, returning the comparisons for the results screen.
   * Comparison is computed against the state *before* this result lands.
   * @param {object} result
   */
  function recordResult(result) {
    const trainer = forTrainer(result.trainerId);
    const hadHistory = Object.keys(trainer.attempts).length > 0;
    const previous = previousAttempt(result.trainerId, result.puzzleDate);
    const bestBefore = trainer.personalBest;

    const vsPrevious = compareToPrevious(result.score, previous);
    const vsBest = compareToBest(result.score, bestBefore, hadHistory);

    const updated = {
      ...trainer,
      attempts: { ...trainer.attempts, [result.puzzleDate]: result },
      personalBest: result.score > bestBefore ? result.score : bestBefore,
    };

    progress = { ...progress, [result.trainerId]: updated };
    const saved = persist();

    return { vsPrevious, vsBest, personalBest: updated.personalBest, saved };
  }

  /** Totals for the progress view (FR-73). */
  function summaryFor(trainerId) {
    const entries = history(trainerId);
    const totalTimeMs = entries.reduce((sum, entry) => sum + (entry.elapsedMs ?? 0), 0);
    return {
      puzzlesCompleted: entries.length,
      totalTimeMs,
      personalBest: forTrainer(trainerId).personalBest,
    };
  }

  /** Remove everything, including attempt records (FR-85). */
  function clearAll() {
    progress = {};
    storage.remove(STORAGE_KEYS.progress);
  }

  return {
    forTrainer,
    history,
    hasAttempt,
    previousAttempt,
    recordResult,
    summaryFor,
    clearAll,
    all: () => progress,
  };
}
