/**
 * Persistence, attempts, comparison, archive and weak-area analysis.
 * Covers US-3.7..US-3.10, US-7.1..US-7.16, US-8.1..US-8.6.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createStorage, createMemoryBackend, STORAGE_KEYS, SCHEMA_VERSION } from '../src/core/storage.js';
import { createProgressStore, compareToPrevious, compareToBest } from '../src/core/progress.js';
import { analyseWeakAreas, aggregateCategories } from '../src/core/weak-areas.js';
import { listArchive, isValidPuzzleDate, EARLIEST_PUZZLE_DATE } from '../src/core/archive.js';
import { addDays } from '../src/core/clock.js';

function makeResult(overrides = {}) {
  return {
    id: `id-${Math.random()}`,
    trainerId: 'mental-math',
    puzzleDate: '2026-10-12',
    difficulty: 'intermediate',
    roundMode: 'timed',
    modeParam: 60,
    score: 20,
    playedAt: 1,
    endedBy: 'time-expired',
    elapsedMs: 60000,
    totalAnswered: 25,
    correctCount: 20,
    accuracy: 80,
    avgAnswerTimeMs: 2400,
    bestStreak: 9,
    livesRemaining: null,
    maxLevel: null,
    categoryStats: [],
    ...overrides,
  };
}

function freshStore() {
  const storage = createStorage({ backend: createMemoryBackend() });
  return { storage, progress: createProgressStore({ storage }) };
}

/* ------------------------------------------------------------ attempt rules */

test('an attempt is consumed per trainer per date, independently (US-3.7)', () => {
  const { progress } = freshStore();

  assert.equal(progress.hasAttempt('mental-math', '2026-10-12'), false);
  progress.recordResult(makeResult());

  assert.equal(progress.hasAttempt('mental-math', '2026-10-12'), true);
  assert.equal(progress.hasAttempt('memory', '2026-10-12'), false, 'other trainers stay available');
  assert.equal(progress.hasAttempt('mental-math', '2026-10-13'), false, 'tomorrow stays available');
});

test('results persist across a reload (US-7.1, FR-83)', () => {
  const backend = createMemoryBackend();
  const first = createProgressStore({ storage: createStorage({ backend }) });
  first.recordResult(makeResult({ score: 23 }));

  // A fresh store over the same backend is what a page reload amounts to.
  const second = createProgressStore({ storage: createStorage({ backend }) });
  assert.equal(second.hasAttempt('mental-math', '2026-10-12'), true);
  assert.equal(second.history('mental-math')[0].score, 23);
  assert.equal(second.forTrainer('mental-math').personalBest, 23);
});

/* -------------------------------------------------------------- comparisons */

test('the personal best only moves on a strictly greater score (US-7.2, FR-61)', () => {
  const { progress } = freshStore();

  progress.recordResult(makeResult({ puzzleDate: '2026-10-10', score: 18 }));
  assert.equal(progress.forTrainer('mental-math').personalBest, 18);

  progress.recordResult(makeResult({ puzzleDate: '2026-10-11', score: 17 }));
  assert.equal(progress.forTrainer('mental-math').personalBest, 18, 'a lower score must not overwrite');

  progress.recordResult(makeResult({ puzzleDate: '2026-10-12', score: 18 }));
  assert.equal(progress.forTrainer('mental-math').personalBest, 18, 'an equal score is not an improvement');

  const better = progress.recordResult(makeResult({ puzzleDate: '2026-10-13', score: 19 }));
  assert.equal(progress.forTrainer('mental-math').personalBest, 19);
  assert.equal(better.vsBest.isNewBest, true);
});

test('comparison against the previous attempt reads correctly (US-7.3, FR-65)', () => {
  assert.equal(compareToPrevious(23, { score: 20 }).status, 'better');
  assert.equal(compareToPrevious(23, { score: 20 }).delta, 3);
  assert.equal(compareToPrevious(17, { score: 20 }).status, 'worse');
  assert.equal(compareToPrevious(17, { score: 20 }).delta, -3);
  assert.equal(compareToPrevious(20, { score: 20 }).status, 'equal');
  assert.equal(compareToPrevious(20, null).status, 'first');
});

