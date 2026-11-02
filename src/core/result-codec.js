/**
 * Compact storage codec for round results.
 *
 * A RoundResult is comfortable to work with but wasteful to store: three of its
 * fields duplicate the keys it is filed under, two more are derivable, and the
 * category labels repeat on every single record. Stored verbatim, two years of
 * daily play across three trainers overruns the 1 MB budget in NFR-10.
 *
 * So results are packed on the way out and rehydrated on the way in. The rest of
 * the application never sees the packed shape.
 */

import { BANDS } from './difficulty.js';

const END_REASONS = ['time-expired', 'lives-exhausted', 'prompts-exhausted'];
const ROUND_MODES = ['timed', 'lives'];

/** Accuracy is recomputed rather than stored (it is a pure function of two fields). */
function accuracyOf(correctCount, totalAnswered) {
  if (totalAnswered === 0) return 0;
  return Math.round((correctCount / totalAnswered) * 1000) / 10;
}

/**
 * Pack one result.
 *
 * `id`, `trainerId` and `puzzleDate` are dropped because they are already the
 * keys the record is filed under. Category labels are replaced by indices into
 * a shared dictionary.
 *
 * @param {object} result
 * @param {{idFor: (categoryId: string, label: string) => number}} labels
 */
export function packResult(result, labels) {
  return {
    d: BANDS.indexOf(result.difficulty),
    m: ROUND_MODES.indexOf(result.roundMode),
    p: result.modeParam,
    s: result.score,
    t: result.playedAt,
    e: END_REASONS.indexOf(result.endedBy),
    l: result.elapsedMs,
    n: result.totalAnswered,
    c: result.correctCount,
    v: result.avgAnswerTimeMs,
    b: result.bestStreak,
    r: result.livesRemaining,
    g: (result.categoryStats ?? []).map((entry) => [
      labels.idFor(entry.categoryId, entry.label),
      entry.asked,
      entry.correct,
    ]),
  };
}

/**
 * Rebuild a full result from its packed form plus the keys it was filed under.
 *
 * @param {object} packed
 * @param {string} trainerId
 * @param {string} puzzleDate
 * @param {{entryFor: (id: number) => {categoryId: string, label: string}}} labels
 */
export function unpackResult(packed, trainerId, puzzleDate, labels) {
  const roundMode = ROUND_MODES[packed.m] ?? 'timed';
  const headlineIsLevel = roundMode === 'lives' && packed.r !== null && packed.r !== undefined;

  return {
    id: `${trainerId}:${puzzleDate}`,
    trainerId,
    puzzleDate,
    difficulty: BANDS[packed.d] ?? 'intermediate',
    roundMode,
    modeParam: packed.p,
    score: packed.s,
    playedAt: packed.t,
    endedBy: END_REASONS[packed.e] ?? 'time-expired',
    elapsedMs: packed.l,
    totalAnswered: packed.n,
    correctCount: packed.c,
    accuracy: accuracyOf(packed.c, packed.n),
    avgAnswerTimeMs: packed.v,
    bestStreak: packed.b,
    livesRemaining: packed.r ?? null,
    maxLevel: headlineIsLevel ? packed.s : null,
    categoryStats: (packed.g ?? []).map(([labelId, asked, correct]) => {
      const entry = labels.entryFor(labelId);
      return { categoryId: entry.categoryId, label: entry.label, asked, correct };
    }),
  };
}

/**
 * A shared category dictionary, so "Country → capital" is stored once rather
 * than on every one of a thousand records.
 * @param {Array<[string, string]>} [initial] serialised [categoryId, label] pairs
 */
export function createLabelDictionary(initial = []) {
  const entries = initial.map(([categoryId, label]) => ({ categoryId, label }));
  const index = new Map(entries.map((entry, i) => [entry.categoryId, i]));

  return {
    idFor(categoryId, label) {
      if (index.has(categoryId)) return index.get(categoryId);
      const id = entries.length;
      entries.push({ categoryId, label: label ?? categoryId });
      index.set(categoryId, id);
      return id;
    },
    entryFor(id) {
      return entries[id] ?? { categoryId: 'unknown', label: 'Unknown' };
    },
    serialise() {
      return entries.map((entry) => [entry.categoryId, entry.label]);
    },
  };
}
