/**
 * Application shell: routing, wiring and the lifecycle glue.
 *
 * The only file that knows how the engine, the trainers and the screens fit
 * together. Everything it calls is pure or DOM-only, so nothing here needs to
 * be tested through a browser (NFR-15).
 */

import { createStorage, STORAGE_KEYS } from '../core/storage.js';
import { createClock } from '../core/clock.js';
import { createProgressStore } from '../core/progress.js';
import { createRound } from '../core/round.js';
import { listArchive, isValidPuzzleDate } from '../core/archive.js';
import { variantsFor } from '../core/variants.js';
import { buildRegistry, CATEGORIES } from '../trainers/index.js';
import { render } from './dom.js';
import { createRoundView } from './round-view.js';
import {
  archiveView,
  briefingView,
  categoriesView,
  categoryView,
  practiceView,
  progressView,
  resultsView,
  trainerView,
} from './views.js';

const main = document.querySelector('#main');
const notice = document.querySelector('#notice');
const liveRegion = document.querySelector('#live-region');

const clock = createClock();
const storage = createStorage();
const progress = createProgressStore({ storage });

let registry = null;
let roundView = null;
let activeRound = null;
let activeTrainer = null;
let progressSelection = { trainerId: null, variantKey: null };
let practiceFilters = {};

function announce(message) {
  if (liveRegion) liveRegion.textContent = message;
}

function showNotice(message) {
  if (!notice) return;
  notice.textContent = message;
  notice.hidden = false;
}

/** Defaults for a trainer's practice filters, remembered between visits (FR-57). */
function filtersFor(trainerId) {
  if (practiceFilters[trainerId]) return practiceFilters[trainerId];
  const trainer = registry.getTrainer(trainerId);
  const defaults = {};
  for (const [name, definition] of Object.entries(trainer.practiceFilters ?? {})) {
    defaults[name] = Array.isArray(definition.default) ? [...definition.default] : definition.default;
  }
  practiceFilters[trainerId] = defaults;
  return defaults;
}

function savePracticeFilters() {
  storage.write(STORAGE_KEYS.practice, practiceFilters);
}

// --- routing ----------------------------------------------------------------

/**
 * Navigating away mid-round must not be a free escape.
 *
 * The Leave button already asks and records the result (FR-10a), so the header
 * links have to go through the same gate — otherwise "Today" would be a way to
 * peek at a puzzle and keep the attempt.
 */
function guardNavigation(action) {
  if (!activeRound || activeRound.state !== 'running') {
    action();
    return;
  }

  if (activeRound.isPractice) {
    activeRound.abandon();
    action();
    return;
  }

  const confirmed = globalThis.confirm(
    'Leaving now ends this round and uses up this attempt. Your score so far will be recorded. Leave anyway?',
  );
  if (!confirmed) return;

  const round = activeRound;
  round.abandon();
  finishRound(round);
}

function show(node) {
  if (roundView) {
    roundView.stop();
    roundView = null;
  }
  render(main, node);
  main.focus?.();
}

function goHome() {
  show(
    categoriesView({
      today: clock.today(),
      categories: CATEGORIES,
      registry,
      progress,
      onCategory: goCategory,
    }),
  );
}

function goCategory(categoryId) {
  show(
    categoryView({
      today: clock.today(),
      category: registry.getCategory(categoryId),
      trainers: registry.trainersIn(categoryId),
      progress,
      onTrainer: goTrainer,
      onBack: goHome,
    }),
  );
}

function goTrainer(trainerId) {
  const trainer = registry.getTrainer(trainerId);
  show(
    trainerView({
      today: clock.today(),
      trainer,
      progress,
      onPlay: (variantKey) => goBriefing(trainerId, variantKey, clock.today()),
      onPractice: () => goPractice(trainerId),
      onBack: () => goCategory(trainer.categoryId),
    }),
  );
}

function goBriefing(trainerId, variantKey, puzzleDate) {
  const trainer = registry.getTrainer(trainerId);
  show(
    briefingView({
      trainer,
      variantKey,
      puzzleDate,
      isArchive: puzzleDate !== clock.today(),
      onStart: () => startRound({ trainer, variantKey, puzzleDate }),
      onBack: () => goTrainer(trainerId),
    }),
  );
}

function goPractice(trainerId, error = null) {
  const trainer = registry.getTrainer(trainerId);
  show(
    practiceView({
      trainer,
      filters: filtersFor(trainerId),
      error,
      onChange: (name, value) => {
        practiceFilters[trainerId] = { ...filtersFor(trainerId), [name]: value };
        savePracticeFilters();
        goPractice(trainerId);
      },
      onStart: () => {
        const filters = filtersFor(trainerId);
        const check = trainer.validateFilters?.(filters) ?? { ok: true };
        // A combination that can produce nothing is refused, not played (FR-56).
        if (!check.ok) {
          goPractice(trainerId, check.reason);
          return;
        }
        startRound({
          trainer,
          variantKey: filters.boardSize ?? 'expert',
          puzzleDate: clock.today(),
          practice: true,
          filters,
        });
      },
      onBack: () => goTrainer(trainerId),
    }),
  );
}