test('comparison against the all-time best reads correctly (US-7.4, FR-66)', () => {
  assert.equal(compareToBest(23, 25, true).status, 'below');
  assert.equal(compareToBest(26, 25, true).status, 'new-best');
  assert.equal(compareToBest(26, 25, true).isNewBest, true);
  assert.equal(compareToBest(25, 25, true).isNewBest, false);
});

test('the first ever attempt states there is nothing to compare (US-7.5, FR-67)', () => {
  const { progress } = freshStore();
  const outcome = progress.recordResult(makeResult({ score: 12 }));

  assert.equal(outcome.vsPrevious.status, 'first');
  assert.match(outcome.vsPrevious.message, /first attempt/i);
  assert.equal(outcome.vsBest.isNewBest, true);
  assert.equal(outcome.personalBest, 12);
});

test('an archive result compares against the right previous attempt (US-7.10)', () => {
  const { progress } = freshStore();
  progress.recordResult(makeResult({ puzzleDate: '2026-10-10', score: 10 }));
  progress.recordResult(makeResult({ puzzleDate: '2026-10-12', score: 30 }));

  // Playing the 11th today must sit at the 11th in history, not at today.
  progress.recordResult(makeResult({ puzzleDate: '2026-10-11', score: 20 }));

  const dates = progress.history('mental-math').map((entry) => entry.puzzleDate);
  assert.deepEqual(dates, ['2026-10-10', '2026-10-11', '2026-10-12'], 'history sorts by puzzle date');
});

test('progress totals are reported for the progress view (US-7.11, FR-73)', () => {
  const { progress } = freshStore();
  progress.recordResult(makeResult({ puzzleDate: '2026-10-10', score: 10, elapsedMs: 45000 }));
  progress.recordResult(makeResult({ puzzleDate: '2026-10-11', score: 30, elapsedMs: 60000 }));

  const summary = progress.summaryFor('mental-math');
  assert.equal(summary.puzzlesCompleted, 2);
  assert.equal(summary.totalTimeMs, 105000);
  assert.equal(summary.personalBest, 30);
});

test('an unplayed trainer reports an empty history (US-7.12, FR-74)', () => {
  const { progress } = freshStore();
  assert.deepEqual(progress.history('memory'), []);
  assert.equal(progress.summaryFor('memory').puzzlesCompleted, 0);
});

test('clearing progress frees every attempt (US-7.14, FR-85)', () => {
  const { progress } = freshStore();
  progress.recordResult(makeResult());
  progress.clearAll();

  assert.equal(progress.hasAttempt('mental-math', '2026-10-12'), false);
  assert.equal(progress.forTrainer('mental-math').personalBest, 0);
});

/* ------------------------------------------------------------------ storage */

test('corrupt storage degrades to empty progress with a notice (US-7.13, FR-84)', () => {
  const backend = createMemoryBackend({ [STORAGE_KEYS.progress]: '{ this is not json' });
  const storage = createStorage({ backend });

  const data = storage.read(STORAGE_KEYS.progress, {});
  assert.deepEqual(data, {}, 'the app must start with empty progress rather than crash');
  assert.ok(storage.warnings().length > 0, 'a non-blocking notice must be raised');
});

test('a future schema version is discarded rather than trusted', () => {
  const backend = createMemoryBackend({
    [STORAGE_KEYS.progress]: JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, data: { x: 1 } }),
  });
  const storage = createStorage({ backend });
  assert.deepEqual(storage.read(STORAGE_KEYS.progress, {}), {});
});

test('the app stays playable when storage throws (US-7.15, FR-86)', () => {
  const hostile = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const storage = createStorage({ backend: hostile, available: false });
  const progress = createProgressStore({ storage });

  assert.equal(storage.available, false);
  const outcome = progress.recordResult(makeResult());
  assert.equal(outcome.saved, false, 'the write fails');
  assert.equal(outcome.vsBest.isNewBest, true, 'but the round still completes and compares');
});

test('two years of daily results stay under 1 MB (US-7.16, NFR-10)', () => {
  const backend = createMemoryBackend();
  const storage = createStorage({ backend });
  const progress = createProgressStore({ storage });

  let date = '2026-01-01';
  for (let day = 0; day < 730; day += 1) {
    for (const trainerId of ['mental-math', 'memory', 'geography']) {
      progress.recordResult(makeResult({
        trainerId,
        puzzleDate: date,
        score: 10 + (day % 20),
        categoryStats: [
          { categoryId: 'addition', label: 'Addition', asked: 12, correct: 9 },
          { categoryId: 'fractions', label: 'Fractions', asked: 7, correct: 2 },
        ],
      }));
    }
    date = addDays(date, 1);
  }

  const bytes = storage.size();
  assert.ok(bytes < 1_000_000, `storage grew to ${bytes} bytes, over the 1 MB budget`);
});

