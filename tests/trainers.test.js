/**
 * The three trainers.
 * Covers US-4.1, US-4.2, US-4.5, US-5.4..US-5.8, US-6.1..US-6.5.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { BANDS } from '../src/core/difficulty.js';
import { checkAnswer } from '../src/core/answer.js';
import { mentalMathTrainer, DURATION_BY_BAND } from '../src/trainers/mental-math/index.js';
import {
  memoryTrainer,
  buildLevel,
  gridSizeFor,
  START_TILES_BY_BAND,
  MAX_FILL_RATIO,
} from '../src/trainers/memory/index.js';
import { createGeographyTrainer, validateCountries } from '../src/trainers/geography/index.js';
import { seedFor } from '../src/core/rng.js';

const countriesUrl = new URL('../src/trainers/geography/countries.json', import.meta.url);
const rawCountries = JSON.parse(readFileSync(fileURLToPath(countriesUrl), 'utf8'));

const silentLogger = { warn() {} };

/* ---------------------------------------------------------------- Mental Math */

test('Mental Math generates only valid prompts across every band (US-4.1)', () => {
  for (const band of BANDS) {
    const generator = mentalMathTrainer.createGenerator({
      puzzleDate: '2026-10-12',
      difficulty: band,
    });

    for (let i = 0; i < 1000; i += 1) {
      const prompt = generator.next({ index: i });

      assert.ok(Number.isFinite(prompt.answer), `${band}: non-finite answer in "${prompt.question}"`);
      assert.ok(!/÷ 0\b/.test(prompt.question), `${band}: division by zero — ${prompt.question}`);

      if (prompt.categoryId === 'division') {
        assert.ok(
          Number.isInteger(prompt.answer),
          `${band}: division must be whole — ${prompt.question} = ${prompt.answer}`,
        );
      }

      if (band === 'beginner' && prompt.categoryId === 'subtraction') {
        assert.ok(prompt.answer >= 0, `beginner subtraction went negative: ${prompt.question}`);
      }
    }
  }
});

test('Mental Math draws only each band\'s permitted categories (US-4.2, FR-89)', () => {
  const allowed = {
    beginner: new Set(['addition', 'subtraction']),
    intermediate: new Set(['addition', 'subtraction', 'multiplication', 'division']),
    advanced: new Set(['addition', 'subtraction', 'multiplication', 'division', 'percentages']),
    expert: new Set(['addition', 'subtraction', 'multiplication', 'division', 'percentages', 'fractions']),
  };

  for (const band of BANDS) {
    const generator = mentalMathTrainer.createGenerator({ puzzleDate: '2026-10-12', difficulty: band });
    for (let i = 0; i < 400; i += 1) {
      const { categoryId } = generator.next({ index: i });
      assert.ok(allowed[band].has(categoryId), `${band} must not draw ${categoryId}`);
    }
  }
});

test('Mental Math round duration follows the band, with no player input (US-3.3)', () => {
  assert.equal(mentalMathTrainer.modeParam('beginner'), 45);
  assert.equal(mentalMathTrainer.modeParam('expert'), 90);
  assert.deepEqual(DURATION_BY_BAND, {
    beginner: 45, intermediate: 60, advanced: 75, expert: 90,
  });
});

test('Mental Math prompts are all categorised (US-4.3, FR-76)', () => {
  const generator = mentalMathTrainer.createGenerator({ puzzleDate: '2026-10-12', difficulty: 'expert' });
  for (let i = 0; i < 100; i += 1) {
    const prompt = generator.next({ index: i });
    assert.ok(prompt.categoryId, 'every prompt needs a category');
    assert.ok(prompt.categoryLabel, 'every category needs a readable label');
  }
});

test('Mental Math fraction answers accept equivalent forms (US-4.4)', () => {
  const generator = mentalMathTrainer.createGenerator({ puzzleDate: '2026-10-12', difficulty: 'expert' });
  let fraction = null;
  for (let i = 0; i < 500 && !fraction; i += 1) {
    const prompt = generator.next({ index: i });
    if (prompt.categoryId === 'fractions') fraction = prompt;
  }

  assert.ok(fraction, 'expert band must produce fraction prompts');
  assert.ok(fraction.formatHint, 'the expected format must be stated (FR-93)');
  assert.equal(checkAnswer(fraction, String(fraction.answer)), 'correct');
  assert.equal(checkAnswer(fraction, fraction.displayAnswer), 'correct');
});

