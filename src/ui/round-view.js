/**
 * The in-round view.
 *
 * Owns every prompt renderer and the keyboard handling that goes with them.
 * All game logic lives in src/core/ — this file only draws and collects input
 * (NFR-15).
 *
 * Covers FR-15 to FR-22, FR-59 to FR-67, FR-113 to FR-134, FR-157 to FR-163.
 */

import { el, render, stat, formatClock } from './dom.js';
import { checkAnswer } from '../core/answer.js';

const FEEDBACK_MS = 700;
const PAIR_REVEAL_MS = 850;

/**
 * @param {object} options
 * @param {HTMLElement} options.container
 * @param {(message: string) => void} options.announce ARIA live region (FR-162)
 * @param {(round: object) => void} options.onFinish
 * @param {() => void} options.onLeave
 */
export function createRoundView({ container, announce, onFinish, onLeave }) {
  let round = null;
  let trainer = null;
  let hintFor = null;
  let timer = null;
  let promptBody = null;
  let feedbackBar = null;
  let statusBar = null;
  /** Visual countdown for timed rounds; null for the other two modes. */
  let timerRail = null;
  /** Wrong guesses so far on the current outline prompt (FR-148). */
  let hints = [];
  let guessesUsed = 0;
  let busy = false;

  function stopTimer() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    document.removeEventListener('keydown', choiceKeys);
  }

  function modeIndicator() {
    if (round.roundMode === 'timed') {
      return stat('Time', formatClock(round.remainingMs()), 'stat-time');
    }
    if (round.roundMode === 'lives') {
      const lives = Math.max(0, round.livesRemaining);
      return stat(
        'Lives',
        el('span', {
          'aria-label': `${lives} lives remaining`,
          text: '♥'.repeat(lives) || '—',
        }),
        'stat-lives',
      );
    }
    return stat('Pairs left', String(round.pairsRemaining ?? 0), 'stat-pairs');
  }

  function renderStatus() {
    const stats = round.stats();
    render(
      statusBar,
      modeIndicator(),
      stat(trainer.scoreLabel ?? 'Score', String(round.score())),
      stat('Accuracy', `${stats.accuracy}%`),
      stat('Streak', String(stats.currentStreak)),
    );

    if (!timerRail) return;
    const remaining = round.remainingMs();
    const total = round.modeParam * 1000;
    const fraction = Math.max(0, Math.min(1, remaining / total));
    const bar = timerRail.firstElementChild;
    bar.style.width = `${fraction * 100}%`;
    bar.classList.toggle('low', fraction <= 0.2);
  }

  /** Submit, show feedback, then move on. */
  function handleSubmit(value) {
    if (busy || round.state !== 'running') return;

    // Outline prompts allow several guesses at the same shape, which is the
    // only way a "you were 400 km north-east" hint can help. Intermediate
    // guesses are judged here and never reach the engine, so the round still
    // sees exactly one graded answer per country.
    const prompt = round.prompt;
    const maxGuesses = prompt?.maxGuesses ?? 1;
    if (prompt?.hintable && maxGuesses > 1 && guessesUsed < maxGuesses - 1) {
      const status = checkAnswer(prompt, value);
      if (status === 'ignored') return;
      if (status === 'incorrect') {
        guessesUsed += 1;
        const hint = hintFor?.(value, prompt.answer);
        if (hint) hints.push(hint);
        renderHints();
        announce(
          hint
            ? `Not quite. ${hint.guess} is ${hint.distanceKm} kilometres away, to the ${hint.direction}.`
            : 'Not a country I know. Try again.',
        );
        return;
      }
    }

    const feedback = round.submit(value);
    if (feedback.status === 'ignored' || feedback.status === 'rejected') {
      if (feedback.status === 'rejected') finish();
      return;
    }

    renderStatus();
    showFeedback(feedback);

    if (feedback.ended) {
      busy = true;
      setTimeout(finish, FEEDBACK_MS);
      return;
    }

    busy = true;
    setTimeout(() => {
      busy = false;
      hints = [];
      guessesUsed = 0;
      drawPrompt();
    }, FEEDBACK_MS);
  }

  /** Redraw just the hint list, leaving the input and its focus alone. */
  function renderHints() {
    const existing = promptBody?.querySelector('.hints');
    const fresh = hintList();
    if (existing && fresh) existing.replaceWith(fresh);
    else if (existing) existing.remove();
    else if (fresh) promptBody?.append(fresh);

    const guessCounter = promptBody?.querySelector('.guess-counter');
    if (guessCounter) {
      const left = (round.prompt?.maxGuesses ?? 1) - guessesUsed;
      guessCounter.textContent = `${left} guess${left === 1 ? '' : 'es'} left on this shape`;
    }
    promptBody?.querySelector('.answer-input')?.focus();
  }

  function showFeedback(feedback) {
    const correct = feedback.status === 'correct';
    const prompt = feedback.prompt;

    // Outline rounds trade the plain "wrong" for a distance hint (FR-148).
    if (!correct && prompt?.hintable && hintFor) {
      const hint = hintFor(lastValue, prompt.answer);
      if (hint) hints.push(hint);
    }

    render(
      feedbackBar,
      el('p', {
        class: `feedback ${correct ? 'feedback-correct' : 'feedback-wrong'}`,
        text: correct ? '✓ Correct' : `✗ Wrong — ${feedback.expected}`,
      }),
      feedback.lifeLost ? el('p', { class: 'feedback-life', text: '♥ You lost a life' }) : null,
    );
    announce(correct ? 'Correct' : `Wrong. ${feedback.expected}`);
  }

  // --- renderers ------------------------------------------------------------

  /** Free-entry answer box, used by numeric and text prompts. */
  function answerInput(prompt) {
    const input = el('input', {
      class: 'answer-input',
      type: prompt.kind === 'numeric' ? 'text' : 'text',
      inputmode: prompt.kind === 'numeric' ? 'decimal' : 'text',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-label': 'Your answer',
      onKeydown: (event) => {
        if (event.key !== 'Enter') return;
        event.preventDefault();
        const value = input.value;
        input.value = '';
        lastValue = value;
        handleSubmit(value);
      },
    });
    return input;
  }

  /** Remembered so an outline hint knows what was guessed. */
  let lastValue = null;

  function choiceButtons(prompt) {
    return el(
      'div',
      { class: 'choices', role: 'group', 'aria-label': 'Answer options' },
      prompt.options.map((option, index) =>
        el('button', {
          type: 'button',
          class: 'choice',
          dataset: { choiceIndex: String(index + 1) },
          onClick: () => {
            lastValue = option;
            handleSubmit(option);
          },
          html: `<kbd>${index + 1}</kbd> <span>${option}</span>`,
        }),
      ),
    );
  }

  /** Number keys pick an option without reaching for the mouse (FR-61). */
  function choiceKeys(event) {
    if (busy || !/^[1-4]$/.test(event.key)) return;
    const target = event.target;
    if (target instanceof HTMLInputElement) return;
    const button = promptBody?.querySelector(`.choice[data-choice-index="${event.key}"]`);
    if (button) {
      event.preventDefault();
      button.click();
    }
  }

  function answerArea(prompt) {
    if (prompt.kind === 'choice') return choiceButtons(prompt);
    const input = answerInput(prompt);
    queueMicrotask(() => input.focus());
    return el('div', { class: 'answer-row' }, [
      input,
      el('button', {
        type: 'button',
        class: 'primary',
        text: 'Submit',
        onClick: () => {
          const value = input.value;
          input.value = '';
          lastValue = value;
          input.focus();
          handleSubmit(value);
        },
      }),
    ]);
  }

  function hintList() {
    if (hints.length === 0) return null;
    return el(
      'ul',
      { class: 'hints', 'aria-label': 'Previous guesses' },
      hints.map((hint) =>
        el('li', { class: 'hint' }, [
          el('span', { class: 'hint-guess', text: hint.guess }),
          el('span', { class: 'hint-distance', text: `${hint.distanceKm.toLocaleString()} km` }),
          el('span', { class: 'hint-arrow', 'aria-label': hint.direction, text: hint.arrow }),
          el('span', { class: 'hint-proximity', text: `${hint.proximity}%` }),
        ]),
      ),
    );
  }

  /** Mental Math, Capitals, Famous People — a question and an answer box. */
  function renderPrompt(prompt) {
    // A clue runs to a sentence or two, so it cannot use the display size a
    // short arithmetic question does.
    const long = String(prompt.question).length > 60;
    render(
      promptBody,
      prompt.prefix ? el('p', { class: 'prompt-prefix', text: prompt.prefix }) : null,
      el('p', { class: long ? 'question question-long' : 'question', text: prompt.question }),
      prompt.formatHint ? el('p', { class: 'format-hint', text: prompt.formatHint }) : null,
      answerArea(prompt),
    );
  }

  function renderFlag(prompt) {
    render(
      promptBody,
      el('div', { class: 'flag-display', role: 'img', 'aria-label': 'Flag to identify', text: prompt.flag }),
      el('p', { class: 'question', text: prompt.question }),
      answerArea(prompt),
    );
  }

  function renderOutline(prompt) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', prompt.viewBox);
    svg.setAttribute('class', 'outline-svg');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Country outline to identify');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', prompt.outline);
    path.setAttribute('fill-rule', 'evenodd');
    svg.append(path);

    render(
      promptBody,
      el('div', { class: 'outline-display' }, [svg]),
      el('p', { class: 'question', text: prompt.question }),
      prompt.maxGuesses > 1
        ? el('p', {
            class: 'format-hint guess-counter',
            text: `${prompt.maxGuesses} guesses left on this shape`,
          })
        : null,
      answerArea(prompt),
      hintList(),
    );
  }

  /**
   * Pattern Memory.
   *
   * The pattern is shown, then hidden, and only then does the grid accept
   * input. Hidden tiles carry no marker in the DOM (FR-122).
   */
  function renderGrid(prompt) {
    const selected = new Set();
    let locked = true;

    const tiles = Array.from({ length: prompt.cellCount }, (_, index) =>
      el('button', {
        type: 'button',
        class: 'tile',
        disabled: true,
        'aria-label': `Tile ${index + 1}`,
        'aria-pressed': 'false',
        onClick: () => toggle(index),
      }),
    );

    function toggle(index) {
      if (locked) return;
      if (selected.has(index)) selected.delete(index);
      else selected.add(index);
      const tile = tiles[index];
      tile.classList.toggle('tile-selected', selected.has(index));
      tile.setAttribute('aria-pressed', String(selected.has(index)));
      submitButton.disabled = selected.size === 0;
    }

    const submitButton = el('button', {
      type: 'button',
      class: 'primary',
      text: 'Submit pattern',
      disabled: true,
      onClick: () => {
        if (locked) return;
        locked = true;
        lastValue = [...selected];
        handleSubmit([...selected]);
      },
    });

    const grid = el(
      'div',
      {
        class: 'tile-grid',
        role: 'group',
        'aria-label': `Level ${prompt.level}, ${prompt.tileCount} tiles to reproduce`,
        style: `grid-template-columns: repeat(${prompt.columns}, 1fr);`,
        onKeydown: (event) => gridKeys(event, tiles, prompt.columns, toggle, submitButton),
      },
      tiles,
    );

    render(
      promptBody,
      el('p', { class: 'level-label', text: `Level ${prompt.level}` }),
      el('p', {
        class: 'format-hint',
        text: 'Watch the pattern, then reproduce it. Arrow keys move, Space selects, Enter submits.',
      }),
      grid,
      submitButton,
    );

    // Show the pattern, then take it away.
    for (const index of prompt.answer) tiles[index].classList.add('tile-lit');
    announce(`Level ${prompt.level}. Memorise ${prompt.tileCount} tiles.`);

    setTimeout(() => {
      for (const index of prompt.answer) tiles[index].classList.remove('tile-lit');
      locked = false;
      for (const tile of tiles) tile.disabled = false;
      tiles[0]?.focus();
      announce('Now reproduce the pattern.');
    }, prompt.displayMs);
  }

  /** Arrow-key navigation shared by both boards (FR-123, FR-133). */
  function gridKeys(event, tiles, columns, toggle, submitButton) {
    const current = tiles.indexOf(document.activeElement);
    if (current < 0) return;

    const moves = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    };

    if (event.key in moves) {
      event.preventDefault();
      const next = current + moves[event.key];
      if (next >= 0 && next < tiles.length) tiles[next].focus();
      return;
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      toggle(current);
      return;
    }
    if (event.key === 'Enter' && submitButton && !submitButton.disabled) {
      event.preventDefault();
      submitButton.click();
    }
  }

  /**
   * Figure Pairs.
   *
   * Face-down cards render empty, so their figures cannot be read out of the
   * DOM (FR-134).
   */
  function renderPairs(prompt) {
    const matched = new Set(prompt.matched);
    const turned = [];
    let locked = false;

    const cards = Array.from({ length: prompt.cellCount }, (_, index) => {
      const isMatched = matched.has(index);
      return el('button', {
        type: 'button',
        class: `pair-card${isMatched ? ' pair-card-matched' : ''}`,
        disabled: isMatched,
        'aria-label': isMatched ? `Card ${index + 1}, matched` : `Card ${index + 1}, face down`,
        text: isMatched ? prompt.faces[index] : '',
        onClick: () => turn(index),
      });
    });

    function reveal(index) {
      cards[index].textContent = prompt.faces[index];
      cards[index].classList.add('pair-card-face-up');
      cards[index].setAttribute('aria-label', `Card ${index + 1}, ${prompt.faces[index]}`);
    }

    function hide(index) {
      cards[index].textContent = '';
      cards[index].classList.remove('pair-card-face-up');
      cards[index].setAttribute('aria-label', `Card ${index + 1}, face down`);
    }

    function turn(index) {
      if (locked || matched.has(index) || turned.includes(index)) return;
      reveal(index);
      turned.push(index);
      if (turned.length < 2) return;

      locked = true;
      const pair = [...turned];
      // Both faces stay visible long enough to be remembered, whether or not
      // they matched — that is the whole game.
      setTimeout(() => {
        lastValue = pair;
        handleSubmit(pair);
        turned.length = 0;
      }, PAIR_REVEAL_MS);
    }

    const board = el(
      'div',
      {
        class: 'pair-board',
        role: 'group',
        'aria-label': `${prompt.pairsTotal - prompt.pairsMatched} pairs left`,
        style: `grid-template-columns: repeat(${prompt.columns}, 1fr);`,
        onKeydown: (event) => gridKeys(event, cards, prompt.columns, turn, null),
      },
      cards,
    );

    render(
      promptBody,
      el('p', {
        class: 'level-label',
        text: `${prompt.pairsMatched} of ${prompt.pairsTotal} pairs matched`,
      }),
      el('p', {
        class: 'format-hint',
        text: 'Turn two cards. Arrow keys move, Space turns a card.',
      }),
      board,
    );

    queueMicrotask(() => cards.find((card) => !card.disabled)?.focus());
  }

  /** Famous People — a portrait where one exists, plus the clue. */
  function renderPortrait(prompt) {
    const figure = prompt.image
      ? el('figure', { class: 'portrait' }, [
          el('img', {
            class: 'portrait-image',
            src: prompt.image,
            alt: 'Portrait of the person to identify',
            loading: 'eager',
            decoding: 'async',
          }),
          prompt.imageCredit
            ? el('figcaption', {
                class: 'portrait-credit',
                text: `${prompt.imageCredit.artist} · ${prompt.imageCredit.licence}`,
              })
            : null,
        ])
      : null;

    render(
      promptBody,
      figure,
      prompt.topicLabel
        ? el('p', { class: 'topic-chip' }, [el('span', { class: 'badge', text: prompt.topicLabel })])
        : null,
      el('p', { class: 'prompt-prefix', text: prompt.prefix ?? 'Who is this?' }),
      el('p', { class: 'question question-long', text: prompt.question }),
      prompt.formatHint ? el('p', { class: 'format-hint', text: prompt.formatHint }) : null,
      answerArea(prompt),
    );
  }

  const RENDERERS = {
    prompt: renderPrompt,
    portrait: renderPortrait,
    flag: renderFlag,
    outline: renderOutline,
    grid: renderGrid,
    pairs: renderPairs,
  };

  function drawPrompt() {
    const prompt = round.prompt;
    if (!prompt) {
      finish();
      return;
    }
    render(feedbackBar);
    (RENDERERS[trainer.renderer] ?? renderPrompt)(prompt);
    renderStatus();
  }

  function finish() {
    stopTimer();
    if (round.state === 'running') round.abandon();
    onFinish(round);
  }

  /** Leaving a daily round spends the attempt, so it asks first (FR-10a). */
  function leave() {
    if (round.state !== 'running') {
      stopTimer();
      onLeave();
      return;
    }
    const confirmed =
      round.isPractice ||
      globalThis.confirm(
        'Leaving now ends this round and uses up today’s attempt. Your score so far will be recorded. Leave anyway?',
      );
    if (!confirmed) return;
    stopTimer();
    round.abandon();
    if (round.isPractice) onLeave();
    else onFinish(round);
  }

  return {
    /**
     * @param {object} options
     * @param {object} options.round
     * @param {object} options.trainer
     * @param {Function} [options.hintFor]
     */
    start({ round: activeRound, trainer: activeTrainer, hintFor: hintResolver }) {
      round = activeRound;
      trainer = activeTrainer;
      hintFor = hintResolver ?? null;
      hints = [];
      guessesUsed = 0;
      busy = false;
      lastValue = null;

      statusBar = el('div', { class: 'round-status' });
      feedbackBar = el('div', { class: 'round-feedback', role: 'status' });
      promptBody = el('div', { class: 'round-body' });
      timerRail =
        activeRound.roundMode === 'timed'
          ? el('div', { class: 'timer-rail', 'aria-hidden': 'true' }, [
              el('span', { class: 'timer-bar', style: 'width: 100%;' }),
            ])
          : null;

      render(
        container,
        // Every screen needs a top-level heading; in a round the trainer name
        // is it, but on screen the sticky header already says so.
        el('h1', { class: 'visually-hidden', text: `${activeTrainer.name} — round in progress` }),
        el('div', { class: 'round-header' }, [
          statusBar,
          el('div', { class: 'round-meta' }, [
            el('span', { class: 'badge', text: activeTrainer.name }),
            round.isPractice ? el('span', { class: 'badge badge-practice', text: 'Practice' }) : null,
            el('button', { type: 'button', class: 'ghost', text: 'Leave round', onClick: leave }),
          ]),
        ]),
        timerRail,
        promptBody,
        feedbackBar,
      );

      round.start();
      drawPrompt();
      document.addEventListener('keydown', choiceKeys);

      if (round.roundMode === 'timed') {
        timer = setInterval(() => {
          if (round.tick() !== 'running') {
            finish();
            return;
          }
          renderStatus();
        }, 200);
      }
    },

    stop: stopTimer,

    /** The value last submitted, so outline hints know what was guessed. */
    get lastValue() {
      return lastValue;
    },
  };
}
