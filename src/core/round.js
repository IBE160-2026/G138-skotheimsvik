/**
 * The Drill Engine round lifecycle.
 *
 * Owns the loop, all three round modes, scoring hand-off and the end
 * conditions. Knows nothing about the DOM and nothing about any individual
 * trainer beyond the registration contract (FR-6), which is what lets the
 * Geography category add three trainers without touching this file.
 *
 * Covers FR-9 to FR-25 and FR-68 to FR-73.
 */

import { checkAnswer, formatExpected } from './answer.js';
import { createScoreboard } from './scoring.js';
import { modeParamFor } from './variants.js';

/** @typedef {'idle'|'running'|'ended'} RoundState */
/** @typedef {'time-expired'|'lives-exhausted'|'board-complete'|'prompts-exhausted'|'abandoned'} EndReason */

/** How many times to re-roll a prompt that duplicates the previous one (FR-24). */
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
 * @param {string} options.variantKey band or board size
 * @param {string} options.puzzleDate ISO date the result is recorded against
 * @param {object} options.generator must expose next(context)
 * @param {object} options.clock injectable clock (NFR-16)
 * @param {boolean} [options.practice] practice rounds are never persisted (FR-47)
 */
export function createRound({ trainer, variantKey, puzzleDate, generator, clock, practice = false }) {
  const roundMode = trainer.roundMode;
  const modeParam = modeParamFor(trainer, variantKey);
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
  let pairsRemaining = roundMode === 'completion' ? modeParam : null;
  /** What the player last submitted, so stateful boards can update themselves. */
  let lastSubmission = null;
  let lastCorrect = null;

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
   * Pull the next prompt, rejecting an immediate repeat (FR-24).
   * Returns null when the generator is exhausted (FR-25).
   */
  function pullPrompt() {
    const context = {
      index: promptIndex,
      ...scoreboard.snapshot(),
      variantKey,
      puzzleDate,
      practice,
      lastSubmission,
      lastCorrect,
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

  /** The headline number, per the trainer's declaration (FR-69). */
  function headlineScore() {
    const summary = scoreboard.snapshot();
    if (trainer.headlineScore === 'mistakes') return summary.mistakes;
    // Levels complete exactly one per correct answer, so "levels reached" and
    // "correct answers" are the same number.
    return summary.correctCount;
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
    get pairsRemaining() {
      return pairsRemaining;
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
    get variantKey() {
      return variantKey;
    },
    get puzzleDate() {
      return puzzleDate;
    },
    get isPractice() {
      return practice;
    },

    remainingMs,
    elapsedMs,
    score: headlineScore,
    stats: () => scoreboard.snapshot(),

    /** Begin the round and present the first prompt immediately (FR-11). */
    start() {
      if (state !== 'idle') return null;
      state = 'running';
      startedAtMs = clock.now();
      advance();
      return currentPrompt;
    },

    /**
     * Poll the clock. Timed rounds need this so expiry ends the round even when
     * the user has stopped submitting answers (FR-14).
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

      // An answer that arrives after expiry counts for nothing (FR-14).
      if (isExpired()) {
        finish('time-expired');
        return { status: 'rejected', reason: 'time-expired' };
      }

      const prompt = currentPrompt;
      const status = checkAnswer(prompt, value);

      // Empty submissions change nothing at all (FR-66).
      if (status === 'ignored') {
        return { status: 'ignored', prompt };
      }

      const isCorrect = status === 'correct';
      scoreboard.record(prompt, isCorrect, clock.now() - promptShownAtMs);
      lastSubmission = value;
      lastCorrect = isCorrect;

      let lifeLost = false;
      if (roundMode === 'lives' && !isCorrect) {
        livesRemaining -= 1;
        lifeLost = true;
      }
      if (roundMode === 'completion' && isCorrect) {
        pairsRemaining = Math.max(0, pairsRemaining - 1);
      }

      const feedback = {
        status,
        prompt,
        expected: formatExpected(prompt),
        lifeLost,
        livesRemaining,
        pairsRemaining,
        stats: scoreboard.snapshot(),
      };

      // The last life ends the round at once, with no further prompt (FR-16).
      if (roundMode === 'lives' && livesRemaining <= 0) {
        finish('lives-exhausted');
        feedback.ended = true;
        return feedback;
      }

      // A completion round ends only when the board is clear (FR-18).
      if (roundMode === 'completion' && pairsRemaining <= 0) {
        finish('board-complete');
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

    /**
     * Leave early.
     *
     * Starting a daily round commits the attempt (FR-10), so this ends the
     * round and keeps the score as it stood rather than discarding it. Practice
     * rounds are exempt only in the sense that nothing persists them — the
     * round itself still ends the same way.
     */
    abandon() {
      if (state === 'idle') {
        state = 'ended';
        endedBy = 'abandoned';
        startedAtMs = clock.now();
        endedAtMs = startedAtMs;
        return;
      }
      finish('abandoned');
    },

    /**
     * Build the persisted result. Only valid once the round has ended.
     * @returns {object|null}
     */
    result() {
      if (state !== 'ended') return null;
      const summary = scoreboard.summary();
      const score =
        trainer.headlineScore === 'mistakes' ? summary.mistakes : summary.correctCount;

      return {
        id: createId(),
        categoryId: trainer.categoryId,
        trainerId: trainer.id,
        variantKind: trainer.variantKind,
        variantKey,
        puzzleDate,
        roundMode,
        modeParam,
        score,
        playedAt: clock.now(),
        endedBy,
        elapsedMs: elapsedMs(),
        livesRemaining: roundMode === 'lives' ? Math.max(0, livesRemaining) : null,
        maxLevel: trainer.headlineScore === 'maxLevel' ? summary.correctCount : null,
        mistakes: roundMode === 'completion' ? summary.mistakes : null,
        ...summary,
      };
    },
  };
}
