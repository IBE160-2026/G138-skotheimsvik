import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildRegistry } from '../src/trainers/index.js';
import { mentalMathTrainer, topicsForBand } from '../src/trainers/math/mental-math.js';
import {
  patternMemoryTrainer,
  buildLevel,
  tilesForLevel,
  maxLevelFor,
} from '../src/trainers/memory/pattern.js';
import { figurePairsTrainer, dealBoard, pairsFor } from '../src/trainers/memory/pairs.js';
import { validateCountries, poolFor, flagFor } from '../src/trainers/geography/content.js';
import { validatePeople, poolFor as peoplePoolFor, PEOPLE_PER_ROUND } from '../src/trainers/people/index.js';
import {
  haversineKm,
  bearingDegrees,
  compassPoint,
  proximityPercent,
} from '../src/trainers/geography/geo.js';
import { createRng } from '../src/core/rng.js';
import { checkAnswer } from '../src/core/answer.js';
import { BANDS, modeParamFor } from '../src/core/variants.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const countriesRaw = JSON.parse(
  readFileSync(join(root, 'src/trainers/geography/countries.json'), 'utf8'),
);
const outlines = JSON.parse(
  readFileSync(join(root, 'src/trainers/geography/outlines.json'), 'utf8'),
);
const peopleRaw = JSON.parse(readFileSync(join(root, 'src/trainers/people/people.json'), 'utf8'));
const countries = validateCountries(countriesRaw, { warn: () => {} });
const registry = buildRegistry(
  { countries: countriesRaw, outlines, people: peopleRaw },
  { warn: () => {} },
);

/** Pull `count` prompts from a trainer at one variant. */
function pull(trainer, variantKey, count, options = {}) {
  const generator = trainer.createGenerator({
    puzzleDate: '2026-11-02',
    variantKey,
    practice: options.practice ?? false,
    filters: options.filters ?? null,
  });
  const prompts = [];
  for (let i = 0; i < count; i += 1) {
    const prompt = generator.next({ index: i });
    if (!prompt) break;
    prompts.push(prompt);
  }
  return prompts;
}

// --- catalogue --------------------------------------------------------------

test('seven trainers register across four categories (FR-6, S21)', () => {
  assert.equal(registry.size, 7);
  assert.deepEqual(
    registry.listCategories().map((c) => c.id),
    ['math', 'memory', 'geography', 'people'],
  );
  assert.deepEqual(registry.trainersIn('memory').map((t) => t.id), [
    'pattern-memory',
    'figure-pairs',
  ]);
  assert.deepEqual(registry.trainersIn('geography').map((t) => t.id), [
    'flag-guesser',
    'outline-guesser',
    'capital-guesser',
  ]);
});

// --- Mental Math ------------------------------------------------------------

test('arithmetic is always valid (FR-106 to FR-108, S3)', () => {
  for (const band of BANDS) {
    for (const prompt of pull(mentalMathTrainer, band, 400)) {
      assert.ok(!/÷ 0\b/.test(prompt.question), `divide by zero: ${prompt.question}`);

      if (prompt.topicId === 'division' && band !== 'expert') {
        assert.ok(Number.isInteger(prompt.answer), `non-integer division: ${prompt.question}`);
      }
      if (prompt.topicId === 'subtraction' && band === 'beginner') {
        assert.ok(prompt.answer >= 0, `negative beginner subtraction: ${prompt.question}`);
      }
    }
  }
});

test('topics follow the band, with algebra and trig only at expert (FR-105, S3)', () => {
  for (const band of BANDS) {
    const allowed = new Set(topicsForBand(band));
    for (const topicId of new Set(pull(mentalMathTrainer, band, 400).map((p) => p.topicId))) {
      assert.ok(allowed.has(topicId), `${band} produced out-of-band topic ${topicId}`);
    }
  }

  const expertTopics = new Set(pull(mentalMathTrainer, 'expert', 600).map((p) => p.topicId));
  assert.ok(expertTopics.has('algebra'));
  assert.ok(expertTopics.has('trigonometry'));

  for (const band of ['beginner', 'intermediate', 'advanced']) {
    const topics = new Set(pull(mentalMathTrainer, band, 400).map((p) => p.topicId));
    assert.ok(!topics.has('algebra'), `${band} must not ask algebra`);
    assert.ok(!topics.has('trigonometry'), `${band} must not ask trigonometry`);
  }
});

