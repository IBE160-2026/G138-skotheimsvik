/**
 * Answer normalisation and checking.
 *
 * Pure functions only — no DOM, no state (NFR-14). Covers FR-45..FR-53, plus the
 * set-equality rule Memory needs (FR-98, FR-99).
 */

/** @typedef {'correct'|'incorrect'|'ignored'} AnswerStatus */

/**
 * Collapse whitespace, case and diacritics so comparison is forgiving
 * (FR-63, FR-64).
 *
 * Stripping accents matters for content like Beyoncé and Pelé, where insisting
 * on the exact glyph would punish a correct answer typed on a plain keyboard.
 */
export function normaliseText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase();
}

/**
 * Compact alphanumeric key that strips spaces, hyphens, apostrophes and punctuation
 * so compound words like "hashbrown" == "Hash Browns" == "hash-brown" and "hotdog" == "Hot Dog".
 */
export function compactKey(value) {
  return normaliseText(value).replace(/[^a-z0-9]/g, '');
}

/**
 * Strip common English plural suffixes from a compact key so singular/plural
 * variations ("hashbrown" vs "hashbrowns", "taco" vs "tacos", "berry" vs "berries") match.
 */
export function singularKey(value) {
  const c = compactKey(value);
  if (c.length <= 3) return c;
  if (c.endsWith('ies') && c.length > 4) return `${c.slice(0, -3)}y`;
  if (
    c.endsWith('ches') ||
    c.endsWith('shes') ||
    c.endsWith('xes') ||
    c.endsWith('zes') ||
    c.endsWith('oes')
  ) {
    return c.slice(0, -2);
  }
  if (c.endsWith('s') && !c.endsWith('ss') && !c.endsWith('us') && !c.endsWith('is')) {
    return c.slice(0, -1);
  }
  return c;
}

/**
 * Match a submitted Word Rush guess against the valid pool using:
 *   1. Exact / space-insensitive / hyphen-insensitive match ("hashbrown" -> "Hash Browns")
 *   2. Singular/plural stem match ("hashbrown" -> "Hash Browns", "pancakes" -> "Pancake")
 *   3. Minor 1-character typo tolerance for words >= 6 chars starting with the required letter
 *      ("hotsog" -> "Hot Dog", "hamberger" -> "Hamburger")
 *
 * Returns `{ status: 'correct'|'duplicate'|'incorrect', matchedEntry: object|null }`.
 */
