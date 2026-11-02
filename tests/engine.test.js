import test from 'node:test';
import assert from 'node:assert/strict';

import { createRegistry } from '../src/core/registry.js';
import { createRound } from '../src/core/round.js';
import { createProgressStore, compareToPrevious, compareToBest } from '../src/core/progress.js';
import { createStorage, createMemoryBackend } from '../src/core/storage.js';
import { beatsBest, improvementOver } from '../src/core/scoring.js';
import { BANDS, modeParamFor, variantsFor, parseBoardSize } from '../src/core/variants.js';
import { seedFor } from '../src/core/rng.js';
import { analyseWeakAreas } from '../src/core/weak-areas.js';

function fixedClock(start = 0) {
  let now = start;
  return { now: () => now, advance: (ms) => (now += ms) };
}

/** A generator that walks a scripted list of correct/incorrect answers. */
function scriptedGenerator(count = 100) {
  let i = 0;
  return {
    next: () => (i >= count ? null : { key: `p${i}`, question: `q${i++}`, answer: 'yes' }),
  };
}

function memoryProgress() {
  return createProgressStore({ storage: createStorage({ backend: createMemoryBackend() }) });
}

const timedTrainer = {
  id: 'mental-math',
  categoryId: 'math',
  name: 'Mental Math',
  roundMode: 'timed',
  variantKind: 'band',
  scoreDirection: 'higher',
  headlineScore: 'correct',
  createGenerator: () => scriptedGenerator(),
};

const livesTrainer = {
  ...timedTrainer,
  id: 'flags',
  categoryId: 'geography',
  roundMode: 'lives',
  modeParam: 3,
};

const pairsTrainer = {
  id: 'figure-pairs',
  categoryId: 'memory',
  name: 'Figure Pairs',
  roundMode: 'completion',
  variantKind: 'boardSize',
  variants: ['4x4'],
  scoreDirection: 'lower',
  headlineScore: 'mistakes',
  modeParam: 8,
  createGenerator: () => scriptedGenerator(),
};

// --- variants ---------------------------------------------------------------

test('band trainers always offer all four bands (FR-26)', () => {
  assert.deepEqual(variantsFor(timedTrainer), BANDS);
});

test('timed band trainers derive duration from the band (FR-29, US-3.3)', () => {
  assert.equal(modeParamFor(timedTrainer, 'beginner'), 45);
  assert.equal(modeParamFor(timedTrainer, 'expert'), 90);
});

test('board sizes parse into usable dimensions', () => {
  assert.deepEqual(parseBoardSize('6x4'), { columns: 6, rows: 4, cells: 24 });
  assert.equal(parseBoardSize('nonsense'), null);
});

// --- registry ---------------------------------------------------------------

test('a trainer registers without the engine knowing it (FR-6, FR-7, S21)', () => {
  const registry = createRegistry();
  registry.registerCategory({ id: 'math', name: 'Math' });
  registry.registerTrainer(timedTrainer);
  assert.equal(registry.getTrainer('mental-math').name, 'Mental Math');
  assert.deepEqual(
    registry.trainersIn('math').map((t) => t.id),
    ['mental-math'],
  );
});

test('the registry rejects a malformed trainer rather than limping on', () => {
  const registry = createRegistry();
  registry.registerCategory({ id: 'math', name: 'Math' });
  assert.throws(() => registry.registerTrainer({ ...timedTrainer, roundMode: 'vibes' }), /round mode/);
  assert.throws(() => registry.registerTrainer({ ...timedTrainer, categoryId: 'nope' }), /unknown category/);
  assert.throws(
    () => registry.registerTrainer({ ...pairsTrainer, categoryId: 'math', variants: ['huge'] }),
    /board size/,
  );
});

// --- round modes ------------------------------------------------------------

test('a timed round ends on expiry and ignores later answers (FR-14, S5)', () => {
  const clock = fixedClock();
  const round = createRound({
    trainer: timedTrainer,
    variantKey: 'beginner',
    puzzleDate: '2026-11-02',
    generator: scriptedGenerator(),
    clock,
  });
  round.start();
  round.submit('yes');
  clock.advance(45_000);
  assert.equal(round.tick(), 'ended');
  assert.equal(round.submit('yes').status, 'rejected');
  assert.equal(round.result().correctCount, 1);
  assert.equal(round.result().endedBy, 'time-expired');
});

test('a lives round ends the moment the last life goes (FR-16, S5)', () => {
  const clock = fixedClock();
  const round = createRound({
    trainer: livesTrainer,
    variantKey: 'expert',
    puzzleDate: '2026-11-02',
    generator: scriptedGenerator(),
    clock,
  });
  round.start();
  round.submit('wrong');
  round.submit('wrong');
  assert.equal(round.livesRemaining, 1);
  const last = round.submit('wrong');
  assert.equal(last.ended, true);
  assert.equal(round.state, 'ended');
  assert.equal(round.endedBy, 'lives-exhausted');
});

test('a completion round ends only when the board is clear (FR-18, S19)', () => {
  const clock = fixedClock();
  const round = createRound({
    trainer: pairsTrainer,
    variantKey: '4x4',
    puzzleDate: '2026-11-02',
    generator: scriptedGenerator(),
    clock,
  });
  round.start();
  for (let i = 0; i < 5; i += 1) round.submit('no');
  assert.equal(round.state, 'running', 'mistakes alone must not end it');
  for (let i = 0; i < 8; i += 1) round.submit('yes');
  assert.equal(round.state, 'ended');
  assert.equal(round.endedBy, 'board-complete');
  assert.equal(round.result().score, 5, 'score is mistakes, not matches');
});

