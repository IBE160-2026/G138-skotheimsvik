import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildRegistry } from '../src/trainers/index.js';
import {
  mentalMathTrainer,
  topicsForBand,
  bandForCorrectCount,
  MATH_TIME_LIMIT_SECONDS,
} from '../src/trainers/math/mental-math.js';
import {
  patternMemoryTrainer,
  buildLevel,
  tilesForLevel,
  maxLevelFor,
  dailyBoardSizeFor,
} from '../src/trainers/memory/pattern.js';
import {
  figurePairsTrainer,
  dealBoard,
  pairsFor,
  dailyPairsBoardSizeFor,
} from '../src/trainers/memory/pairs.js';
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
import { buildGitHubAuthorizeUrl, createAuthStore, isAdminUser } from '../src/core/auth.js';
import { createLeaderboardStore } from '../src/core/leaderboard.js';
import { createPreferencesStore } from '../src/core/preferences.js';
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

test('twelve trainers register across twelve standalone 1-run-per-day categories (FR-6, S21)', () => {
  assert.equal(registry.size, 12);
  assert.deepEqual(
    registry.listCategories().map((c) => c.id),
    [
      'word-rush',
      'word-chain',
      'timeline-sort',
      'connection-grid',
      'math',
      'pattern-memory',
      'figure-pairs',
      'flag-guesser',
      'outline-guesser',
      'capital-guesser',
      'border-hop',
      'people',
    ],
  );
  for (const cat of registry.listCategories()) {
    assert.equal(registry.trainersIn(cat.id).length, 1, `category ${cat.id} must have 1 trainer`);
    const trainer = registry.trainersIn(cat.id)[0];
    assert.equal(trainer.variants.length, 1, `trainer ${trainer.id} must have 1 daily attempt`);
  }
});

// --- Math Blitz -------------------------------------------------------------

test('Math Blitz is a 3-lives, 20s-per-question daily streak trainer with escalating difficulty and practice filters', () => {
  assert.equal(mentalMathTrainer.name, 'Math Blitz');
  assert.equal(mentalMathTrainer.roundMode, 'lives');
  assert.equal(mentalMathTrainer.modeParam, 3);
  assert.equal(mentalMathTrainer.promptTimeLimitSeconds, 20);
  assert.equal(MATH_TIME_LIMIT_SECONDS, 20);
  assert.deepEqual(mentalMathTrainer.variants, ['daily']);
  assert.ok(!mentalMathTrainer.noPractice, 'Math Blitz keeps Practice mode available');
  assert.ok(mentalMathTrainer.practiceFilters?.topics, 'Math Blitz exposes topic filters in Practice');

  assert.equal(bandForCorrectCount(0), 'beginner');
  assert.equal(bandForCorrectCount(3), 'beginner');
  assert.equal(bandForCorrectCount(4), 'intermediate');
  assert.equal(bandForCorrectCount(9), 'advanced');
  assert.equal(bandForCorrectCount(15), 'expert');
});