test('algebra prompts have an integer solution that satisfies them (FR-109, S3)', () => {
  const prompts = pull(mentalMathTrainer, 'expert', 800).filter((p) => p.topicId === 'algebra');
  assert.ok(prompts.length > 20, 'expected a reasonable sample of algebra prompts');

  for (const prompt of prompts) {
    assert.ok(Number.isInteger(prompt.answer), `non-integer solution: ${prompt.question}`);

    const linear = /^(\d+)x ([+−]) (\d+) = (-?\d+)$/.exec(prompt.question);
    if (linear) {
      const [, a, sign, b, c] = linear;
      const offset = sign === '−' ? -Number(b) : Number(b);
      assert.equal(Number(a) * prompt.answer + offset, Number(c), prompt.question);
    }
  }
});

test('trigonometry uses exact values and never asks tan 90 (FR-110, S3)', () => {
  const prompts = pull(mentalMathTrainer, 'expert', 800).filter(
    (p) => p.topicId === 'trigonometry',
  );
  assert.ok(prompts.length > 20);
  const exact = new Set(['0', '1/2', '√2/2', '√3/2', '1', '√3/3', '√3']);

  for (const prompt of prompts) {
    assert.notEqual(prompt.question, 'tan 90°', 'tan 90 is undefined');
    assert.ok(exact.has(prompt.answer), `inexact value: ${prompt.answer}`);
    assert.equal(prompt.options.length, 4);
    assert.ok(prompt.options.includes(prompt.answer));
    assert.equal(new Set(prompt.options).size, 4, 'options must be distinct');
  }
});

test('practice honours the topic filter exactly (FR-55, S18)', () => {
  const prompts = pull(mentalMathTrainer, 'expert', 500, {
    practice: true,
    filters: { topics: ['algebra'] },
  });
  assert.ok(prompts.length > 0);
  for (const prompt of prompts) assert.equal(prompt.topicId, 'algebra');
});

test('an empty topic filter is refused rather than played (FR-56, S18)', () => {
  assert.equal(mentalMathTrainer.validateFilters({ topics: [] }).ok, false);
  assert.equal(mentalMathTrainer.validateFilters({ topics: ['addition'] }).ok, true);
});

test('duration scales with the band (FR-29, US-3.3)', () => {
  assert.equal(modeParamFor(mentalMathTrainer, 'beginner'), 45);
  assert.equal(modeParamFor(mentalMathTrainer, 'expert'), 90);
});

// --- Pattern Memory ---------------------------------------------------------

test('each level adds exactly one tile (FR-117, S15)', () => {
  for (let level = 1; level <= 10; level += 1) {
    assert.equal(tilesForLevel(level + 1) - tilesForLevel(level), 1);
  }
});

test('the board never grows mid-round (FR-119)', () => {
  const prompts = pull(patternMemoryTrainer, '4x4', 50);
  assert.ok(prompts.length > 1);
  for (const prompt of prompts) {
    assert.equal(prompt.columns, 4);
    assert.equal(prompt.rows, 4);
  }
});

test('levels are a pure function of seed and level number (NFR-5)', () => {
  assert.deepEqual(
    buildLevel(createRng(1234), '6x6', 1).answer,
    buildLevel(createRng(1234), '6x6', 1).answer,
  );

  const level = buildLevel(createRng(99), '6x6', 12);
  assert.equal(level.tileCount, tilesForLevel(12));
  assert.equal(new Set(level.answer).size, level.tileCount, 'tiles must be distinct');
  for (const index of level.answer) assert.ok(index >= 0 && index < 36);
});

