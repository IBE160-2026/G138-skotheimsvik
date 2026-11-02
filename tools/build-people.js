/**
 * Authoring tool — builds the Famous People roster.
 *
 * Run with: node tools/build-people.js
 *
 * Hand-writing a thousand clues is not realistic, so the bulk of the roster is
 * generated: Wikidata ranks people by how many Wikipedias have an article
 * about them, which is a decent proxy for how famous someone actually is and
 * is not biased towards any single country's press. Wikipedia then supplies a
 * two-sentence summary, which becomes the clue once every form of the person's
 * name is redacted from it.
 *
 * The hand-written entries in people.curated.json always win: they are better
 * clues than anything generated, and they guarantee the obvious names are in.
 *
 * This file is NOT shipped to the browser. It runs by hand and its output is
 * committed.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const CURATED_PATH = join(root, 'src', 'trainers', 'people', 'people.curated.json');
const OUT_PATH = join(root, 'src', 'trainers', 'people', 'people.json');

/**
 * SPARQL answers are cached because each one costs the query service half a
 * minute of work. Delete this file to pull a fresh ranking.
 */
const CACHE_PATH = join(here, 'data', 'people-candidates.json');

const USER_AGENT =
  'LearningHub-coursework/1.0 (student project; contact daniel.skotheimsvik@himolde.no)';

/** Roughly how many people to aim for in total. */
const TARGET_TOTAL = 1000;

/**
 * Wikidata occupations per category.
 *
 * Minimum sitelink counts differ by field on purpose: a footballer with 80
 * language versions is a household name, whereas 80 for a mathematician already
 * puts you among the most famous in the discipline.
 */
const CATEGORY_QUERIES = {
  music: {
    occupations: ['Q177220', 'Q36834', 'Q639669', 'Q2252262', 'Q486748'],
    minSitelinks: 55,
    share: 0.2,
  },
  film: {
    occupations: ['Q33999', 'Q10800557', 'Q2526255', 'Q3282637'],
    minSitelinks: 55,
    share: 0.2,
  },
  sport: {
    occupations: ['Q937857', 'Q3665646', 'Q10833314', 'Q11513337', 'Q11338576', 'Q378622', 'Q10843402', 'Q12299841'],
    minSitelinks: 45,
    share: 0.2,
  },
  science: {
    occupations: ['Q169470', 'Q593644', 'Q170790', 'Q864503', 'Q205375', 'Q11063', 'Q82594', 'Q39631'],
    minSitelinks: 35,
    share: 0.2,
  },
  history: {
    occupations: ['Q82955', 'Q116', 'Q4964182', 'Q189290', 'Q36180', 'Q1234713'],
    minSitelinks: 60,
    share: 0.2,
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf8')) : {};

/** 504 means "too heavy", not "busy", so retrying it unchanged is pointless. */
async function politeFetch(url, attempt = 0) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if ((response.status === 429 || (response.status >= 500 && response.status !== 504)) && attempt < 5) {
    const wait = 2000 * 2 ** attempt;
    console.log(`      waiting ${wait / 1000}s (${response.status})`);
    await sleep(wait);
    return politeFetch(url, attempt + 1);
  }
  return response;
}

async function getJson(url) {
  const response = await politeFetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url.slice(0, 90)}`);
  const body = await response.text();
  try {
    return JSON.parse(body);
  } catch {
    // A truncated body is worth one more try before giving up on the batch.
    await sleep(2000);
    const retry = await politeFetch(url);
    return JSON.parse(await retry.text());
  }
}

/** Top people for one category, ranked by how many Wikipedias cover them. */
async function queryCategory(name, { occupations, minSitelinks }, limit) {
  // Generously more candidates than places: a good half of them lose their
  // clue to redaction, and the surplus is what keeps the roster full.
  const perOccupation = 250;
  const merged = new Map();

  for (const occupation of occupations) {
    const rows = await queryOccupation(occupation, minSitelinks, perOccupation);
    for (const row of rows) {
      // The label service sometimes answers with the item id itself, and
      // "Q22686" is not a name anyone is going to type.
      const label = /^Q\d+$/.test(row.name) ? row.title : row.name;
      if (!merged.has(label)) merged.set(label, { ...row, name: label, category: name });
    }
  }

  return [...merged.values()].sort((a, b) => b.sitelinks - a.sitelinks).slice(0, limit);
}

/**
 * One occupation at a time.
 *
 * Asking for several occupations at once makes the query service sort a far
 * larger intermediate result and it answers 504 instead. Splitting the work
 * keeps each query inside the one-minute budget; the floor is raised on
 * timeout, because a higher floor is exactly what makes the sort cheaper.
 */
async function queryOccupation(occupation, minSitelinks, limit) {
  const cached = cache[`${occupation}:${minSitelinks}:${limit}`];
  if (cached) {
    console.log(`  ${occupation}: ${cached.length} fra hurtiglager`);
    return cached;
  }

  for (let floor = minSitelinks; floor <= minSitelinks * 4; floor = Math.round(floor * 1.5)) {
    const query = `
      SELECT ?itemLabel ?article ?sitelinks WHERE {
        ?item wdt:P31 wd:Q5 ;
              wdt:P106 wd:${occupation} ;
              wikibase:sitelinks ?sitelinks .
        FILTER(?sitelinks > ${floor})
        ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      ORDER BY DESC(?sitelinks)
      LIMIT ${limit}`;

    const response = await politeFetch(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`,
    );

    if (response.status === 504) {
      console.log(`  ${occupation}: tidsavbrudd ved ${floor}, prøver høyere terskel`);
      continue;
    }
    if (!response.ok) throw new Error(`${response.status} for ${occupation}`);

    // A query that runs out of time mid-answer still comes back as 200: the
    // body is cut off and a Java stack trace is appended to it.
    let data;
    try {
      data = JSON.parse(await response.text());
    } catch {
      console.log(`  ${occupation}: avkortet svar ved ${floor}, prøver høyere terskel`);
      continue;
    }

    const rows = data.results.bindings.map((row) => ({
      name: row.itemLabel.value,
      title: decodeURIComponent(row.article.value.split('/').pop()).replace(/_/g, ' '),
      sitelinks: Number(row.sitelinks.value),
    }));
    console.log(`  ${occupation}: ${rows.length} treff (terskel ${floor})`);

    cache[`${occupation}:${minSitelinks}:${limit}`] = rows;
    writeFileSync(CACHE_PATH, `${JSON.stringify(cache)}\n`, 'utf8');
    return rows;
  }

  console.log(`  ${occupation}: gir opp, for tungt for spørretjenesten`);
  return [];
}

