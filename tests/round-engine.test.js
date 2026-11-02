/**
 * The Drill Engine round lifecycle, both round modes.
 * Covers US-2.1 through US-2.14, US-10.6, US-10.7, NFR-2, NFR-3.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createRound } from '../src/core/round.js';
import { createFixedClock } from '../src/core/clock.js';
import { createRegistry } from '../src/core/registry.js';

const timedTrainer = { id: 't', name: 'Timed', roundMode: 'timed', headlineScore: 'correct' };
const livesTrainer = { id: 'l', name: 'Lives', roundMode: 'lives', headlineScore: 'correct' };

/** A generator producing a predictable, non-repeating stream. */
function counterGenerator(limit = Infinity) {
  let n = 0;
  return {
    next() {
      n += 1;
      if (n > limit) return null;
      return { kind: 'numeric', key: `q${n}`, answer: n, question: `q${n}`, categoryId: 'c', categoryLabel: 'C' };
    },
  };
}

function setup(trainer, modeParam, generator = counterGenerator()) {
  const clock = createFixedClock({ today: '2026-10-12', startMs: 0 });
  const round = createRound({
    trainer,
    puzzleDate: '2026-10-12',
    difficulty: 'intermediate',
    generator,
    clock,
    modeParam,
  });
  return { clock, round };
}

test('a round presents its first prompt immediately on start (US-2.1)', () => {
  const { round } = setup(timedTrainer, 60);
  assert.equal(round.state, 'idle');
  const prompt = round.start();
  assert.equal(round.state, 'running');
  assert.ok(prompt, 'a prompt must be available at once');
  assert.equal(round.remainingMs(), 60000);
});

test('a timed round ends exactly on expiry and rejects late answers (US-2.2, FR-13)', () => {
  const { clock, round } = setup(timedTrainer, 60);
  round.start();

  round.submit(1);
  assert.equal(round.state, 'running');

  clock.advance(59_999);
  assert.equal(round.tick(), 'running', 'still running one millisecond before expiry');

  clock.advance(1);
  assert.equal(round.tick(), 'ended');
  assert.equal(round.endedBy, 'time-expired');

  const late = round.submit(2);
  assert.equal(late.status, 'rejected');

  const result = round.result();
  assert.equal(result.totalAnswered, 1, 'the late answer must not be counted');
});

test('timer accuracy is within 100 ms over a 90 s round (US-10.6, NFR-2)', () => {
  const { clock, round } = setup(timedTrainer, 90);
  round.start();
  clock.advance(90_000);
  round.tick();
  assert.ok(Math.abs(round.result().elapsedMs - 90_000) <= 100);
});

test('a lives round ends on the last life with no further prompt (US-2.3, NFR-3)', () => {
  const { round } = setup(livesTrainer, 3);
  round.start();

  round.submit(999); // wrong
  assert.equal(round.livesRemaining, 2);
  assert.equal(round.state, 'running');

  round.submit(999); // wrong
  assert.equal(round.livesRemaining, 1);
  assert.equal(round.state, 'running');

  const final = round.submit(999); // wrong
  assert.equal(round.state, 'ended');
  assert.equal(round.endedBy, 'lives-exhausted');
  assert.equal(final.ended, true);
  assert.equal(final.next, undefined, 'no further prompt may be rendered');
  assert.equal(round.prompt, null);
});

test('one life ends the round on the first mistake (US-5.3, FR-97)', () => {
  const { round } = setup(livesTrainer, 1);
  round.start();
  round.submit(-1);
  assert.equal(round.state, 'ended');
  assert.equal(round.endedBy, 'lives-exhausted');
});

test('a correct answer costs no life and reports a life loss distinctly (US-2.4)', () => {
  const { round } = setup(livesTrainer, 3);
  const prompt = round.start();
  const good = round.submit(prompt.answer);
  assert.equal(good.status, 'correct');
  assert.equal(good.lifeLost, false);
  assert.equal(round.livesRemaining, 3);

  const bad = round.submit(-1);
  assert.equal(bad.lifeLost, true);
  assert.equal(bad.livesRemaining, 2);
});

