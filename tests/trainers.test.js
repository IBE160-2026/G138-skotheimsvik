import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
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
import {
  checkAnswer,
  matchSuggestions,
  matchWordRushEntry,
  resolveClosestMatch,
} from '../src/core/answer.js';
import { verifyWordRushCandidateOnline } from '../src/trainers/word-rush/index.js';
import { BANDS, modeParamFor } from '../src/core/variants.js';
import { buildGitHubAuthorizeUrl, createAuthStore } from '../src/core/auth.js';
import { createLeaderboardStore } from '../src/core/leaderboard.js';
import { createStorage, createMemoryBackend } from '../src/core/storage.js';
import { createRound } from '../src/core/round.js';
import { createFixedClock } from '../src/core/clock.js';
import * as views from '../src/ui/views.js';
import { createRoundView } from '../src/ui/round-view.js';
import { formatDate } from '../src/ui/dom.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const countriesRaw = JSON.parse(
  readFileSync(join(root, 'src/trainers/geography/countries.json'), 'utf8'),
);
const outlines = JSON.parse(
  readFileSync(join(root, 'src/trainers/geography/outlines.json'), 'utf8'),
);
const peopleRaw = JSON.parse(readFileSync(join(root, 'src/trainers/people/people.json'), 'utf8'));
const portraitsRaw = JSON.parse(
  readFileSync(join(root, 'src/trainers/people/portraits.json'), 'utf8'),
);
const countries = validateCountries(countriesRaw, { warn: () => {} });
const registry = buildRegistry(
  { countries: countriesRaw, outlines, people: peopleRaw, portraits: portraitsRaw },
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

test('twelve trainers register across eight categories (FR-6, S21)', () => {
  assert.equal(registry.size, 12);
  assert.deepEqual(
    registry.listCategories().map((c) => c.id),
    [
      'word-rush',
      'word-chain',
      'timeline-sort',
      'connection-grid',
      'math',
      'memory',
      'geography',
      'people',
    ],
  );
  assert.deepEqual(registry.trainersIn('word-rush').map((t) => t.id), ['word-rush']);
  assert.deepEqual(registry.trainersIn('word-chain').map((t) => t.id), ['word-chain']);
  assert.deepEqual(registry.trainersIn('timeline-sort').map((t) => t.id), ['timeline-sort']);
  assert.deepEqual(registry.trainersIn('connection-grid').map((t) => t.id), ['connection-grid']);
  assert.deepEqual(registry.trainersIn('memory').map((t) => t.id), [
    'pattern-memory',
    'figure-pairs',
  ]);
  assert.deepEqual(registry.trainersIn('geography').map((t) => t.id), [
    'flag-guesser',
    'outline-guesser',
    'capital-guesser',
    'border-hop',
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

// Most clues are generated from encyclopedia intros, so the things that go
// wrong are mechanical: a surviving name fragment, a half-stripped
// pronunciation guide, or a sentence that starts mid-word.
test('no clue leaks a part of the name or the leftovers of its own cleanup', () => {
  for (const person of peopleContent.people) {
    for (const part of person.name.split(/[\s'’-]+/)) {
      if (part.length < 4) continue;
      // Whole words only: "Amsterdam annexe" is not a leak of "Anne".
      const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      assert.ok(
        !new RegExp(`\\b${escaped}\\b`, 'i').test(person.clue),
        `clue for ${person.name} contains "${part}"`,
      );
    }
    assert.ok(!/[()[\]]/.test(person.clue), `clue for ${person.name} has a stray bracket`);
    assert.ok(/^[A-Z"“]/.test(person.clue), `clue for ${person.name} starts mid-sentence`);
    assert.ok(!/[—–]\s*[—–]/.test(person.clue), `clue for ${person.name} has doubled dashes`);
  }
});

test('every category pool is big enough for a full round', () => {
  for (const key of Object.keys(peopleContent.categories)) {
    const pool = peoplePoolFor(peopleContent.people, key);
    assert.ok(pool.length >= PEOPLE_PER_ROUND, `${key} has only ${pool.length}`);
  }
  assert.equal(peoplePoolFor(peopleContent.people, 'all').length, peopleContent.people.length);
});

test('People Guesser is a single daily 3-lives run combining all categories with no practice mode (US-12.1)', () => {
  const trainer = registry.getTrainer('famous-people');
  assert.equal(trainer.name, 'People Guesser');
  assert.equal(trainer.roundMode, 'lives');
  assert.equal(trainer.modeParam, 3);
  assert.deepEqual(trainer.variants, ['all']);
  assert.equal(trainer.noPractice, true);
  const prompts = pull(trainer, 'all', 40);
  assert.equal(prompts.length, 40);
  assert.equal(new Set(prompts.map((p) => p.answer)).size, 40);
});

test('poolFor filters by category when given a category key (FR-156)', () => {
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

/**
 * Portraits come from Wikimedia, so the licence is the part with real
 * consequences. A non-free image in a public coursework repository is a
 * copyright problem, not a cosmetic one.
 */
test('every bundled portrait is freely licensed, attributed, and present on disk', () => {
  const credits = JSON.parse(
    readFileSync(join(root, 'src/trainers/people/portraits.json'), 'utf8'),
  ).portraits;

  const allowed = /^(public domain|pd[- ]?|cc0|cc[- ]by(?!.*(nc|nd))|no restrictions|attribution|ogl)/i;
  const entries = Object.entries(credits);
  assert.ok(entries.length > 100, `only ${entries.length} portraits`);

  for (const [name, credit] of entries) {
    assert.ok(allowed.test(credit.licence), `${name} has a non-free licence: ${credit.licence}`);
    assert.ok(credit.artist && credit.artist.length > 0, `${name} has no attribution`);
    assert.match(credit.source, /^https:\/\/(commons\.wikimedia|en\.wikipedia)\.org\//, name);
    assert.ok(
      existsSync(join(root, 'src/trainers/people/portraits', credit.file)),
      `${name}: missing file ${credit.file}`,
    );
  }
});

test('a person without a portrait still produces a playable prompt (FR-167)', () => {
  const trainer = registry.getTrainer('famous-people');
  for (const prompt of pull(trainer, 'all', 15)) {
    assert.ok(prompt.question.length > 20, 'the clue must carry the prompt on its own');
    assert.ok(prompt.image && prompt.image.length > 0, `${prompt.answer} must have a portrait URL`);
    assert.ok(prompt.imageCredit?.artist, `${prompt.answer} has an image but no credit`);
    assert.ok(prompt.imageCredit?.licence, `${prompt.answer} has an image but no licence`);
  }
});

test('all 195 countries have high-resolution outlines in outlines.json', () => {
  for (const country of countries) {
    const entry = outlines.outlines[country.name];
    assert.ok(entry && entry.d && entry.d.length > 10, `Missing outline for ${country.name}`);
    assert.ok(Array.isArray(entry.centroid) && entry.centroid.length === 2);
  }
});

test('autocomplete and autocorrect suggest prefix matches (like AL -> Albania) and snap typos', () => {
  const pool = countries.map((c) => ({ label: c.name, alternatives: c.alternatives }));
  const alMatches = matchSuggestions('AL', pool, 10).map((m) => m.label);
  assert.ok(alMatches.includes('Albania'), 'typing AL should suggest Albania');
  assert.ok(alMatches.includes('Algeria'), 'typing AL should suggest Algeria');

  // Autocorrect minor typos to closest valid entry
  assert.equal(resolveClosestMatch('Albani', pool), 'Albania');
  assert.equal(resolveClosestMatch('Norwy', pool), 'Norway');
});

test('word-rush never picks an impossible letter, disables word help, and is titled Word Rush', () => {
  const wr = registry.getTrainer('word-rush');
  assert.equal(wr.name, 'Word Rush');
  const c1 = wr.getChallenge('2026-10-15', 'daily');
  const c2 = wr.getChallenge('2026-10-15', 'daily');
  assert.equal(c1.categoryId, c2.categoryId);
  assert.equal(c1.letter, c2.letter);
  assert.ok(c1.validWords.length >= 5, `expected >= 5 valid words, got ${c1.validWords.length}`);

  const gen = wr.createGenerator({ puzzleDate: '2026-10-15', variantKey: 'daily' });
  const prompt = gen.next({ index: 0 });
  assert.equal(prompt.kind, 'word-rush');
  assert.equal(prompt.suggestions, undefined, 'Word Rush must not expose autocomplete suggestions');
});

test('GitHub auth and daily/all-time leaderboards record only real players with zero fake baselines', async () => {
  const storage = createStorage({ backend: createMemoryBackend() });
  const auth = createAuthStore({ storage });
  const lb = createLeaderboardStore({ storage });

  // Step 2: Authorize URL points to real github.com/login/oauth/authorize
  const authUrl = buildGitHubAuthorizeUrl({
    clientId: 'Iv1.testclientid',
    redirectUri: 'http://localhost:8080/',
    state: 'category:word-rush',
  });
  assert.ok(authUrl.startsWith('https://github.com/login/oauth/authorize?'));
  assert.ok(authUrl.includes('client_id=Iv1.testclientid'));
  assert.ok(authUrl.includes('scope=read%3Auser'));

  // Before any player plays, leaderboards must be completely empty (no fake players).
  assert.equal(lb.dailyLeaderboard('2026-10-15', { trainerId: 'word-rush' }).length, 0);
  assert.equal(lb.allTimeLeaderboard({ trainerId: 'word-rush' }).length, 0);

  // Step 3 & 4: Exchange OAuth ?code=... for verified user via /api/github-auth
  const user = await auth.completeOAuthCallback('oauth_code_123', async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      user: {
        login: 'octocat',
        id: 583231,
        name: 'The Octocat',
        avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4',
      },
    }),
  }));

  assert.equal(auth.isAuthenticated(), true);
  assert.equal(user.login, 'octocat');

  lb.recordEntry({
    user,
    result: {
      puzzleDate: '2026-10-15',
      trainerId: 'word-rush',
      variantKey: 'daily',
      score: 42,
      elapsedMs: 118000,
      wordRush: { categoryLabel: 'Food', letter: 'C' },
    },
  });

  const daily = lb.dailyLeaderboard('2026-10-15', { trainerId: 'word-rush', maxPossible: 50 });
  assert.equal(daily.length, 1);
  assert.equal(daily[0].login, 'octocat');
  assert.equal(daily[0].score, 42);

  const allTime = lb.allTimeLeaderboard({ trainerId: 'word-rush' });
  assert.equal(allTime.length, 1);
  assert.equal(allTime[0].login, 'octocat');
  assert.equal(allTime[0].bestScore, 42);
});

test('word-rush accepts compound/spaced variants (hashbrown / hash brown / hash browns) and minor 1-char typos (hotsog -> Hot Dog)', () => {
  const wr = registry.getTrainer('word-rush');
  // Find a date or use practice generator for Food with H
  const hFoodPrompt = {
    kind: 'word-rush',
    letter: 'H',
    topicId: 'food',
    topicLabel: 'Food & Dishes',
    categoryGroup: 'food',
    validWords: [
      { label: 'Hot Dog', alternatives: [] },
      { label: 'Hash Browns', alternatives: [] },
      { label: 'Hamburger', alternatives: [] },
    ],
    foundWords: [],
  };

  // Compound vs spaced vs singular/plural
  assert.equal(matchWordRushEntry(hFoodPrompt, 'hash brown').status, 'correct');
  assert.equal(matchWordRushEntry(hFoodPrompt, 'hashbrown').status, 'correct');
  assert.equal(matchWordRushEntry(hFoodPrompt, 'hashbrowns').status, 'correct');
  assert.equal(matchWordRushEntry(hFoodPrompt, 'hotdog').status, 'correct');
  assert.equal(matchWordRushEntry(hFoodPrompt, 'hot dog').status, 'correct');

  // 1-character typo tolerance on words >= 6 chars starting with the right letter
  const hotsogMatch = matchWordRushEntry(hFoodPrompt, 'hotsog');
  assert.equal(hotsogMatch.status, 'correct');
  assert.equal(hotsogMatch.matchedEntry.label, 'Hot Dog');

  // Duplicate detection works across compound/plural variants too
  const withFound = { ...hFoodPrompt, foundWords: ['Hash Browns'] };
  assert.equal(matchWordRushEntry(withFound, 'hashbrown').status, 'duplicate');
  assert.equal(matchWordRushEntry(withFound, 'hash brown').status, 'duplicate');
  assert.ok(wr);
});

test('verifyWordRushCandidateOnline approves valid unseen foods and declines non-matching words via public APIs', async () => {
  const mockFetch = async (url) => {
    if (url.includes('themealdb.com') && url.includes('Halloumi')) {
      return {
        ok: true,
        json: async () => ({ meals: [{ strMeal: 'Halloumi Skewers' }] }),
      };
    }
    if (url.includes('datamuse.com') && url.includes('hibachi')) {
      return {
        ok: true,
        json: async () => [
          {
            word: 'hibachi',
            defs: ['n\tA traditional Japanese heating device used for cooking food and grilled dishes.'],
          },
        ],
      };
    }
    return {
      ok: true,
      json: async () => ({ meals: null }),
    };
  };

  const approvedMeal = await verifyWordRushCandidateOnline({
    word: 'Halloumi',
    letter: 'H',
    categoryId: 'food',
    categoryGroup: 'food',
    fetchImpl: mockFetch,
  });
  assert.equal(approvedMeal.approved, true);

  const approvedDict = await verifyWordRushCandidateOnline({
    word: 'hibachi',
    letter: 'H',
    categoryId: 'food',
    categoryGroup: 'food',
    fetchImpl: mockFetch,
  });
  assert.equal(approvedDict.approved, true);

  const declinedWrongLetter = await verifyWordRushCandidateOnline({
    word: 'Pizza',
    letter: 'H',
    categoryId: 'food',
    categoryGroup: 'food',
    fetchImpl: mockFetch,
  });
  assert.equal(declinedWrongLetter.approved, false);
});

test('Border Hop is registered under Geography and connects bordering countries along valid overland routes', () => {
  const borderHop = registry.getTrainer('border-hop');
  assert.ok(borderHop, 'Border Hop trainer should exist');
  assert.equal(borderHop.categoryId, 'geography');

  const gen = borderHop.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'intermediate' });
  const p1 = gen.next({ index: 0 });
  assert.equal(p1.kind, 'border-hop');
  assert.ok(p1.startCountry && p1.targetCountry);
  assert.notEqual(p1.startCountry, p1.targetCountry);
  assert.ok(p1.validNextCountries.length > 0);
  assert.equal(checkAnswer(p1, p1.answer), 'correct');
});

test('Timeline Sort, Word Chain, and ConnectionGrid are registered in their own categories as single daily 3-lives games with no practice mode', () => {
  const timeline = registry.getTrainer('timeline-sort');
  assert.ok(timeline);
  assert.equal(timeline.categoryId, 'timeline-sort');
  assert.equal(timeline.roundMode, 'lives');
  assert.equal(timeline.modeParam, 3);
  assert.deepEqual(timeline.variants, ['daily']);
  assert.equal(timeline.noPractice, true);
  const tlGen = timeline.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'daily' });
  const tlPrompt = tlGen.next({ index: 0 });
  assert.equal(tlPrompt.kind, 'timeline-sort');
  assert.equal(tlPrompt.timeline.length, 1);
  assert.equal(checkAnswer(tlPrompt, tlPrompt.answer), 'correct');
  const tlNext = tlGen.next({ index: 1, lastCorrect: true, lastSubmission: tlPrompt.answer });
  assert.equal(tlNext.timeline.length, 2, 'Timeline grows by 1 card each turn');

  const wordChain = registry.getTrainer('word-chain');
  assert.ok(wordChain);
  assert.equal(wordChain.categoryId, 'word-chain');
  assert.equal(wordChain.roundMode, 'lives');
  assert.equal(wordChain.modeParam, 3);
  assert.deepEqual(wordChain.variants, ['daily']);
  assert.equal(wordChain.noPractice, true);
  const wcGen = wordChain.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'daily' });
  const wcPrompt = wcGen.next({ index: 0 });
  assert.equal(wcPrompt.isWordChain, true);
  assert.equal(wcPrompt.previousWord, null, 'First word is chosen by the player, not the game');
  assert.equal(wcPrompt.letter, '', 'First word can start with any letter in the category');
  assert.equal(checkAnswer(wcPrompt, wcPrompt.answer), 'correct');
  const wcNext = wcGen.next({ index: 1, lastCorrect: true, lastSubmission: wcPrompt.answer });
  assert.equal(
    wcNext.previousWord,
    wcPrompt.answer,
    'Word Chain advances to the player’s chosen starter word and requires its last letter next',
  );
  // Starter word is now in foundWords so repeating it is rejected as a duplicate
  assert.equal(matchWordRushEntry(wcNext, wcPrompt.answer).status, 'duplicate');

  // Verify round.result() records isWordChain, starterWord, and chainWords accurately
  const clock = createFixedClock({ today: '2026-11-15', startMs: 1000 });
  const wcRoundGen = wordChain.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'daily' });
  const wcRound = createRound({
    trainer: wordChain,
    variantKey: 'daily',
    puzzleDate: '2026-11-15',
    generator: wcRoundGen,
    clock,
  });
  const firstPrompt = wcRound.start();
  const firstWord = firstPrompt.answer;
  wcRound.submit(firstWord);
  const secondWord = wcRound.prompt.answer;
  wcRound.submit(secondWord);
  wcRound.abandon();
  const wcResult = wcRound.result();
  assert.equal(wcResult.wordRush.isWordChain, true);
  assert.equal(wcResult.wordRush.starterWord, firstWord);
  assert.deepEqual(wcResult.wordRush.foundWords, [firstWord, secondWord]);
  assert.deepEqual(wcResult.wordRush.chainWords, [firstWord, secondWord]);

  const connGrid = registry.getTrainer('connection-grid');
  assert.ok(connGrid);
  assert.equal(connGrid.categoryId, 'connection-grid');
  assert.equal(connGrid.roundMode, 'lives');
  assert.equal(connGrid.modeParam, 3);
  assert.deepEqual(connGrid.variants, ['daily']);
  assert.equal(connGrid.noPractice, true);
  const cgGen = connGrid.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'daily' });
  const cgPrompt = cgGen.next({ index: 0 });
  assert.equal(cgPrompt.kind, 'connection-grid');
  assert.equal(cgPrompt.remainingCells.length, 16);
  assert.equal(checkAnswer(cgPrompt, cgPrompt.answer), 'correct');
  assert.equal(checkAnswer(cgPrompt, ['a', 'b', 'c', 'd']), 'incorrect');
  const cgNext = cgGen.next({ index: 1, lastCorrect: true, lastSubmission: cgPrompt.answer });
  assert.equal(cgNext.solvedGroups.length, 1);
  assert.equal(cgNext.remainingCells.length, 12);
});

test('UI views and date formatting load cleanly and format dates in English', () => {
  assert.equal(typeof views.categoriesView, 'function');
  assert.equal(typeof views.trainerView, 'function');
  assert.equal(typeof views.leaderboardView, 'function');
  assert.equal(typeof createRoundView, 'function');
  const formatted = formatDate('2026-11-15');
  assert.match(formatted, /Sun.*15.*Nov.*2026/);
});
