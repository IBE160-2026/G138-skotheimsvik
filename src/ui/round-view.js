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
    const promptRem = round.promptRemainingMs?.();
    const hasPromptTimer = typeof promptRem === 'number';
    render(
      statusBar,
      modeIndicator(),
      hasPromptTimer ? stat('Timer', `${Math.ceil(promptRem / 1000)}s`, 'stat-time') : null,
      stat(trainer.scoreLabel ?? 'Score', String(round.score())),
      stat('Accuracy', `${stats.accuracy}%`),
      stat('Streak', String(stats.currentStreak)),
    );

    if (!timerRail) return;
    const remaining = round.roundMode === 'timed' ? round.remainingMs() : promptRem;
    const total =
      round.roundMode === 'timed'
        ? round.modeParam * 1000
        : (round.promptTimeLimitSeconds ?? 30) * 1000;
    const fraction = Math.max(0, Math.min(1, remaining / total));
    const bar = timerRail.firstElementChild;
    bar.style.width = `${fraction * 100}%`;
    bar.classList.toggle('low', fraction <= 0.2);
  }

  /** Triggered when the 30s per-prompt timer expires in a lives round (e.g. People Guesser). */
  function handlePromptTimeout() {
    if (busy || round.state !== 'running') return;
    const feedback = round.submit('', { timedOut: true });
    if (feedback.status === 'rejected') {
      finish();
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

    const stayOnSamePrompt = Boolean(
      feedback.status === 'incorrect' && prompt?.stayOnWrongGuess,
    );

    busy = true;
    setTimeout(() => {
      busy = false;
      if (stayOnSamePrompt) {
        guessesUsed += 1;
      } else {
        hints = [];
        guessesUsed = 0;
      }
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

    let feedbackText = correct
      ? '✓ Correct'
      : feedback.timedOut
        ? `⏱ Time's up! — ${feedback.expected}`
        : prompt?.hideExpectedOnWrong && !feedback.ended
          ? prompt?.hintable && hints.length > 0
            ? `✗ Not "${lastValue}" — ${hints[hints.length - 1].distanceKm.toLocaleString()} km ${hints[hints.length - 1].direction} ${hints[hints.length - 1].arrow}`
            : Array.isArray(prompt?.capitalHints)
              ? `✗ Not "${lastValue}" — new clue unlocked below!`
              : `✗ Not "${lastValue}" — try again!`
          : `✗ Wrong — ${feedback.expected}`;

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
      prompt.difficultyLabel
        ? el('p', { class: 'topic-chip' }, [
            el('span', { class: 'badge', text: `Today’s Difficulty: ${prompt.difficultyLabel}` }),
          ])
        : null,
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
      prompt.difficultyLabel
        ? el('p', { class: 'topic-chip' }, [
            el('span', { class: 'badge', text: `Today’s Difficulty: ${prompt.difficultyLabel}` }),
          ])
        : null,
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
   * Build a crisp, illustrated city skyline SVG fallback so a capital city
   * always displays a visual scene even if Wikipedia REST API is offline.
   */
  function buildCapitalSkylineDataUri(continent = 'World') {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f172a"/>
          <stop offset="65%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#334155"/>
        </linearGradient>
      </defs>
      <rect width="640" height="360" fill="url(#sky)"/>
      <circle cx="510" cy="82" r="34" fill="rgba(250,204,21,0.22)"/>
      <path d="M0 290 L55 290 L55 210 L95 210 L95 290 L120 290 L120 155 L170 155 L170 290 L195 290 L195 185 L245 185 L245 290 L280 290 L280 120 L300 95 L320 120 L320 290 L350 290 L350 170 L405 170 L405 290 L435 290 L435 140 L485 140 L485 290 L520 290 L520 200 L570 200 L570 290 L640 290 L640 360 L0 360 Z" fill="#0b1120"/>
      <text x="320" y="334" text-anchor="middle" fill="#cbd5e1" font-family="system-ui, sans-serif" font-size="15" font-weight="600" letter-spacing="2">MYSTERY CAPITAL CITY · ${String(continent).toUpperCase()}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  let capitalPhotoCache = { key: null, src: null };

  /**
   * Capital Guesser — shows a photo of the capital city at the start, and
   * reveals up to 3 progressive hints as the player makes wrong guesses:
   *   1st wrong guess: Closest / major other city in the same country
   *   2nd wrong guess: Fun fact about the capital city
   *   3rd wrong guess: Which country the capital belongs to
   */
  function renderCapital(prompt) {
    const fallbackSkyline = buildCapitalSkylineDataUri(prompt.topicLabel);
    const initialSrc =
      capitalPhotoCache.key === prompt.key && capitalPhotoCache.src
        ? capitalPhotoCache.src
        : fallbackSkyline;

    const imgEl = el('img', {
      class: 'capital-photo-image',
      src: initialSrc,
      alt: 'Photograph of the mystery capital city',
      loading: 'eager',
      decoding: 'async',
      style:
        'width: 100%; max-width: 520px; height: 240px; object-fit: cover; border-radius: 12px; display: block; margin: 0 auto;',
      onError: (e) => {
        const img = e.currentTarget;
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = 'true';
        img.src = fallbackSkyline;
      },
    });

    if (
      capitalPhotoCache.key !== prompt.key &&
      prompt.capitalName &&
      typeof globalThis.fetch === 'function'
    ) {
      const title = encodeURIComponent(String(prompt.capitalName).replace(/\s+/g, '_'));
      globalThis
        .fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const thumb = data?.originalimage?.source || data?.thumbnail?.source;
          if (thumb) {
            capitalPhotoCache = { key: prompt.key, src: thumb };
            imgEl.src = thumb;
          }
        })
        .catch(() => {});
    }

    const allHints = Array.isArray(prompt.capitalHints) ? prompt.capitalHints : [];
    const unlockedCount = Math.min(guessesUsed, allHints.length);

    const hintCards = allHints.map((item, idx) => {
      const isUnlocked = idx < unlockedCount;
      return el(
        'div',
        {
          class: `card capital-hint-card${isUnlocked ? ' is-unlocked' : ' is-locked'}`,
          style: 'padding: 0.75rem 1rem; margin-bottom: 0.5rem; text-align: left;',
        },
        [
          el('div', {
            class: 'muted small',
            style: 'font-weight: 600; margin-bottom: 0.2rem;',
            text: item.label,
          }),
          el('div', {
            style: isUnlocked ? 'font-weight: 600;' : 'opacity: 0.65; font-style: italic;',
            text: isUnlocked
              ? item.text
              : `Locked — unlocked after mistake #${idx + 1}`,
          }),
        ],
      );
    });

    render(
      promptBody,
      prompt.difficultyLabel
        ? el('p', { class: 'topic-chip' }, [
            el('span', { class: 'badge', text: `Today’s Difficulty: ${prompt.difficultyLabel}` }),
          ])
        : null,
      el('figure', { class: 'capital-photo-frame', style: 'margin: 0 0 1rem 0;' }, [imgEl]),
      el('p', { class: 'question', text: prompt.question }),
      prompt.formatHint ? el('p', { class: 'format-hint', text: prompt.formatHint }) : null,
      answerArea(prompt),
      el(
        'div',
        {
          class: 'capital-hints-list',
          'aria-label': 'Capital city progressive hints',
          style: 'margin-top: 1rem;',
        },
        hintCards,
      ),
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
      prompt.boardSizeLabel
        ? el('p', { class: 'topic-chip' }, [
            el('span', { class: 'badge', text: `Board: ${prompt.boardSizeLabel}` }),
          ])
        : null,
      el('p', { class: 'level-label', text: `Level ${prompt.level}` }),
      el('p', {
        class: 'format-hint',
        text: 'Watch the pattern, then reproduce it. One wrong tile ends the run!',
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
      prompt.boardSizeLabel
        ? el('p', { class: 'topic-chip' }, [
            el('span', { class: 'badge', text: `Today’s Board: ${prompt.boardSizeLabel}` }),
          ])
        : null,
      el('p', {
        class: 'level-label',
        text: `${prompt.pairsMatched} of ${prompt.pairsTotal} pairs matched · ${round.stats().totalAnswered} ${round.stats().totalAnswered === 1 ? 'try' : 'tries'}`,
      }),
      el('p', {
        class: 'format-hint',
        text: 'Turn two cards. Complete all pairs in as few attempts as possible.',
      }),
      board,
    );

    queueMicrotask(() => cards.find((card) => !card.disabled)?.focus());
  }

  /** Famous People — every person gets a portrait (local WebP, Wikimedia Commons, Wikipedia REST API thumbnail, or fallback SVG), plus the clue. */
  function renderPortrait(prompt) {
    const fallbackUri = buildFallbackPortraitDataUri(prompt.answer, prompt.topicLabel);
    const imgSrc = prompt.image || fallbackUri;

    const imgEl = el('img', {
      class: 'portrait-image',
      src: imgSrc,
      alt: 'Portrait of the person to identify',
      loading: 'eager',
      decoding: 'async',
      onError: (e) => {
        const img = e.currentTarget;
        if (!img.dataset.wikiRestTried && prompt.personName) {
          img.dataset.wikiRestTried = 'true';
          const title = encodeURIComponent(String(prompt.personName).replace(/\s+/g, '_'));
          fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              const thumb = data?.thumbnail?.source || data?.originalimage?.source;
              if (thumb && thumb !== img.src) {
                img.src = thumb;
              } else {
                img.dataset.fallbackApplied = 'true';
                img.src = fallbackUri;
              }
            })
            .catch(() => {
              img.dataset.fallbackApplied = 'true';
              img.src = fallbackUri;
            });
          return;
        }
        if (img.dataset.fallbackApplied) return;
        img.dataset.fallbackApplied = 'true';
        img.src = fallbackUri;
      },
    });

    const figure = el('figure', { class: 'portrait' }, [
      imgEl,
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
   * Border Hop — Travle-style live regional map where you see the starting country
   * and destination country in their real geographic positions, and every country
   * you guess is added onto the map in real time to visually bridge the route.
   */
  function renderBorderHop(prompt) {
    const pathTaken = prompt.pathTaken ?? [prompt.startCountry];
    const wrongGuesses = prompt.wrongGuesses ?? [];
    const mapCountries = Array.isArray(prompt.mapCountries) ? prompt.mapCountries : [];

    function buildRegionalMapSvg() {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', prompt.mapViewBox || '-20 -60 60 50');
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.setAttribute('class', 'border-hop-live-map-svg');
      svg.setAttribute('role', 'img');
      svg.setAttribute(
        'aria-label',
        `Live route map from ${prompt.startCountry} to ${prompt.targetCountry}`,
      );

      // Draw dashed connector line between start centroid, current centroid, and target centroid
      const startEntry = mapCountries.find((c) => c.role === 'start');
      const currentEntry =
        mapCountries.find((c) => c.role === 'current') ?? startEntry;
      const targetEntry = mapCountries.find((c) => c.role === 'target');

      if (currentEntry?.centroid && targetEntry?.centroid) {
        const [cLat, cLon] = currentEntry.centroid;
        const [tLat, tLon] = targetEntry.centroid;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', String(cLon));
        line.setAttribute('y1', String(-cLat));
        line.setAttribute('x2', String(tLon));
        line.setAttribute('y2', String(-tLat));
        line.setAttribute('class', 'border-hop-map-connector');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.append(line);
      }

      for (const country of mapCountries) {
        if (!country.worldPath) continue;
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `border-hop-map-country is-${country.role}`);

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = country.name;
        g.append(title);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', country.worldPath);
        path.setAttribute('fill-rule', 'evenodd');
        path.setAttribute('vector-effect', 'non-scaling-stroke');
        g.append(path);
        svg.append(g);
      }

      return svg;
    }

    function endpointPill(roleLabel, code, name, roleClass) {
      const lower = String(code ?? '').toLowerCase();
      return el('div', { class: `border-hop-endpoint ${roleClass}` }, [
        el('span', { class: 'word-rush-pill-label', text: roleLabel }),
        el('span', { class: 'border-hop-country-chip' }, [
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
        ]),
      ]);
    }

    render(
      promptBody,
      prompt.difficultyLabel
        ? el('p', { class: 'topic-chip' }, [
            el('span', { class: 'badge', text: `Today’s Route: ${prompt.difficultyLabel}` }),
          ])
        : null,
      el('div', { class: 'border-hop-header' }, [
        el('p', {
          class: 'prompt-prefix',
          text: `Today I’d like to travel overland from ${prompt.startCountry} to ${prompt.targetCountry}`,
        }),
        el('div', { class: 'border-hop-endpoints' }, [
          endpointPill('Start', prompt.startCode, prompt.startCountry, 'is-start-pill'),
          el('span', { class: 'border-hop-arrow', text: '➔' }),
          endpointPill('Destination', prompt.targetCode, prompt.targetCountry, 'is-target-pill'),
        ]),
        el('div', { class: 'border-hop-map-stage' }, [
          buildRegionalMapSvg(),
          el('div', { class: 'border-hop-map-legend' }, [
            el('span', { class: 'border-hop-legend-item is-start', text: `● Start (${prompt.startCountry})` }),
            el('span', { class: 'border-hop-legend-item is-step', text: '● Connected Route' }),
            wrongGuesses.length > 0
              ? el('span', { class: 'border-hop-legend-item is-wrong', text: '● Off-route Guess' })
              : null,
            el('span', { class: 'border-hop-legend-item is-target', text: `● Destination (${prompt.targetCountry})` }),
          ]),
        ]),
        el('p', {
          class: 'format-hint',
          text: `Shortest route: ${prompt.optimalSteps} border crossings. Currently at ${prompt.currentCountry} — enter a bordering country to build your path on the map!`,
        }),
      ]),
      el('div', { class: 'border-hop-trail' }, [
        el('span', { class: 'word-rush-pill-label', text: 'Past Guesses & Connected Route:' }),
        el(
          'div',
          { class: 'border-hop-steps' },
          [
            ...pathTaken.map((countryName, idx) =>
              el('span', {
                class: `word-rush-chip is-found${idx === pathTaken.length - 1 ? ' is-current-hop' : ''}`,
                text: `${idx === 0 ? '📍 ' : '✓ '}${countryName}`,
              }),
            ),
            ...wrongGuesses.map((wrongName) =>
              el('span', {
                class: 'word-rush-chip is-wrong-hop',
                text: `✗ ${wrongName}`,
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
   * Timeline Sort — Timdle-style interactive drag-and-drop timeline where the
   * player drags the statement card directly onto the chronological timeline
   * track (or drops/clicks a time slot along the timeline) to place it.
   */
  function renderTimelineSort(prompt) {
    const timeline = prompt.timeline ?? [];
    const card = prompt.card;
    let activeDropSlot = null;

    function submitSlot(slotIndex) {
      lastValue = String(slotIndex);
      handleSubmit(String(slotIndex));
    }

    function setHighlightSlot(slotIndex) {
      activeDropSlot = slotIndex;
      const allZones = promptBody?.querySelectorAll('.timeline-drop-zone') ?? [];
      for (const z of allZones) {
        const isMatch = Number(z.dataset.slotIndex) === slotIndex;
        z.classList.toggle('is-drag-over', isMatch);
      }
    }

    function makeDropZone(slotIndex, timeHintLabel) {
      const zone = el(
        'div',
        {
          class: 'timeline-drop-zone',
          dataset: { slotIndex: String(slotIndex) },
          role: 'button',
          tabindex: '0',
          'aria-label': `Drop or place card ${timeHintLabel}`,
          onDragover: (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            setHighlightSlot(slotIndex);
          },
          onDragenter: (e) => {
            e.preventDefault();
            setHighlightSlot(slotIndex);
          },
          onDragleave: (e) => {
            if (!zone.contains(e.relatedTarget)) {
              zone.classList.remove('is-drag-over');
            }
          },
          onDrop: (e) => {
            e.preventDefault();
            zone.classList.remove('is-drag-over');
            submitSlot(slotIndex);
          },
          onClick: () => submitSlot(slotIndex),
          onKeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              submitSlot(slotIndex);
            }
          },
        },
        [
          el('span', { class: 'timeline-drop-dot', 'aria-hidden': 'true' }),
          el('span', { class: 'timeline-drop-text', text: `Drop here · ${timeHintLabel}` }),
        ],
      );
      return zone;
    }

    const candidateEl = el(
      'div',
      {
        class: 'timeline-candidate-card is-draggable',
        draggable: 'true',
        'aria-grabbed': 'false',
        onDragstart: (e) => {
          candidateEl.classList.add('is-dragging');
          candidateEl.setAttribute('aria-grabbed', 'true');
          promptBody?.querySelector('.timeline-track')?.classList.add('is-dragging-active');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', card.title);
          }
        },
        onDragend: () => {
          candidateEl.classList.remove('is-dragging');
          candidateEl.setAttribute('aria-grabbed', 'false');
          promptBody?.querySelector('.timeline-track')?.classList.remove('is-dragging-active');
          setHighlightSlot(null);
        },
      },
      [
        el('div', { class: 'timeline-candidate-top' }, [
          el('span', { class: 'badge', text: card.category }),
          el('span', { class: 'timeline-drag-handle', text: '⠿ Drag onto timeline' }),
        ]),
        el('h2', { class: 'timeline-candidate-title', text: card.title }),
        el('p', {
          class: 'muted small timeline-candidate-sub',
          text: 'Drag this statement card to the right point on the timeline below (or tap a time slot).',
        }),
      ],
    );

    // Touch / pointer drag support so mobile & mouse users can drag smoothly even without HTML5 DnD
    let pointerDragging = false;
    let ghostEl = null;

    candidateEl.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      // Let native HTML5 drag handle desktop mouse if supported, use pointer tracking for touch/pen
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      pointerDragging = true;
      candidateEl.classList.add('is-dragging');
      promptBody?.querySelector('.timeline-track')?.classList.add('is-dragging-active');

      ghostEl = el('div', {
        class: 'timeline-drag-ghost',
        text: card.title,
        style: `left: ${e.clientX}px; top: ${e.clientY}px;`,
      });
      document.body.append(ghostEl);

      const onMove = (moveEvent) => {
        if (!pointerDragging) return;
        if (ghostEl) {
          ghostEl.style.left = `${moveEvent.clientX}px`;
          ghostEl.style.top = `${moveEvent.clientY}px`;
        }
        const target = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const zone = target?.closest?.('.timeline-drop-zone');
        if (zone && zone.dataset.slotIndex !== undefined) {
          setHighlightSlot(Number(zone.dataset.slotIndex));
        } else {
          setHighlightSlot(null);
        }
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        if (ghostEl) {
          ghostEl.remove();
          ghostEl = null;
        }
        candidateEl.classList.remove('is-dragging');
        promptBody?.querySelector('.timeline-track')?.classList.remove('is-dragging-active');
        const chosen = activeDropSlot;
        setHighlightSlot(null);
        pointerDragging = false;
        if (chosen !== null) {
          submitSlot(chosen);
        }
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    });

    const trackItems = [];
    trackItems.push(
      makeDropZone(0, `Earlier than ${timeline[0]?.formattedYear ?? ''}`),
    );

    for (let i = 0; i < timeline.length; i += 1) {
      const ev = timeline[i];
      trackItems.push(
        el('div', { class: 'timeline-node' }, [
          el('div', { class: 'timeline-node-marker' }, [
            el('span', { class: 'timeline-year-badge', text: ev.formattedYear }),
          ]),
          el('div', { class: 'timeline-placed-card' }, [
            el('div', { class: 'timeline-placed-info' }, [
              el('strong', { text: ev.title }),
              el('span', { class: 'muted small', text: ev.category }),
            ]),
          ]),
        ]),
      );

      if (i < timeline.length - 1) {
        trackItems.push(
          makeDropZone(
            i + 1,
            `${ev.formattedYear} — ${timeline[i + 1].formattedYear}`,
          ),
        );
      } else {
        trackItems.push(
          makeDropZone(timeline.length, `Later than ${ev.formattedYear}`),
        );
      }
    }

    render(
      promptBody,
      candidateEl,
      el(
        'div',
        {
          class: 'timeline-track',
          role: 'group',
          'aria-label': 'Chronological timeline',
        },
        [
          el('div', { class: 'timeline-axis-header' }, [
            el('span', { class: 'muted small', text: '← Earliest in History' }),
            el('span', { class: 'muted small', text: `${timeline.length} ${timeline.length === 1 ? 'event' : 'events'} on timeline` }),
            el('span', { class: 'muted small', text: 'Most Recent →' }),
          ]),
          el('div', { class: 'timeline-rail' }, trackItems),
        ],
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
    capital: renderCapital,
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
      const hasPromptTimer =
        typeof activeRound.promptTimeLimitSeconds === 'number' &&
        activeRound.promptTimeLimitSeconds > 0;
      timerRail =
        activeRound.roundMode === 'timed' || hasPromptTimer
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
      } else if (hasPromptTimer) {
        timer = setInterval(() => {
          if (round.state !== 'running') {
            finish();
            return;
          }
          if (busy) return;
          const rem = round.promptRemainingMs?.() ?? 0;
          if (rem <= 0) {
            handlePromptTimeout();
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