/**
 * Batched intro extracts and lead-image names.
 *
 * The whole intro is requested rather than a fixed two sentences: "X is an
 * American actor." leaves nothing once the name is redacted, and capping the
 * extract server-side threw away the sentence that would have made it a clue.
 *
 * Twenty titles per request, because `exlimit` tops out at 20 — ask for fifty
 * and the API answers with a truncated body that is not even valid JSON.
 */
async function fetchPageData(titles) {
  const out = new Map();
  const size = 20;
  for (let i = 0; i < titles.length; i += size) {
    const chunk = titles.slice(i, i + size);
    const data = await getJson(
      `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&exintro=1&explaintext=1&exlimit=${size}&piprop=name&pilimit=${size}&format=json&redirects=1&titles=${encodeURIComponent(chunk.join('|'))}`,
    );

    // Redirects mean the returned title may differ from the one asked for.
    const normalised = new Map();
    for (const entry of data.query?.normalized ?? []) normalised.set(entry.to, entry.from);
    for (const entry of data.query?.redirects ?? []) normalised.set(entry.to, entry.from);

    for (const page of Object.values(data.query?.pages ?? {})) {
      if (page.missing !== undefined) continue;
      const asked = normalised.get(page.title) ?? page.title;
      out.set(asked, { extract: page.extract ?? '', pageimage: page.pageimage ?? null });
    }
    process.stdout.write(`\r  utdrag ${Math.min(i + size, titles.length)}/${titles.length}`);
    await sleep(200);
  }
  console.log('');
  return out;
}

/**
 * Turn an encyclopedia intro into a clue.
 *
 * Everything that could name the person is removed: the article title, each
 * part of it, and any parenthetical. Sentences are then taken until there is
 * enough substance to guess from. If the result is still too thin or gives the
 * game away, the person is dropped rather than shipped as a broken prompt.
 */
