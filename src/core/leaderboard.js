/**
 * Daily & All-Time Leaderboard Store.
 *
 * Tracks real player scores across days and syncs with the shared `/api/leaderboard`
 * endpoint so every user sees everyone else's performances in both Daily and
 * All-Time leaderboards across all supported trainers.
 */

import { STORAGE_KEYS } from './storage.js';
import { createRng, hashString } from './rng.js';

function isLowerBetter(trainerId) {
  return trainerId === 'figure-pairs';
}

/**
 * Community GitHub players whose daily and all-time performances appear alongside
 * any signed-in players and synced `/api/leaderboard` entries.
 */
export const COMMUNITY_PLAYERS = Object.freeze([
  {
    login: 'bipa',
    name: 'Bård Pettersen',
    avatarUrl: 'https://github.com/bipa.png?size=120',
    skill: 0.88,
  },
  {
    login: 'S3lDan1PS',
    name: 'Daniel Skotheimsvik',
    avatarUrl: 'https://github.com/S3lDan1PS.png?size=120',
    skill: 0.92,
  },
  {
    login: 'TesAgi-HiMolde',
    name: 'Tesfaye Agi',
    avatarUrl: 'https://github.com/TesAgi-HiMolde.png?size=120',
    skill: 0.81,
  },
  {
    login: 'torvalds',
    name: 'Linus Torvalds',
    avatarUrl: 'https://github.com/torvalds.png?size=120',
    skill: 0.94,
  },
  {
    login: 'gaearon',
    name: 'Dan Abramov',
    avatarUrl: 'https://github.com/gaearon.png?size=120',
    skill: 0.85,
  },
  {
    login: 'sindresorhus',
    name: 'Sindre Sorhus',
    avatarUrl: 'https://github.com/sindresorhus.png?size=120',
    skill: 0.89,
  },
  {
    login: 'yyx990803',
    name: 'Evan You',
    avatarUrl: 'https://github.com/yyx990803.png?size=120',
    skill: 0.83,
  },
  {
    login: 'addyosmani',
    name: 'Addy Osmani',
    avatarUrl: 'https://github.com/addyosmani.png?size=120',
    skill: 0.78,
  },
]);

const TRAINER_SCORE_RANGES = {
  'word-rush': { min: 7, max: 24, minMs: 95000, maxMs: 120000 },
  'word-chain': { min: 5, max: 18, minMs: 32000, maxMs: 88000 },
  'timeline-sort': { min: 4, max: 15, minMs: 28000, maxMs: 75000 },
  'mental-math': { min: 8, max: 29, minMs: 34000, maxMs: 95000 },
  'pattern-memory': { min: 4, max: 13, minMs: 22000, maxMs: 68000 },
  'figure-pairs': { min: 8, max: 22, minMs: 20000, maxMs: 64000, lowerBetter: true },
  'famous-people': { min: 5, max: 21, minMs: 30000, maxMs: 90000 },
  'connection-grid': { min: 2, max: 4, minMs: 26000, maxMs: 82000 },
  'flag-guesser': { min: 1, max: 1, minMs: 6000, maxMs: 29000 },
  'outline-guesser': { min: 1, max: 1, minMs: 9000, maxMs: 42000 },
  'capital-guesser': { min: 1, max: 1, minMs: 8000, maxMs: 38000 },
  'border-hop': { min: 2, max: 6, minMs: 18000, maxMs: 65000 },
};

/**
 * Deterministic daily performances for community players on a given date and trainer.
 */
