/**
 * Variants — the axis along which a trainer splits its daily puzzles.
 *
 * Most trainers split by difficulty band. Memory splits by board size, because
 * a random pattern cannot meaningfully be authored as "intermediate" (brief
 * §5.5). Both are the same thing to the engine: a list of keys, one scored
 * attempt per key per day, one personal best per key.
 *
 * Covers FR-26 to FR-29.
 */

/** @typedef {'beginner'|'intermediate'|'advanced'|'expert'} Band */

/** Ordered easiest to hardest; the index doubles as a rank. */
export const BANDS = Object.freeze(['beginner', 'intermediate', 'advanced', 'expert']);

export const BAND_LABELS = Object.freeze({
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  expert: 'Expert',
});

/** Round length for the timed trainers, per band (PRD §3.2). */
export const BAND_DURATION_SECONDS = Object.freeze({
  beginner: 45,
  intermediate: 60,
  advanced: 75,
  expert: 90,
});

export function isBand(value) {
  return BANDS.includes(value);
}

export function bandRank(band) {
  return BANDS.indexOf(band);
}

/** Parse "5x5" into usable dimensions. */
export function parseBoardSize(key) {
  const match = /^(\d+)x(\d+)$/.exec(String(key));
  if (!match) return null;
  const columns = Number(match[1]);
  const rows = Number(match[2]);
  if (columns < 2 || rows < 2) return null;
  return { columns, rows, cells: columns * rows };
}

export function boardSizeLabel(key) {
  const size = parseBoardSize(key);
  return size ? `${size.columns}×${size.rows}` : String(key);
}

/**
 * Human-readable name for any variant key.
 * @param {'band'|'boardSize'} kind
 * @param {string} key
 */
export function variantLabel(kind, key) {
  return kind === 'band' ? (BAND_LABELS[key] ?? key) : boardSizeLabel(key);
}

/**
 * The variant keys a trainer offers.
 *
 * Band trainers always offer all four and never fewer — FR-26 — so the list is
 * derived rather than declared, which removes a way for a trainer to get it
 * wrong.
 */
export function variantsFor(trainer) {
  return trainer.variantKind === 'band' ? [...BANDS] : [...trainer.variants];
}

export function isValidVariant(trainer, key) {
  return variantsFor(trainer).includes(key);
}

/**
 * Mode parameter for a trainer and variant: seconds for timed rounds, lives for
 * lives rounds, pairs for completion rounds.
 *
 * A trainer may override with modeParamFor; otherwise a timed band trainer
 * scales with the band (FR-29) and everything else uses its fixed value.
 */
export function modeParamFor(trainer, variantKey) {
  if (typeof trainer.modeParamFor === 'function') {
    return trainer.modeParamFor(variantKey);
  }
  if (trainer.roundMode === 'timed' && trainer.variantKind === 'band') {
    return BAND_DURATION_SECONDS[variantKey];
  }
  return trainer.modeParam;
}

/** Plain-language description of what the player is about to face (FR-4). */
export function describeRound(trainer, variantKey) {
  const param = modeParamFor(trainer, variantKey);
  if (trainer.roundMode === 'timed') return `${param} seconds`;
  if (trainer.roundMode === 'lives') {
    return param === 1 ? 'One life — the first mistake ends it' : `${param} lives`;
  }
  return `${param} pairs to match`;
}