test('starting a round commits it — leaving keeps the score so far (FR-10, US-2.11)', () => {
  const clock = fixedClock();
  const round = createRound({
    trainer: timedTrainer,
    variantKey: 'beginner',
    puzzleDate: '2026-11-02',
    generator: scriptedGenerator(),
    clock,
  });
  round.start();
  round.submit('yes');
  round.submit('yes');
  round.abandon();
  assert.equal(round.state, 'ended');
  assert.equal(round.endedBy, 'abandoned');
  assert.equal(round.result().score, 2, 'an abandoned round still records what was earned');
});

// --- score direction --------------------------------------------------------

test('lower is better for mistake-scored trainers (FR-75, S19)', () => {
  assert.equal(beatsBest(7, 9, 'lower'), true);
  assert.equal(beatsBest(11, 9, 'lower'), false);
  assert.equal(beatsBest(9, 9, 'lower'), false, 'matching is not beating');
  assert.equal(beatsBest(19, 18, 'higher'), true);
  assert.equal(beatsBest(5, null, 'lower'), true, 'first result always wins');
  assert.equal(improvementOver(7, 9, 'lower'), 2);
  assert.equal(improvementOver(21, 18, 'higher'), 3);
});

// --- progress ---------------------------------------------------------------

function resultFor(variantKey, score, puzzleDate, overrides = {}) {
  return {
    id: `${variantKey}-${puzzleDate}`,
    categoryId: 'math',
    trainerId: 'mental-math',
    variantKind: 'band',
    variantKey,
    puzzleDate,
    roundMode: 'timed',
    modeParam: 60,
    score,
    playedAt: 1,
    endedBy: 'time-expired',
    elapsedMs: 1000,
    totalAnswered: score,
    correctCount: score,
    accuracy: 100,
    avgAnswerTimeMs: 100,
    bestStreak: score,
    livesRemaining: null,
    mistakes: null,
    maxLevel: null,
    topicStats: [],
    ...overrides,
  };
}

test('each band holds its own attempt and its own best (FR-74, US-3.7, S13)', () => {
  const progress = memoryProgress();
  progress.recordResult(resultFor('beginner', 30, '2026-11-02'));

  assert.equal(progress.hasAttempt('mental-math', 'beginner', '2026-11-02'), true);
  assert.equal(progress.hasAttempt('mental-math', 'expert', '2026-11-02'), false);

  progress.recordResult(resultFor('expert', 12, '2026-11-02'));
  assert.equal(progress.personalBest('mental-math', 'beginner'), 30);
  assert.equal(progress.personalBest('mental-math', 'expert'), 12);

  progress.recordResult(resultFor('expert', 14, '2026-11-03'));
  assert.equal(progress.personalBest('mental-math', 'expert'), 14);
  assert.equal(progress.personalBest('mental-math', 'beginner'), 30, 'untouched by the Expert run');
  assert.deepEqual(progress.spentVariants('mental-math', '2026-11-02').sort(), ['beginner', 'expert']);
});

test('comparison respects score direction (FR-83, US-6.11)', () => {
  const better = compareToPrevious(7, { score: 9 }, 'lower');
  assert.equal(better.status, 'better');
  assert.equal(better.delta, 2);

  const worse = compareToBest(11, 9, 'lower');
  assert.equal(worse.isNewBest, false);

  const newBest = compareToBest(7, 9, 'lower');
  assert.equal(newBest.isNewBest, true);
});

test('comparison handles the first attempt (FR-82, S16)', () => {
  assert.equal(compareToPrevious(10, null).status, 'first');
  assert.equal(compareToBest(10, null).isNewBest, true);
});

test('results survive the storage round trip (FR-99, S1)', () => {
  const backend = createMemoryBackend();
  const first = createProgressStore({ storage: createStorage({ backend }) });
  first.recordResult(
    resultFor('advanced', 21, '2026-11-02', {
      topicStats: [{ topicId: 'algebra', label: 'Algebra', asked: 7, correct: 2 }],
    }),
  );

  const reloaded = createProgressStore({ storage: createStorage({ backend }) });
  const stored = reloaded.history('mental-math', 'advanced');
  assert.equal(stored.length, 1);
  assert.equal(stored[0].score, 21);
  assert.equal(stored[0].variantKey, 'advanced');
  assert.deepEqual(stored[0].topicStats, [
    { topicId: 'algebra', label: 'Algebra', asked: 7, correct: 2 },
  ]);
});

// --- determinism ------------------------------------------------------------

test('seeds differ by variant and by date, and repeat exactly (FR-30 to FR-32, S12)', () => {
  const a = seedFor('mental-math', 'beginner', '2026-11-02');
  assert.equal(a, seedFor('mental-math', 'beginner', '2026-11-02'));
  assert.notEqual(a, seedFor('mental-math', 'expert', '2026-11-02'));
  assert.notEqual(a, seedFor('mental-math', 'beginner', '2026-11-03'));
  assert.notEqual(a, seedFor('flags', 'beginner', '2026-11-02'));
});

// --- weak topics ------------------------------------------------------------

test('the weakest topic is the worst well-sampled one (FR-94, S7)', () => {
  const analysis = analyseWeakAreas([
    { topicId: 'algebra', label: 'Algebra', asked: 7, correct: 2 },
    { topicId: 'addition', label: 'Addition', asked: 10, correct: 9 },
    { topicId: 'trig', label: 'Trigonometry', asked: 2, correct: 0 },
  ]);
  assert.equal(analysis.status, 'ok');
  assert.equal(analysis.weakest.topicId, 'algebra', 'the 2-sample topic is too thin to count');
  assert.match(analysis.message, /You miss Algebra most/);
});
