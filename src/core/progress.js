/**
 * Progress: attempt records, per-variant personal bests and result comparison.
 *
 * Covers FR-35 to FR-38, FR-43, FR-74 to FR-76, FR-80 to FR-83, FR-86, FR-99.
 *
 * Attempts are keyed by variant and then by puzzle date, which enforces the
 * one-attempt-per-combination rule structurally — a (variant, date) pair either
 * has a result or it does not. Bests live on the variant rather than the
 * trainer, because the player chooses the band and a Beginner score is not
 * comparable to an Expert one (FR-74).
 */

import { STORAGE_KEYS } from './storage.js';
import { packResult, unpackResult, createLabelDictionary } from './result-codec.js';
import { beatsBest, improvementOver } from './scoring.js';

/** @typedef {{attempts: Record<string, object>, personalBest: number|null}} VariantProgress */

function emptyVariant() {
  return { attempts: {}, personalBest: null };
}

function emptyTrainerProgress(trainerId) {
  return { trainerId, variants: {} };
}

/**
 * Compare a score against the previous attempt (FR-80, FR-82).
 * @param {number} score
 * @param {object|null} previous
 * @param {'higher'|'lower'} direction
 */
export function compareToPrevious(score, previous, direction = 'higher') {
  if (!previous) {
    return {
      status: 'first',
      delta: 0,
      message: 'This is your first attempt here — nothing to compare against yet.',
    };
  }

  const delta = improvementOver(score, previous.score, direction);
  const unit = direction === 'lower' ? 'mistake' : 'point';
  const plural = Math.abs(delta) === 1 ? unit : `${unit}s`;

  if (delta > 0) {
    return { status: 'better', delta, message: `You beat your previous attempt by ${delta} ${plural}.` };
  }
  if (delta < 0) {
    return {
      status: 'worse',
      delta,
      message: `You fell short of your previous attempt by ${Math.abs(delta)} ${plural}.`,
    };
  }
  return { status: 'equal', delta: 0, message: 'You matched your previous attempt exactly.' };
}

/**
 * Compare a score against the all-time best for this variant (FR-81).
 * A best is only beaten strictly, so matching it does not overwrite it (FR-75).
 * @param {number} score
 * @param {number|null} best
 * @param {'higher'|'lower'} direction
 */
export function compareToBest(score, best, direction = 'higher') {
  if (best === null || best === undefined) {
    return {
      status: 'first',
      delta: 0,
      isNewBest: true,
      message: 'Your first score here — a new personal best by default.',
    };
  }
  if (beatsBest(score, best, direction)) {
    return {
      status: 'new-best',
      delta: improvementOver(score, best, direction),
      isNewBest: true,
      message: `New personal best — ${score}, beating ${best}.`,
    };
  }
  if (score === best) {
    return {
      status: 'equal',
      delta: 0,
      isNewBest: false,
      message: `You matched your personal best of ${best}.`,
    };
  }
  return {
    status: 'below',
    delta: improvementOver(score, best, direction),
    isNewBest: false,
    message: `${Math.abs(improvementOver(score, best, direction))} away from your personal best of ${best}.`,
  };
}

/**
 * @param {object} options
 * @param {object} options.storage
 */