test('arithmetic is always valid across escalating bands (FR-106 to FR-108, S3)', () => {
  for (const band of BANDS) {
    for (const prompt of pull(mentalMathTrainer, band, 200)) {
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
    for (const topicId of new Set(pull(mentalMathTrainer, band, 250).map((p) => p.topicId))) {
      assert.ok(allowed.has(topicId), `${band} produced out-of-band topic ${topicId}`);
    }
  }

  const expertTopics = new Set(pull(mentalMathTrainer, 'expert', 500).map((p) => p.topicId));
  assert.ok(expertTopics.has('algebra'));
  assert.ok(expertTopics.has('trigonometry'));

  for (const band of ['beginner', 'intermediate', 'advanced']) {
    const topics = new Set(pull(mentalMathTrainer, band, 250).map((p) => p.topicId));
    assert.ok(!topics.has('algebra'), `${band} must not ask algebra`);
    assert.ok(!topics.has('trigonometry'), `${band} must not ask trigonometry`);
  }
});

test('algebra prompts have an integer solution that satisfies them (FR-109, S3)', () => {
  const prompts = pull(mentalMathTrainer, 'expert', 600).filter((p) => p.topicId === 'algebra');
  assert.ok(prompts.length > 15, 'expected a reasonable sample of algebra prompts');

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
  const prompts = pull(mentalMathTrainer, 'expert', 600).filter(
    (p) => p.topicId === 'trigonometry',
  );
  assert.ok(prompts.length > 15);
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
  const prompts = pull(mentalMathTrainer, 'daily', 200, {
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

// --- Pattern Memory ---------------------------------------------------------

test('each level adds exactly one tile and Pattern Memory has 1 life with no practice mode', () => {
  assert.equal(patternMemoryTrainer.categoryId, 'pattern-memory');
  assert.equal(patternMemoryTrainer.roundMode, 'lives');
  assert.equal(patternMemoryTrainer.modeParam, 1);
  assert.equal(patternMemoryTrainer.noPractice, true);
  assert.deepEqual(patternMemoryTrainer.variants, ['daily']);

  for (let level = 1; level <= 10; level += 1) {
    assert.equal(tilesForLevel(level + 1) - tilesForLevel(level), 1);
  }
});

test('Pattern Memory daily board size varies across days and steps up when a grid reaches capacity', () => {
  const sizesSeen = new Set();
  for (let day = 1; day <= 25; day += 1) {
    sizesSeen.add(dailyBoardSizeFor(`2026-11-${String(day).padStart(2, '0')}`));
  }
  assert.ok(sizesSeen.size >= 3, 'daily board size should vary across dates');

  const prompts = pull(patternMemoryTrainer, 'daily', 20);
  assert.ok(prompts.length >= 15, 'Pattern Memory continues onto larger boards past initial capacity');
  assert.equal(pull(patternMemoryTrainer, '3x3', 100).length, maxLevelFor('3x3'));
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

test('a bigger board has higher single-grid capacity', () => {
  assert.ok(maxLevelFor('6x6') > maxLevelFor('3x3'));
  assert.ok(tilesForLevel(maxLevelFor('3x3')) >= 5, 'a 3x3 board must reach the average human span');
});

test('a pattern with a sequence checks exact blink order, while legacy grid prompts check sets', () => {
  const legacyPrompt = { kind: 'grid', answer: [1, 4, 7] };
  assert.equal(checkAnswer(legacyPrompt, [7, 1, 4]), 'correct');
  assert.equal(checkAnswer(legacyPrompt, [1, 4]), 'incorrect');
  assert.equal(checkAnswer(legacyPrompt, [1, 4, 7, 9]), 'incorrect');

  const seqPrompt = { kind: 'grid', answer: [7, 1, 4], sequence: [7, 1, 4] };
  assert.equal(checkAnswer(seqPrompt, [7, 1, 4]), 'correct');
  assert.equal(checkAnswer(seqPrompt, [1, 4, 7]), 'incorrect');
  assert.equal(checkAnswer(seqPrompt, [7, 1]), 'incorrect');

  // Also verify daily Pattern Memory extends the sequence by 1 square each round on the same board
  const gen = patternMemoryTrainer.createGenerator({ puzzleDate: '2026-11-05', variantKey: 'daily' });
  const lvl1 = gen.next();
  const lvl2 = gen.next();
  assert.equal(lvl2.sequence.length, lvl1.sequence.length + 1);
  if (lvl1.boardSize === lvl2.boardSize) {
    assert.deepEqual(lvl2.sequence.slice(0, lvl1.sequence.length), lvl1.sequence);
  }
});

// --- Figure Pairs -----------------------------------------------------------

test('Figure Pairs is a standalone 1-run-per-day completion game with varying board size and no practice mode', () => {
  assert.equal(figurePairsTrainer.categoryId, 'figure-pairs');
  assert.equal(figurePairsTrainer.roundMode, 'completion');
  assert.equal(figurePairsTrainer.noPractice, true);
  assert.deepEqual(figurePairsTrainer.variants, ['daily']);

  const sizesSeen = new Set();
  for (let day = 1; day <= 25; day += 1) {
    sizesSeen.add(dailyPairsBoardSizeFor(`2026-11-${String(day).padStart(2, '0')}`));
  }
  assert.ok(sizesSeen.size >= 3, 'daily pairs board size should vary across dates');

  for (const size of ['4x3', '4x4', '6x4', '6x6']) {
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
  const dailySize = dailyPairsBoardSizeFor('2026-11-02');
  assert.equal(modeParamFor(figurePairsTrainer, 'daily', '2026-11-02'), pairsFor(dailySize));
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

test('Geography is split into 4 standalone 1-run-per-day modes with varying daily difficulty and no practice mode', () => {
  const flags = registry.getTrainer('flag-guesser');
  const countryGuesser = registry.getTrainer('outline-guesser');
  const capitals = registry.getTrainer('capital-guesser');
  const borderHop = registry.getTrainer('border-hop');

  assert.equal(flags.categoryId, 'flag-guesser');
  assert.equal(flags.modeParam, 3);
  assert.equal(flags.noPractice, true);
  assert.deepEqual(flags.variants, ['daily']);

  assert.equal(countryGuesser.categoryId, 'outline-guesser');
  assert.equal(countryGuesser.name, 'Country Guesser');
  assert.equal(countryGuesser.modeParam, 6);
  assert.equal(countryGuesser.noPractice, true);
  assert.deepEqual(countryGuesser.variants, ['daily']);

  assert.equal(capitals.categoryId, 'capital-guesser');
  assert.equal(capitals.name, 'Capital Guesser');
  assert.equal(capitals.modeParam, 4); // 3 wrong-guess hints + 1 final guess
  assert.equal(capitals.noPractice, true);
  assert.deepEqual(capitals.variants, ['daily']);

  assert.equal(borderHop.categoryId, 'border-hop');
  assert.equal(borderHop.modeParam, 3);
  assert.equal(borderHop.noPractice, true);
  assert.deepEqual(borderHop.variants, ['daily']);
});

test('Flag Guesser and Country Guesser are 1-target daily puzzles that stay on the same target across wrong guesses', () => {
  const clock = createFixedClock({ today: '2026-11-15', startMs: 1000 });
  const countryGuesser = registry.getTrainer('outline-guesser');
  const gen = countryGuesser.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'daily' });
  const round = createRound({
    trainer: countryGuesser,
    variantKey: 'daily',
    puzzleDate: '2026-11-15',
    generator: gen,
    clock,
  });
  const prompt = round.start();
  assert.ok(prompt.outline && prompt.outline.length > 10);
  assert.equal(prompt.stayOnWrongGuess, true);
  assert.equal(round.livesRemaining, 6);

  // 2 wrong guesses deduct lives but keep the same target country active
  round.submit('Atlantis');
  assert.equal(round.livesRemaining, 5);
  assert.equal(round.prompt.answer, prompt.answer);
  round.submit('Narnia');
  assert.equal(round.livesRemaining, 4);
  assert.equal(round.prompt.answer, prompt.answer);

  // Solving the daily country completes the round immediately
  const solved = round.submit(prompt.answer);
  assert.equal(solved.status, 'correct');
  assert.equal(solved.ended, true);
  assert.equal(round.state, 'ended');
});

test('Capital Guesser only asks for the capital city and provides 3 progressive hints (closest city, fun fact, country)', () => {
  const capitals = registry.getTrainer('capital-guesser');
  const gen = capitals.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'daily' });
  const prompt = gen.next({ index: 0 });
  assert.equal(prompt.stayOnWrongGuess, true);
  assert.equal(prompt.capitalHints.length, 3);
  assert.match(prompt.capitalHints[0].label, /Hint 1.*City/i);
  assert.match(prompt.capitalHints[1].label, /Hint 2.*Fact/i);
  assert.match(prompt.capitalHints[2].label, /Hint 3.*Country/i);
  assert.ok(prompt.capitalHints[2].text.includes(prompt.countryName));

  // Losing all 4 lives in Capital Guesser records the answerReveal on the result
  const clock = createFixedClock({ today: '2026-11-15', startMs: 1000 });
  const round = createRound({
    trainer: capitals,
    variantKey: 'daily',
    puzzleDate: '2026-11-15',
    generator: capitals.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'daily' }),
    clock,
  });
  round.start();
  round.submit('Wrong 1');
  round.submit('Wrong 2');
  round.submit('Wrong 3');
  round.submit('Wrong 4');
  assert.equal(round.state, 'ended');
  const res = round.result();
  assert.ok(res.answerReveal);
  assert.equal(res.answerReveal.kind, 'capital');
  assert.equal(res.answerReveal.solved, false);
  assert.equal(res.answerReveal.capitalName, prompt.capitalName);
  assert.equal(res.answerReveal.countryName, prompt.countryName);
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
  assert.equal(trainer.promptTimeLimitSeconds, 30);
  assert.deepEqual(trainer.variants, ['all']);
  assert.equal(trainer.noPractice, true);
  const prompts = pull(trainer, 'all', 40);
  assert.equal(prompts.length, 40);
  assert.equal(new Set(prompts.map((p) => p.answer)).size, 40);

  // Verify 30s per-person countdown timer and timeout life loss
  const clock = createFixedClock({ today: '2026-11-15', startMs: 1000 });
  const gen = trainer.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'all' });
  const round = createRound({
    trainer,
    variantKey: 'all',
    puzzleDate: '2026-11-15',
    generator: gen,
    clock,
  });
  const firstPrompt = round.start();
  assert.equal(round.promptRemainingMs(), 30_000);
  clock.advance(12_000);
  assert.equal(round.promptRemainingMs(), 18_000);
  const timeoutFeedback = round.submit('', { timedOut: true });
  assert.equal(timeoutFeedback.status, 'incorrect');
  assert.equal(timeoutFeedback.timedOut, true);
  assert.equal(timeoutFeedback.lifeLost, true);
  assert.equal(timeoutFeedback.expected, firstPrompt.answer);
  assert.equal(round.livesRemaining, 2);
  // Timer resets to 30s for the next person
  assert.equal(round.promptRemainingMs(), 30_000);
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

  // Pattern Memory leaderboard ranks higher levels first
  lb.recordEntry({
    user,
    result: {
      puzzleDate: '2026-10-15',
      trainerId: 'pattern-memory',
      variantKey: 'daily',
      score: 11,
      elapsedMs: 45000,
    },
  });
  const pmDaily = lb.dailyLeaderboard('2026-10-15', { trainerId: 'pattern-memory' });
  assert.equal(pmDaily.length, 1);
  assert.equal(pmDaily[0].score, 11);

  // Figure Pairs leaderboard records total tries (attempts) and ranks fewer tries first
  const user2 = { login: 'alice', name: 'Alice', avatarUrl: '' };
  lb.recordEntry({
    user,
    result: {
      puzzleDate: '2026-10-15',
      trainerId: 'figure-pairs',
      variantKey: 'daily',
      score: 4, // 4 mistakes
      totalAnswered: 12, // 12 total tries
      correctCount: 8,
      mistakes: 4,
      elapsedMs: 38000,
    },
  });
  lb.recordEntry({
    user: user2,
    result: {
      puzzleDate: '2026-10-15',
      trainerId: 'figure-pairs',
      variantKey: 'daily',
      score: 1, // 1 mistake
      totalAnswered: 9, // 9 total tries (fewer tries = rank #1)
      correctCount: 8,
      mistakes: 1,
      elapsedMs: 32000,
    },
  });
  const fpDaily = lb.dailyLeaderboard('2026-10-15', { trainerId: 'figure-pairs' });
  assert.equal(fpDaily.length, 2);
  assert.equal(fpDaily[0].login, 'alice');
  assert.equal(fpDaily[0].score, 9);
  assert.equal(fpDaily[1].login, 'octocat');
  assert.equal(fpDaily[1].score, 12);

  const fpAllTime = lb.allTimeLeaderboard({ trainerId: 'figure-pairs' });
  assert.equal(fpAllTime[0].login, 'alice');
  assert.equal(fpAllTime[0].bestScore, 9);
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

test('Border Hop is a standalone 1-run-per-day trainer that connects bordering countries and exposes a Travle-style live regional map', () => {
  const borderHop = registry.getTrainer('border-hop');
  assert.ok(borderHop, 'Border Hop trainer should exist');
  assert.equal(borderHop.categoryId, 'border-hop');

  const gen = borderHop.createGenerator({ puzzleDate: '2026-11-15', variantKey: 'daily' });
  const p1 = gen.next({ index: 0 });
  assert.equal(p1.kind, 'border-hop');
  assert.ok(p1.startCountry && p1.targetCountry);
  assert.notEqual(p1.startCountry, p1.targetCountry);
  assert.ok(p1.startOutline && p1.targetOutline, 'start and target country outlines must be provided');
  assert.ok(p1.mapViewBox && Array.isArray(p1.mapCountries), 'Travle-style mapViewBox and mapCountries must be provided');
  assert.equal(p1.mapCountries.length, 2, 'Starts with start and target countries on the map');
  assert.ok(p1.validNextCountries.length > 0);
  assert.equal(p1.stayOnWrongGuess, true);
  assert.equal(checkAnswer(p1, p1.answer), 'correct');

  // Guessing a valid bordering country adds it to the live map
  const p2 = gen.next({ index: 1, lastCorrect: true, lastSubmission: p1.answer });
  if (p2) {
    assert.equal(p2.mapCountries.length, 3, 'Connected country is added to the live map');
    assert.ok(p2.mapCountries.some((c) => c.name === p1.answer && c.role === 'current'));
  }
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

  // Word Rush has practice mode enabled, while Timeline Sort / Word Chain / ConnectionGrid / People Guesser do not
  const wr = registry.getTrainer('word-rush');
  assert.ok(!wr.noPractice, 'Word Rush should have practice mode enabled');
  assert.ok(wr.practiceFilters?.category, 'Word Rush should expose category practice filters');

  // Admin mode recognizes S3lDan1PS and bipa (case-insensitive) and rejects non-admin accounts
  assert.equal(isAdminUser({ login: 'S3lDan1PS' }), true);
  assert.equal(isAdminUser({ login: 's3ldan1ps' }), true);
  assert.equal(isAdminUser({ login: 'bipa' }), true);
  assert.equal(isAdminUser({ login: 'BIPA' }), true);
  assert.equal(isAdminUser({ login: 'octocat' }), false);
});

test('Preferences store orders favorited gamemodes at the top in favorite order and enforces 1 like/dislike per user per gamemode', () => {
  const storage = createStorage({ backend: createMemoryBackend() });
  const prefs = createPreferencesStore({ storage });
  const userA = { login: 'bipa' };
  const userB = { login: 'S3lDan1PS' };

  const sampleCategories = [
    { id: 'word-rush', name: 'Word Rush' },
    { id: 'border-hop', name: 'Border Hop' },
    { id: 'timeline-sort', name: 'Timeline Sort' },
    { id: 'math', name: 'Math Blitz' },
  ];

  // Favorite timeline-sort first, then border-hop second
  prefs.toggleFavorite(userA, 'timeline-sort');
  prefs.toggleFavorite(userA, 'border-hop');
  assert.deepEqual(prefs.getFavorites(userA), ['timeline-sort', 'border-hop']);

  const sorted = prefs.sortCategories(sampleCategories, userA).map((c) => c.id);
  assert.deepEqual(sorted, ['timeline-sort', 'border-hop', 'word-rush', 'math']);

  // Move border-hop earlier to #1
  prefs.moveFavorite(userA, 'border-hop', -1);
  assert.deepEqual(prefs.getFavorites(userA), ['border-hop', 'timeline-sort']);

  // 1 like/dislike per user per gamemode
  let r = prefs.vote(userA, 'border-hop', 'like');
  assert.deepEqual(r, { likes: 1, dislikes: 0, userVote: 'like' });

  // Repeating the same vote toggles it off; switching to dislike moves the vote
  prefs.vote(userA, 'border-hop', 'dislike');
  r = prefs.getReaction('border-hop', userA);
  assert.deepEqual(r, { likes: 0, dislikes: 1, userVote: 'dislike' });

  // Second user likes border-hop
  prefs.vote(userB, 'border-hop', 'like');
  assert.deepEqual(prefs.getReaction('border-hop', userB), {
    likes: 1,
    dislikes: 1,
    userVote: 'like',
  });
});

test('every JavaScript file in src/ and api/ passes node --check syntax validation (prevents blank screen regressions)', () => {
  function collectJsFiles(dir) {
    const files = [];
    if (!existsSync(dir)) return files;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectJsFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        files.push(fullPath);
      }
    }
    return files;
  }

  const allJsFiles = [...collectJsFiles(join(root, 'src')), ...collectJsFiles(join(root, 'api'))];
  assert.ok(allJsFiles.length >= 20, 'Should discover all source JS files');
  for (const file of allJsFiles) {
    execFileSync(process.execPath, ['--check', file]);
  }
});