export function matchWordRushEntry(prompt, submitted) {
  const value = normaliseText(submitted);
  const valCompact = compactKey(submitted);
  const valSingular = singularKey(submitted);
  if (!valCompact) return { status: 'ignored', matchedEntry: null };

  const validPool = prompt?.validWords ?? [];
  const foundList = prompt?.foundWords ?? [];
  const foundCompactSet = new Set(foundList.map(compactKey));
  const foundSingularSet = new Set(foundList.map(singularKey));

  // Check if the user repeated a word already in foundWords (including previous Word Chain steps)
  if (foundCompactSet.has(valCompact) || (valSingular.length >= 3 && foundSingularSet.has(valSingular))) {
    const matchedExisting =
      foundList.find(
        (w) => compactKey(w) === valCompact || (valSingular.length >= 3 && singularKey(w) === valSingular),
      ) ?? String(submitted).trim();
    return { status: 'duplicate', matchedEntry: { label: matchedExisting } };
  }

  // Pass 1: Exact, compact (space/hyphen-insensitive), or singular/plural match
  for (const entry of validPool) {
    const label = typeof entry === 'string' ? entry : entry.label;
    const forms = [label, ...(entry.alternatives ?? [])];
    for (const form of forms) {
      const fNorm = normaliseText(form);
      const fCompact = compactKey(form);
      const fSingular = singularKey(form);
      if (
        fNorm === value ||
        fCompact === valCompact ||
        (fSingular.length >= 3 && fSingular === valSingular)
      ) {
        const labelCompact = compactKey(label);
        const labelSingular = singularKey(label);
        if (foundCompactSet.has(labelCompact) || foundSingularSet.has(labelSingular)) {
          return { status: 'duplicate', matchedEntry: typeof entry === 'string' ? { label } : entry };
        }
        return { status: 'correct', matchedEntry: typeof entry === 'string' ? { label } : entry };
      }
    }
  }

  // Pass 2: Forgiving 1-edit typo tolerance for words >= 6 chars (e.g. "hotsog" -> "hotdog")
  const requiredLetter = compactKey(prompt?.letter ?? '');
  if (valCompact.length >= 6 && (!requiredLetter || valCompact.startsWith(requiredLetter))) {
    let bestEntry = null;
    let bestDist = Infinity;
    for (const entry of validPool) {
      const label = typeof entry === 'string' ? entry : entry.label;
      const forms = [label, ...(entry.alternatives ?? [])];
      for (const form of forms) {
        const fCompact = compactKey(form);
        const fSingular = singularKey(form);
        if (Math.abs(fCompact.length - valCompact.length) <= 1) {
          const d = Math.min(
            editDistance(valCompact, fCompact),
            editDistance(valSingular, fSingular),
          );
          const maxDist = valCompact.length >= 9 ? 2 : 1;
          if (d <= maxDist && d < bestDist) {
            bestDist = d;
            bestEntry = typeof entry === 'string' ? { label } : entry;
          }
        }
      }
    }
    if (bestEntry) {
      const labelCompact = compactKey(bestEntry.label);
      const labelSingular = singularKey(bestEntry.label);
      if (foundCompactSet.has(labelCompact) || foundSingularSet.has(labelSingular)) {
        return { status: 'duplicate', matchedEntry: bestEntry };
      }
      return { status: 'correct', matchedEntry: bestEntry };
    }
  }

  return { status: 'incorrect', matchedEntry: null };
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

/** Exact ordered sequence equality for sequential Pattern Memory. */
export function sequenceEquals(submitted, expected) {
  if (!Array.isArray(submitted) || !Array.isArray(expected)) return false;
  if (submitted.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i += 1) {
    if (submitted[i] !== expected[i]) return false;
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
      if (Array.isArray(prompt.sequence)) {
        return sequenceEquals(submitted, prompt.sequence) ? 'correct' : 'incorrect';
      }
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

    case 'word-rush': {
      const res = matchWordRushEntry(prompt, submitted);
      return res.status;
    }

    case 'connection-grid': {
      const picks = Array.isArray(submitted) ? submitted : [];
      if (picks.length !== 4) return 'incorrect';
      const normPicks = picks.map((w) => normaliseText(w)).sort();
      // Any unsolved group of 4 words on the board is a valid match
      const unsolved = prompt.unsolvedGroups ?? prompt.groups ?? [];
      for (const group of unsolved) {
        const groupNorm = (group.words ?? []).map((w) => normaliseText(w)).sort();
        if (
          groupNorm.length === 4 &&
          groupNorm.every((val, idx) => val === normPicks[idx])
        ) {
          return 'correct';
        }
      }
      return 'incorrect';
    }

    case 'timeline-sort':
    case 'border-hop':
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
  // A pairs turn has no single right answer; the two cards simply did not match.
  if (prompt.kind === 'pairs') {
    return 'not a pair';
  }
  return String(prompt.displayAnswer ?? prompt.answer);
}

/**
 * Damerau-Levenshtein edit distance between two normalised strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i][0] = i;
  for (let j = 0; j <= n; j += 1) dp[0][j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[m][n];
}

/**
 * Rank and return matching suggestions from a vocabulary list for a typed query.
 *
 * Prioritises:
 * 1. Exact matches (canonical or alternative)
 * 2. Starts-with matches (e.g. "AL" -> "Albania", "Algeria")
 * 3. Word-boundary starts-with matches (e.g. "Mercury" -> "Freddie Mercury")
 * 4. Substring matches
 * 5. Closest edit-distance matches (fuzzy autocorrect)
 *
 * @param {string} query
 * @param {Array<string|{label: string, alternatives?: string[]}>} pool
 * @param {number} [limit]
 * @returns {Array<{label: string, score: number}>}
 */
export function matchSuggestions(query, pool, limit = 8) {
  const q = normaliseText(query);
  if (!q || !Array.isArray(pool) || pool.length === 0) return [];

  const scored = [];
  const seen = new Set();

  for (const item of pool) {
    const label = typeof item === 'string' ? item : item?.label;
    if (!label || seen.has(label)) continue;
    seen.add(label);

    const alts = typeof item === 'object' && Array.isArray(item.alternatives) ? item.alternatives : [];
    const forms = [label, ...alts].map(normaliseText).filter(Boolean);
    const normLabel = forms[0];

    let bestScore = Infinity;

    for (const form of forms) {
      if (form === q) {
        bestScore = Math.min(bestScore, 0);
        break;
      }
      if (form.startsWith(q)) {
        // Prefer canonical label starting with query over an alias starting with query
        const bonus = form === normLabel ? 0 : 0.5;
        bestScore = Math.min(bestScore, 1 + bonus + (form.length - q.length) * 0.01);
        continue;
      }
      const words = form.split(' ');
      if (words.some((w) => w.startsWith(q))) {
        bestScore = Math.min(bestScore, 2 + (form.length - q.length) * 0.01);
        continue;
      }
      if (form.includes(q)) {
        bestScore = Math.min(bestScore, 3 + (form.length - q.length) * 0.01);
        continue;
      }
      // Fuzzy edit distance against full form or prefix of form
      const prefix = form.slice(0, Math.min(form.length, q.length + 2));
      const dFull = editDistance(q, form);
      const dPrefix = editDistance(q, prefix);
      const d = Math.min(dFull, dPrefix + 0.5);
      const maxAllowed = Math.max(2, Math.ceil(q.length * 0.45));
      if (d <= maxAllowed) {
        bestScore = Math.min(bestScore, 10 + d + Math.abs(form.length - q.length) * 0.05);
      }
    }

    if (bestScore < Infinity) {
      scored.push({ label, score: bestScore });
    }
  }

  // If the user typed something bizarre that didn't hit the threshold, still find the absolute closest match
  if (scored.length === 0) {
    let closest = null;
    let closestDist = Infinity;
    for (const item of pool) {
      const label = typeof item === 'string' ? item : item?.label;
      if (!label) continue;
      const norm = normaliseText(label);
      const d = editDistance(q, norm);
      if (d < closestDist) {
        closestDist = d;
        closest = label;
      }
    }
    if (closest) scored.push({ label: closest, score: 100 + closestDist });
  }

  scored.sort((a, b) => a.score - b.score || a.label.localeCompare(b.label));
  return scored.slice(0, limit);
}

/**
 * Autocorrect a typed submission to the closest valid item in the vocabulary pool,
 * so a player can never submit a word that does not exist.
 *
 * @param {string} submitted
 * @param {Array<string|{label: string, alternatives?: string[]}>} pool
 * @returns {string}
 */
export function resolveClosestMatch(submitted, pool) {
  const raw = String(submitted ?? '').trim();
  if (!raw || !Array.isArray(pool) || pool.length === 0) return raw;
  const matches = matchSuggestions(raw, pool, 1);
  return matches.length > 0 ? matches[0].label : raw;
}