test('a bigger board allows more levels, and the round ends at capacity (FR-119, S15)', () => {
  assert.ok(maxLevelFor('6x6') > maxLevelFor('3x3'));
  assert.equal(pull(patternMemoryTrainer, '3x3', 100).length, maxLevelFor('3x3'));
  // Corsi reports an average span of five to six on nine blocks, so the
  // smallest board must allow at least that far before it runs out.
  assert.ok(tilesForLevel(maxLevelFor('3x3')) >= 5, 'a 3x3 board must reach the average human span');
});

test('a pattern is checked as a set, not a sequence (FR-116, S4)', () => {
  const prompt = { kind: 'grid', answer: [1, 4, 7] };
  assert.equal(checkAnswer(prompt, [7, 1, 4]), 'correct');
  assert.equal(checkAnswer(prompt, [1, 4]), 'incorrect');
  assert.equal(checkAnswer(prompt, [1, 4, 7, 9]), 'incorrect');
});

// --- Figure Pairs -----------------------------------------------------------

test('a board holds each figure exactly twice (FR-125, FR-126, S19)', () => {
  for (const size of figurePairsTrainer.variants) {
    const board = dealBoard(createRng(7), size);
    assert.equal(board.faces.length, board.cells);
    assert.equal(board.cells % 2, 0);

    const counts = new Map();
    for (const face of board.faces) counts.set(face, (counts.get(face) ?? 0) + 1);
    assert.equal(counts.size, pairsFor(size));
    for (const [face, count] of counts) assert.equal(count, 2, `${face} appears ${count} times`);
  }
});

test('the completion target is the number of pairs (FR-18, S19)', () => {
  assert.equal(modeParamFor(figurePairsTrainer, '6x4'), 12);
  assert.equal(modeParamFor(figurePairsTrainer, '4x4'), 8);
});

test('two cards match when their figures match (FR-127, FR-128)', () => {
  const prompt = { kind: 'pairs', faces: ['★', '●', '★', '●'] };
  assert.equal(checkAnswer(prompt, [0, 2]), 'correct');
  assert.equal(checkAnswer(prompt, [0, 1]), 'incorrect');
  assert.equal(checkAnswer(prompt, [0, 0]), 'ignored', 'one card is not a turn');
  assert.equal(checkAnswer(prompt, [0]), 'ignored');
});

test('matched cards stay face up as the board progresses (FR-127)', () => {
  const generator = figurePairsTrainer.createGenerator({
    puzzleDate: '2026-11-02',
    variantKey: '4x3',
  });
  const first = generator.next({ index: 0 });
  assert.deepEqual(first.matched, []);

  const twin = first.faces.indexOf(first.faces[0], 1);
  const pair = [0, twin];
  const second = generator.next({ index: 1, lastCorrect: true, lastSubmission: pair });
  assert.deepEqual(
    second.matched.slice().sort((a, b) => a - b),
    pair.slice().sort((a, b) => a - b),
  );
  assert.equal(second.pairsMatched, 1);
});

// --- Geography --------------------------------------------------------------

test('all 195 countries validate and every flag derives (FR-135, FR-135a)', () => {
  assert.equal(countries.length, 195);
  assert.equal(countries.filter((c) => !c.flag).length, 0);
  assert.equal(flagFor({ code: 'NO' }), '🇳🇴');
  assert.equal(flagFor({ code: 'nope' }), '');
});

test('malformed entries are skipped, not fatal (FR-136, S9)', () => {
  const warnings = [];
  const result = validateCountries(
    {
      countries: [
        { name: 'Good', capital: 'City', continent: 'Europe', tier: 1, code: 'XX' },
        { name: '' },
      ],
    },
    { warn: (message) => warnings.push(message) },
  );
  assert.equal(result.length, 1);
  assert.equal(warnings.length, 1);
});

