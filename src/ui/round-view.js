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
import { checkAnswer, matchSuggestions, resolveClosestMatch } from '../core/answer.js';

const FEEDBACK_MS = 700;
const PAIR_REVEAL_MS = 850;

/**
 * Derive 2-letter ISO code from a flag prompt (uses `prompt.code` or decodes regional indicator symbols).
 */
function resolveFlagCode(prompt) {
  if (prompt?.code) return String(prompt.code).toLowerCase();
  if (typeof prompt?.key === 'string' && prompt.key.startsWith('flag:')) {
    return prompt.key.slice(5).toLowerCase();
  }
  if (typeof prompt?.flag === 'string' && prompt.flag.length >= 4) {
    const cp1 = prompt.flag.codePointAt(0);
    const cp2 = prompt.flag.codePointAt(2);
    if (cp1 >= 0x1f1e6 && cp1 <= 0x1f1ff && cp2 >= 0x1f1e6 && cp2 <= 0x1f1ff) {
      return String.fromCharCode(cp1 - 0x1f1e6 + 97, cp2 - 0x1f1e6 + 97);
    }
  }
  return null;
}

/**
 * Generate a crisp SVG data URI fallback portrait so a person card is never without a picture.
 */
function buildFallbackPortraitDataUri(name = 'Famous Person', category = '') {
  const parts = String(name).trim().split(/\s+/);
  const initials =
    parts.length >= 2
      ? `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
      : String(name).slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 400" width="320" height="400">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect width="320" height="400" fill="url(#bg)"/>
    <circle cx="160" cy="145" r="56" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
    <path d="M72 340 C72 268 248 268 248 340" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <text x="160" y="162" text-anchor="middle" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="42" font-weight="700">${initials}</text>
    <text x="160" y="372" text-anchor="middle" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="14" letter-spacing="2">${String(category || 'PORTRAIT').toUpperCase()}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

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

    // Word Rush is rapid-fire: no word help or autocorrect — you must type the word right.
    if (prompt?.kind === 'word-rush') {
      const status = checkAnswer(prompt, value);
      if (status === 'ignored') return;
      if (status === 'duplicate') {
        render(
          feedbackBar,
          el('p', {
            class: 'feedback feedback-life',
            text: `Already found "${value}" — keep going!`,
          }),
        );
        announce(`Already found ${value}`);
        return;
      }
      if (status === 'incorrect') {
        render(
          feedbackBar,
          el('p', {
            class: 'feedback feedback-wrong',
            text: `"${value}" is not on the ${prompt.topicLabel} (${prompt.letter}) list.`,
          }),
        );
        announce(`Not in list: ${value}`);
        return;
      }

      const feedback = round.submit(value);
      renderStatus();
      render(
        feedbackBar,
        el('p', {
          class: 'feedback feedback-correct',
          text: `✓ +1 "${value}"`,
        }),
      );
      announce(`Found ${value}`);
      if (feedback.ended) {
        finish();
        return;
      }
      drawPrompt();
      return;
    }

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

  /**
   * Build the text/numeric answer area with live prefix autocomplete suggestions
   * (e.g. typing "AL" shows "Albania", "Algeria", etc.) and automatic closest-word
   * autocorrect before submitting so the player never submits a non-existent word.
   */
  function answerArea(prompt) {
    if (prompt.kind === 'choice') return choiceButtons(prompt);

    const hasSuggestions =
      prompt.kind !== 'word-rush' &&
      Array.isArray(prompt.suggestions) &&
      prompt.suggestions.length > 0;
    const alreadyFoundSet = new Set(
      (prompt.foundWords ?? []).map((w) => String(w).toLocaleLowerCase()),
    );
    const activePool = hasSuggestions
      ? prompt.suggestions.filter((entry) => {
          const label = typeof entry === 'string' ? entry : entry.label;
          return !alreadyFoundSet.has(label.toLocaleLowerCase());
        })
      : [];

    let currentMatches = [];
    let selectedIndex = 0;

    const suggestionList = hasSuggestions
      ? el('ul', {
          class: 'autocomplete-list',
          role: 'listbox',
          'aria-label': 'Matching words',
          hidden: true,
        })
      : null;

    function resolveAndSubmit(raw) {
      const trimmed = String(raw ?? '').trim();
      if (!trimmed) return;
      let finalValue = trimmed;
      if (hasSuggestions) {
        if (currentMatches.length > 0 && selectedIndex >= 0 && currentMatches[selectedIndex]) {
          finalValue = currentMatches[selectedIndex].label;
        } else {
          finalValue = resolveClosestMatch(trimmed, activePool);
        }
      }
      input.value = '';
      if (suggestionList) {
        suggestionList.hidden = true;
        render(suggestionList);
      }
      currentMatches = [];
      lastValue = finalValue;
      input.focus();
      handleSubmit(finalValue);
    }

    function updateSuggestions() {
      if (!hasSuggestions || !suggestionList) return;
      const query = input.value.trim();
      if (!query) {
        suggestionList.hidden = true;
        render(suggestionList);
        currentMatches = [];
        return;
      }

      currentMatches = matchSuggestions(query, activePool, 7);
      selectedIndex = 0;

      if (currentMatches.length === 0) {
        suggestionList.hidden = true;
        render(suggestionList);
        return;
      }

      suggestionList.hidden = false;
      drawSuggestionItems();
    }

    function drawSuggestionItems() {
      if (!suggestionList) return;
      render(
        suggestionList,
        ...currentMatches.map((item, idx) =>
          el(
            'li',
            {
              class: `autocomplete-item${idx === selectedIndex ? ' is-active' : ''}`,
              role: 'option',
              'aria-selected': String(idx === selectedIndex),
              onMousedown: (e) => {
                // Prevent input blur before click registers
                e.preventDefault();
                selectedIndex = idx;
                resolveAndSubmit(item.label);
              },
            },
            [
              el('span', { class: 'autocomplete-label', text: item.label }),
              el('span', {
                class: 'autocomplete-badge',
                text:
                  idx === selectedIndex
                    ? 'Enter ↵'
                    : item.matchType === 'fuzzy'
                      ? 'Closest match'
                      : '',
              }),
            ],
          ),
        ),
      );
    }

    const input = el('input', {
      class: 'answer-input',
      type: 'text',
      inputmode: prompt.kind === 'numeric' ? 'decimal' : 'text',
      placeholder:
        prompt.kind === 'word-rush'
          ? `Type a ${prompt.topicLabel} word starting with ${prompt.letter}...`
          : hasSuggestions
            ? 'Start typing (e.g. AL for Albania)...'
            : 'Your answer...',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-label': 'Your answer',
      onInput: () => updateSuggestions(),
      onKeydown: (event) => {
        if (hasSuggestions && currentMatches.length > 0) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            selectedIndex = (selectedIndex + 1) % currentMatches.length;
            drawSuggestionItems();
            return;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            selectedIndex = (selectedIndex - 1 + currentMatches.length) % currentMatches.length;
            drawSuggestionItems();
            return;
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            if (currentMatches[selectedIndex]) {
              input.value = currentMatches[selectedIndex].label;
              updateSuggestions();
            }
            return;
          }
        }
        if (event.key !== 'Enter') return;
        event.preventDefault();
        resolveAndSubmit(input.value);
      },
    });

    queueMicrotask(() => input.focus());

    return el('div', { class: 'answer-box-wrap' }, [
      el('div', { class: 'answer-row' }, [
        input,
        el('button', {
          type: 'button',
          class: 'primary',
          text: 'Submit',
          onClick: () => resolveAndSubmit(input.value),
        }),
      ]),
      suggestionList,
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
    const code = resolveFlagCode(prompt);
    const flagNode = code
      ? el('div', { class: 'flag-display', role: 'img', 'aria-label': 'Flag to identify' }, [
          el('img', {
            class: 'flag-image',
            src: `https://flagcdn.com/w320/${code}.png`,
            srcset: `https://flagcdn.com/w640/${code}.png 2x`,
            alt: 'Country flag to identify',
            loading: 'eager',
            decoding: 'async',
            onError: (e) => {
              const parent = e.currentTarget.parentElement;
              if (parent) parent.textContent = prompt.flag ?? '';
            },
          }),
        ])
      : el('div', {
          class: 'flag-display',
          role: 'img',
          'aria-label': 'Flag to identify',
          text: prompt.flag,
        });

    render(
      promptBody,
      flagNode,
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

  /** Famous People — every person gets a portrait (local WebP, Wikimedia Commons, or fallback SVG), plus the clue. */
  function renderPortrait(prompt) {
    const fallbackUri = buildFallbackPortraitDataUri(prompt.answer, prompt.topicLabel);
    const imgSrc = prompt.image || fallbackUri;

    const figure = el('figure', { class: 'portrait' }, [
      el('img', {
        class: 'portrait-image',
        src: imgSrc,
        alt: 'Portrait of the person to identify',
        loading: 'eager',
        decoding: 'async',
        onError: (e) => {
          const img = e.currentTarget;
          if (img.dataset.fallbackApplied) return;
          img.dataset.fallbackApplied = 'true';
          img.src = fallbackUri;
        },
      }),
      prompt.imageCredit
        ? el('figcaption', {
            class: 'portrait-credit',
            text: `${prompt.imageCredit.artist} · ${prompt.imageCredit.licence}`,
          })
        : null,
    ]);

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

  /**
   * Word Rush (2-Minute Daily Category + Letter Challenge).
   */
  function renderWordRush(prompt) {
    const foundWords = prompt.foundWords ?? [];
    render(
      promptBody,
      el('div', { class: 'word-rush-header' }, [
        el('div', { class: 'word-rush-brand-row' }, [
          el('span', {
            class: 'word-rush-logo',
            'aria-hidden': 'true',
            html: `<svg viewBox="0 0 40 40" width="38" height="38" fill="none">
              <rect x="2" y="2" width="36" height="36" rx="9" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2.2"/>
              <path d="M22 7L11 21.5h8.2L17.8 33 29 18.5h-8.2L22 7Z" fill="currentColor"/>
            </svg>`,
          }),
          el('h2', { class: 'word-rush-title', text: 'Word Rush' }),
        ]),
        el('div', { class: 'word-rush-prompt-pills' }, [
          el('div', { class: 'word-rush-pill' }, [
            el('span', { class: 'word-rush-pill-label', text: 'Category' }),
            el('strong', { class: 'word-rush-pill-value', text: prompt.topicLabel }),
          ]),
          el('div', { class: 'word-rush-pill word-rush-pill-letter' }, [
            el('span', { class: 'word-rush-pill-label', text: 'Starts with' }),
            el('strong', { class: 'word-rush-pill-value', text: prompt.letter }),
          ]),
          el('div', { class: 'word-rush-pill' }, [
            el('span', { class: 'word-rush-pill-label', text: 'Found' }),
            el('strong', {
              class: 'word-rush-pill-value',
              text: String(foundWords.length),
            }),
          ]),
        ]),
      ]),
      answerArea(prompt),
      el('div', { class: 'word-rush-found-panel' }, [
        el('h3', {
          class: 'word-rush-found-title',
          text: `Words Found (${foundWords.length})`,
        }),
        foundWords.length === 0
          ? el('p', {
              class: 'muted',
              text: `No words guessed yet — type a word starting with "${prompt.letter}" and press Enter.`,
            })
          : el(
              'ul',
              { class: 'word-rush-chips', 'aria-label': 'Words found so far' },
              foundWords.map((word) => el('li', { class: 'word-rush-chip is-found', text: `✓ ${word}` })),
            ),
      ]),
    );
  }

  const RENDERERS = {
    prompt: renderPrompt,
    portrait: renderPortrait,
    flag: renderFlag,
    outline: renderOutline,
    grid: renderGrid,
    pairs: renderPairs,
    'word-rush': renderWordRush,
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