test('Mental Math is deterministic for a given date (FR-32)', () => {
  const makeSequence = () => {
    const generator = mentalMathTrainer.createGenerator({ puzzleDate: '2026-10-12', difficulty: 'advanced' });
    return Array.from({ length: 40 }, (_, i) => generator.next({ index: i }).question);
  };
  assert.deepEqual(makeSequence(), makeSequence());
});

/* -------------------------------------------------------------------- Memory */

test('Memory adds exactly one tile per level (US-5.4, FR-100)', () => {
  const seed = seedFor('memory', '2026-10-12');
  for (const band of BANDS) {
    for (let level = 1; level < 20; level += 1) {
      const current = buildLevel(seed, band, level);
      const next = buildLevel(seed, band, level + 1);
      assert.equal(next.tileCount, current.tileCount + 1);
    }
    assert.equal(buildLevel(seed, band, 1).tileCount, START_TILES_BY_BAND[band]);
  }
});

test('Memory never runs out of levels and stays deterministic (US-5.5, NFR-5)', () => {
  const seed = seedFor('memory', '2026-10-12');
  for (const level of [1, 10, 50, 200]) {
    const first = buildLevel(seed, 'intermediate', level);
    const second = buildLevel(seed, 'intermediate', level);
    assert.deepEqual(first.answer, second.answer, `level ${level} must be reproducible`);
    assert.equal(first.answer.length, first.tileCount);
    assert.equal(new Set(first.answer).size, first.tileCount, 'tiles must be distinct');
    assert.ok(first.answer.every((i) => i >= 0 && i < first.gridSize ** 2), 'tiles must fit the grid');
  }
});

test('Memory level n is independent of levels before it (NFR-5)', () => {
  const seed = seedFor('memory', '2026-10-12');
  // Generated cold, with nothing before it — must match the same level generated
  // after walking up from level 1.
  const cold = buildLevel(seed, 'advanced', 37);
  for (let i = 1; i < 37; i += 1) buildLevel(seed, 'advanced', i);
  const warm = buildLevel(seed, 'advanced', 37);
  assert.deepEqual(cold.answer, warm.answer);
});

test('the Memory grid grows to stay legible (US-5.6, FR-102)', () => {
  assert.equal(gridSizeFor(3), 4);
  let previous = 0;
  for (let tiles = 1; tiles <= 120; tiles += 1) {
    const size = gridSizeFor(tiles);
    assert.ok(size >= previous, 'grid must never shrink as tiles increase');
    assert.ok(tiles <= size * size * MAX_FILL_RATIO, `grid too crowded at ${tiles} tiles`);
    previous = size;
  }
});

test('Memory band sets the starting tiles and display time (US-5.7, FR-103)', () => {
  const seed = seedFor('memory', '2026-10-12');
  const beginner = buildLevel(seed, 'beginner', 1);
  const expert = buildLevel(seed, 'expert', 1);
  assert.ok(expert.tileCount > beginner.tileCount);
  assert.ok(expert.displayMs < beginner.displayMs, 'expert shows the pattern more briefly');
});

test('Memory reports one life and scores by level reached (US-5.8, FR-97, FR-104)', () => {
  assert.equal(memoryTrainer.modeParam(), 1);
  assert.equal(memoryTrainer.headlineScore, 'maxLevel');
  assert.equal(memoryTrainer.roundMode, 'lives');
});

test('Memory generator advances with the number of correct answers (FR-101)', () => {
  const generator = memoryTrainer.createGenerator({ puzzleDate: '2026-10-12', difficulty: 'beginner' });
  assert.equal(generator.next({ correctCount: 0 }).level, 1);
  assert.equal(generator.next({ correctCount: 7 }).level, 8);
  assert.equal(generator.next({ correctCount: 99 }).level, 100);
});

/* ----------------------------------------------------------------- Geography */

test('Geography validates content and skips malformed entries (US-6.2, FR-115)', () => {
  const valid = validateCountries(rawCountries, silentLogger);
  assert.ok(valid.length > 40, 'the bundled content must survive validation');

  const polluted = {
    countries: [
      { name: 'Norway', capital: 'Oslo', continent: 'Europe', tier: 1 },
      { name: '', capital: 'Nowhere', continent: 'Europe', tier: 1 },
      { name: 'Broken', capital: 'X', continent: 'Europe', tier: 99 },
      { name: 'NoCapital', continent: 'Europe', tier: 1 },
      null,
    ],
  };
  const survivors = validateCountries(polluted, silentLogger);
  assert.equal(survivors.length, 1, 'only the valid entry may survive');
  assert.equal(survivors[0].name, 'Norway');

  assert.deepEqual(validateCountries({ nonsense: true }, silentLogger), []);
});

