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
import {
  checkAnswer,
  matchSuggestions,
  matchWordRushEntry,
  resolveClosestMatch,
} from '../core/answer.js';

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

    // Word Rush is rapid-fire: compound/singular/plural/1-edit typo tolerance + live online engine lookup for unseen words.
    if (prompt?.kind === 'word-rush') {
      const matchResult = matchWordRushEntry(prompt, value);
      if (matchResult.status === 'ignored') return;
      if (matchResult.status === 'duplicate') {
        const dupLabel = matchResult.matchedEntry?.label ?? value;
        render(
          feedbackBar,
          el('p', {
            class: 'feedback feedback-life',
            text: `Already found "${dupLabel}" — keep going!`,
          }),
        );
        announce(`Already found ${dupLabel}`);
        return;
      }

      if (matchResult.status === 'correct') {
        const canonical = matchResult.matchedEntry?.label ?? value;
        const feedback = round.submit(canonical);
        renderStatus();
        render(
          feedbackBar,
          el('p', {
            class: 'feedback feedback-correct',
            text: `✓ +1 "${canonical}"`,
          }),
        );
        announce(`Found ${canonical}`);
        if (feedback.ended) {
          finish();
          return;
        }
        drawPrompt();
        return;
      }

      // If not found in local dictionary, ask the online engine verifier (TheMealDB / Datamuse / Wikipedia)
      if (typeof trainer?.verifyCandidateOnline === 'function') {
        render(
          feedbackBar,
          el('p', {
            class: 'feedback',
            text: `Checking "${value}"...`,
          }),
        );
        trainer.verifyCandidateOnline(value, prompt).then((verification) => {
          if (!round || round.state !== 'running') return;
          const activePrompt = round.prompt;
          if (!activePrompt || activePrompt.kind !== 'word-rush') return;

          if (verification?.approved) {
            const approvedLabel = verification.canonicalLabel || value;
            // Dynamically register the newly verified word in the active challenge pool so round.submit accepts it
            if (Array.isArray(activePrompt.validWords)) {
              activePrompt.validWords.push({
                label: approvedLabel,
                alternatives: [String(value).trim()],
              });
            }
            const feedback = round.submit(approvedLabel);
            renderStatus();
            render(
              feedbackBar,
              el('p', {
                class: 'feedback feedback-correct',
                text: `✓ +1 "${approvedLabel}" (verified)`,
              }),
            );
            announce(`Verified and found ${approvedLabel}`);
            if (feedback.ended) {
              finish();
              return;
            }
            drawPrompt();
          } else {
            let lifeLost = false;
            let ended = false;
            if (round.roundMode === 'lives') {
              const fb = round.submit(value);
              lifeLost = Boolean(fb.lifeLost);
              ended = Boolean(fb.ended);
              renderStatus();
            }
            render(
              feedbackBar,
              el('p', {
                class: 'feedback feedback-wrong',
                text: activePrompt.letter
                  ? `"${value}" is not a verified ${activePrompt.topicLabel} (${activePrompt.letter}) entry.`
                  : `"${value}" is not a verified ${activePrompt.topicLabel} entry.`,
              }),
              lifeLost ? el('p', { class: 'feedback-life', text: '♥ You lost a life' }) : null,
            );
            announce(`Not verified: ${value}`);
            if (ended) {
              busy = true;
              setTimeout(finish, FEEDBACK_MS);
            }
          }
        });
        return;
      }

      let lifeLost = false;
      let ended = false;
      if (round.roundMode === 'lives') {
        const fb = round.submit(value);
        lifeLost = Boolean(fb.lifeLost);
        ended = Boolean(fb.ended);
        renderStatus();
      }
      render(
        feedbackBar,
        el('p', {
          class: 'feedback feedback-wrong',
          text: prompt.letter
            ? `"${value}" is not on the ${prompt.topicLabel} (${prompt.letter}) list.`
            : `"${value}" is not on the ${prompt.topicLabel} list.`,
        }),
        lifeLost ? el('p', { class: 'feedback-life', text: '♥ You lost a life' }) : null,
      );
      announce(`Not in list: ${value}`);
      if (ended) {
        busy = true;
        setTimeout(finish, FEEDBACK_MS);
      }
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

    let feedbackText = correct ? '✓ Correct' : `✗ Wrong — ${feedback.expected}`;

    if (prompt?.kind === 'connection-grid' && Array.isArray(lastValue)) {
      const pickNorm = new Set(lastValue.map((w) => normaliseText(w)));
      const unsolved = prompt.unsolvedGroups ?? prompt.groups ?? [];
      if (correct) {
        const matchedGroup = unsolved.find((g) => {
          const gWords = (g.words ?? []).map((w) => normaliseText(w));
          return gWords.length === 4 && gWords.every((w) => pickNorm.has(w));
        });
        feedbackText = matchedGroup
          ? `✓ Solved "${matchedGroup.title}" (${matchedGroup.words.join(' · ')})`
          : '✓ Correct group!';
      } else {
        // Check if 3 of the 4 selected words belong to the same unsolved category ("One away!")
        const isOneAway = unsolved.some((g) => {
          const gWords = (g.words ?? []).map((w) => normaliseText(w));
          const overlap = gWords.filter((w) => pickNorm.has(w)).length;
          return overlap === 3;
        });
        const pickedLabel = lastValue.join(', ');
        feedbackText = isOneAway
          ? `✗ One away! 3 of your 4 words (${pickedLabel}) belong to the same category.`
          : `✗ Not a matching group (${pickedLabel}) — try another combination.`;
      }
    }

    render(
      feedbackBar,
      el('p', {
        class: `feedback ${correct ? 'feedback-correct' : 'feedback-wrong'}`,
        text: feedbackText,
      }),
      feedback.lifeLost ? el('p', { class: 'feedback-life', text: '♥ You lost a life' }) : null,
    );
    announce(feedbackText);
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
          ? prompt.letter
            ? `Type a ${prompt.topicLabel} word starting with ${prompt.letter}...`
            : `Type any ${prompt.topicLabel} word to start the chain...`
          : hasSuggestions
            ? 'Start typing (e.g. AL for Albania)...'
            : 'Your answer...',
      autocomplete: 'off',
      autocapitalize: 'off',
      spellcheck: 'false',
      'aria-label': 'Your answer',
      onInput: () => {
        if (feedbackBar?.childNodes.length) {
          render(feedbackBar);
        }
        updateSuggestions();
      },
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
        prompt.kind === 'word-rush'
          ? el('button', {
              type: 'button',
              class: 'secondary word-rush-give-up-btn',
              text: 'Give Up',
              onClick: () => giveUpWordRush(),
            })
          : null,
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

  /**
   * Word Chain (90-second Last-Letter Relay).
   */
  function renderWordChain(prompt) {
    const chainWords = prompt.chainWords ?? [prompt.previousWord].filter(Boolean);
    const isFirstTurn = chainWords.length === 0;
    render(
      promptBody,
      el('div', { class: 'word-rush-header' }, [
        el('div', { class: 'word-rush-brand-row' }, [
          el('span', {
            class: 'word-rush-logo',
            'aria-hidden': 'true',
            html: `<svg viewBox="0 0 40 40" width="38" height="38" fill="none">
              <rect x="2" y="2" width="36" height="36" rx="9" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2.2"/>
              <path d="M15 25l10-10M13 18l-2 2a5 5 0 0 0 7 7l2-2M27 22l2-2a5 5 0 0 0-7-7l-2 2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
            </svg>`,
          }),
          el('h2', { class: 'word-rush-title', text: 'Word Chain' }),
        ]),
        el('div', { class: 'word-rush-prompt-pills' }, [
          el('div', { class: 'word-rush-pill' }, [
            el('span', { class: 'word-rush-pill-label', text: 'Category' }),
            el('strong', { class: 'word-rush-pill-value', text: prompt.topicLabel }),
          ]),
          el('div', { class: 'word-rush-pill' }, [
            el('span', { class: 'word-rush-pill-label', text: 'Last word' }),
            el('strong', {
              class: 'word-rush-pill-value',
              text: isFirstTurn ? 'Choose your first word!' : prompt.previousWord,
            }),
          ]),
          el('div', { class: 'word-rush-pill word-rush-pill-letter' }, [
            el('span', { class: 'word-rush-pill-label', text: 'Next starts with' }),
            el('strong', {
              class: 'word-rush-pill-value',
              text: isFirstTurn ? 'Any' : prompt.letter,
            }),
          ]),
          el('div', { class: 'word-rush-pill' }, [
            el('span', { class: 'word-rush-pill-label', text: 'Chain' }),
            el('strong', {
              class: 'word-rush-pill-value',
              text: String(chainWords.length),
            }),
          ]),
        ]),
      ]),
      answerArea(prompt),
      el('div', { class: 'word-rush-found-panel' }, [
        el('h3', {
          class: 'word-rush-found-title',
          text: `Word Relay (${chainWords.length} in chain)`,
        }),
        chainWords.length === 0
          ? el('p', {
              class: 'muted',
              text: `Type any ${prompt.topicLabel} word to start your chain!`,
            })
          : el(
              'ul',
              { class: 'word-rush-chips word-chain-relay', 'aria-label': 'Word chain sequence' },
              chainWords.map((word, idx) =>
                el('li', {
                  class: `word-rush-chip ${idx === 0 ? 'is-starter' : 'is-found'}`,
                  text: idx === 0 ? `🏁 ${word}` : `→ ${word}`,
                }),
              ),
            ),
      ]),
    );
  }

  /**
   * Border Hop — step-by-step overland route between two countries.
   */
  function renderBorderHop(prompt) {
    const pathTaken = prompt.pathTaken ?? [prompt.startCountry];

    function flagBadge(code, name) {
      const lower = String(code ?? '').toLowerCase();
      return el('span', { class: 'border-hop-country-chip' }, [
        lower
          ? el('img', {
              src: `https://flagcdn.com/w40/${lower}.png`,
              alt: '',
              width: '22',
              height: '15',
              class: 'border-hop-mini-flag',
            })
          : null,
        el('strong', { text: name }),
      ]);
    }

    render(
      promptBody,
      el('div', { class: 'border-hop-header' }, [
        el('p', { class: 'prompt-prefix', text: 'Overland Border Route' }),
        el('div', { class: 'border-hop-endpoints' }, [
          el('div', { class: 'border-hop-endpoint' }, [
            el('span', { class: 'word-rush-pill-label', text: 'Start' }),
            flagBadge(prompt.startCode, prompt.startCountry),
          ]),
          el('span', { class: 'border-hop-arrow', text: '➔' }),
          el('div', { class: 'border-hop-endpoint' }, [
            el('span', { class: 'word-rush-pill-label', text: 'Destination' }),
            flagBadge(prompt.targetCode, prompt.targetCountry),
          ]),
        ]),
        el('p', {
          class: 'format-hint',
          text: `Shortest route: ${prompt.optimalSteps} border crossings. Currently in ${prompt.currentCountry} — name a bordering country to move closer to ${prompt.targetCountry}!`,
        }),
      ]),
      el('div', { class: 'border-hop-trail' }, [
        el('span', { class: 'word-rush-pill-label', text: 'Your Route So Far:' }),
        el(
          'div',
          { class: 'border-hop-steps' },
          [
            ...pathTaken.map((countryName, idx) =>
              el('span', {
                class: `word-rush-chip is-found${idx === pathTaken.length - 1 ? ' is-current-hop' : ''}`,
                text: `${idx === 0 ? '📍 ' : '→ '}${countryName}`,
              }),
            ),
            el('span', {
              class: 'word-rush-chip is-missed',
              text: `→ ? → 🏁 ${prompt.targetCountry}`,
            }),
          ],
        ),
      ]),
      answerArea(prompt),
    );
  }

  /**
   * Timeline Sort — place the event card in the right chronological slot.
   */
  function renderTimelineSort(prompt) {
    const timeline = prompt.timeline ?? [];
    const card = prompt.card;

    function slotButton(slotIndex, label) {
      return el('button', {
        type: 'button',
        class: 'timeline-slot-btn',
        onClick: () => {
          lastValue = String(slotIndex);
          handleSubmit(String(slotIndex));
        },
        text: label,
      });
    }

    const items = [];
    items.push(
      slotButton(0, `Place Before ${timeline[0]?.formattedYear ?? ''}`),
    );

    for (let i = 0; i < timeline.length; i += 1) {
      const ev = timeline[i];
      items.push(
        el('div', { class: 'timeline-placed-card' }, [
          el('span', { class: 'timeline-year-badge', text: ev.formattedYear }),
          el('div', { class: 'timeline-placed-info' }, [
            el('strong', { text: ev.title }),
            el('span', { class: 'muted small', text: ev.category }),
          ]),
        ]),
      );

      if (i < timeline.length - 1) {
        items.push(
          slotButton(
            i + 1,
            `Place Between ${ev.formattedYear} & ${timeline[i + 1].formattedYear}`,
          ),
        );
      } else {
        items.push(
          slotButton(timeline.length, `Place After ${ev.formattedYear}`),
        );
      }
    }

    render(
      promptBody,
      el('div', { class: 'timeline-candidate-card' }, [
        el('span', { class: 'badge', text: card.category }),
        el('p', { class: 'prompt-prefix', text: 'Where on the timeline does this belong?' }),
        el('h2', { class: 'timeline-candidate-title', text: card.title }),
      ]),
      el(
        'div',
        { class: 'timeline-rail', role: 'group', 'aria-label': 'Timeline placement slots' },
        items,
      ),
    );
  }

  /**
   * ConnectionGrid — select 4 words that share a hidden category.
   */
  function renderConnectionGrid(prompt) {
    const solvedGroups = prompt.solvedGroups ?? [];
    const remainingCells = prompt.remainingCells ?? [];
    const selectedWords = new Set();

    const submitBtn = el('button', {
      type: 'button',
      class: 'primary',
      disabled: true,
      text: 'Submit 4 Words',
      onClick: () => {
        if (selectedWords.size !== 4) return;
        const pick = [...selectedWords];
        lastValue = pick;
        handleSubmit(pick);
      },
    });

    const clearBtn = el('button', {
      type: 'button',
      class: 'ghost',
      text: 'Deselect All',
      onClick: () => {
        selectedWords.clear();
        syncTiles();
      },
    });

    const tileButtons = remainingCells.map((cell) =>
      el('button', {
        type: 'button',
        class: 'connection-tile',
        text: cell.word,
        onClick: () => {
          if (feedbackBar?.childNodes.length) {
            render(feedbackBar);
          }
          if (selectedWords.has(cell.word)) {
            selectedWords.delete(cell.word);
          } else if (selectedWords.size < 4) {
            selectedWords.add(cell.word);
          }
          syncTiles();
        },
      }),
    );

    function syncTiles() {
      for (const btn of tileButtons) {
        const active = selectedWords.has(btn.textContent);
        btn.classList.toggle('is-selected', active);
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
      submitBtn.disabled = selectedWords.size !== 4;
      submitBtn.textContent =
        selectedWords.size === 4
          ? 'Submit 4 Words'
          : `Select ${4 - selectedWords.size} More`;
    }

    syncTiles();

    render(
      promptBody,
      el('p', {
        class: 'format-hint',
        text: 'Select four words that share a common thread.',
      }),
      solvedGroups.length > 0
        ? el(
            'div',
            { class: 'connection-solved-list' },
            solvedGroups.map((group) =>
              el('div', { class: 'connection-solved-banner' }, [
                el('strong', { class: 'connection-solved-title', text: group.title }),
                el('span', {
                  class: 'connection-solved-words',
                  text: group.words.join(' · '),
                }),
              ]),
            ),
          )
        : null,
      el(
        'div',
        {
          class: 'connection-board',
          role: 'group',
          'aria-label': 'ConnectionGrid word tiles',
        },
        tileButtons,
      ),
      el('div', { class: 'row-actions connection-actions' }, [submitBtn, clearBtn]),
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
    'word-chain': renderWordChain,
    'border-hop': renderBorderHop,
    'timeline-sort': renderTimelineSort,
    'connection-grid': renderConnectionGrid,
  };

  function drawPrompt() {
    const prompt = round.prompt;
    if (!prompt) {
      finish();
      return;
    }
    (RENDERERS[trainer.renderer] ?? renderPrompt)(prompt);
    renderStatus();
  }

  function finish() {
    stopTimer();
    if (round.state === 'running') round.abandon();
    onFinish(round);
  }

  /**
   * Immediately finish a Word Rush round, record the score achieved so far,
   * and reveal all valid answers on the results screen.
   */
  function giveUpWordRush() {
    if (round.state !== 'running') return;
    finish();
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
