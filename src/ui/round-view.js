/**
 * The active round view.
 *
 * Owns prompt rendering, input handling and the per-mode indicator. All grading
 * is delegated to the engine; this file only displays what it is told.
 *
 * Covers FR-14, FR-18..FR-22, FR-45..FR-48, FR-53, FR-105..FR-108, FR-120, FR-123.
 */

import { el, render, stat, formatClock, bandBadge } from './dom.js';
import { bandLabel } from '../core/difficulty.js';

const FEEDBACK_MS = 650; // bounded, auto-dismissing (FR-21)

export function createRoundView({ container, announce, onFinish, onAbandon }) {
  let round = null;
  let trainer = null;
  let tickHandle = null;
  let feedbackHandle = null;
  let patternHandle = null;
  let selection = new Set();
  let cursor = 0;
  let acceptingInput = false;

  const statusBar = el('div', { class: 'round-bar' });
  const promptArea = el('div', { class: 'prompt-area' });
  const feedbackArea = el('div', { class: 'feedback', role: 'status', 'aria-live': 'polite' });

  function clearTimers() {
    clearInterval(tickHandle);
    clearTimeout(feedbackHandle);
    clearTimeout(patternHandle);
    tickHandle = feedbackHandle = patternHandle = null;
  }

  /** Mode indicator plus live score, accuracy and streak (FR-22). */
  function drawStatusBar() {
    const stats = round.stats();
    const modeStat =
      round.roundMode === 'timed'
        ? stat('Time', formatClock(round.remainingMs()), round.remainingMs() <= 10000 ? 'timer-low' : '')
        : el('div', { class: 'stat' }, [
            el('span', { class: 'stat-label', text: 'Lives' }),
            el('span', {
              class: 'stat-value lives',
              // Hearts are decorative; the count is given as text for screen readers.
              html: `<span aria-hidden="true">${'♥'.repeat(Math.max(0, round.livesRemaining))}</span>`,
              'aria-label': `${round.livesRemaining} lives remaining`,
            }),
          ]);

    const headline =
      trainer.headlineScore === 'maxLevel'
        ? stat('Level', stats.correctCount + 1)
        : stat('Correct', stats.correctCount);

    render(
      statusBar,
      el('div', { class: 'stat-group' }, [
        modeStat,
        headline,
        stat('Accuracy', `${stats.accuracy}%`),
        stat('Streak', stats.currentStreak),
      ]),
      el('div', { class: 'badge-row' }, [
        bandBadge(round.difficulty, bandLabel(round.difficulty)),
        el('button', { type: 'button', onclick: handleAbandon, text: 'Quit round' }),
      ]),
    );
  }

  function handleAbandon() {
    clearTimers();
    round.abandon();
    onAbandon();
  }

  function showFeedback(outcome) {
    const isCorrect = outcome.status === 'correct';
    // Text and an icon, never colour alone (FR-123).
    const icon = isCorrect ? '✓' : '✗';
    const text = isCorrect
      ? `${icon} Correct`
      : `${icon} Wrong — the answer was ${outcome.expected}${outcome.lifeLost ? ' · life lost' : ''}`;

    render(feedbackArea, el('span', { class: isCorrect ? 'feedback-correct' : 'feedback-incorrect', text }));
    announce(text);

    feedbackHandle = setTimeout(() => render(feedbackArea), FEEDBACK_MS);
  }

  function submit(value) {
    if (!acceptingInput || round.state !== 'running') return;

    const outcome = round.submit(value);
    if (outcome.status === 'ignored' || outcome.status === 'rejected') return;

    showFeedback(outcome);
    drawStatusBar();

    if (round.state !== 'running') {
      finish();
      return;
    }
    drawPrompt();
  }

  function finish() {
    clearTimers();
    acceptingInput = false;
    onFinish(round.result());
  }

  /* ------------------------------------------------------------- renderers */

  function drawNumericPrompt(prompt) {
    const input = el('input', {
      class: 'answer-input',
      type: 'text',
      inputmode: 'decimal',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-label': 'Your answer',
    });

    const form = el('form', {
      onsubmit: (event) => {
        event.preventDefault();
        const value = input.value;
        input.value = ''; // cleared and refocused after each answer (FR-53)
        submit(value);
        input.focus();
      },
    }, [input]);

    render(
      promptArea,
      el('p', { class: 'prompt-question', text: prompt.question }),
      prompt.formatHint ? el('p', { class: 'prompt-hint', text: prompt.formatHint }) : null,
      form,
      feedbackArea,
    );

    input.focus(); // focus lands on the input when the prompt appears (FR-120)
  }

  function drawChoicePrompt(prompt) {
    const buttons = prompt.choices.map((choice, index) =>
      el('button', {
        type: 'button',
        class: 'choice',
        onclick: () => submit(choice),
      }, [
        el('span', { class: 'choice-key', text: String(index + 1), 'aria-hidden': 'true' }),
        el('span', { text: choice }),
      ]),
    );

    render(
      promptArea,
      prompt.flag ? el('div', { class: 'prompt-flag', text: prompt.flag, role: 'img', 'aria-label': 'Flag' }) : null,
      el('p', { class: 'prompt-question', text: prompt.question }),
      el('p', { class: 'prompt-hint', text: 'Click an option, or press 1 to 4.' }),
      el('div', { class: 'choice-grid' }, buttons),
      feedbackArea,
    );

    buttons[0]?.focus();
  }

  function drawTextPrompt(prompt) {
    const input = el('input', {
      class: 'answer-input', type: 'text', autocomplete: 'off',
      autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'Your answer',
    });

    const form = el('form', {
      onsubmit: (event) => {
        event.preventDefault();
        const value = input.value;
        input.value = '';
        submit(value);
        input.focus();
      },
    }, [input]);

    render(
      promptArea,
      prompt.flag ? el('div', { class: 'prompt-flag', text: prompt.flag, role: 'img', 'aria-label': 'Flag' }) : null,
      el('p', { class: 'prompt-question', text: prompt.question }),
      el('p', { class: 'prompt-hint', text: 'Type your answer and press Enter.' }),
      form,
      feedbackArea,
    );

    input.focus();
  }

  /**
   * The Memory grid.
   *
   * The lit tiles are written to the DOM only while they are meant to be
   * visible; once hidden, the markup carries no trace of them (FR-106).
   */
  function drawGridPrompt(prompt) {
    selection = new Set();
    cursor = 0;

    const grid = el('div', {
      class: 'memory-grid',
      role: 'group',
      'aria-label': `Level ${prompt.level}, ${prompt.tileCount} tiles to reproduce`,
      style: `grid-template-columns: repeat(${prompt.gridSize}, 1fr);`,
    });

    const cellCount = prompt.gridSize ** 2;
    const tiles = [];

    for (let index = 0; index < cellCount; index += 1) {
      const tile = el('button', {
        type: 'button',
        class: 'tile',
        'aria-pressed': 'false',
        'aria-label': `Tile ${index + 1}`,
        tabindex: index === 0 ? '0' : '-1',
        disabled: true,
        onclick: () => toggleTile(index),
      });
      tiles.push(tile);
      grid.append(tile);
    }

    const submitButton = el('button', {
      type: 'button',
      class: 'button-primary',
      disabled: true,
      text: 'Submit pattern',
      onclick: () => submit([...selection]),
    });

    function toggleTile(index) {
      if (!acceptingInput) return;
      if (selection.has(index)) selection.delete(index);
      else selection.add(index);

      tiles[index].setAttribute('aria-pressed', selection.has(index) ? 'true' : 'false');
      submitButton.textContent = `Submit pattern (${selection.size}/${prompt.tileCount})`;
    }

    function focusTile(index) {
      const clamped = Math.max(0, Math.min(cellCount - 1, index));
      tiles[cursor].tabIndex = -1;
      cursor = clamped;
      tiles[cursor].tabIndex = 0;
      tiles[cursor].focus();
    }

    // Arrows move, Space/Enter select, Enter on the grid submits (FR-107).
    grid.addEventListener('keydown', (event) => {
      if (!acceptingInput) return;
      const size = prompt.gridSize;
      const moves = {
        ArrowRight: 1, ArrowLeft: -1, ArrowDown: size, ArrowUp: -size,
      };

      if (event.key in moves) {
        event.preventDefault();
        focusTile(cursor + moves[event.key]);
      } else if (event.key === ' ') {
        event.preventDefault();
        toggleTile(cursor);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        submit([...selection]);
      }
    });

    render(
      promptArea,
      el('p', { class: 'prompt-question', text: `Level ${prompt.level}` }),
      el('p', { class: 'prompt-hint', id: 'grid-hint', text: 'Watch the pattern, then reproduce it. Arrow keys move, Space selects, Enter submits.' }),
      grid,
      submitButton,
      feedbackArea,
    );

    // Show the pattern, then wipe every trace of it before accepting input.
    acceptingInput = false;
    for (const index of prompt.answer) tiles[index].dataset.lit = 'true';
    announce(`Level ${prompt.level}. Memorise ${prompt.tileCount} tiles.`);

    patternHandle = setTimeout(() => {
      for (const tile of tiles) delete tile.dataset.lit;
      for (const tile of tiles) tile.disabled = false;
      submitButton.disabled = false;
      acceptingInput = true;
      focusTile(0);
      announce('Now reproduce the pattern.');
    }, prompt.displayMs);
  }

  function drawPrompt() {
    const prompt = round.prompt;
    if (!prompt) return;

    acceptingInput = true;

    switch (prompt.kind) {
      case 'grid': drawGridPrompt(prompt); break;
      case 'choice': drawChoicePrompt(prompt); break;
      case 'text': drawTextPrompt(prompt); break;
      default: drawNumericPrompt(prompt);
    }
  }

  /** Number keys answer multiple-choice prompts (FR-47). */
  function handleGlobalKeys(event) {
    if (!acceptingInput || round?.state !== 'running') return;
    const prompt = round.prompt;
    if (prompt?.kind !== 'choice') return;

    const index = Number(event.key) - 1;
    if (Number.isInteger(index) && index >= 0 && index < prompt.choices.length) {
      event.preventDefault();
      submit(prompt.choices[index]);
    }
  }

  return {
    /** Begin a round and take over the container. */
    start(activeRound, activeTrainer) {
      round = activeRound;
      trainer = activeTrainer;
      clearTimers();

      render(container, statusBar, promptArea);
      document.addEventListener('keydown', handleGlobalKeys);

      round.start();
      drawStatusBar();
      drawPrompt();

      // Timed rounds must expire even if the player stops answering (FR-12).
      if (round.roundMode === 'timed') {
        tickHandle = setInterval(() => {
          drawStatusBar();
          if (round.tick() !== 'running') finish();
        }, 100);
      }
    },

    /** Tear down listeners and timers when leaving the view. */
    destroy() {
      clearTimers();
      acceptingInput = false;
      document.removeEventListener('keydown', handleGlobalKeys);
    },
  };
}
