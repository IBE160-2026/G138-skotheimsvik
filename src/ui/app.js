/**
 * Application controller.
 *
 * Registers the trainers, owns routing and holds the only mutable UI state.
 * Note that nothing in src/core/ imports this file — the dependency runs one
 * way, which is what lets a new trainer be added without engine changes (FR-11).
 */

import { createClock } from '../core/clock.js';
import { createStorage, STORAGE_KEYS } from '../core/storage.js';
import { createProgressStore } from '../core/progress.js';
import { createRegistry } from '../core/registry.js';
import { createRound } from '../core/round.js';
import { difficultyForDate } from '../core/difficulty.js';
import { listArchive, isValidPuzzleDate } from '../core/archive.js';

import { mentalMathTrainer } from '../trainers/mental-math/index.js';
import { memoryTrainer } from '../trainers/memory/index.js';
import { createGeographyTrainer } from '../trainers/geography/index.js';

import { render } from './dom.js';
import { homeView, briefingView, resultsView, archiveView, progressView } from './views.js';
import { createRoundView } from './round-view.js';

const main = document.getElementById('main');
const noticeBox = document.getElementById('notice');
const liveRegion = document.getElementById('live-region');

const clock = createClock();
const storage = createStorage();
const progress = createProgressStore({ storage });
const registry = createRegistry();

let roundView = null;
let activeRound = null;
let lastDate = clock.today();

/** Push a message into the ARIA live region (FR-124). */
function announce(message) {
  liveRegion.textContent = '';
  // A microtask gap makes repeated identical messages announce again.
  setTimeout(() => void (liveRegion.textContent = message), 30);
}

function showNotice(message) {
  noticeBox.textContent = message;
  noticeBox.hidden = false;
}

function flushStorageWarnings() {
  const warnings = storage.warnings();
  if (warnings.length > 0) {
    showNotice(warnings.join(' '));
    storage.clearWarnings();
  } else if (!storage.available) {
    showNotice('Your browser is blocking storage, so progress will not be saved and the daily limit will not apply.');
  }
}

/* ------------------------------------------------------------ registration */

async function registerTrainers() {
  registry.register(mentalMathTrainer);
  registry.register(memoryTrainer);

  // Geography is content-driven, so it is loaded before registration (FR-110).
  try {
    const response = await fetch(new URL('../trainers/geography/countries.json', import.meta.url));
    const content = await response.json();
    registry.register(createGeographyTrainer(content));
  } catch (error) {
    // A content failure must not take the rest of the app down (NFR-7).
    console.warn('[geography] Content could not be loaded.', error);
    registry.register({
      ...createGeographyTrainer({ countries: [] }),
      available: false,
    });
  }
}

/* ----------------------------------------------------------------- routing */

function leaveRound() {
  if (roundView) {
    roundView.destroy();
    roundView = null;
  }
  activeRound = null;
}

const routes = {
  home() {
    const today = clock.today();
    return homeView({
      today,
      difficulty: difficultyForDate(today),
      trainers: registry.list(),
      progress,
      onSelect: (trainerId) => go('briefing', { trainerId, puzzleDate: today }),
      onArchive: () => go('archive'),
    });
  },

  briefing({ trainerId, puzzleDate }) {
    const trainer = registry.get(trainerId);
    const today = clock.today();

    // Guard against a stale link to an already-played or invalid date (FR-41).
    if (!trainer || !isValidPuzzleDate(puzzleDate, today) || progress.hasAttempt(trainerId, puzzleDate)) {
      return routes.home();
    }

    return briefingView({
      trainer,
      puzzleDate,
      difficulty: difficultyForDate(puzzleDate),
      isArchive: puzzleDate !== today,
      onStart: () => go('round', { trainerId, puzzleDate }),
      onBack: () => go('home'),
    });
  },

  archive() {
    return archiveView({
      entries: listArchive({ today: clock.today(), trainers: registry.list(), progress }),
      onPlay: (trainerId, puzzleDate) => go('briefing', { trainerId, puzzleDate }),
    });
  },

  progress() {
    return progressView({ trainers: registry.list(), progress });
  },

  results({ result, comparison }) {
    return resultsView({
      result,
      trainer: registry.get(result.trainerId),
      comparison,
      onHome: () => go('home'),
      onArchive: () => go('archive'),
      onProgress: () => go('progress'),
    });
  },
};

/**
 * Navigate. Every route swaps the view in place, with no page reload (FR-7).
 * @param {string} name
 * @param {object} [params]
 */
function go(name, params = {}) {
  leaveRound();

  if (name === 'round') {
    startRound(params);
    return;
  }

  const view = routes[name]?.(params) ?? routes.home();
  render(main, view);
  main.focus();
  flushStorageWarnings();
}

/* ------------------------------------------------------------------- round */

function startRound({ trainerId, puzzleDate }) {
  const trainer = registry.get(trainerId);
  const difficulty = difficultyForDate(puzzleDate);

  activeRound = createRound({
    trainer,
    puzzleDate,
    difficulty,
    generator: trainer.createGenerator({ puzzleDate, difficulty }),
    clock,
    modeParam: trainer.modeParam(difficulty),
  });

  roundView = createRoundView({
    container: main,
    announce,
    onAbandon: () => go('home'),
    onFinish: (result) => {
      // Memory scores by level reached, which is its correct-answer count.
      const comparison = progress.recordResult(result);
      leaveRound();
      go('results', { result, comparison });
    },
  });

  roundView.start(activeRound, trainer);
  main.focus();
}

/* ------------------------------------------------------------------- chrome */

function applyTheme(theme) {
  const resolved =
    theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : theme;

  document.documentElement.dataset.theme = resolved;
  document.getElementById('theme-icon').textContent = resolved === 'light' ? '☀️' : '🌙';
  storage.write(STORAGE_KEYS.settings, { theme });
}

function initTheme() {
  // Defaults to the OS preference on a first visit (FR-118).
  const settings = storage.read(STORAGE_KEYS.settings, { theme: 'system' });
  applyTheme(settings.theme ?? 'system');

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    applyTheme(current === 'light' ? 'dark' : 'light');
  });
}

function initNav() {
  for (const button of document.querySelectorAll('[data-route]')) {
    button.addEventListener('click', () => go(button.dataset.route));
  }

  document.getElementById('clear-progress').addEventListener('click', () => {
    if (!window.confirm('Clear all progress, results and personal bests? This cannot be undone.')) return;
    progress.clearAll();
    showNotice('All progress has been cleared.');
    go('home');
  });
}

/**
 * Release the day's attempts when the local date rolls over, without a reload
 * (FR-38). Checked on a timer and whenever the tab regains focus.
 */
function watchForDateChange() {
  const check = () => {
    const today = clock.today();
    if (today === lastDate) return;
    lastDate = today;
    if (!activeRound) {
      announce('A new day has started. Today\'s puzzles are available.');
      go('home');
    }
  };

  setInterval(check, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
}

/* -------------------------------------------------------------------- boot */

async function boot() {
  initTheme();
  initNav();
  watchForDateChange();

  await registerTrainers();
  go('home');
}

// A failure during boot must still leave a readable page (NFR-7).
boot().catch((error) => {
  console.error('[learninghub] Failed to start.', error);
  main.textContent = 'LearningHub failed to start. Please reload the page.';
});