test('incorrect feedback reports the expected answer (US-2.7, FR-20)', () => {
  const { round } = setup(timedTrainer, 60);
  const prompt = round.start();
  const feedback = round.submit(prompt.answer + 1);
  assert.equal(feedback.status, 'incorrect');
  assert.equal(feedback.expected, String(prompt.answer));
});

test('empty submissions cost nothing at all (US-2.6, FR-52)', () => {
  const { round } = setup(livesTrainer, 3);
  round.start();
  round.submit(1); // build a streak first

  const before = round.stats();
  const ignored = round.submit('');

  assert.equal(ignored.status, 'ignored');
  assert.equal(round.livesRemaining, 3, 'no life may be lost');
  assert.deepEqual(round.stats(), before, 'no statistic may change');
});

test('prompts are supplied lazily without a pre-built list (US-2.10, FR-24)', () => {
  let generated = 0;
  const generator = {
    next() {
      generated += 1;
      return { kind: 'numeric', key: `q${generated}`, answer: generated };
    },
  };

  const { round } = setup(timedTrainer, 600, generator);
  round.start();
  assert.equal(generated, 1, 'only the first prompt exists at start');

  for (let i = 0; i < 20; i += 1) round.submit(-1);
  assert.equal(generated, 21, 'prompts appear one at a time, on demand');
});

test('the same prompt never appears twice in a row (US-2.11, FR-23)', () => {
  let toggle = 0;
  const generator = {
    next() {
      // Returns the same key twice before changing, forcing the retry path.
      toggle += 1;
      const id = Math.floor(toggle / 2);
      return { kind: 'numeric', key: `q${id}`, answer: id };
    },
  };

  const { round } = setup(timedTrainer, 600, generator);
  let previousKey = round.start().key;

  for (let i = 0; i < 10; i += 1) {
    round.submit(-1);
    if (round.state !== 'running') break;
    assert.notEqual(round.prompt.key, previousKey);
    previousKey = round.prompt.key;
  }
});

test('an exhausted generator ends the round cleanly (US-2.14, FR-25)', () => {
  const { round } = setup(timedTrainer, 600, counterGenerator(3));
  round.start();
  round.submit(-1);
  round.submit(-1);
  round.submit(-1);
  assert.equal(round.state, 'ended');
  assert.equal(round.endedBy, 'prompts-exhausted');
});

test('abandoning writes no result (US-2.12, FR-6)', () => {
  const { round } = setup(timedTrainer, 60);
  round.start();
  round.submit(1);
  round.abandon();
  assert.equal(round.state, 'abandoned');
  assert.equal(round.result(), null, 'an abandoned round must produce no result');
});

test('the result record carries everything the PRD data model requires', () => {
  const { clock, round } = setup(livesTrainer, 3);
  const prompt = round.start();
  clock.advance(500);
  round.submit(prompt.answer);
  clock.advance(500);
  round.submit(-1);
  round.submit(-1);
  round.submit(-1);

  const result = round.result();
  for (const field of [
    'id', 'trainerId', 'puzzleDate', 'difficulty', 'roundMode', 'modeParam',
    'score', 'playedAt', 'endedBy', 'elapsedMs', 'totalAnswered', 'correctCount',
    'accuracy', 'avgAnswerTimeMs', 'bestStreak', 'livesRemaining', 'categoryStats',
  ]) {
    assert.ok(field in result, `result is missing ${field}`);
  }
  assert.equal(result.puzzleDate, '2026-10-12');
  assert.equal(result.livesRemaining, 0);
});

test('the registry accepts a conforming trainer and rejects a broken one (US-1.3)', () => {
  const registry = createRegistry();
  const valid = {
    id: 'x', name: 'X', roundMode: 'timed', headlineScore: 'correct',
    modeParam: () => 60, createGenerator: () => counterGenerator(),
  };

  registry.register(valid);
  assert.equal(registry.size, 1);
  assert.ok(registry.has('x'));

  assert.throws(() => registry.register(valid), /already registered/);
  assert.throws(() => registry.register({ id: 'y' }), /missing required field/);
  assert.throws(
    () => registry.register({ ...valid, id: 'z', roundMode: 'nonsense' }),
    /unknown round mode/,
  );
});