test('bands widen the country pool (FR-137, S2)', () => {
  const beginner = poolFor(countries, 'beginner').length;
  const intermediate = poolFor(countries, 'intermediate').length;
  const expert = poolFor(countries, 'expert').length;
  assert.ok(beginner < intermediate && intermediate < expert);
  assert.equal(expert, 195);
});

test('choice bands offer four distinct plausible options, expert types (FR-138, FR-139)', () => {
  const flags = registry.getTrainer('flag-guesser');

  for (const prompt of pull(flags, 'beginner', 60)) {
    assert.equal(prompt.kind, 'choice');
    assert.equal(prompt.options.length, 4);
    assert.equal(new Set(prompt.options).size, 4);
    assert.ok(prompt.options.includes(prompt.answer));
  }
  for (const prompt of pull(flags, 'expert', 20)) {
    assert.equal(prompt.kind, 'text');
  }
});

test('every Geography trainer runs three lives (FR-140, S5)', () => {
  for (const id of ['flag-guesser', 'outline-guesser', 'capital-guesser']) {
    assert.equal(modeParamFor(registry.getTrainer(id), 'expert'), 3);
  }
});

test('the Outline Guesser only asks countries it can draw (FR-135b)', () => {
  const outlineTrainer = registry.getTrainer('outline-guesser');
  for (const prompt of pull(outlineTrainer, 'expert', 120)) {
    assert.ok(prompt.outline && prompt.outline.length > 10, `${prompt.answer} has no shape`);
    assert.equal(prompt.viewBox, outlines.viewBox);
  }
});

test('the Capital Guesser asks both directions (FR-153, FR-154)', () => {
  const capitals = registry.getTrainer('capital-guesser');
  const topics = new Set(pull(capitals, 'advanced', 200).map((p) => p.topicId));
  assert.ok(topics.has('country-capital'));
  assert.ok(topics.has('capital-country'));
});

test('documented alternative names are accepted (FR-65, FR-155, S4)', () => {
  const uk = countries.find((c) => c.name === 'United Kingdom');
  const prompt = { kind: 'text', answer: uk.name, alternatives: uk.alternatives };
  assert.equal(checkAnswer(prompt, 'UK'), 'correct');
  assert.equal(checkAnswer(prompt, '  great britain '), 'correct');
  assert.equal(checkAnswer(prompt, 'Ireland'), 'incorrect');
});

// --- Outline hints ----------------------------------------------------------

test('distance matches hand-checked haversine values (FR-151, S20)', () => {
  // Oslo to Rome is about 2010 km.
  const km = haversineKm([59.91, 10.75], [41.9, 12.5]);
  assert.ok(Math.abs(km - 2010) < 30, `got ${km}`);
  assert.equal(Math.round(haversineKm([0, 0], [0, 0])), 0);
});

test('direction is reported as a compass point (FR-149, S20)', () => {
  assert.equal(compassPoint(bearingDegrees([40.2, -4.5], [52.1, 19.4])).name, 'north-east');
  assert.equal(compassPoint(0).name, 'north');
  assert.equal(compassPoint(90).name, 'east');
  assert.equal(compassPoint(180).name, 'south');
  assert.equal(compassPoint(270).name, 'west');
});

test('proximity is 100 only when exact and falls with distance (FR-150, S20)', () => {
  assert.equal(proximityPercent(0), 100);
  assert.ok(proximityPercent(2000) < 100);
  assert.ok(proximityPercent(8000) < proximityPercent(2000));
  assert.equal(proximityPercent(1e9), 0);
});

test('a wrong guess produces a usable hint (FR-148, S20)', () => {
  const outlineTrainer = registry.getTrainer('outline-guesser');
  const hint = outlineTrainer.hintFor('France', 'Germany');
  assert.equal(hint.guess, 'France');
  assert.ok(hint.distanceKm > 300 && hint.distanceKm < 1200, `got ${hint.distanceKm}`);
  assert.match(hint.direction, /east/);
  assert.ok(hint.proximity > 85);
  assert.equal(outlineTrainer.hintFor('Atlantis', 'Germany'), null);
});

