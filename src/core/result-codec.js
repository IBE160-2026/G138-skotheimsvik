/**
 * Compact storage codec for round results.
 *
 * A RoundResult is comfortable to work with but wasteful to store: four of its
 * fields duplicate the keys it is filed under, two more are derivable, and the
 * topic labels repeat on every single record. Stored verbatim, two years of
 * daily play across six trainers and their variants overruns the 2 MB budget in
 * NFR-11.
 *
 * So results are packed on the way out and rehydrated on the way in. The rest of
 * the application never sees the packed shape.
 */

const END_REASONS = [
  'time-expired',
  'lives-exhausted',
  'board-complete',
  'prompts-exhausted',
  'abandoned',
];
const ROUND_MODES = ['timed', 'lives', 'completion'];

/** Accuracy is recomputed rather than stored (a pure function of two fields). */
function accuracyOf(correctCount, totalAnswered) {
  if (totalAnswered === 0) return 0;
  return Math.round((correctCount / totalAnswered) * 1000) / 10;
}

/**
 * Pack one result.
 *
 * `id`, `trainerId`, `variantKey` and `puzzleDate` are dropped because they are
 * already the keys the record is filed under. Topic labels are replaced by
 * indices into a shared dictionary.
 *
 * @param {object} result
 * @param {{idFor: (topicId: string, label: string) => number}} labels
 */
export function packResult(result, labels) {
  return {
    k: result.categoryId,
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
    x: result.mistakes ?? null,
    g: (result.topicStats ?? []).map((entry) => [
      labels.idFor(entry.topicId, entry.label),
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
 * @param {{entryFor: (id: number) => {topicId: string, label: string}}} labels
 * @param {string} variantKey
 */
export function unpackResult(packed, trainerId, puzzleDate, labels, variantKey) {
  const roundMode = ROUND_MODES[packed.m] ?? 'timed';

  return {
    id: `${trainerId}:${variantKey}:${puzzleDate}`,
    categoryId: packed.k ?? 'unknown',
    trainerId,
    variantKey,
    puzzleDate,
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
    mistakes: packed.x ?? null,
    maxLevel: roundMode === 'lives' ? packed.s : null,
    topicStats: (packed.g ?? []).map(([labelId, asked, correct]) => {
      const entry = labels.entryFor(labelId);
      return { topicId: entry.topicId, label: entry.label, asked, correct };
    }),
  };
}

/**
 * A shared topic dictionary, so "Country → capital" is stored once rather than
 * on every one of a thousand records.
 * @param {Array<[string, string]>} [initial] serialised [topicId, label] pairs
 */
export function createLabelDictionary(initial = []) {
  const entries = initial.map(([topicId, label]) => ({ topicId, label }));
  const index = new Map(entries.map((entry, i) => [entry.topicId, i]));

  return {
    idFor(topicId, label) {
      if (index.has(topicId)) return index.get(topicId);
      const id = entries.length;
      entries.push({ topicId, label: label ?? topicId });
      index.set(topicId, id);
      return id;
    },
    entryFor(id) {
      return entries[id] ?? { topicId: 'unknown', label: 'Unknown' };
    },
    serialise() {
      return entries.map((entry) => [entry.topicId, entry.label]);
    },
  };
}
