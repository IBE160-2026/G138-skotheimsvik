/**
 * Clock and calendar-date handling.
 *
 * Satisfies NFR-15: nothing in the application reads the system clock directly.
 * Everything date-dependent goes through a clock instance, so tests can simulate
 * any local date without touching the machine's real time.
 */

/**
 * Format a Date as an ISO calendar date in the *local* time zone.
 *
 * Deliberately not `toISOString()`, which converts to UTC and would put a user
 * in UTC+2 onto the wrong puzzle for the first two hours of each day (FR-34).
 * @param {Date} date
 * @returns {string} e.g. "2026-10-12"
 */
export function toLocalISODate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse an ISO calendar date into a local-midnight Date.
 * @param {string} iso
 * @returns {Date}
 */
export function fromLocalISODate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Whole days from `fromIso` to `toIso`. Positive when `toIso` is later.
 * @param {string} fromIso
 * @param {string} toIso
 * @returns {number}
 */
export function daysBetween(fromIso, toIso) {
  const MS_PER_DAY = 86400000;
  const from = fromLocalISODate(fromIso);
  const to = fromLocalISODate(toIso);
  return Math.round((to - from) / MS_PER_DAY);
}

/**
 * Shift an ISO date by a number of days.
 * @param {string} iso
 * @param {number} days
 * @returns {string}
 */
export function addDays(iso, days) {
  const date = fromLocalISODate(iso);
  date.setDate(date.getDate() + days);
  return toLocalISODate(date);
}

/**
 * Create a clock.
 *
 * @param {object} [options]
 * @param {() => number} [options.now] monotonic-ish millisecond source, for durations
 * @param {() => Date} [options.date] wall-clock date source, for the calendar date
 */
export function createClock(options = {}) {
  const nowMs = options.now ?? (() => Date.now());
  const nowDate = options.date ?? (() => new Date());

  return {
    /** Milliseconds, for measuring elapsed time within a round. */
    now: () => nowMs(),
    /** The current Date object. */
    date: () => nowDate(),
    /** Today's local calendar date as an ISO string. */
    today: () => toLocalISODate(nowDate()),
  };
}

/**
 * A clock the tests drive by hand.
 * @param {object} [options]
 * @param {string} [options.today] ISO date to report
 * @param {number} [options.startMs] initial millisecond reading
 */
export function createFixedClock(options = {}) {
  let iso = options.today ?? '2026-10-12';
  let ms = options.startMs ?? 0;

  return {
    now: () => ms,
    date: () => fromLocalISODate(iso),
    today: () => iso,
    /** Advance the millisecond reading. */
    advance(deltaMs) {
      ms += deltaMs;
      return ms;
    },
    /** Move to a different calendar date. */
    setToday(nextIso) {
      iso = nextIso;
    },
  };
}