/* --------------------------------------------------------------- weak areas */

test('the weakest category is identified in plain language (US-8.2, US-8.4)', () => {
  const stats = [
    { categoryId: 'addition', label: 'Addition', asked: 10, correct: 9 },
    { categoryId: 'fractions', label: 'Fractions', asked: 7, correct: 2 },
    { categoryId: 'division', label: 'Division', asked: 8, correct: 7 },
  ];

  const analysis = analyseWeakAreas(stats);
  assert.equal(analysis.status, 'ok');
  assert.equal(analysis.weakest.categoryId, 'fractions');
  assert.equal(analysis.message, 'You miss Fractions most — 2 of 7 correct');
});

test('thin categories are excluded from the analysis (US-8.3, FR-78)', () => {
  const stats = [
    { categoryId: 'addition', label: 'Addition', asked: 10, correct: 9 },
    { categoryId: 'fractions', label: 'Fractions', asked: 2, correct: 0 },
  ];

  const analysis = analyseWeakAreas(stats);
  assert.equal(analysis.weakest.categoryId, 'addition', 'a 2-prompt category must not win');
});

test('insufficient data is reported honestly (US-8.5, FR-80)', () => {
  const analysis = analyseWeakAreas([
    { categoryId: 'addition', label: 'Addition', asked: 2, correct: 1 },
  ]);
  assert.equal(analysis.status, 'insufficient-data');
  assert.match(analysis.message, /not enough data/i);
});

test('a trainer without categories is handled (FR-82)', () => {
  assert.equal(analyseWeakAreas([]).status, 'no-categories');
});

test('weak areas aggregate across the full history (US-8.6, FR-81)', () => {
  const merged = aggregateCategories([
    { categoryStats: [{ categoryId: 'fractions', label: 'Fractions', asked: 5, correct: 1 }] },
    { categoryStats: [{ categoryId: 'fractions', label: 'Fractions', asked: 5, correct: 4 }] },
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].asked, 10);
  assert.equal(merged[0].correct, 5);
  assert.equal(merged[0].hitRate, 50);
});

/* ------------------------------------------------------------------ archive */

test('the archive lists past dates with difficulty and played state (US-3.9)', () => {
  const { progress } = freshStore();
  progress.recordResult(makeResult({ puzzleDate: '2026-10-11', score: 15 }));

  const trainers = [
    { id: 'mental-math', name: 'Mental Math Sprint' },
    { id: 'memory', name: 'Memory' },
  ];
  const entries = listArchive({ today: '2026-10-12', trainers, progress, limit: 5 });

  assert.equal(entries[0].puzzleDate, '2026-10-11', 'newest first, excluding today');
  assert.ok(entries[0].difficulty, 'each entry states its band');

  const mentalMath = entries[0].trainers.find((t) => t.trainerId === 'mental-math');
  assert.equal(mentalMath.played, true);
  assert.equal(mentalMath.score, 15);
  assert.equal(entries[0].trainers.find((t) => t.trainerId === 'memory').played, false);
});

test('the archive stops at the earliest puzzle date (US-3.9, FR-42)', () => {
  const { progress } = freshStore();
  const today = addDays(EARLIEST_PUZZLE_DATE, 3);
  const entries = listArchive({ today, trainers: [{ id: 'memory', name: 'Memory' }], progress, limit: 60 });

  assert.equal(entries.length, 3, 'only the three days since the earliest date exist');
  assert.equal(entries.at(-1).puzzleDate, EARLIEST_PUZZLE_DATE);
});

test('puzzle dates outside the valid window are rejected', () => {
  assert.equal(isValidPuzzleDate('2026-10-11', '2026-10-12'), true);
  assert.equal(isValidPuzzleDate('2026-10-13', '2026-10-12'), false, 'the future has no puzzles');
  assert.equal(isValidPuzzleDate('2025-01-01', '2026-10-12'), false, 'before the earliest date');
});
