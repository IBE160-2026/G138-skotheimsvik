/**
 * Round scoring: counts, accuracy, streaks, timing and per-topic tallies.
 *
 * Pure state machine, no DOM (NFR-15). Covers FR-68 to FR-73 and the
 * aggregation half of FR-93.
 *
 * "Topic" is what earlier versions called a category; the word was freed up for
 * Math / Memory / Geography.
 */

/** Accuracy as a percentage, one decimal, 0 when nothing was answered (FR-70). */
export function computeAccuracy(correctCount, totalAnswered) {
  if (totalAnswered === 0) return 0;
  return Math.round((correctCount / totalAnswered) * 1000) / 10;
}

/** Mean answer time, 0 when nothing was answered (FR-71). */
export function computeAverageAnswerTime(totalElapsedMs, totalAnswered) {
  if (totalAnswered === 0) return 0;
  return Math.round(totalElapsedMs / totalAnswered);
}

/**
 * Is `score` better than `best` for this trainer? (FR-75, FR-83)
 *
 * Figure Pairs scores mistakes, so fewer is better. Everything else counts
 * correct answers or levels, where more is better. Strict comparison means
 * matching your best does not overwrite it.
 */
export function beatsBest(score, best, direction = 'higher') {
  if (best === null || best === undefined) return true;
  return direction === 'lower' ? score < best : score > best;
}

/** Signed improvement, positive when `score` is better than `reference`. */
export function improvementOver(score, reference, direction = 'higher') {
  return direction === 'lower' ? reference - score : score - reference;
}

export function createScoreboard() {
  let totalAnswered = 0;
  let correctCount = 0;
  let currentStreak = 0;
  let bestStreak = 0;
  let totalElapsedMs = 0;
  let mistakes = 0;
  /** @type {Map<string, {topicId: string, label: string, asked: number, correct: number}>} */
  const topics = new Map();

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
      mistakes += 1;
    }

    if (prompt?.topicId) {
      const existing = topics.get(prompt.topicId) ?? {
        topicId: prompt.topicId,
        label: prompt.topicLabel ?? prompt.topicId,
        asked: 0,
        correct: 0,
      };
      existing.asked += 1;
      if (isCorrect) existing.correct += 1;
      topics.set(prompt.topicId, existing);
    }
  }

  /** Live values for the in-round display (FR-22). */
  function snapshot() {
    return {
      totalAnswered,
      correctCount,
      currentStreak,
      bestStreak,
      mistakes,
      accuracy: computeAccuracy(correctCount, totalAnswered),
    };
  }

  /** Final values for the result record. */
  function summary() {
    return {
      totalAnswered,
      correctCount,
      bestStreak,
      mistakes,
      accuracy: computeAccuracy(correctCount, totalAnswered),
      avgAnswerTimeMs: computeAverageAnswerTime(totalElapsedMs, totalAnswered),
      topicStats: [...topics.values()].map((entry) => ({ ...entry })),
    };
  }

  return { record, snapshot, summary };
}