function goArchive() {
  show(
    archiveView({
      entries: listArchive({
        today: clock.today(),
        trainers: registry.listTrainers(),
        progress,
      }),
      onPlay: (trainerId, variantKey, puzzleDate) => goBriefing(trainerId, variantKey, puzzleDate),
      onBack: goHome,
    }),
  );
}

function goProgress(selection = progressSelection) {
  const trainers = registry.listTrainers();
  progressSelection = {
    trainerId: selection.trainerId ?? trainers[0].id,
    variantKey: selection.variantKey,
  };
  show(
    progressView({
      trainers,
      progress,
      selection: progressSelection,
      onSelect: goProgress,
      onBack: goHome,
    }),
  );
}

// --- rounds -----------------------------------------------------------------

function startRound({ trainer, variantKey, puzzleDate, practice = false, filters = null }) {
  // Guard against a stale link or a second tab (FR-35, FR-41).
  if (!practice) {
    if (!isValidPuzzleDate(puzzleDate, clock.today())) {
      showNotice('That puzzle date is not available.');
      goHome();
      return;
    }
    if (progress.hasAttempt(trainer.id, variantKey, puzzleDate)) {
      showNotice('You have already played that one.');
      goTrainer(trainer.id);
      return;
    }
  }

  const generator = trainer.createGenerator({ puzzleDate, variantKey, practice, filters });
  activeTrainer = trainer;
  activeRound = createRound({ trainer, variantKey, puzzleDate, generator, clock, practice });

  roundView = createRoundView({
    container: main,
    announce,
    onFinish: finishRound,
    onLeave: () => (practice ? goTrainer(trainer.id) : goHome()),
  });

  roundView.start({
    round: activeRound,
    trainer,
    hintFor: trainer.hintFor ? (guess, answer) => trainer.hintFor(guess, answer) : null,
  });
}

function finishRound(round) {
  const result = round.result();
  activeRound = null;
  if (!result) {
    goHome();
    return;
  }

  // Practice never reaches the progress store at all (FR-47, FR-48).
  if (round.isPractice) {
    show(
      resultsView({
        result,
        trainer: activeTrainer,
        comparison: null,
        isPractice: true,
        onBack: () => goTrainer(activeTrainer.id),
        onArchive: goArchive,
        onProgress: () => goProgress(),
      }),
    );
    return;
  }

  const comparison = progress.recordResult(result, activeTrainer.scoreDirection);
  if (!comparison.saved) {
    showNotice('Your progress could not be saved — this browser is blocking storage.');
  }

  show(
    resultsView({
      result,
      trainer: activeTrainer,
      comparison,
      isPractice: false,
      onBack: () => goTrainer(activeTrainer.id),
      onArchive: goArchive,
      onProgress: () =>
        goProgress({ trainerId: activeTrainer.id, variantKey: result.variantKey }),
    }),
  );
}

// --- chrome -----------------------------------------------------------------

function applyTheme(theme) {
  const resolved =
    theme === 'system'
      ? globalThis.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme;
  document.documentElement.dataset.theme = resolved;
  const icon = document.querySelector('#theme-icon');
  if (icon) icon.textContent = resolved === 'light' ? '☀' : '🌙';
}

function setupChrome() {
  const settings = storage.read(STORAGE_KEYS.settings, { theme: 'system' });
  applyTheme(settings.theme ?? 'system');

  document.querySelector('#theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme;
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    storage.write(STORAGE_KEYS.settings, { theme: next });
  });

  for (const button of document.querySelectorAll('[data-route]')) {
    button.addEventListener('click', () => {
      const route = button.dataset.route;
      guardNavigation(() => {
        if (route === 'home') goHome();
        else if (route === 'archive') goArchive();
        else if (route === 'progress') goProgress();
      });
    });
  }

  document.querySelector('#clear-progress')?.addEventListener('click', () => {
    if (!globalThis.confirm('Delete all your results and personal bests? This cannot be undone.')) {
      return;
    }
    progress.clearAll();
    showNotice('All progress cleared.');
    goHome();
  });
}

/**
 * A tab left open overnight should pick up the new day without a reload
 * (FR-38).
 */
function watchForNewDay() {
  let currentDay = clock.today();
  const check = () => {
    const today = clock.today();
    if (today === currentDay) return;
    currentDay = today;
    if (!activeRound || activeRound.state !== 'running') goHome();
  };
  setInterval(check, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) check();
  });
}

// --- boot -------------------------------------------------------------------

async function boot() {
  try {
    const [countries, outlines, people] = await Promise.all([
      fetch(new URL('../trainers/geography/countries.json', import.meta.url)).then((r) => r.json()),
      fetch(new URL('../trainers/geography/outlines.json', import.meta.url)).then((r) => r.json()),
      fetch(new URL('../trainers/people/people.json', import.meta.url)).then((r) => r.json()),
    ]);

    registry = buildRegistry({ countries, outlines, people });
    practiceFilters = storage.read(STORAGE_KEYS.practice, {});

    setupChrome();
    watchForNewDay();
    goHome();
  } catch (error) {
    console.error('[app] Failed to start', error);
    render(main);
    showNotice('LearningHub could not load its content. Try reloading the page.');
  }
}

boot();
