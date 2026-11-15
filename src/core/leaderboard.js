/**
 * Daily & All-Time Leaderboard Store.
 *
 * Tracks real player scores across days, with support for Word Rush (daily word count
 * and all-time cumulative words + personal bests). No fake or pre-seeded entries.
 */

import { STORAGE_KEYS } from './storage.js';

/**
 * @param {{storage: object}} options
 */
export function createLeaderboardStore({ storage }) {
  // Stored shape: { entries: Array<{login, name, avatarUrl, puzzleDate, trainerId, variantKey, score, elapsedMs, categoryLabel, letter}> }
  let state = storage.read(STORAGE_KEYS.leaderboard, { entries: [] });
  if (!Array.isArray(state?.entries)) {
    state = { entries: [] };
  }

  function persist() {
    storage.write(STORAGE_KEYS.leaderboard, state);
  }

  /**
   * Record a user's round score onto the leaderboard.
   */
  function recordEntry({ user, result }) {
    if (!user?.login || !result) return;

    const existingIdx = state.entries.findIndex(
      (e) =>
        e.login.toLowerCase() === user.login.toLowerCase() &&
        e.puzzleDate === result.puzzleDate &&
        e.trainerId === result.trainerId &&
        e.variantKey === result.variantKey,
    );

    const isFigurePairs = result.trainerId === 'figure-pairs';
    // For Figure Pairs, the user's leaderboard score is total tries (totalAnswered),
    // or mistakes + pairs matched if totalAnswered is absent. Fewer tries = better!
    const recordedScore = isFigurePairs
      ? result.totalAnswered || (result.mistakes ?? 0) + (result.correctCount ?? 0)
      : result.score;

    const record = {
      login: user.login,
      name: user.name || user.login,
      avatarUrl: user.avatarUrl || `https://github.com/${user.login}.png?size=120`,
      puzzleDate: result.puzzleDate,
      trainerId: result.trainerId,
      variantKey: result.variantKey,
      score: recordedScore,
      mistakes: result.mistakes ?? 0,
      totalAnswered: result.totalAnswered ?? recordedScore,
      elapsedMs: result.elapsedMs,
      categoryLabel: result.wordRush?.categoryLabel ?? null,
      letter: result.wordRush?.letter ?? null,
      playedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      const prevScore = state.entries[existingIdx].score;
      const isBetterOrEqual = isFigurePairs
        ? recordedScore <= prevScore
        : recordedScore >= prevScore;
      if (isBetterOrEqual) {
        state.entries[existingIdx] = record;
      }
    } else {
      state.entries.push(record);
    }

    persist();
  }

  /**
   * Get the daily leaderboard for a specific puzzleDate (defaults to Word Rush).
   */
  function dailyLeaderboard(puzzleDate, { trainerId = 'word-rush' } = {}) {
    const isLowerBetter = trainerId === 'figure-pairs';
    const userEntries = state.entries.filter(
      (e) => e.puzzleDate === puzzleDate && e.trainerId === trainerId,
    );
    const byLogin = new Map();

    for (const entry of userEntries) {
      const key = entry.login.toLowerCase();
      const prev = byLogin.get(key);
      if (!prev) {
        byLogin.set(key, { ...entry });
      } else if (isLowerBetter ? entry.score < prev.score : entry.score > prev.score) {
        byLogin.set(key, { ...entry });
      }
    }

    return [...byLogin.values()]
      .sort((a, b) => {
        const scoreDiff = isLowerBetter ? a.score - b.score : b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        return (a.elapsedMs ?? 120000) - (b.elapsedMs ?? 120000);
      })
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }

  /**
   * Get the all-time leaderboard.
   */
  function allTimeLeaderboard({ trainerId = 'word-rush' } = {}) {
    const isLowerBetter = trainerId === 'figure-pairs';
    const userEntries = state.entries.filter((e) => e.trainerId === trainerId);
    const aggregatedUsers = new Map();

    for (const entry of userEntries) {
      const key = entry.login.toLowerCase();
      const current = aggregatedUsers.get(key) ?? {
        login: entry.login,
        name: entry.name,
        avatarUrl: entry.avatarUrl,
        totalWords: 0,
        bestScore: isLowerBetter ? Infinity : 0,
        roundsPlayed: 0,
      };
      current.totalWords += entry.score;
      current.bestScore = isLowerBetter
        ? Math.min(current.bestScore, entry.score)
        : Math.max(current.bestScore, entry.score);
      current.roundsPlayed += 1;
      aggregatedUsers.set(key, current);
    }

    return [...aggregatedUsers.values()]
      .sort((a, b) => {
        if (isLowerBetter) {
          // For Figure Pairs all-time: fewest best-run tries first, then most rounds completed
          return a.bestScore - b.bestScore || b.roundsPlayed - a.roundsPlayed;
        }
        return b.totalWords - a.totalWords || b.bestScore - a.bestScore;
      })
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }

  return {
    recordEntry,
    dailyLeaderboard,
    allTimeLeaderboard,
  };
}