export function createProgressStore({ storage }) {
  // On disk: { labels: [[id, label], ...], trainers: { id: { v: { key: { a: {date: packed}, b: best } } } } }
  const stored = storage.read(STORAGE_KEYS.progress, { labels: [], trainers: {} });
  const labels = createLabelDictionary(stored.labels ?? []);

  /** @type {Record<string, {trainerId: string, variants: Record<string, VariantProgress>}>} */
  let progress = {};
  for (const [trainerId, entry] of Object.entries(stored.trainers ?? {})) {
    const variants = {};
    for (const [variantKey, variantEntry] of Object.entries(entry.v ?? {})) {
      const attempts = {};
      for (const [puzzleDate, packed] of Object.entries(variantEntry.a ?? {})) {
        attempts[puzzleDate] = unpackResult(packed, trainerId, puzzleDate, labels, variantKey);
      }
      variants[variantKey] = { attempts, personalBest: variantEntry.b ?? null };
    }
    progress[trainerId] = { trainerId, variants };
  }

  function persist() {
    const trainers = {};
    for (const [trainerId, entry] of Object.entries(progress)) {
      const variants = {};
      for (const [variantKey, variantEntry] of Object.entries(entry.variants)) {
        const packedAttempts = {};
        for (const [puzzleDate, result] of Object.entries(variantEntry.attempts)) {
          packedAttempts[puzzleDate] = packResult(result, labels);
        }
        variants[variantKey] = { a: packedAttempts, b: variantEntry.personalBest };
      }
      trainers[trainerId] = { v: variants };
    }
    // The dictionary is serialised after packing, so it includes any new labels.
    return storage.write(STORAGE_KEYS.progress, { labels: labels.serialise(), trainers });
  }

  function forTrainer(trainerId) {
    return progress[trainerId] ?? emptyTrainerProgress(trainerId);
  }

  function forVariant(trainerId, variantKey) {
    return forTrainer(trainerId).variants[variantKey] ?? emptyVariant();
  }

  /** Every result for one variant, oldest puzzle date first. */
  function history(trainerId, variantKey) {
    return Object.values(forVariant(trainerId, variantKey).attempts).sort((a, b) =>
      a.puzzleDate < b.puzzleDate ? -1 : a.puzzleDate > b.puzzleDate ? 1 : 0,
    );
  }

  /** Every result for a trainer across all variants, oldest first. */
  function fullHistory(trainerId) {
    return Object.values(forTrainer(trainerId).variants)
      .flatMap((variant) => Object.values(variant.attempts))
      .sort((a, b) => (a.puzzleDate < b.puzzleDate ? -1 : a.puzzleDate > b.puzzleDate ? 1 : 0));
  }

  /** Has this exact combination already been attempted? (FR-35, FR-41) */
  function hasAttempt(trainerId, variantKey, puzzleDate) {
    return Boolean(forVariant(trainerId, variantKey).attempts[puzzleDate]);
  }

  /** Variant keys already spent for a date, so the UI can mark them (FR-3). */
  function spentVariants(trainerId, puzzleDate) {
    return Object.entries(forTrainer(trainerId).variants)
      .filter(([, variant]) => Boolean(variant.attempts[puzzleDate]))
      .map(([key]) => key);
  }

  function personalBest(trainerId, variantKey) {
    return forVariant(trainerId, variantKey).personalBest;
  }

  /**
   * The most recently played round for this variant, optionally excluding a date.
   */
  function previousAttempt(trainerId, variantKey, excludeDate) {
    const entries = history(trainerId, variantKey).filter((entry) => entry.puzzleDate !== excludeDate);
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }

  /**
   * Record a finished round, returning the comparisons for the results screen.
   * Comparison is computed against the state *before* this result lands.
   *
   * Practice results never reach this function (FR-47, FR-48); the caller drops
   * them, which keeps the "practice cannot affect records" rule in one place.
   *
   * @param {object} result
   * @param {'higher'|'lower'} direction
   */
  function recordResult(result, direction = 'higher') {
    const { trainerId, variantKey, puzzleDate } = result;
    const trainer = forTrainer(trainerId);
    const variant = forVariant(trainerId, variantKey);
    const previous = previousAttempt(trainerId, variantKey, puzzleDate);
    const bestBefore = variant.personalBest;

    const vsPrevious = compareToPrevious(result.score, previous, direction);
    const vsBest = compareToBest(result.score, bestBefore, direction);

    const updatedVariant = {
      attempts: { ...variant.attempts, [puzzleDate]: result },
      personalBest: beatsBest(result.score, bestBefore, direction) ? result.score : bestBefore,
    };

    progress = {
      ...progress,
      [trainerId]: {
        trainerId,
        variants: { ...trainer.variants, [variantKey]: updatedVariant },
      },
    };
    const saved = persist();

    return { vsPrevious, vsBest, personalBest: updatedVariant.personalBest, saved };
  }

  /** Totals for the progress view (FR-89). */
  function summaryFor(trainerId, variantKey) {
    const entries = variantKey ? history(trainerId, variantKey) : fullHistory(trainerId);
    const totalTimeMs = entries.reduce((sum, entry) => sum + (entry.elapsedMs ?? 0), 0);
    return {
      puzzlesCompleted: entries.length,
      totalTimeMs,
      personalBest: variantKey ? personalBest(trainerId, variantKey) : null,
    };
  }

  /** Remove everything, including attempt records (FR-101). */
  function clearAll() {
    progress = {};
    storage.remove(STORAGE_KEYS.progress);
  }

  return {
    forTrainer,
    forVariant,
    history,
    fullHistory,
    hasAttempt,
    spentVariants,
    personalBest,
    previousAttempt,
    recordResult,
    summaryFor,
    clearAll,
    all: () => progress,
  };
}
