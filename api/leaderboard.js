/**
 * Shared Daily & All-Time Leaderboard API (`GET /api/leaderboard` & `POST /api/leaderboard`).
 *
 * Persists real player leaderboard entries across all signed-in GitHub users so
 * every player sees everyone else's daily and all-time performances across devices.
 * Zero fake or pre-seeded players.
 *
 * Storage tiers (automatic multi-tier sync):
 *   1. Upstash Redis / Vercel KV REST API (`KV_REST_API_URL` & `KV_REST_API_TOKEN`
 *      or `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`) when configured.
 *   2. Built-in compressed cloud KV store (`keyvalue.immanuel.co` with deflate +
 *      base64url chunking) so serverless deployments on Vercel persist scores
 *      globally out-of-the-box with zero external setup required.
 *   3. Local JSON file (`.data/leaderboard.json` or `/tmp/learninghub-leaderboard.json`)
 *      plus in-memory cache for fast local development and warm serverless instances.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

const KV_KEY = 'learninghub:v3:leaderboard';
const KV_WORDS_KEY = 'learninghub:v3:learned_words';
const CLOUD_KV_APP_KEY = process.env.LEADERBOARD_KV_APP_KEY || 'xsmx36lv';
const CLOUD_KV_PREFIX = 'lh_v3_clean';
const CLOUD_WORDS_PREFIX = 'lh_v3_words';
const CLOUD_CHUNK_SIZE = 180;
const MAX_CLOUD_CHUNKS = 25;
const MAX_ENTRIES = 500;
const S3LDAN_RESET_CUTOFF_MS = 1795026000000;

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCAL_DATA_FILE = join(HERE, '..', '.data', 'leaderboard.json');
const TMP_DATA_FILE = '/tmp/learninghub-leaderboard.json';
const LOCAL_WORDS_FILE = join(HERE, '..', '.data', 'learned-words.json');
const TMP_WORDS_FILE = '/tmp/learninghub-learned-words.json';

/** In-memory cache shared across warm invocations. */
let memoryEntries = null;
let memoryLearnedWords = null;

function isLowerBetterTrainer(trainerId) {
  return trainerId === 'figure-pairs';
}

function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.practice || raw.isPractice || raw.adminMode || raw.isAdminMode) return null;

  const login = String(raw.login ?? '').trim();
  const puzzleDate = String(raw.puzzleDate ?? '').trim();
  const trainerId = String(raw.trainerId ?? '').trim();
  const variantKey = String(raw.variantKey ?? 'daily').trim();
  const score = Number(raw.score);
  const playedAt = Number.isFinite(Number(raw.playedAt)) ? Number(raw.playedAt) : Date.now();

  if (!login || !/^\d{4}-\d{2}-\d{2}$/.test(puzzleDate) || !trainerId || !Number.isFinite(score)) {
    return null;
  }

  // Filter out the historical pre-reset S3lDan1PS entries so they cannot be re-imported
  if (login.toLowerCase() === 's3ldan1ps' && playedAt <= S3LDAN_RESET_CUTOFF_MS) {
    return null;
  }

  return {
    login,
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
    playedAt,
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
  let combined = [];
  for (const candidate of [LOCAL_DATA_FILE, TMP_DATA_FILE]) {
    try {
      if (existsSync(candidate)) {
        const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
        if (Array.isArray(parsed?.entries)) {
          combined = mergeLeaderboardEntries(combined, parsed.entries);
        }
      }
    } catch {
      /* ignore and try next */
    }
  }
  return combined;
}

