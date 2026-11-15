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
import { buildGitHubAuthorizeUrl, createAuthStore } from '../core/auth.js';
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
let githubClientId = null;

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

function redirectToGitHubLogin(nextTarget = '') {
  if (!githubClientId) {
    showNotice(
      'GitHub OAuth is not configured yet. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to .env (or Vercel environment variables).',
    );
    return;
  }
  const redirectUri = `${globalThis.location.origin}${globalThis.location.pathname}`;
  const githubAuthUrl = buildGitHubAuthorizeUrl({
    clientId: githubClientId,
    redirectUri,
    state: nextTarget,
  });
  globalThis.location.assign(githubAuthUrl);
}

function renderUserBadge() {
  if (!userBadgeSlot) return;
  const user = auth.getUser();
  if (!user) {
    render(
      userBadgeSlot,
      el(
        'button',
        {
          type: 'button',
          class: 'primary sign-in-top-btn',
          onClick: () => redirectToGitHubLogin(),
        },
        [
          el('span', {
            html: `<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>`,
          }),
          el('span', { text: 'Sign in with GitHub' }),
        ],
      ),
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
            goHome();
          });
        },
      }),
    ]),
  );
}

function requireAuth(action, nextTarget = '') {
  if (!auth.isAuthenticated()) {
    redirectToGitHubLogin(nextTarget);
    return;
  }
  action();
}

function goHome() {
  show(
    categoriesView({
      today: clock.today(),
      categories: CATEGORIES,
      registry,
      progress,
      user: auth.getUser(),
      onCategory: goCategory,
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
  }, `category:${categoryId}`);
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
  }, `trainer:${trainerId}`);
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
  }, `trainer:${trainerId}`);
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
  }, 'leaderboard');
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
  }, `trainer:${trainerId}`);
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
  }, 'archive');
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
  }, 'progress');
}

// --- rounds -----------------------------------------------------------------

function startRound({ trainer, variantKey, puzzleDate, practice = false, filters = null }) {
  if (!auth.isAuthenticated()) {
    redirectToGitHubLogin(`trainer:${trainer.id}`);
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
    const [countries, outlines, people, portraits, oauthConfig] = await Promise.all([
      fetch(new URL('../trainers/geography/countries.json', import.meta.url)).then((r) => r.json()),
      fetch(new URL('../trainers/geography/outlines.json', import.meta.url)).then((r) => r.json()),
      fetch(new URL('../trainers/people/people.json', import.meta.url)).then((r) => r.json()),
      fetch(new URL('../trainers/people/portraits.json', import.meta.url))
        .then((r) => r.json())
        .catch(() => null),
      fetch('/api/github-config')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]);

    githubClientId = oauthConfig?.clientId ?? null;

    registry = buildRegistry({
      countries,
      outlines,
      people,
      portraits,
      portraitBase: new URL('../trainers/people/portraits/', import.meta.url).href,
    });
    practiceFilters = storage.read(STORAGE_KEYS.practice, {});

    // Step 3: Handle GitHub OAuth redirect with ?code=<AUTH_CODE>
    const params = new URLSearchParams(globalThis.location.search);
    const oauthCode = params.get('code');
    const nextRoute = params.get('state') || params.get('next');

    if (oauthCode) {
      globalThis.history?.replaceState?.({}, '', globalThis.location.pathname);
      try {
        await auth.completeOAuthCallback(oauthCode);
      } catch (err) {
        showNotice(err.message || 'Could not complete GitHub sign-in.');
      }
    }

    setupChrome();
    watchForNewDay();

    if (nextRoute && auth.isAuthenticated()) {
      globalThis.history?.replaceState?.({}, '', globalThis.location.pathname);
      if (nextRoute === 'leaderboard') {
        goLeaderboard();
        return;
      }
      if (nextRoute === 'archive') {
        goArchive();
        return;
      }
      if (nextRoute === 'progress') {
        goProgress();
        return;
      }
      if (nextRoute.startsWith('trainer:')) {
        const trainerId = nextRoute.slice('trainer:'.length);
        goTrainer(trainerId);
        return;
      }
      if (nextRoute.startsWith('category:')) {
        const categoryId = nextRoute.slice('category:'.length);
        goCategory(categoryId);
        return;
      }
    }

    goHome();
  } catch (error) {
    console.error('[app] Failed to start', error);
    render(main);
    showNotice('LearningHub could not load its content. Try reloading the page.');
  }
}

boot();