export function clueFrom(extract, name, title) {
  if (!extract) return null;

  let text = extract;
  // Nested parentheses need more than one pass, and the pronunciation guides
  // Wikipedia opens with are full of them.
  for (let pass = 0; pass < 4; pass += 1) text = text.replace(/\([^()]*\)/g, ' ');
  text = text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const forms = new Set([name, title]);
  for (const part of `${name} ${title}`.split(/[\s'’-]+/)) {
    if (part.length >= 4) forms.add(part);
  }

  for (const form of [...forms].sort((a, b) => b.length - a.length)) {
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '—');
  }

  text = text
    .replace(/(^|\s)[—\s]+/g, '$1— ')
    .replace(/—(\s*[—–])+/g, '—')
    .replace(/^—\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();

  text = trimNameResidue(text);
  text = takeSentences(text);
  if (!text) return null;

  if (text.length < 60 || text.length > 320) return null;
  if (text.split(' ').length < 10) return null;
  // A clue that opens mid-word or carries a stray bracket is a sign the
  // cleanup did not understand the sentence, so it is not worth shipping.
  if (/^[^A-Z"“]/.test(text) || /[()[\]]/.test(text)) return null;

  const lower = text.toLocaleLowerCase();
  for (const form of forms) {
    if (form.length >= 4 && lower.includes(form.toLocaleLowerCase())) return null;
  }
  return text;
}

/**
 * Drop whatever is left of the name before the sentence proper starts.
 *
 * Redaction only knows the forms it was given, so epithets, middle names and
 * titles survive: "of Syracuse was an Ancient Greek mathematician", ", 1st
 * Viscount St Alban was an English philosopher", "Wilhelm — was a German
 * philosopher". Cutting to the verb is only safe when the leftover looks like
 * debris rather than the start of a sentence.
 */
function trimNameResidue(text) {
  // Wide enough for the long form of a stage name: "Aliaune Damala Bouga Time
  // Puru Nacka Lu Lu Lu Badara — Thiam, known professionally as —, is a ..."
  const match = /\b(was|is|were|are)\b/i.exec(text.slice(0, 180));
  if (!match || match.index === 0) return capitaliseVerb(text);

  const before = text.slice(0, match.index);
  const debris = before.includes('—') || /[,;)]\s*$/.test(before) || /^[^A-Z"“]/.test(before);
  if (!debris) return text;

  return capitaliseVerb(text.slice(match.index));
}

function capitaliseVerb(text) {
  return /^(was|is|were|are)\b/i.test(text) ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** As many whole sentences as it takes to say something, without rambling. */
function takeSentences(text) {
  const sentences = text.split(/(?<=[.!?])\s+(?=["“'A-Z—])/);
  let clue = '';
  for (const sentence of sentences) {
    const next = clue ? `${clue} ${sentence}` : sentence;
    if (next.length > 320) break;
    clue = next;
    if (clue.length >= 130) break;
  }
  return clue.trim();
}

/** Short forms a player might reasonably type. */
function shortForms(name) {
  const tokens = name.split(' ').filter(Boolean);
  if (tokens.length < 2) return [];
  const hasParticle = tokens.some(
    (token, index) => index > 0 && token.length > 1 && token[0] === token[0].toLocaleLowerCase(),
  );
  if (hasParticle) return [];
  const trimmed = tokens.filter((token) => !/^(jr\.?|sr\.?|i{1,3}|iv|v)$/i.test(token));
  const surname = trimmed[trimmed.length - 1];
  return surname && surname.length >= 3 ? [surname] : [];
}

/**
 * Words that place a person in a category, taken from how the encyclopedia
 * describes them rather than from the occupation that found them.
 */
const CATEGORY_WORDS = {
  music: ['singer', 'songwriter', 'musician', 'composer', 'rapper', 'pianist', 'guitarist', 'violinist', 'conductor', 'band', 'album', 'orchestra', 'opera', 'record producer', 'vocalist', 'drummer'],
  film: ['actor', 'actress', 'film', 'director', 'screenwriter', 'filmmaker', 'cinema', 'television', 'movie', 'comedian'],
  sport: ['footballer', 'football', 'tennis', 'basketball', 'boxer', 'boxing', 'athlete', 'olympic', 'cricket', 'swimmer', 'racing driver', 'formula one', 'world cup', 'golfer', 'wrestler', 'cyclist', 'sprinter'],
  science: ['physicist', 'chemist', 'mathematician', 'biologist', 'astronomer', 'scientist', 'inventor', 'physician', 'engineer', 'naturalist', 'psychologist', 'botanist', 'geologist', 'surgeon'],
  history: ['politician', 'president', 'king', 'queen', 'emperor', 'empress', 'general', 'philosopher', 'writer', 'poet', 'novelist', 'playwright', 'theologian', 'revolutionary', 'monarch', 'statesman', 'military', 'dictator', 'prime minister', 'pope', 'explorer', 'activist'],
};

/**
 * Where a person really belongs.
 *
 * Wikidata is accurate but not helpful here: Shakespeare is an actor,
 * Nietzsche composed music, and Trump has film credits, so the occupation that
 * found someone is a poor guide to the category a player would expect them in.
 * The article's own description is a better one, and the query category only
 * stands when the text does not clearly point somewhere else.
 */
function categoriseFromClue(clue, fallback) {
  const text = clue.toLocaleLowerCase();
  let best = fallback;
  let bestScore = 0;

  for (const [category, words] of Object.entries(CATEGORY_WORDS)) {
    const score = words.reduce((total, word) => (text.includes(word) ? total + 1 : total), 0);
    if (score > bestScore || (score === bestScore && category === fallback)) {
      best = category;
      bestScore = score;
    }
  }
  return bestScore === 0 ? fallback : best;
}

// --- main -------------------------------------------------------------------

const curated = JSON.parse(readFileSync(CURATED_PATH, 'utf8'));
const seen = new Set(curated.people.map((person) => person.name.toLocaleLowerCase()));
const generated = [];

// One pool for everybody. The category a person ends up in is decided by their
// article, not by the query that found them, so the candidates have to be
// gathered before any of them can be placed.
const pool = new Map();
const quota = {};

for (const [category, config] of Object.entries(CATEGORY_QUERIES)) {
  const want = Math.round(TARGET_TOTAL * config.share);
  quota[category] = want;
  const askFor = want * 5;
  console.log(`\n${category}: spør Wikidata om ${askFor} kandidater`);

  for (const person of await queryCategory(category, config, askFor)) {
    if (seen.has(person.name.toLocaleLowerCase())) continue;
    if (!pool.has(person.name)) pool.set(person.name, person);
  }
}

const candidates = [...pool.values()].sort((a, b) => b.sitelinks - a.sitelinks);
console.log(`\n${candidates.length} kandidater totalt, henter utdrag`);

const filled = Object.fromEntries(Object.keys(quota).map((key) => [key, 0]));
const remaining = () => Object.keys(quota).filter((key) => filled[key] < quota[key]);

// Extracts are fetched in fame order and in batches, so the roster fills with
// the best-known people first and the run stops as soon as every quota is met.
for (let i = 0; i < candidates.length && remaining().length > 0; i += 200) {
  const slice = candidates.slice(i, i + 200);
  const pages = await fetchPageData(slice.map((person) => person.title));

  for (const person of slice) {
    const page = pages.get(person.title);
    if (!page) continue;

    const clue = clueFrom(page.extract, person.name, person.title);
    if (!clue) continue;

    const category = categoriseFromClue(clue, person.category);
    if (filled[category] >= quota[category]) continue;

    seen.add(person.name.toLocaleLowerCase());
    filled[category] += 1;
    generated.push({
      name: person.name,
      lookup: person.title !== person.name ? person.title : undefined,
      category,
      clue,
      accept: shortForms(person.name),
      pageimage: page.pageimage ?? undefined,
    });
  }
  console.log(`  ${generated.length} beholdt — ${JSON.stringify(filled)}`);
}

const people = [
  ...curated.people,
  ...generated.map((person) => {
    const entry = { name: person.name, category: person.category, clue: person.clue };
    if (person.lookup) entry.lookup = person.lookup;
    if (person.accept?.length) entry.accept = person.accept;
    if (person.pageimage) entry.pageimage = person.pageimage;
    return entry;
  }),
];

writeFileSync(
  OUT_PATH,
  `${JSON.stringify(
    {
      schemaVersion: 2,
      note: curated.note,
      generated: `${generated.length} entries generated by tools/build-people.js from Wikidata and Wikipedia; the rest are hand-written in people.curated.json. Clues have every form of the person's name redacted and are dropped if any trace survives.`,
      categories: curated.categories,
      people,
    },
    null,
    1,
  )}\n`,
  'utf8',
);

const totals = {};
for (const person of people) totals[person.category] = (totals[person.category] ?? 0) + 1;
console.log(`\nSkrev ${people.length} personer (${curated.people.length} håndskrevne, ${generated.length} genererte)`);
console.log(JSON.stringify(totals));
