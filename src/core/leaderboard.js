/**
 * Daily & All-Time Leaderboard Store.
 *
 * Tracks ONLY real player scores across days and syncs with the shared
 * `/api/leaderboard` endpoint so every user who visits the website and plays
 * sees each other's real performances in both Daily and All-Time leaderboards.
 */

import { STORAGE_KEYS } from './storage.js';

const LEGACY_SIMULATED_LOGINS = new Set([
  'torvalds',
  'gaearon',
  'sindresorhus',
  'yyx990803',
  'addyosmani',
]);

const S3LDAN_RESET_CUTOFF_MS = 1795026000000;

function isLowerBetter(trainerId) {
  return trainerId === 'figure-pairs';
}

function cleanEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (entry.practice || entry.isPractice || entry.adminMode || entry.isAdminMode) return null;
  const login = String(entry.login ?? '').trim();
  if (!login || LEGACY_SIMULATED_LOGINS.has(login.toLowerCase())) return null;
  const playedAt = Number.isFinite(Number(entry.playedAt)) ? Number(entry.playedAt) : Date.now();
  if (login.toLowerCase() === 's3ldan1ps' && playedAt <= S3LDAN_RESET_CUTOFF_MS) return null;
  return {
    login,
    avatarUrl:
      typeof entry.avatarUrl === 'string' && entry.avatarUrl.startsWith('https://')
        ? entry.avatarUrl
        : `https://github.com/${encodeURIComponent(login)}.png?size=120`,
    puzzleDate: String(entry.puzzleDate ?? '').trim(),
    trainerId: String(entry.trainerId ?? '').trim(),
    variantKey: String(entry.variantKey ?? 'daily').trim() || 'daily',
    score: Number(entry.score),
    mistakes: Number.isFinite(Number(entry.mistakes)) ? Number(entry.mistakes) : 0,
    totalAnswered: Number.isFinite(Number(entry.totalAnswered))
      ? Number(entry.totalAnswered)
      : Number(entry.score),
    elapsedMs: Number.isFinite(Number(entry.elapsedMs)) ? Number(entry.elapsedMs) : 0,
    categoryLabel: entry.categoryLabel ? String(entry.categoryLabel) : null,
    letter: entry.letter ? String(entry.letter) : null,
    playedAt,
  };
}

/**
 * @param {{storage: object, fetchImpl?: typeof fetch}} options
 */