function writeFileStore(entries) {
  const payload = JSON.stringify({ entries, updatedAt: Date.now() }, null, 2);
  let wroteAny = false;
  for (const candidate of [LOCAL_DATA_FILE, TMP_DATA_FILE]) {
    try {
      mkdirSync(dirname(candidate), { recursive: true });
      writeFileSync(candidate, payload, 'utf8');
      wroteAny = true;
    } catch {
      /* try fallback path */
    }
  }
  return wroteAny;
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

function packCompactEntry(e) {
  return [
    e.login,
    e.puzzleDate,
    e.trainerId,
    e.variantKey === 'daily' ? '' : e.variantKey,
    e.score,
    e.mistakes || 0,
    e.totalAnswered ?? e.score,
    e.elapsedMs || 0,
    e.categoryLabel || '',
    e.letter || '',
    e.playedAt || 0,
  ];
}

function unpackCompactEntry(row) {
  if (!Array.isArray(row) || row.length < 6) return sanitizeEntry(row);
  // Support both 11-element (no name) and legacy 12-element rows
  if (row.length >= 12 && /^\d{4}-\d{2}-\d{2}$/.test(String(row[2] ?? ''))) {
    const [
      login,
      _legacyName,
      puzzleDate,
      trainerId,
      variantKey,
      score,
      mistakes,
      totalAnswered,
      elapsedMs,
      categoryLabel,
      letter,
      playedAt,
    ] = row;
    return sanitizeEntry({
      login,
      avatarUrl: `https://github.com/${encodeURIComponent(login)}.png?size=120`,
      puzzleDate,
      trainerId,
      variantKey: variantKey || 'daily',
      score,
      mistakes,
      totalAnswered,
      elapsedMs,
      categoryLabel: categoryLabel || null,
      letter: letter || null,
      playedAt: playedAt || Date.now(),
    });
  }
  const [
    login,
    puzzleDate,
    trainerId,
    variantKey,
    score,
    mistakes,
    totalAnswered,
    elapsedMs,
    categoryLabel,
    letter,
    playedAt,
  ] = row;
  return sanitizeEntry({
    login,
    avatarUrl: `https://github.com/${encodeURIComponent(login)}.png?size=120`,
    puzzleDate,
    trainerId,
    variantKey: variantKey || 'daily',
    score,
    mistakes,
    totalAnswered,
    elapsedMs,
    categoryLabel: categoryLabel || null,
    letter: letter || null,
    playedAt: playedAt || Date.now(),
  });
}

async function fetchKvWithRetry(url, options = {}, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
    } catch {
      /* retry */
    }
    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, 80 * (attempt + 1)));
    }
  }
  return null;
}

async function readBuiltInCloudKv() {
  try {
    const metaRes = await fetchKvWithRetry(
      `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${CLOUD_KV_APP_KEY}/${CLOUD_KV_PREFIX}_meta`,
    );
    if (!metaRes) return [];
    const metaRaw = JSON.parse(await metaRes.text());
    if (!metaRaw || typeof metaRaw !== 'string') return [];
    const chunkCount = Number(metaRaw);
    if (!Number.isInteger(chunkCount) || chunkCount <= 0 || chunkCount > MAX_CLOUD_CHUNKS) {
      return [];
    }

    const chunks = [];
    for (let idx = 0; idx < chunkCount; idx += 1) {
      const res = await fetchKvWithRetry(
        `https://keyvalue.immanuel.co/api/KeyVal/GetValue/${CLOUD_KV_APP_KEY}/${CLOUD_KV_PREFIX}_c${idx}`,
      );
      if (!res) return [];
      const val = JSON.parse(await res.text());
      if (typeof val !== 'string' || !val) return [];
      chunks.push(val);
    }

    const joined = chunks.join('');
    if (!joined) return [];
    const decompressed = inflateRawSync(Buffer.from(joined, 'base64url')).toString('utf8');
    const rows = JSON.parse(decompressed);
    if (!Array.isArray(rows)) return [];
    return rows.map(unpackCompactEntry).filter(Boolean);
  } catch {
    return [];
  }
}

async function writeBuiltInCloudKv(entries) {
  try {
    const compactRows = entries.map(packCompactEntry);
    const compressed = deflateRawSync(Buffer.from(JSON.stringify(compactRows))).toString(
      'base64url',
    );
    const chunks = [];
    for (let i = 0; i < compressed.length; i += CLOUD_CHUNK_SIZE) {
      chunks.push(compressed.slice(i, i + CLOUD_CHUNK_SIZE));
    }
    if (chunks.length === 0 || chunks.length > MAX_CLOUD_CHUNKS) return false;

    for (let idx = 0; idx < chunks.length; idx += 1) {
      const res = await fetchKvWithRetry(
        `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${CLOUD_KV_APP_KEY}/${CLOUD_KV_PREFIX}_c${idx}/${chunks[idx]}`,
        { method: 'POST' },
      );
      if (!res) return false;
    }

    const metaRes = await fetchKvWithRetry(
      `https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${CLOUD_KV_APP_KEY}/${CLOUD_KV_PREFIX}_meta/${chunks.length}`,
      { method: 'POST' },
    );
    return Boolean(metaRes?.ok);
  } catch {
    return false;
  }
}