test('Geography runs with exactly three lives (US-6.1, FR-109)', () => {
  const trainer = createGeographyTrainer(rawCountries, silentLogger);
  assert.equal(trainer.modeParam(), 3);
  assert.equal(trainer.roundMode, 'lives');
});

test('Geography produces all four prompt categories (US-6.3, FR-111)', () => {
  const trainer = createGeographyTrainer(rawCountries, silentLogger);
  const generator = trainer.createGenerator({ puzzleDate: '2026-10-12', difficulty: 'advanced' });

  const seen = new Set();
  for (let i = 0; i < 300; i += 1) seen.add(generator.next({ index: i }).categoryId);

  for (const category of ['country-capital', 'capital-country', 'flag-country', 'country-continent']) {
    assert.ok(seen.has(category), `category ${category} never appeared`);
  }
});

test('Geography narrows the pool on easier days and types answers at expert (US-6.4, FR-112)', () => {
  const trainer = createGeographyTrainer(rawCountries, silentLogger);
  const tierByName = new Map(validateCountries(rawCountries, silentLogger).map((c) => [c.name, c.tier]));

  const beginner = trainer.createGenerator({ puzzleDate: '2026-10-12', difficulty: 'beginner' });
  for (let i = 0; i < 200; i += 1) {
    const prompt = beginner.next({ index: i });
    assert.equal(prompt.kind, 'choice', 'beginner answers by choosing');
    const subject = prompt.key.split(':')[1];
    assert.equal(tierByName.get(subject), 1, `${subject} is outside the beginner pool`);
  }

  const expert = trainer.createGenerator({ puzzleDate: '2026-10-12', difficulty: 'expert' });
  let freeTextSeen = false;
  for (let i = 0; i < 100; i += 1) {
    const prompt = expert.next({ index: i });
    if (prompt.categoryId !== 'country-continent') {
      assert.equal(prompt.kind, 'text', 'expert answers by typing');
      freeTextSeen = true;
    }
  }
  assert.ok(freeTextSeen);
});

test('Geography offers four distinct plausible choices (US-6.5, FR-113)', () => {
  const trainer = createGeographyTrainer(rawCountries, silentLogger);
  const generator = trainer.createGenerator({ puzzleDate: '2026-10-12', difficulty: 'advanced' });

  for (let i = 0; i < 200; i += 1) {
    const prompt = generator.next({ index: i });
    if (prompt.kind !== 'choice') continue;
    assert.equal(prompt.choices.length, 4);
    assert.equal(new Set(prompt.choices).size, 4, 'choices must be distinct');
    assert.ok(prompt.choices.includes(prompt.answer), 'the correct answer must be present');
    assert.equal(checkAnswer(prompt, prompt.answer), 'correct');
  }
});

test('Geography content needs no network and ships flags locally (US-6.6, FR-114)', () => {
  const serialised = JSON.stringify(rawCountries);
  assert.ok(!/https?:\/\//.test(serialised), 'content must contain no external URLs');
});

test('Geography is deterministic for a given date (FR-32)', () => {
  const trainer = createGeographyTrainer(rawCountries, silentLogger);
  const makeSequence = () => {
    const generator = trainer.createGenerator({ puzzleDate: '2026-11-03', difficulty: 'advanced' });
    return Array.from({ length: 30 }, (_, i) => generator.next({ index: i }).key);
  };
  assert.deepEqual(makeSequence(), makeSequence());
});

test('every trainer satisfies the registration contract (FR-11)', () => {
  const trainers = [mentalMathTrainer, memoryTrainer, createGeographyTrainer(rawCountries, silentLogger)];
  for (const trainer of trainers) {
    assert.ok(trainer.id && trainer.name && trainer.description);
    assert.ok(['timed', 'lives'].includes(trainer.roundMode));
    assert.ok(['correct', 'maxLevel'].includes(trainer.headlineScore));
    assert.equal(typeof trainer.createGenerator, 'function');
    assert.equal(typeof trainer.modeParam, 'function');
    assert.equal(typeof trainer.describeMode, 'function');
  }
});
