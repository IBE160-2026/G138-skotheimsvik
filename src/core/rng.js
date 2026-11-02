/**
 * Deterministic pseudo-random number generation.
 *
 * Resolves PRD §9 Q4: seeds are derived with FNV-1a and consumed by mulberry32.
 * Both are pure functions of their input — no Math.random, no wall-clock time —
 * which is what NFR-4 and NFR-5 require.
 */

/**
 * FNV-1a 32-bit string hash. Fast, well-distributed, and short enough to read.
 * @param {string} text
 * @returns {number} unsigned 32-bit integer
 */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    // 32-bit FNV prime multiply, written as shifts to stay inside int32.
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Build the seed for a trainer's puzzle on a given date.
 * @param {string} trainerId
 * @param {string} puzzleDate ISO date, e.g. "2026-10-12"
 * @returns {number}
 */
export function seedFor(trainerId, puzzleDate) {
  return hashString(`${trainerId}:${puzzleDate}`);
}

/**
 * Build the seed for a date's difficulty band.
 *
 * Deliberately excludes the trainer: FR-26 assigns a band to the *date*, so
 * every trainer shares the same band on a given day.
 * @param {string} puzzleDate
 * @returns {number}
 */
export function difficultySeedFor(puzzleDate) {
  return hashString(`difficulty:${puzzleDate}`);
}

/**
 * mulberry32 — a small, fast, well-tested seeded PRNG.
 * @param {number} seed
 * @returns {() => number} generator returning floats in [0, 1)
 */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A seeded random source with the helpers the generators actually need.
 * @param {number} seed
 */
export function createRng(seed) {
  const next = mulberry32(seed);

  /** Float in [0, 1). */
  const float = () => next();

  /** Integer in [min, max] inclusive. */
  const int = (min, max) => min + Math.floor(next() * (max - min + 1));

  /** Uniformly pick one element. */
  const pick = (items) => items[Math.floor(next() * items.length)];

  /** Fisher-Yates, returning a new array and leaving the input untouched. */
  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  /** Pick `count` distinct elements. */
  const sample = (items, count) => shuffle(items).slice(0, count);

  /**
   * Pick from weighted entries of shape [value, weight].
   * @param {Array<[any, number]>} entries
   */
  const weighted = (entries) => {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = next() * total;
    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll < 0) return value;
    }
    return entries[entries.length - 1][0];
  };

  return { float, int, pick, shuffle, sample, weighted };
}