test('an alternative spelling still resolves to a hint (FR-65)', () => {
  const outlineTrainer = registry.getTrainer('outline-guesser');
  assert.equal(outlineTrainer.hintFor('UK', 'Germany').guess, 'United Kingdom');
});

// --- Famous People ----------------------------------------------------------

const peopleContent = validatePeople(peopleRaw, { warn: () => {} });

test('every person has a category and a clue that does not give the answer away', () => {
  assert.ok(peopleContent.people.length >= 80, `only ${peopleContent.people.length} people`);
  for (const person of peopleContent.people) {
    assert.ok(person.clue.length > 20, `clue too thin for ${person.name}`);
    assert.ok(
      !person.clue.toLocaleLowerCase().includes(person.name.toLocaleLowerCase()),
      `clue names ${person.name}`,
    );
    assert.ok(peopleContent.categories[person.category], `unknown category for ${person.name}`);
  }
  assert.equal(new Set(peopleContent.people.map((p) => p.name)).size, peopleContent.people.length);
});

test('every category pool is big enough for a full round', () => {
  for (const key of Object.keys(peopleContent.categories)) {
    const pool = peoplePoolFor(peopleContent.people, key);
    assert.ok(pool.length >= PEOPLE_PER_ROUND, `${key} has only ${pool.length}`);
  }
  assert.equal(peoplePoolFor(peopleContent.people, 'all').length, peopleContent.people.length);
});

test('a round draws fifteen distinct people (US-12.1)', () => {
  const trainer = registry.getTrainer('famous-people');
  const prompts = pull(trainer, 'all', 40);
  assert.equal(prompts.length, PEOPLE_PER_ROUND);
  assert.equal(new Set(prompts.map((p) => p.answer)).size, PEOPLE_PER_ROUND);
});

test('a category round only asks that category (FR-156)', () => {
  const trainer = registry.getTrainer('famous-people');
  for (const key of Object.keys(peopleContent.categories)) {
    for (const prompt of pull(trainer, key, 20)) {
      assert.equal(prompt.topicId, key);
    }
  }
});

test('surnames and unaccented spellings are accepted (FR-64, FR-65)', () => {
  const byName = new Map(peopleContent.people.map((p) => [p.name, p]));

  const mercury = byName.get('Freddie Mercury');
  assert.equal(checkAnswer({ kind: 'text', ...mercury }, 'mercury'), 'correct');

  const pele = byName.get('Pelé');
  assert.equal(checkAnswer({ kind: 'text', ...pele }, 'Pele'), 'correct');

  const king = byName.get('Martin Luther King Jr.');
  assert.equal(checkAnswer({ kind: 'text', ...king }, 'Martin Luther King'), 'correct');
  assert.equal(checkAnswer({ kind: 'text', ...king }, 'King'), 'correct');

  // A lowercase particle means no automatic surname, so "Great" is not a name.
  const alexander = byName.get('Alexander the Great');
  assert.equal(checkAnswer({ kind: 'text', ...alexander }, 'Great'), 'incorrect');
  assert.equal(checkAnswer({ kind: 'text', ...alexander }, 'Alexander'), 'correct');
});

test('a malformed person is skipped, and a clue naming its answer is rejected', () => {
  const warnings = [];
  const result = validatePeople(
    {
      categories: { music: 'Music' },
      people: [
        { name: 'Good Person', category: 'music', clue: 'A clue that is long enough to pass.' },
        { name: 'No Clue', category: 'music' },
        { name: 'Giveaway', category: 'music', clue: 'This clue names Giveaway outright.' },
      ],
    },
    { warn: (message) => warnings.push(message) },
  );
  assert.equal(result.people.length, 1);
  assert.equal(warnings.length, 2);
});
