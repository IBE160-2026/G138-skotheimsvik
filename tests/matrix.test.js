import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildRegistry } from '../src/trainers/index.js';
import { createRound } from '../src/core/round.js';
import { variantsFor, modeParamFor } from '../src/core/variants.js';

/**
 * The full manual test matrix from US-11.1, automated.
 *
 * Every trainer is played at every variant until it reaches an end condition.
 * Doing it by hand across 24 combinations is slow and never repeated; doing it
 * here means a broken end condition fails the build instead of surviving until
 * someone happens to play that board size.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const countries = JSON.parse(readFileSync(join(root, 'src/trainers/geography/countries.json'), 'utf8'));
const outlines = JSON.parse(readFileSync(join(root, 'src/trainers/geography/outlines.json'), 'utf8'));
const people = JSON.parse(readFileSync(join(root, 'src/trainers/people/people.json'), 'utf8'));
const registry = buildRegistry({ countries, outlines, people }, { warn: () => {} });

const VALID_END_REASONS = ['time-expired', 'lives-exhausted', 'board-complete', 'prompts-exhausted'];

/**
 * Play one round to its natural end.
 *
 * Each mode needs its own strategy: a completion round only ends by clearing
 * the board, a lives round needs deliberate failures, and a timed round needs
 * the clock pushed past its duration.
 */
function playRound(trainer, variantKey) {
  let now = 0;
  const clock = {
    now: () => now,
    date: () => new Date('2026-11-02T12:00:00'),
    today: () => '2026-11-02',
  };

  const generator = trainer.createGenerator({
    puzzleDate: '2026-11-02',
    variantKey,
    practice: false,
    filters: null,
  });
  const round = createRound({ trainer, variantKey, puzzleDate: '2026-11-02', generator, clock });
  round.start();

  const alwaysCorrect = trainer.roundMode === 'completion';
  let correct = 0;
  let guard = 0;

  while (round.state === 'running' && guard < 600) {
    guard += 1;
    const prompt = round.prompt;
    now += 500;
    const beCorrect = alwaysCorrect || correct < 6;

    let answer;
    if (prompt.kind === 'grid') {
      // A wrong grid answer still has to be non-empty: an empty submission is
      // ignored by design (FR-66) rather than counted as wrong.
      answer = beCorrect ? prompt.answer : [(prompt.answer[0] + 1) % prompt.cellCount];
    } else if (prompt.kind === 'pairs') {
      const matched = new Set(prompt.matched);
      let first = 0;
      while (matched.has(first)) first += 1;
      answer = [first, prompt.faces.indexOf(prompt.faces[first], first + 1)];
    } else {
      answer = beCorrect ? prompt.answer : '\u0000definitely-not-the-answer';
    }

    if (beCorrect) correct += 1;
    round.submit(answer);
    if (trainer.roundMode === 'timed' && guard > 12) {
      now += modeParamFor(trainer, variantKey) * 1000;
    }
    round.tick();
  }

  return { round, guard, result: round.result() };
}

for (const trainer of registry.listTrainers()) {
  for (const variantKey of variantsFor(trainer)) {
    test(`${trainer.id} at ${variantKey} plays to a clean finish (US-11.1, S2)`, () => {
      const { round, guard, result } = playRound(trainer, variantKey);

      assert.notEqual(round.state, 'running', `still running after ${guard} prompts`);
      assert.ok(result, 'round produced no result');
      assert.ok(
        VALID_END_REASONS.includes(result.endedBy),
        `unexpected end reason: ${result.endedBy}`,
      );
      assert.ok(result.totalAnswered > 0, 'round graded nothing');
      assert.equal(result.trainerId, trainer.id);
      assert.equal(result.variantKey, variantKey);
      assert.equal(result.categoryId, trainer.categoryId);
      assert.ok(result.score >= 0);
      assert.ok(result.accuracy >= 0 && result.accuracy <= 100);
      assert.ok(result.elapsedMs >= 0);
    });
  }
}

test('every mode reaches the end condition it is supposed to (S5)', () => {
  const byMode = {};
  for (const trainer of registry.listTrainers()) {
    const { result } = playRound(trainer, variantsFor(trainer)[1]);
    byMode[trainer.roundMode] ??= new Set();
    byMode[trainer.roundMode].add(result.endedBy);
  }

  assert.ok(byMode.timed.has('time-expired'), 'a timed round must be able to run out of time');
  assert.ok(byMode.lives.has('lives-exhausted'), 'a lives round must be able to run out of lives');
  assert.ok(byMode.completion.has('board-complete'), 'a completion round must be able to clear');
});

test('a cleared Figure Pairs board scores zero mistakes (S19)', () => {
  const pairs = registry.getTrainer('figure-pairs');
  for (const variantKey of variantsFor(pairs)) {
    const { result } = playRound(pairs, variantKey);
    assert.equal(result.endedBy, 'board-complete');
    assert.equal(result.score, 0, 'a perfect board has no mistakes');
    assert.equal(result.totalAnswered, modeParamFor(pairs, variantKey), 'one turn per pair');
  }
});
