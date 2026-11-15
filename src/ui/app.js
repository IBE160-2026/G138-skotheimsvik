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
import { createAuthStore } from '../core/auth.js';
import { createLeaderboardStore } from '../core/leaderboard.js';
import { createRound } from '../core/round.js';
import { listArchive, isValidPuzzleDate } from '../core/archive.js';
import { variantsFor } from '../core/variants.js';
import { buildRegistry, CATEGORIES } from '../trainers/index.js';
import { el, render } from './dom.js';
import { createRoundView } from './round-view.js';
import {
  archiveView,
  briefingView,
  categoriesView,
  categoryView,
  leaderboardView,
  loginGateView,
  practiceView,
  progressView,
  resultsView,
  trainerView,
} from './views.js';

const main = document.querySelector('#main');
const notice = document.querySelector('#notice');
const liveRegion = document.querySelector('#live-region');
const userBadgeSlot = document.querySelector('#user-badge-slot');

const clock = createClock();
const storage = createStorage();
const progress = createProgressStore({ storage });
const auth = createAuthStore({ storage });
const leaderboard = createLeaderboardStore({ storage });

let registry = null;
let roundView = null;
let activeRound = null;
let activeTrainer = null;
let progressSelection = { trainerId: null, variantKey: null };
let leaderboardState = { tab: 'daily', selectedDate: null };
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

function renderUserBadge() {
  if (!userBadgeSlot) return;
  const user = auth.getUser();
  if (!user) {
    render(
      userBadgeSlot,
      el('button', {
        type: 'button',
        class: 'user-pill user-pill-guest',
        text: 'Sign in with GitHub',
        onClick: () => guardNavigation(() => goLogin()),
      }),
    );
    return;
  }

  render(
    userBadgeSlot,
    el('div', { class: 'user-pill' }, [
      el('img', {
        class: 'user-pill-avatar',
        src: user.avatarUrl,
        alt: `${user.login} GitHub avatar`,
      }),
      el('span', { class: 'user-pill-handle', text: `@${user.login}` }),
      el('button', {
        type: 'button',
        class: 'user-pill-logout',
        title: 'Sign out of GitHub',
        'aria-label': 'Sign out of GitHub',
        text: '×',
        onClick: () => {
          guardNavigation(() => {
            auth.logout();
            renderUserBadge();
            goLogin();
          });
        },
      }),
    ]),
  );
}

function goLogin(error = null, loading = false) {
  show(
    loginGateView({
      error,
      loading,
      onLogin: async (username) => {
        goLogin(null, true);
        try {
          await auth.loginWithGitHub(username);
          renderUserBadge();
          goHome();
        } catch (err) {
          goLogin(err.message || 'Could not sign in with GitHub.', false);
        }
      },
    }),
  );
}

function requireAuth(action) {
  if (!auth.isAuthenticated()) {
    goLogin();
    return;
  }
  action();
}

function goHome() {
  if (!auth.isAuthenticated()) {
    goLogin();
    return;
  }
  show(
    categoriesView({
      today: clock.today(),
      categories: CATEGORIES,
      registry,
      progress,
      user: auth.getUser(),
      onCategory: goCategory,
      onQuickWordRush: () => goBriefing('word-rush', 'daily', clock.today()),
      onLeaderboard: () => goLeaderboard(),
    }),
  );
}

function goCategory(categoryId) {
  requireAuth(() => {
    if (categoryId === 'word-rush') {
      goTrainer('word-rush');
      return;
    }
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
  });
}

function goTrainer(trainerId) {
  requireAuth(() => {
    const trainer = registry.getTrainer(trainerId);
    show(
      trainerView({
        today: clock.today(),
        trainer,
        progress,
        onPlay: (variantKey) => goBriefing(trainerId, variantKey, clock.today()),
        onPractice: () => goPractice(trainerId),
        onBack: () => (trainer.id === 'word-rush' ? goHome() : goCategory(trainer.categoryId)),
      }),
    );
  });
}

