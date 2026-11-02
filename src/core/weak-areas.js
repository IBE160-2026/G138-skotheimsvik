/**
 * Weak-topic analysis.
 *
 * FR-92 to FR-98. Thinly sampled topics are excluded so a single unlucky
 * question cannot be reported as a weakness.
 */

/** A topic must have been asked at least this often to count (FR-94). */
export const MIN_ASKED_FOR_ANALYSIS = 3;

/**
 * Merge topic tallies from many rounds into one list (FR-97).
 * @param {Array<{topicStats?: Array}>} results
 */
export function aggregateTopics(results) {
  /** @type {Map<string, {topicId: string, label: string, asked: number, correct: number}>} */
  const totals = new Map();

  for (const result of results ?? []) {
    for (const stat of result?.topicStats ?? []) {
      const existing = totals.get(stat.topicId) ?? {
        topicId: stat.topicId,
        label: stat.label ?? stat.topicId,
        asked: 0,
        correct: 0,
      };
      existing.asked += stat.asked;
      existing.correct += stat.correct;
      totals.set(stat.topicId, existing);
    }
  }

  return [...totals.values()].map((entry) => ({
    ...entry,
    hitRate: entry.asked === 0 ? 0 : Math.round((entry.correct / entry.asked) * 1000) / 10,
  }));
}

/**
 * Identify the weakest topic.
 *
 * @param {Array} topicStats
 * @param {object} [options]
 * @param {number} [options.minAsked]
 * @returns {{status: 'ok'|'insufficient-data'|'no-topics', weakest: object|null, message: string, topics: Array}}
 */
export function analyseWeakAreas(topicStats, options = {}) {
  const minAsked = options.minAsked ?? MIN_ASKED_FOR_ANALYSIS;
  const topics = aggregateTopics([{ topicStats }]);

  if (topics.length === 0) {
    return {
      status: 'no-topics',
      weakest: null,
      message: 'This trainer does not track topics.',
      topics,
    };
  }

  const eligible = topics.filter((entry) => entry.asked >= minAsked);

  if (eligible.length === 0) {
    return {
      status: 'insufficient-data',
      weakest: null,
      message: 'Not enough data yet to pick out a weak area.',
      topics,
    };
  }

  // Lowest hit rate wins; ties break towards the more-asked topic, which is the
  // better-evidenced of the two.
  const weakest = eligible.reduce((worst, entry) => {
    if (entry.hitRate < worst.hitRate) return entry;
    if (entry.hitRate === worst.hitRate && entry.asked > worst.asked) return entry;
    return worst;
  });

  return {
    status: 'ok',
    weakest,
    message: `You miss ${weakest.label} most — ${weakest.correct} of ${weakest.asked} correct`,
    topics,
  };
}
