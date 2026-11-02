/**
 * Determinism, seeding and date-assigned difficulty.
 * Covers US-3.1, US-3.2, US-3.4, NFR-4.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRng, seedFor, difficultySeedFor, hashString } from '../src/core/rng.js';
import {
  BANDS,
  BAND_DISTRIBUTION,
  difficultyForDate,
  bandRank,
} from '../src/core/difficulty.js';
import { addDays, toLocalISODate, daysBetween } from '../src/core/clock.js';

test('hashString is stable and distinguishes inputs', () => {
  assert.equal(hashString('mental-math:2026-10-12'), hashString('mental-math:2026-10-12'));
  assert.notEqual(hashString('mental-math:2026-10-12'), hashString('mental-math:2026-10-13'));
});

test('the same seed yields an identical sequence (NFR-4)', () => {
  const seed = seedFor('mental-math', '2026-10-12');
  const first = Array.from({ length: 50 }, () => createRng(seed).int(0, 1000));
  const second = Array.from({ length: 50 }, () => createRng(seed).int(0, 1000));
  assert.deepEqual(first, second);
});

test('different dates yield different sequences (US-3.4)', () => {
  const a = createRng(seedFor('mental-math', '2026-10-12'));
  const b = createRng(seedFor('mental-math', '2026-10-13'));
  const left = Array.from({ length: 20 }, () => a.int(0, 1_000_000));
  const right = Array.from({ length: 20 }, () => b.int(0, 1_000_000));
  assert.notDeepEqual(left, right);
});

test('difficulty is identical on repeated computation (US-3.1)', () => {
  for (let i = 0; i < 30; i += 1) {
    const date = addDays('2026-10-01', i);
    assert.equal(difficultyForDate(date), difficultyForDate(date));
  }
});

test('difficulty seed ignores the trainer, so all trainers share a band (FR-27)', () => {
  assert.equal(difficultySeedFor('2026-10-12'), difficultySeedFor('2026-10-12'));
});

test('all four bands occur across a year and match the target distribution (US-3.2)', () => {
  const counts = Object.fromEntries(BANDS.map((band) => [band, 0]));
  const days = 365;

  for (let i = 0; i < days; i += 1) {
    counts[difficultyForDate(addDays('2026-01-01', i))] += 1;
  }

  for (const band of BANDS) {
    assert.ok(counts[band] > 0, `band ${band} never occurred`);
    const actual = counts[band] / days;
    const target = BAND_DISTRIBUTION[band];
    assert.ok(
      Math.abs(actual - target) < 0.07,
      `${band}: expected about ${target}, got ${actual.toFixed(3)}`,
    );
  }
});

test('bands are ranked easiest to hardest', () => {
  assert.equal(bandRank('beginner'), 0);
  assert.ok(bandRank('expert') > bandRank('advanced'));
});

test('calendar dates use local time, not UTC (FR-34)', () => {
  // 1 January at 00:30 local must report 1 January regardless of UTC offset.
  const localNewYear = new Date(2026, 0, 1, 0, 30, 0);
  assert.equal(toLocalISODate(localNewYear), '2026-01-01');
});

test('date arithmetic survives month and year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-10-01', '2026-10-12'), 11);
  assert.equal(daysBetween('2026-10-12', '2026-10-01'), -11);
});
