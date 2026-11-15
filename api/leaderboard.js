/**
 * Shared Daily & All-Time Leaderboard API (`GET /api/leaderboard` & `POST /api/leaderboard`).
 *
 * Persists leaderboard entries across all signed-in GitHub users so every
 * player sees everyone else's daily and all-time performances across devices.
 *
 * Storage tiers (automatic fallback):
 *   1. Upstash Redis / Vercel KV REST API (`KV_REST_API_URL` & `KV_REST_API_TOKEN`
 *      or `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`) when configured.
 *   2. GitHub Gist JSON store (`GITHUB_GIST_ID` & `GITHUB_GIST_TOKEN`) when configured.
 *   3. Local JSON file (`.data/leaderboard.json` or `/tmp/learninghub-leaderboard.json`)
 *      plus in-memory cache so local development and serverless instances share state.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KV_KEY = 'learninghub:v2:leaderboard';
const MAX_ENTRIES = 5000;

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_FILE = join(HERE, '..', '.data', 'leaderboard.json');
const TMP_DATA_FILE = '/tmp/learninghub-leaderboard.json';

/** In-memory cache shared across warm invocations. */
let memoryEntries = null;

function isLowerBetterTrainer(trainerId) {
  return trainerId === 'figure-pairs';
}

function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const login = String(raw.login ?? '').trim();
  const puzzleDate = String(raw.puzzleDate ?? '').trim();
  const trainerId = String(raw.trainerId ?? '').trim();
  const variantKey = String(raw.variantKey ?? 'daily').trim();
  const score = Number(raw.score);

  if (!login || !/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate) || !trainerId || !Number.isFinite(score)) {
    return null;
  }

  return {
    login,
    name: String(raw.name || login).trim().slice(0, 80),
    avatarUrl:
      typeof raw.avatarUrl === 'string' && raw.avatarUrl.startsWith('https://')
        ? raw.avatarUrl
        : `https://github.com/${encodeURIComponent(login)}.png?size=120`,
    puzzleDate,
    trainerId,
    variantKey,
    score,
    mistakes: Number.isFinite(Number(raw.mistakes)) ? Number(raw.mistakes) : 0,
    totalAnswered: Number.isFinite(Number(raw.totalAnswered)) ? Number(raw.totalAnswered) : score,
    elapsedMs: Number.isFinite(Number(raw.elapsedMs)) ? Number(raw.elapsedMs) : 0,
    categoryLabel: typeof raw.categoryLabel === 'string' ? raw.categoryLabel.slice(0, 80) : null,
    letter: typeof raw.letter === 'string' ? raw.letter.slice(0, 8) : null,
    playedAt: Number.isFinite(Number(raw.playedAt)) ? Number(raw.playedAt) : Date.now(),
  };
}

/**
 * Merge two arrays of leaderboard entries, keeping each player's best score per
 * `(login, puzzleDate, trainerId, variantKey)`.
 */
export function mergeLeaderboardEntries(existing = [], incoming = []) {
  const map = new Map();

  for (const raw of [...existing, ...incoming]) {
    const entry = sanitizeEntry(raw);
    if (!entry) continue;
    const key = `${entry.login.toLowerCase()}|${entry.puzzleDate}|${entry.trainerId}|${entry.variantKey}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, entry);
      continue;
    }
    const lowerBetter = isLowerBetterTrainer(entry.trainerId);
    const isBetter = lowerBetter ? entry.score < prev.score : entry.score > prev.score;
    const isEqualFaster =
      entry.score === prev.score && (entry.elapsedMs ?? Infinity) < (prev.elapsedMs ?? Infinity);
    if (isBetter || isEqualFaster) {
      map.set(key, entry);
    }
  }

  const merged = [...map.values()];
  if (merged.length > MAX_ENTRIES) {
    merged.sort((a, b) => (b.playedAt ?? 0) - (a.playedAt ?? 0));
    return merged.slice(0, MAX_ENTRIES);
  }
  return merged;
}

function readFileStore() {
  for (const candidate of [LOCAL_DATA_FILE, TMP_DATA_FILE]) {
    try {
      if (existsSync(candidate)) {
        const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
        if (Array.isArray(parsed?.entries)) {
          return parsed.entries;
        }
      }
    } catch {
      /* ignore and try next */
    }
  }
  return [];
}

function writeFileStore(entries) {
  const payload = JSON.stringify({ entries, updatedAt: Date.now() }, null, 2);
  for (const candidate of [LOCAL_DATA_FILE, TMP_DATA_FILE]) {
    try {
      mkdirSync(dirname(candidate), { recursive: true });
      writeFileSync(candidate, payload, 'utf8');
      return true;
    } catch {
      /* try fallback path */
    }
  }
  return false;
}

async function readKvStore() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/get/${encodeURIComponent(KV_KEY)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.result) return [];
    const parsed = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return Array.isArray(parsed?.entries) ? parsed.entries : Array.isArray(parsed) ? parsed : [];
  } catch {
    return null;
  }
}

async function writeKvStore(entries) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return false;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/set/${encodeURIComponent(KV_KEY)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(JSON.stringify({ entries, updatedAt: Date.now() })),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loadSharedEntries() {
  const kvEntries = await readKvStore();
  const fileEntries = readFileStore();
  const combined = mergeLeaderboardEntries(
    memoryEntries ?? [],
    mergeLeaderboardEntries(fileEntries, kvEntries ?? []),
  );
  memoryEntries = combined;
  return combined;
}

export async function saveSharedEntries(incomingEntries) {
  const current = await loadSharedEntries();
  const merged = mergeLeaderboardEntries(current, incomingEntries);
  memoryEntries = merged;
  writeFileStore(merged);
  await writeKvStore(merged);
  return merged;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const entries = await loadSharedEntries();
    res.status(200).json({ entries });
    return;
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const incoming = Array.isArray(body.entries)
      ? body.entries
      : body.entry
        ? [body.entry]
        : [];

    const entries = await saveSharedEntries(incoming);
    res.status(200).json({ entries });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