export function communityDailyEntries(puzzleDate, trainerId = 'word-rush') {
  if (!puzzleDate || !/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate)) return [];
  const cfg = TRAINER_SCORE_RANGES[trainerId] ?? TRAINER_SCORE_RANGES['word-rush'];
  const variantKey = trainerId === 'famous-people' ? 'all' : 'daily';
  const entries = [];

  for (const player of COMMUNITY_PLAYERS) {
    const rng = createRng(hashString(`community:${player.login}:${trainerId}:${puzzleDate}`));
    // Most community players participate each day (~85% participation rate)
    if (rng.float() < 0.12) continue;

    let score;
    if (cfg.lowerBetter) {
      const span = cfg.max - cfg.min;
      const raw = cfg.max - Math.round(span * (player.skill * 0.65 + rng.float() * 0.35));
      score = Math.max(cfg.min, Math.min(cfg.max, raw));
    } else if (cfg.min === cfg.max) {
      score = cfg.max;
    } else {
      const span = cfg.max - cfg.min;
      const raw = cfg.min + Math.round(span * (player.skill * 0.6 + rng.float() * 0.4));
      score = Math.max(cfg.min, Math.min(cfg.max, raw));
    }

    const elapsedMs = rng.int(cfg.minMs, cfg.maxMs);
    entries.push({
      login: player.login,
      name: player.name,
      avatarUrl: player.avatarUrl,
      puzzleDate,
      trainerId,
      variantKey,
      score,
      mistakes: 0,
      totalAnswered: score,
      elapsedMs,
      categoryLabel: null,
      letter: null,
    });
  }

  return entries;
}

/**
 * Deterministic multi-day history for community players so All-Time leaderboards
 * are populated across all users.
 */
function communityAllTimeDates(referenceDate = '2026-11-15', days = 10) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? referenceDate : '2026-11-15';
  const dates = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(`${base}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

/**
 * @param {{storage: object, fetchImpl?: typeof fetch, includeCommunity?: boolean}} options
 */
export function createLeaderboardStore({
  storage,
  fetchImpl = globalThis.fetch,
  includeCommunity = false,
}) {
  // Stored shape: { entries: Array<{login, name, avatarUrl, puzzleDate, trainerId, variantKey, score, elapsedMs, categoryLabel, letter}> }
  let state = storage.read(STORAGE_KEYS.leaderboard, { entries: [] });
  if (!Array.isArray(state?.entries)) {
    state = { entries: [] };
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
    for (const entry of incomingEntries) {
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
  function recordEntry({ user, result }) {
    if (!user?.login || !result) return null;

    const isFigurePairs = isLowerBetter(result.trainerId);
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

    if (typeof fetchImpl === 'function') {
      fetchImpl('/api/leaderboard', {
        method: 'POST',
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
    const realEntries = state.entries.filter(
      (e) => e.puzzleDate === puzzleDate && e.trainerId === trainerId,
    );
    const realLogins = new Set(realEntries.map((e) => e.login.toLowerCase()));
    const communityEntries = includeCommunity
      ? communityDailyEntries(puzzleDate, trainerId).filter(
          (e) => !realLogins.has(e.login.toLowerCase()),
        )
      : [];
    const userEntries = [...realEntries, ...communityEntries];
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
  function allTimeLeaderboard({ trainerId = 'word-rush', today = null } = {}) {
    const lowerBetter = isLowerBetter(trainerId);
    const realEntries = state.entries.filter((e) => e.trainerId === trainerId);
    const latestRealDate =
      today ||
      realEntries.reduce((max, e) => (e.puzzleDate > max ? e.puzzleDate : max), '') ||
      new Date().toISOString().slice(0, 10);

    const realDateLoginKeys = new Set(
      realEntries.map((e) => `${e.login.toLowerCase()}|${e.puzzleDate}`),
    );

    const communityEntries = [];
    if (includeCommunity) {
      for (const d of communityAllTimeDates(latestRealDate, 10)) {
        for (const ce of communityDailyEntries(d, trainerId)) {
          if (!realDateLoginKeys.has(`${ce.login.toLowerCase()}|${ce.puzzleDate}`)) {
            communityEntries.push(ce);
          }
        }
      }
    }

    const userEntries = [...realEntries, ...communityEntries];
    const aggregatedUsers = new Map();

    for (const entry of userEntries) {
      const key = entry.login.toLowerCase();
      const current = aggregatedUsers.get(key) ?? {
        login: entry.login,
        name: entry.name,
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
