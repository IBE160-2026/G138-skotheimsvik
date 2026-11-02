/**
 * Answer checking and scoring.
 * Covers US-2.6, US-2.8, US-2.9, US-5.2.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { checkAnswer, parseNumeric, setEquals, normaliseText } from '../src/core/answer.js';
import { createScoreboard, computeAccuracy, computeAverageAnswerTime } from '../src/core/scoring.js';

const textPrompt = { kind: 'text', answer: 'Oslo' };
const numericPrompt = { kind: 'numeric', answer: 15 };

test('text answers tolerate whitespace and case (US-2.6, FR-49, FR-50)', () => {
  assert.equal(checkAnswer(textPrompt, ' oslo '), 'correct');
  assert.equal(checkAnswer(textPrompt, 'OSLO'), 'correct');
  assert.equal(checkAnswer(textPrompt, 'Bergen'), 'incorrect');
});

test('empty submissions are ignored entirely (FR-52)', () => {
  assert.equal(checkAnswer(textPrompt, ''), 'ignored');
  assert.equal(checkAnswer(textPrompt, '   '), 'ignored');
  assert.equal(checkAnswer(textPrompt, null), 'ignored');
  assert.equal(checkAnswer({ kind: 'grid', answer: [1] }, []), 'ignored');
});

test('documented alternative spellings are accepted (FR-51, US-6.7)', () => {
  const prompt = { kind: 'text', answer: 'United States', alternatives: ['USA', 'US'] };
  assert.equal(checkAnswer(prompt, 'usa'), 'correct');
  assert.equal(checkAnswer(prompt, 'US'), 'correct');
  assert.equal(checkAnswer(prompt, 'Canada'), 'incorrect');
});

test('numeric answers accept fractions, decimals and percent forms (FR-93)', () => {
  assert.equal(parseNumeric('3/4'), 0.75);
  assert.equal(parseNumeric('0,75'), 0.75);
  assert.equal(parseNumeric('75%'), 75);
  assert.equal(parseNumeric('not a number'), null);
  assert.equal(parseNumeric('1/0'), null);

  const fraction = { kind: 'numeric', answer: 0.75, tolerance: 1e-6 };
  assert.equal(checkAnswer(fraction, '3/4'), 'correct');
  assert.equal(checkAnswer(fraction, '0.75'), 'correct');
  assert.equal(checkAnswer(numericPrompt, '15'), 'correct');
  assert.equal(checkAnswer(numericPrompt, '16'), 'incorrect');
  assert.equal(checkAnswer(numericPrompt, 'abc'), 'incorrect');
});

test('grid answers compare as sets, ignoring order (US-5.2, FR-98, FR-99)', () => {
  const prompt = { kind: 'grid', answer: [1, 3, 6] };
  assert.equal(checkAnswer(prompt, [6, 1, 3]), 'correct');
  assert.equal(checkAnswer(prompt, [1, 3]), 'incorrect', 'omission must fail');
  assert.equal(checkAnswer(prompt, [1, 3, 6, 7]), 'incorrect', 'extra tile must fail');
  assert.ok(setEquals([1, 2], [2, 1]));
  assert.ok(!setEquals([1, 2], [1, 2, 3]));
});

test('normaliseText collapses internal whitespace', () => {
  assert.equal(normaliseText('  New   Delhi '), 'new delhi');
});

test('accuracy is one decimal and safe at zero (US-2.9, FR-56)', () => {
  assert.equal(computeAccuracy(7, 10), 70);
  assert.equal(computeAccuracy(1, 3), 33.3);
  assert.equal(computeAccuracy(0, 0), 0);
  assert.equal(computeAverageAnswerTime(0, 0), 0);
});

test('streak increments, resets, and best streak is retained (US-2.8)', () => {
  const board = createScoreboard();
  const prompt = { categoryId: 'addition', categoryLabel: 'Addition' };

  board.record(prompt, true, 100);
  board.record(prompt, true, 100);
  board.record(prompt, true, 100);
  assert.equal(board.snapshot().currentStreak, 3);

  board.record(prompt, false, 100);
  assert.equal(board.snapshot().currentStreak, 0, 'streak resets on a wrong answer');
  assert.equal(board.snapshot().bestStreak, 3, 'best streak is retained');

  const summary = board.summary();
  assert.equal(summary.totalAnswered, 4);
  assert.equal(summary.correctCount, 3);
  assert.equal(summary.accuracy, 75);
  assert.equal(summary.avgAnswerTimeMs, 100);
});

test('category tallies sum to total answered (US-4.3, US-8.1)', () => {
  const board = createScoreboard();
  board.record({ categoryId: 'addition', categoryLabel: 'Addition' }, true, 50);
  board.record({ categoryId: 'fractions', categoryLabel: 'Fractions' }, false, 50);
  board.record({ categoryId: 'fractions', categoryLabel: 'Fractions' }, true, 50);

  const summary = board.summary();
  const asked = summary.categoryStats.reduce((sum, entry) => sum + entry.asked, 0);
  assert.equal(asked, summary.totalAnswered);
});
