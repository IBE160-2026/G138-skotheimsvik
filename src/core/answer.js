/**
 * Answer normalisation and checking.
 *
 * Pure functions only — no DOM, no state (NFR-14). Covers FR-45..FR-53, plus the
 * set-equality rule Memory needs (FR-98, FR-99).
 */

/** @typedef {'correct'|'incorrect'|'ignored'} AnswerStatus */

/** Collapse whitespace and case so comparison is forgiving (FR-49, FR-50). */
export function normaliseText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

/**
 * Is this submission empty, and therefore to be ignored entirely (FR-52)?
 * @param {unknown} value
 */
export function isEmptySubmission(value) {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return String(value).trim() === '';
}

/**
 * Parse a numeric answer, accepting plain numbers, fractions ("3/4"), decimals
 * with either separator ("0,75"), and percent signs (FR-93).
 * @param {unknown} value
 * @returns {number|null} null when it is not a number at all
 */
export function parseNumeric(value) {
  const raw = String(value ?? '').trim().replace(/\s+/g, '').replace(/%$/, '');
  if (raw === '') return null;

  const fraction = raw.match(/^(-?\d+)\/(\d+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (denominator === 0) return null;
    return Number(fraction[1]) / denominator;
  }

  const normalised = raw.replace(',', '.');
  if (!/^-?\d*\.?\d+$/.test(normalised)) return null;

  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Numeric comparison with a tolerance, so 0.75 and 3/4 agree. */
export function numericEquals(submitted, expected, tolerance = 1e-9) {
  if (submitted === null) return false;
  return Math.abs(submitted - expected) <= tolerance;
}

/** Set equality, ignoring order and duplicates (FR-98, FR-99). */
export function setEquals(submitted, expected) {
  const left = new Set(submitted ?? []);
  const right = new Set(expected ?? []);
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
}

/**
 * Check a submission against a prompt.
 *
 * @param {object} prompt the prompt being answered
 * @param {unknown} submitted what the user entered
 * @returns {AnswerStatus}
 */
export function checkAnswer(prompt, submitted) {
  if (isEmptySubmission(submitted)) return 'ignored';

  switch (prompt.kind) {
    case 'numeric': {
      const value = parseNumeric(submitted);
      if (value === null) return 'incorrect';
      return numericEquals(value, prompt.answer, prompt.tolerance ?? 1e-9)
        ? 'correct'
        : 'incorrect';
    }

    case 'grid': {
      return setEquals(submitted, prompt.answer) ? 'correct' : 'incorrect';
    }

    case 'pairs': {
      // Any two cells showing the same figure match, so there is no single
      // correct answer to compare against (FR-127).
      const picks = Array.isArray(submitted) ? submitted : [];
      if (picks.length !== 2) return 'ignored';
      const [first, second] = picks;
      if (first === second) return 'ignored';
      const faces = prompt.faces ?? [];
      return faces[first] !== undefined && faces[first] === faces[second] ? 'correct' : 'incorrect';
    }

    case 'choice':
    case 'text':
    default: {
      const value = normaliseText(submitted);
      const accepted = [prompt.answer, ...(prompt.alternatives ?? [])].map(normaliseText);
      return accepted.includes(value) ? 'correct' : 'incorrect';
    }
  }
}

/**
 * How the correct answer should read back to the user in feedback (FR-20).
 * @param {object} prompt
 * @returns {string}
 */
export function formatExpected(prompt) {
  if (prompt.kind === 'grid') {
    return `${(prompt.answer ?? []).length} tiles`;
  }
  return String(prompt.displayAnswer ?? prompt.answer);
}
