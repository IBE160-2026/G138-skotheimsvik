/**
 * Weak-area analysis.
 *
 * FR-76..FR-81. Thin categories are excluded so a single unlucky question
 * cannot be reported as a weakness.
 */

/** A category must have been asked at least this often to count (FR-78). */
export const MIN_ASKED_FOR_ANALYSIS = 3;

/**
 * Merge category tallies from many rounds into one list (FR-81).
 * @param {Array<{categoryStats?: Array}>} results
 */
export function aggregateCategories(results) {
  /** @type {Map<string, {categoryId: string, label: string, asked: number, correct: number}>} */
  const totals = new Map();

  for (const result of results ?? []) {
    for (const stat of result?.categoryStats ?? []) {
      const existing = totals.get(stat.categoryId) ?? {
        categoryId: stat.categoryId,
        label: stat.label ?? stat.categoryId,
        asked: 0,
        correct: 0,
      };
      existing.asked += stat.asked;
      existing.correct += stat.correct;
      totals.set(stat.categoryId, existing);
    }
  }

  return [...totals.values()].map((entry) => ({
    ...entry,
    hitRate: entry.asked === 0 ? 0 : Math.round((entry.correct / entry.asked) * 1000) / 10,
  }));
}

/**
 * Identify the weakest category.
 *
 * @param {Array} categoryStats
 * @param {object} [options]
 * @param {number} [options.minAsked]
 * @returns {{status: 'ok'|'insufficient-data'|'no-categories', weakest: object|null, message: string, categories: Array}}
 */
export function analyseWeakAreas(categoryStats, options = {}) {
  const minAsked = options.minAsked ?? MIN_ASKED_FOR_ANALYSIS;
  const categories = aggregateCategories([{ categoryStats }]);

  if (categories.length === 0) {
    return {
      status: 'no-categories',
      weakest: null,
      message: 'This trainer does not track categories.',
      categories,
    };
  }

  const eligible = categories.filter((entry) => entry.asked >= minAsked);

  if (eligible.length === 0) {
    return {
      status: 'insufficient-data',
      weakest: null,
      message: 'Not enough data yet to pick out a weak area.',
      categories,
    };
  }

  // Lowest hit rate wins; ties break towards the more-asked category, which is
  // the better-evidenced of the two.
  const weakest = eligible.reduce((worst, entry) => {
    if (entry.hitRate < worst.hitRate) return entry;
    if (entry.hitRate === worst.hitRate && entry.asked > worst.asked) return entry;
    return worst;
  });

  return {
    status: 'ok',
    weakest,
    message: `You miss ${weakest.label} most — ${weakest.correct} of ${weakest.asked} correct`,
    categories,
  };
}
