/**
 * The Drill Engine round lifecycle.
 *
 * Owns the loop, both round modes, scoring hand-off and the end conditions.
 * Knows nothing about the DOM and nothing about any individual trainer beyond
 * the registration contract (FR-11), which is what lets E-6 add a third trainer
 * without touching this file.
 *
 * Covers FR-8..FR-25, FR-54..FR-59, FR-63.
 */

import { checkAnswer, formatExpected } from './answer.js';
import { createScoreboard } from './scoring.js';

/** @typedef {'idle'|'running'|'ended'|'abandoned'} RoundState */
/** @typedef {'time-expired'|'lives-exhausted'|'prompts-exhausted'} EndReason */

/** How many times to re-roll a prompt that duplicates the previous one (FR-23). */
const DUPLICATE_RETRY_LIMIT = 5;

function createId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `r-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

/**
 * @param {object} options
 * @param {object} options.trainer registered trainer definition
 * @param {string} options.puzzleDate ISO date the result is recorded against
 * @param {string} options.difficulty band for that date
 * @param {object} options.generator must expose next(context)
 * @param {object} options.clock injectable clock (NFR-15)
 * @param {number} options.modeParam seconds when timed, lives when lives
 */
export function createRound({
  trainer,
  puzzleDate,
  difficulty,
  generator,
  clock,
  modeParam,
}) {
  const roundMode = trainer.roundMode;
  const scoreboard = createScoreboard();

  /** @type {RoundState} */
  let state = 'idle';
  /** @type {EndReason|null} */
  let endedBy = null;
  /** @type {object|null} */
  let currentPrompt = null;
  let previousPromptKey = null;
  let promptIndex = 0;
  let startedAtMs = 0;
  let endedAtMs = 0;
  let promptShownAtMs = 0;
  let livesRemaining = roundMode === 'lives' ? modeParam : null;

  const durationMs = roundMode === 'timed' ? modeParam * 1000 : null;

  function elapsedMs() {
    if (state === 'idle') return 0;
    const end = state === 'running' ? clock.now() : endedAtMs;
    return Math.max(0, end - startedAtMs);
  }

  function remainingMs() {
    if (roundMode !== 'timed') return null;
    return Math.max(0, durationMs - elapsedMs());
  }

  function isExpired() {
    return roundMode === 'timed' && elapsedMs() >= durationMs;
  }

  function finish(reason) {
    if (state !== 'running') return;
    state = 'ended';
    endedBy = reason;
    endedAtMs = clock.now();
    currentPrompt = null;
  }

  /**
   * Pull the next prompt, rejecting an immediate repeat (FR-23).
   * Returns null when the generator is exhausted (FR-25).
   */
  function pullPrompt() {
    const context = {
      index: promptIndex,
      ...scoreboard.snapshot(),
      difficulty,
      puzzleDate,
    };

    let candidate = null;
    for (let attempt = 0; attempt <= DUPLICATE_RETRY_LIMIT; attempt += 1) {
      candidate = generator.next(context);
      if (!candidate) return null;
      const key = candidate.key ?? JSON.stringify(candidate.question ?? candidate.answer);
      if (key !== previousPromptKey) {
        previousPromptKey = key;
        return candidate;
      }
    }
    // Generator keeps returning the same thing; accept it rather than hang.
    return candidate;
  }

  function advance() {
    const next = pullPrompt();
    if (!next) {
      finish('prompts-exhausted');
      return;
    }
    promptIndex += 1;
    currentPrompt = next;
    promptShownAtMs = clock.now();
  }

  return {
    get state() {
      return state;
    },
    get prompt() {
      return currentPrompt;
    },
    get livesRemaining() {
      return livesRemaining;
    },
    get endedBy() {
      return endedBy;
    },
    get roundMode() {
      return roundMode;
    },
    get modeParam() {
      return modeParam;
    },
    get difficulty() {
      return difficulty;
    },
    get puzzleDate() {
      return puzzleDate;
    },

    remainingMs,
    elapsedMs,
    stats: () => scoreboard.snapshot(),

    /** Begin the round and present the first prompt immediately (FR-8). */
    start() {
      if (state !== 'idle') return;
      state = 'running';
      startedAtMs = clock.now();
      advance();
      return currentPrompt;
    },

    /**
     * Poll the clock. Timed rounds need this so expiry ends the round even when
     * the user has stopped submitting answers (FR-12).
     */
    tick() {
      if (state === 'running' && isExpired()) {
        finish('time-expired');
      }
      return state;
    },

    /**
     * Submit an answer for the current prompt.
     * @param {unknown} value
     */
    submit(value) {
      if (state !== 'running') {
        return { status: 'rejected', reason: 'round-not-running' };
      }

      // An answer that arrives after expiry counts for nothing (FR-13).
      if (isExpired()) {
        finish('time-expired');
        return { status: 'rejected', reason: 'time-expired' };
      }

      const prompt = currentPrompt;
      const status = checkAnswer(prompt, value);

      // Empty submissions change nothing at all (FR-52).
      if (status === 'ignored') {
        return { status: 'ignored', prompt };
      }

      const isCorrect = status === 'correct';
      scoreboard.record(prompt, isCorrect, clock.now() - promptShownAtMs);

      let lifeLost = false;
      if (roundMode === 'lives' && !isCorrect) {
        livesRemaining -= 1;
        lifeLost = true;
      }

      const feedback = {
        status,
        prompt,
        expected: formatExpected(prompt),
        lifeLost,
        livesRemaining,
        stats: scoreboard.snapshot(),
      };

      // The last life ends the round at once, with no further prompt (FR-17).
      if (roundMode === 'lives' && livesRemaining <= 0) {
        finish('lives-exhausted');
        feedback.ended = true;
        return feedback;
      }

      if (isExpired()) {
        finish('time-expired');
        feedback.ended = true;
        return feedback;
      }

      advance();
      feedback.ended = state !== 'running';
      feedback.next = currentPrompt;
      return feedback;
    },

    /** Leave without recording anything; the day's attempt survives (FR-6). */
    abandon() {
      if (state === 'running' || state === 'idle') {
        state = 'abandoned';
        currentPrompt = null;
      }
    },

    /**
     * Build the persisted result. Only valid once the round has ended.
     * @returns {object|null}
     */
    result() {
      if (state !== 'ended') return null;
      const summary = scoreboard.summary();

      // Both headline kinds resolve to the correct-answer count: Mental Math and
      // Geography score one point per right answer, and Memory completes exactly
      // one level per right answer, so "levels completed" is the same number.
      const score = summary.correctCount;
      const maxLevel = trainer.headlineScore === 'maxLevel' ? score : null;

      return {
        id: createId(),
        trainerId: trainer.id,
        puzzleDate,
        difficulty,
        roundMode,
        modeParam,
        score,
        playedAt: clock.now(),
        endedBy,
        elapsedMs: elapsedMs(),
        livesRemaining: roundMode === 'lives' ? Math.max(0, livesRemaining) : null,
        maxLevel,
        ...summary,
      };
    },
  };
}