export function createLeaderboardStore({ storage, fetchImpl = globalThis.fetch }) {
  // Purge any legacy v2 leaderboard key in browser localStorage so old cached entries or sensitive fields are removed
  try {
    globalThis.localStorage?.removeItem?.('learninghub.v2.leaderboard');
  } catch {
    /* ignore */
  }
  // Stored shape: { entries: Array<{login, avatarUrl, puzzleDate, trainerId, variantKey, score, elapsedMs, categoryLabel, letter}> }
  let state = storage.read(STORAGE_KEYS.leaderboard, { entries: [] });
  if (!Array.isArray(state?.entries)) {
    state = { entries: [] };
  } else {
    let hadLegacyOrSensitive = false;
    const filtered = [];
    for (const raw of state.entries) {
      if (raw && 'name' in raw) hadLegacyOrSensitive = true;
      const cleaned = cleanEntry(raw);
      if (cleaned) {
        filtered.push(cleaned);
      } else {
        hadLegacyOrSensitive = true;
      }
    }
    if (hadLegacyOrSensitive || filtered.length !== state.entries.length) {
      state = { entries: filtered };
      storage.write(STORAGE_KEYS.leaderboard, state);
    }
  }

  function persist() {
    storage.write(STORAGE_KEYS.leaderboard, state);
  }

  /**
   * Merge an array of remote or local entries into the store, keeping the best
   * performance for each `(login, puzzleDate, trainerId, variantKey)`.
   */
  function mergeEntries(incomingEntries = []) {
    if (!Array.isArray(incomingEntries) || incomingEntries.length === 0) {
      return state.entries;
    }

    let changed = false;
    for (const rawEntry of incomingEntries) {
      const entry = cleanEntry(rawEntry);
      if (!entry?.login || !entry?.puzzleDate || !entry?.trainerId || typeof entry.score !== 'number') {
        continue;
      }
      const lowerBetter = isLowerBetter(entry.trainerId);
      const existingIdx = state.entries.findIndex(
        (e) =>
          e.login.toLowerCase() === entry.login.toLowerCase() &&
          e.puzzleDate === entry.puzzleDate &&
          e.trainerId === entry.trainerId &&
          (e.variantKey ?? 'daily') === (entry.variantKey ?? 'daily'),
      );

      if (existingIdx >= 0) {
        const prev = state.entries[existingIdx];
        const isBetter = lowerBetter ? entry.score < prev.score : entry.score > prev.score;
        const isEqualFaster =
          entry.score === prev.score &&
          (entry.elapsedMs ?? Infinity) < (prev.elapsedMs ?? Infinity);
        if (isBetter || isEqualFaster) {
          state.entries[existingIdx] = { ...prev, ...entry };
          changed = true;
        }
      } else {
        state.entries.push({ ...entry });
        changed = true;
      }
    }

    if (changed) {
      persist();
    }
    return state.entries;
  }

  /**
   * Synchronize local entries with the shared backend (`/api/leaderboard`) so
   * every user sees all players' daily and all-time scores.
   */
  async function syncWithServer() {
    if (typeof fetchImpl !== 'function') return state.entries;
    try {
      const hasLocal = state.entries.length > 0;
      const response = await fetchImpl('/api/leaderboard', {
        method: hasLocal ? 'POST' : 'GET',
        cache: 'no-store',
        headers: hasLocal
          ? { 'Content-Type': 'application/json', Accept: 'application/json' }
          : { Accept: 'application/json' },
        body: hasLocal ? JSON.stringify({ entries: state.entries }) : undefined,
      });
      if (!response?.ok) return state.entries;
      const data = await response.json();
      if (Array.isArray(data?.entries)) {
        mergeEntries(data.entries);
      }
    } catch {
      /* offline or test environment — local entries remain intact */
    }
    return state.entries;
  }

  /**
   * Record a user's round score onto the leaderboard and push it to the shared server.
   */
  function recordEntry({ user, result, adminMode = false, sync = true }) {
    if (!user?.login || !result) return null;
    if (adminMode || result.adminMode || result.isAdminMode || result.isPractice || result.practice) {
      return null;
    }

    const isFigurePairs = isLowerBetter(result.trainerId);
    // For Figure Pairs, the user's leaderboard score is total tries (totalAnswered),
    // or mistakes + pairs matched if totalAnswered is absent. Fewer tries = better!
    const recordedScore = isFigurePairs
      ? result.totalAnswered || (result.mistakes ?? 0) + (result.correctCount ?? 0)
      : result.score;

    const record = {
      login: user.login,
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

    const existingIdx = state.entries.findIndex(
      (e) =>
        e.login.toLowerCase() === user.login.toLowerCase() &&
        e.puzzleDate === result.puzzleDate &&
        e.trainerId === result.trainerId &&
        e.variantKey === result.variantKey,
    );

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

    if (sync && typeof fetchImpl === 'function') {
      fetchImpl('/api/leaderboard', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ entry: record, entries: state.entries }),
      })
        .then((r) => (r?.ok ? r.json() : null))
        .then((data) => {
          if (Array.isArray(data?.entries)) {
            mergeEntries(data.entries);
          }
        })
        .catch(() => {});
    }

    return record;
  }

  /**
   * Get the daily leaderboard for a specific puzzleDate (defaults to Word Rush).
   */
  function dailyLeaderboard(puzzleDate, { trainerId = 'word-rush' } = {}) {
    const lowerBetter = isLowerBetter(trainerId);
    const userEntries = state.entries.filter(
      (e) => e.puzzleDate === puzzleDate && e.trainerId === trainerId,
    );
    const byLogin = new Map();

    for (const entry of userEntries) {
      const key = entry.login.toLowerCase();
      const prev = byLogin.get(key);
      if (!prev) {
        byLogin.set(key, { ...entry });
      } else if (lowerBetter ? entry.score < prev.score : entry.score > prev.score) {
        byLogin.set(key, { ...entry });
      }
    }

    return [...byLogin.values()]
      .sort((a, b) => {
        const scoreDiff = lowerBetter ? a.score - b.score : b.score - a.score;
        if (scoreDiff !== 0) return scoreDiff;
        return (a.elapsedMs ?? 120000) - (b.elapsedMs ?? 120000);
      })
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }

  /**
   * Get the all-time leaderboard across all users for a given trainer.
   */
  function allTimeLeaderboard({ trainerId = 'word-rush' } = {}) {
    const lowerBetter = isLowerBetter(trainerId);
    const userEntries = state.entries.filter((e) => e.trainerId === trainerId);
    const aggregatedUsers = new Map();

    for (const entry of userEntries) {
      const key = entry.login.toLowerCase();
      const current = aggregatedUsers.get(key) ?? {
        login: entry.login,
        avatarUrl: entry.avatarUrl,
        totalWords: 0,
        bestScore: lowerBetter ? Infinity : 0,
        roundsPlayed: 0,
      };
      current.totalWords += entry.score;
      current.bestScore = lowerBetter
        ? Math.min(current.bestScore, entry.score)
        : Math.max(current.bestScore, entry.score);
      current.roundsPlayed += 1;
      aggregatedUsers.set(key, current);
    }

    return [...aggregatedUsers.values()]
      .sort((a, b) => {
        if (lowerBetter) {
          // For Figure Pairs all-time: fewest best-run tries first, then most rounds completed
          return a.bestScore - b.bestScore || b.roundsPlayed - a.roundsPlayed;
        }
        return b.totalWords - a.totalWords || b.bestScore - a.bestScore;
      })
      .map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }

  return {
    recordEntry,
    mergeEntries,
    syncWithServer,
    dailyLeaderboard,
    allTimeLeaderboard,
    allEntries: () => [...state.entries],
  };
}
