/**
 * Authoring tool — fetches portrait images for the Famous People trainer.
 *
 * Run with: node tools/build-people-images.js
 *
 * This file is NOT shipped to the browser. It runs by hand, and its output is
 * committed. The application loads images from its own origin and never calls
 * Wikipedia (NFR-9).
 *
 * Only images whose licence is machine-verifiable as public domain or a
 * Creative Commons licence that permits reuse are downloaded. Anything else is
 * skipped and the person stays clue-only, which is the safe default for a
 * public repository.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const PEOPLE_PATH = join(root, 'src', 'trainers', 'people', 'people.json');
const IMAGE_DIR = join(root, 'src', 'trainers', 'people', 'portraits');
const CREDITS_PATH = join(root, 'src', 'trainers', 'people', 'portraits.json');

/** Licences we may bundle and redistribute, given attribution. */
const ALLOWED = [
  /^public domain/i,
  /^pd[- ]?/i,
  /^cc0/i,
  /^cc[- ]by(?!.*(nc|nd))/i,
  /^no restrictions$/i,
  /^attribution$/i,
  /^ogl/i,
];

const USER_AGENT = 'LearningHub-coursework/1.0 (student project; contact daniel.skotheimsvik@himolde.no)';

/**
 * Thumbnail width to request.
 *
 * Wikimedia only serves a fixed set of widths and rejects anything else with a
 * 400, so this cannot be an arbitrary number. 250 is the smallest allowed size
 * that still looks right at the ~160px the portrait is displayed at, and keeps
 * the whole set near 3 MB rather than 5.
 */
const THUMB_WIDTH = 250;

/**
 * Upper bound on the bundled set.
 *
 * The roster is around a thousand people and a portrait averages 29 kB, so
 * fetching every one would put roughly 25 MB of images in the repository for
 * a game that shows fifteen a day. people.json is ordered most-famous-first,
 * so taking the first few hundred gives pictures to the people a player is
 * most likely to meet; everyone else stays clue-only, which the trainer
 * supports by design (FR-167).
 */
const MAX_PORTRAITS = 400;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetch with backoff.
 *
 * Wikimedia rate-limits anonymous callers hard, and a run over 130 people will
 * hit it. Retrying beats failing, and makes the tool safe to re-run.
 */
async function politeFetch(url, attempt = 0) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (response.status === 429 && attempt < 5) {
    const wait = 2000 * 2 ** attempt;
    console.log(`      rate-limited, waiting ${wait / 1000}s`);
    await sleep(wait);
    return politeFetch(url, attempt + 1);
  }
  return response;
}

function licenceAllowed(name) {
  return Boolean(name) && ALLOWED.some((pattern) => pattern.test(name.trim()));
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function getJson(url) {
  const response = await politeFetch(url);
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  return response.json();
}

/**
 * The canonical file name for an article's lead image.
 *
 * For large originals the summary's "originalimage" is itself a thumbnail URL,
 * so the last path segment is something like 3840px-Foo.jpg rather than the
 * file name. In a /thumb/ URL the real name is the segment before it.
 */
async function findFile(name) {
  const summary = await getJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}`,
  );
  const source = summary?.originalimage?.source;
  if (!source) return null;

  const parts = source.split('?')[0].split('/');
  const index = parts.indexOf('thumb');
  const raw = index === -1 ? parts[parts.length - 1] : parts[parts.length - 2];
  return decodeURIComponent(raw);
}

/**
 * Licence metadata and a ready-made thumbnail URL for a file.
 *
 * Asking the API for the thumbnail beats building the URL by hand: it knows
 * which widths are allowed and converts formats such as TIFF to JPEG for us.
 * Most images live on Commons, but some are uploaded locally to the English
 * Wikipedia, so both have to be asked.
 */
async function getFileInfo(file) {
  for (const host of ['commons.wikimedia.org', 'en.wikipedia.org']) {
    const data = await getJson(
      `https://${host}/w/api.php?action=query&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${THUMB_WIDTH}&format=json&titles=${encodeURIComponent(`File:${file}`)}`,
    );
    const page = Object.values(data?.query?.pages ?? {})[0];
    const info = page?.imageinfo?.[0];
    if (info?.extmetadata) {
      const meta = info.extmetadata;
      return {
        licence:
          stripHtml(meta.LicenseShortName?.value) ||
          stripHtml(meta.UsageTerms?.value) ||
          stripHtml(meta.License?.value),
        artist: stripHtml(meta.Artist?.value),
        thumb: info.thumburl ?? info.url,
        host,
      };
    }
    await sleep(150);
  }
  return null;
}

async function download(url, destination) {
  const response = await politeFetch(url);
  if (!response.ok) throw new Error(`${response.status} downloading ${url}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(destination, buffer);
  return buffer.length;
}

const { people } = JSON.parse(readFileSync(PEOPLE_PATH, 'utf8'));
if (!existsSync(IMAGE_DIR)) mkdirSync(IMAGE_DIR, { recursive: true });

// Resume: a previous run may have been cut short by rate limiting.
const credits = existsSync(CREDITS_PATH)
  ? (JSON.parse(readFileSync(CREDITS_PATH, 'utf8')).portraits ?? {})
  : {};
const skipped = [];
let bytes = 0;

for (const person of people) {
  if (Object.keys(credits).length >= MAX_PORTRAITS) {
    console.log(`\nTak p\u00e5 ${MAX_PORTRAITS} portretter n\u00e5dd; resten blir hintebaserte.`);
    break;
  }
  if (credits[person.name] && existsSync(join(IMAGE_DIR, credits[person.name].file))) continue;
  const slug = person.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  try {
    // Generated entries already carry the lead image's file name from the
    // roster build, which saves a request and the thumbnail-URL guesswork.
    const file = person.pageimage ?? (await findFile(person.lookup ?? person.name));
    if (!file) {
      skipped.push(`${person.name}: no lead image`);
      continue;
    }

    const info = await getFileInfo(file);
    if (!info || !licenceAllowed(info.licence)) {
      skipped.push(`${person.name}: licence "${info?.licence || 'unknown'}"`);
      continue;
    }

    const extension = (info.thumb.split('?')[0].split('.').pop() ?? 'jpg')
      .toLowerCase()
      .replace('jpeg', 'jpg');
    if (!['jpg', 'png'].includes(extension)) {
      skipped.push(`${person.name}: unsupported format .${extension}`);
      continue;
    }
    const filename = `${slug}.${extension}`;
    bytes += await download(info.thumb, join(IMAGE_DIR, filename));
    credits[person.name] = {
      file: filename,
      licence: info.licence,
      artist: info.artist || 'Unknown',
      source: `https://${info.host}/wiki/File:${encodeURIComponent(file)}`,
    };
    console.log(`ok    ${person.name} — ${info.licence}`);
  } catch (error) {
    skipped.push(`${person.name}: ${error.message}`);
  }

  // Wikimedia rate-limits anonymous callers, so this is deliberately unhurried.
  await sleep(400);
}

writeFileSync(
  CREDITS_PATH,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      note: 'Generated by tools/build-people-images.js. Every portrait here is public domain or under a Creative Commons licence that permits reuse with attribution. Attribution is shown next to the picture in the app and listed in full on the credits screen.',
      portraits: credits,
    },
    null,
    1,
  )}\n`,
  'utf8',
);

console.log(`\n${Object.keys(credits).length} portretter av ${people.length}, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
if (skipped.length) {
  console.log(`\nUten bilde (${skipped.length}):`);
  for (const line of skipped) console.log(`  - ${line}`);
}
