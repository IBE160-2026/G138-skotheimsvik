/**
 * Round scoring: counts, accuracy, streaks, timing and per-category tallies.
 *
 * Pure state machine with no DOM involvement (NFR-14). Covers FR-54..FR-59 and
 * the aggregation half of FR-77.
 */

/** Accuracy as a percentage, one decimal, 0 when nothing was answered (FR-56). */
export function computeAccuracy(correctCount, totalAnswered) {
  if (totalAnswered === 0) return 0;
  return Math.round((correctCount / totalAnswered) * 1000) / 10;
}

/** Mean answer time, 0 when nothing was answered (FR-57). */
export function computeAverageAnswerTime(totalElapsedMs, totalAnswered) {
  if (totalAnswered === 0) return 0;
  return Math.round(totalElapsedMs / totalAnswered);
}

/**
 * Create a scoreboard for one round.
 */
export function createScoreboard() {
  let totalAnswered = 0;
  let correctCount = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let totalElapsedMs = 0;
  /** @type {Map<string, {categoryId: string, label: string, asked: number, correct: number}>} */
  const categories = new Map();

  /**
   * Record one graded answer.
   * @param {object} prompt
   * @param {boolean} isCorrect
   * @param {number} elapsedMs
   */
  function record(prompt, isCorrect, elapsedMs = 0) {
    totalAnswered += 1;
    totalElapsedMs += Math.max(0, elapsedMs);

    if (isCorrect) {
      correctCount += 1;
      currentStreak += 1;
      if (currentStreak > bestStreak) bestStreak = currentStreak;
    } else {
      currentStreak = 0;
    }

    if (prompt?.categoryId) {
      const existing = categories.get(prompt.categoryId) ?? {
        categoryId: prompt.categoryId,
        label: prompt.categoryLabel ?? prompt.categoryId,
        asked: 0,
        correct: 0,
      };
      existing.asked += 1;
      if (isCorrect) existing.correct += 1;
      categories.set(prompt.categoryId, existing);
    }
  }

  /** Live values for the in-round display (FR-22). */
  function snapshot() {
    return {
      totalAnswered,
      correctCount,
      currentStreak,
      bestStreak,
      accuracy: computeAccuracy(correctCount, totalAnswered),
    };
  }

  /** Final values for the result record. */
  function summary() {
    return {
      totalAnswered,
      correctCount,
      bestStreak,
      accuracy: computeAccuracy(correctCount, totalAnswered),
      avgAnswerTimeMs: computeAverageAnswerTime(totalElapsedMs, totalAnswered),
      categoryStats: [...categories.values()].map((entry) => ({ ...entry })),
    };
  }

  return { record, snapshot, summary };
}