function goBriefing(trainerId, variantKey, puzzleDate) {
  requireAuth(() => {
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
  });
}

function goLeaderboard(nextState = {}) {
  requireAuth(() => {
    leaderboardState = {
      tab: nextState.tab ?? leaderboardState.tab ?? 'daily',
      selectedDate: nextState.selectedDate ?? leaderboardState.selectedDate ?? clock.today(),
    };
    const wordRushTrainer = registry.listTrainers().find((t) => t.id === 'word-rush');
    show(
      leaderboardView({
        today: clock.today(),
        selectedDate: leaderboardState.selectedDate,
        tab: leaderboardState.tab,
        leaderboard,
        wordRushTrainer,
        currentUser: auth.getUser(),
        onSelectTab: (tab) => goLeaderboard({ tab }),
        onSelectDate: (selectedDate) => goLeaderboard({ selectedDate }),
        onPlayToday: () => goBriefing('word-rush', 'daily', clock.today()),
        onBack: goHome,
      }),
    );
  });
}

function goPractice(trainerId, error = null) {
  requireAuth(() => {
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
            variantKey: filters.boardSize ?? filters.category ?? 'expert',
            puzzleDate: clock.today(),
            practice: true,
            filters,
          });
        },
        onBack: () => goTrainer(trainerId),
      }),
    );
  });
}

function goArchive() {
  requireAuth(() => {
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
  });
}

function goProgress(selection = progressSelection) {
  requireAuth(() => {
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
  });
}

// --- rounds -----------------------------------------------------------------

function startRound({ trainer, variantKey, puzzleDate, practice = false, filters = null }) {
  if (!auth.isAuthenticated()) {
    goLogin('Sign in with GitHub to start a round.');
    return;
  }

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

  const currentUser = auth.getUser();

  // Practice never reaches the progress store at all (FR-47, FR-48).
  if (round.isPractice) {
    show(
      resultsView({
        result,
        trainer: activeTrainer,
        comparison: null,
        isPractice: true,
        leaderboard,
        currentUser,
        onBack: () => goTrainer(activeTrainer.id),
        onArchive: goArchive,
        onProgress: () => goProgress(),
        onLeaderboard: () => goLeaderboard({ selectedDate: result.puzzleDate }),
      }),
    );
    return;
  }

  const comparison = progress.recordResult(result, activeTrainer.scoreDirection);
  if (!comparison.saved) {
    showNotice('Your progress could not be saved — this browser is blocking storage.');
  }

  if (currentUser) {
    leaderboard.recordEntry({ user: currentUser, result });
  }

  show(
    resultsView({
      result,
      trainer: activeTrainer,
      comparison,
      isPractice: false,
      leaderboard,
      currentUser,
      onBack: () => goTrainer(activeTrainer.id),
      onArchive: goArchive,
      onProgress: () =>
        goProgress({ trainerId: activeTrainer.id, variantKey: result.variantKey }),
      onLeaderboard: () => goLeaderboard({ selectedDate: result.puzzleDate }),
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
  if (icon) icon.textContent = resolved === 'light' ? 'Light' : 'Dark';
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
        else if (route === 'leaderboard') goLeaderboard();
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

  renderUserBadge();
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
    const [countries, outlines, people, portraits] = await Promise.all([
      fetch(new URL('../trainers/geography/countries.json', import.meta.url)).then((r) => r.json()),
      fetch(new URL('../trainers/geography/outlines.json', import.meta.url)).then((r) => r.json()),
      fetch(new URL('../trainers/people/people.json', import.meta.url)).then((r) => r.json()),
      fetch(new URL('../trainers/people/portraits.json', import.meta.url))
        .then((r) => r.json())
        .catch(() => null),
    ]);

    registry = buildRegistry({
      countries,
      outlines,
      people,
      portraits,
      portraitBase: new URL('../trainers/people/portraits/', import.meta.url).href,
    });
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