function sanitizeLearnedWord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const categoryId = String(raw.categoryId ?? '').trim().toLowerCase();
  const label = String(raw.label ?? '').trim().slice(0, 80);
  if (!categoryId || !label) return null;
  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives.map((a) => String(a ?? '').trim().slice(0, 80)).filter(Boolean).slice(0, 8)
    : undefined;
  return alternatives?.length ? { categoryId, label, alternatives } : { categoryId, label };
}

export function mergeLearnedWords(existing = [], incoming = []) {
  const map = new Map();
  for (const raw of [...existing, ...incoming]) {
    const item = sanitizeLearnedWord(raw);
    if (!item) continue;
    const key = `${item.categoryId}|${item.label.toLowerCase()}`;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return [...map.values()].slice(0, 2000);
}

function readLearnedWordsFileStore() {
  let combined = [];
  for (const candidate of [LOCAL_WORDS_FILE, TMP_WORDS_FILE]) {
    try {
      if (existsSync(candidate)) {
        const parsed = JSON.parse(readFileSync(candidate, 'utf8'));
        if (Array.isArray(parsed?.learnedWords)) {
          combined = mergeLearnedWords(combined, parsed.learnedWords);
        }
      }
    } catch {
      /* ignore */
    }
  }
  return combined;
}

function writeLearnedWordsFileStore(learnedWords) {
  const payload = JSON.stringify({ learnedWords, updatedAt: Date.now() }, null, 2);
  let wroteAny = false;
  for (const candidate of [LOCAL_WORDS_FILE, TMP_WORDS_FILE]) {
    try {
      mkdirSync(dirname(candidate), { recursive: true });
      writeFileSync(candidate, payload, 'utf8');
      wroteAny = true;
    } catch {
      /* ignore */
    }
  }
  return wroteAny;
}

export async function loadSharedLearnedWords() {
  const fileWords = readLearnedWordsFileStore();
  memoryLearnedWords = mergeLearnedWords(memoryLearnedWords ?? [], fileWords);
  return memoryLearnedWords;
}

export async function saveSharedLearnedWords(incomingWords = []) {
  const current = await loadSharedLearnedWords();
  const merged = mergeLearnedWords(current, incomingWords);
  memoryLearnedWords = merged;
  writeLearnedWordsFileStore(merged);
  return merged;
}

export async function loadSharedEntries() {
  const [kvEntries, cloudEntries] = await Promise.all([readKvStore(), readBuiltInCloudKv()]);
  const fileEntries = readFileStore();
  const combined = mergeLeaderboardEntries(
    memoryEntries ?? [],
    mergeLeaderboardEntries(
      fileEntries,
      mergeLeaderboardEntries(kvEntries ?? [], cloudEntries ?? []),
    ),
  );
  memoryEntries = combined;
  return combined;
}

export async function saveSharedEntries(incomingEntries) {
  const current = await loadSharedEntries();
  const merged = mergeLeaderboardEntries(current, incomingEntries);
  memoryEntries = merged;
  writeFileStore(merged);
  await Promise.all([writeKvStore(merged), writeBuiltInCloudKv(merged)]);
  return merged;
}

export default async function handler(req, res) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  if (req.method === 'GET') {
    const [entries, learnedWords] = await Promise.all([
      loadSharedEntries(),
      loadSharedLearnedWords(),
    ]);
    res.status(200).json({ entries, learnedWords });
    return;
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const incoming = Array.isArray(body.entries)
      ? body.entries
      : body.entry
        ? [body.entry]
        : [];
    const incomingWords = Array.isArray(body.learnedWords)
      ? body.learnedWords
      : body.learnedWord
        ? [body.learnedWord]
        : [];

    const [entries, learnedWords] = await Promise.all([
      incoming.length > 0 ? saveSharedEntries(incoming) : loadSharedEntries(),
      incomingWords.length > 0 ? saveSharedLearnedWords(incomingWords) : loadSharedLearnedWords(),
    ]);
    res.status(200).json({ entries, learnedWords });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
