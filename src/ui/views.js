/**
 * The static views: home, briefing, results, archive and progress.
 *
 * These read from core modules and return DOM nodes. They hold no state of
 * their own — the app controller owns that.
 */

import { el, stat, bandBadge, formatDuration, formatDate } from './dom.js';
import { bandLabel } from '../core/difficulty.js';
import { analyseWeakAreas } from '../core/weak-areas.js';
import { lineChart, chartLegend } from './chart.js';

/* --------------------------------------------------------------------- home */

export function homeView({ today, difficulty, trainers, progress, onSelect, onArchive }) {
  const cards = trainers.map((trainer) => {
    const played = progress.hasAttempt(trainer.id, today);
    const best = progress.forTrainer(trainer.id).personalBest;
    const attempt = progress.forTrainer(trainer.id).attempts[today];

    return el('article', { class: 'card' }, [
      el('h3', { text: trainer.name }),
      el('p', { text: trainer.description }),
      el('div', { class: 'badge-row' }, [
        el('span', { class: 'badge', text: trainer.describeMode(difficulty) }),
        best > 0 ? el('span', { class: 'badge', text: `Best: ${best}` }) : null,
        played ? el('span', { class: 'badge badge-done', text: `✓ Done today — ${attempt.score}` }) : null,
      ]),
      el('div', { class: 'card-footer' }, [
        trainer.available === false
          ? el('span', { class: 'badge', text: 'Unavailable — content failed to load' })
          : el('button', {
              type: 'button',
              class: played ? '' : 'button-primary',
              disabled: played,
              onclick: () => onSelect(trainer.id),
              text: played ? 'Come back tomorrow' : 'Play today',
            }),
      ]),
    ]);
  });

  const allPlayed = trainers.every((trainer) => progress.hasAttempt(trainer.id, today));

  return el('div', {}, [
    el('h1', { class: 'page-title', text: "Today's puzzles" }),
    el('p', { class: 'page-intro' }, [
      `${formatDate(today)} — everyone plays the same puzzle today. `,
      'Difficulty: ',
      bandBadge(difficulty, bandLabel(difficulty)),
    ]),
    el('div', { class: 'card-grid' }, cards),
    allPlayed
      ? el('div', { class: 'section' }, [
          el('p', { text: 'All done for today. Previous days are waiting in the archive.' }),
          el('button', { type: 'button', class: 'button-primary', onclick: onArchive, text: 'Open the archive' }),
        ])
      : null,
  ]);
}

/* ----------------------------------------------------------------- briefing */

export function briefingView({ trainer, puzzleDate, difficulty, isArchive, onStart, onBack }) {
  return el('div', {}, [
    el('h1', { class: 'page-title', text: trainer.name }),
    el('p', { class: 'page-intro', text: trainer.description }),

    el('div', { class: 'card' }, [
      el('div', { class: 'result-grid' }, [
        stat('Date', formatDate(puzzleDate)),
        stat('Difficulty', bandLabel(difficulty)),
        stat('Round ends', trainer.roundMode === 'timed' ? 'On the clock' : 'Out of lives'),
      ]),
      el('p', { text: `${bandLabel(difficulty)} — ${trainer.describeMode(difficulty)}` }),
      isArchive ? el('p', { text: 'This is an archive puzzle. The result is recorded against its own date.' }) : null,
      el('p', { class: 'prompt-hint', text: 'You get one attempt. Quitting early costs nothing.' }),
    ]),

    // Only start or back — no difficulty or duration control (FR-4).
    el('div', { class: 'actions' }, [
      el('button', { type: 'button', class: 'button-primary', onclick: onStart, text: 'Start' }),
      el('button', { type: 'button', onclick: onBack, text: 'Back' }),
    ]),
  ]);
}

/* ------------------------------------------------------------------ results */

const END_REASONS = {
  'time-expired': 'Time ran out.',
  'lives-exhausted': 'You ran out of lives.',
  'prompts-exhausted': 'The questions ran out.',
};

export function resultsView({ result, trainer, comparison, onHome, onArchive, onProgress }) {
  const weak = trainer.supportsCategories ? analyseWeakAreas(result.categoryStats) : null;

  return el('div', {}, [
    el('h1', { class: 'page-title', text: `${trainer.name} — ${result.score}` }),
    el('p', { class: 'page-intro' }, [
      `${END_REASONS[result.endedBy] ?? 'Round over.'} `,
      formatDate(result.puzzleDate), ' · ',
      bandBadge(result.difficulty, bandLabel(result.difficulty)),
    ]),

    el('div', { class: 'card' }, [
      el('div', { class: 'result-grid' }, [
        stat(trainer.scoreLabel, result.score),
        stat('Correct', `${result.correctCount} of ${result.totalAnswered}`),
        stat('Accuracy', `${result.accuracy}%`),
        stat('Avg time', `${(result.avgAnswerTimeMs / 1000).toFixed(1)}s`),
        stat('Best streak', result.bestStreak),
        stat('Duration', formatDuration(result.elapsedMs)),
      ]),
    ]),

    el('div', { class: 'comparison-list' }, [
      el('div', { class: `comparison comparison-${comparison.vsPrevious.status}` }, [
        el('strong', { text: 'Against your previous attempt: ' }),
        el('span', { text: comparison.vsPrevious.message }),
      ]),
      el('div', { class: `comparison comparison-${comparison.vsBest.status}` }, [
        el('strong', { text: 'Against your best: ' }),
        el('span', { text: comparison.vsBest.message }),
      ]),
    ]),

    weak
      ? el('div', { class: 'section' }, [
          el('h2', { text: 'Weak areas' }),
          el('p', { text: weak.message }),
          weak.categories.length > 0 ? categoryTable(weak.categories) : null,
        ])
      : null,

    !comparison.saved
      ? el('p', { class: 'notice', text: 'This result could not be saved — your browser is blocking storage.' })
      : null,

    // No replay of the same puzzle is offered (FR-69).
    el('div', { class: 'actions' }, [
      el('button', { type: 'button', class: 'button-primary', onclick: onHome, text: 'Back to today' }),
      el('button', { type: 'button', onclick: onArchive, text: 'Play an archive puzzle' }),
      el('button', { type: 'button', onclick: onProgress, text: 'See your progress' }),
    ]),
  ]);
}

function categoryTable(categories) {
  return el('table', {}, [
    el('thead', {}, el('tr', {}, [
      el('th', { text: 'Category' }),
      el('th', { text: 'Correct' }),
      el('th', { text: 'Hit rate' }),
    ])),
    el('tbody', {}, categories
      .slice()
      .sort((a, b) => a.hitRate - b.hitRate)
      .map((entry) => el('tr', {}, [
        el('td', { text: entry.label }),
        el('td', { text: `${entry.correct} of ${entry.asked}` }),
        el('td', { text: `${entry.hitRate}%` }),
      ]))),
  ]);
}

/* ------------------------------------------------------------------ archive */

export function archiveView({ entries, onPlay }) {
  if (entries.length === 0) {
    return el('div', {}, [
      el('h1', { class: 'page-title', text: 'Archive' }),
      el('p', { class: 'empty-state', text: 'No previous puzzles yet — today is the first day.' }),
    ]);
  }

  const rows = entries.map((entry) =>
    el('tr', {}, [
      el('td', {}, [
        el('div', { text: formatDate(entry.puzzleDate) }),
        bandBadge(entry.difficulty, bandLabel(entry.difficulty)),
      ]),
      ...entry.trainers.map((trainerState) =>
        el('td', {}, [
          trainerState.played
            ? el('span', { class: 'badge badge-done', text: `✓ ${trainerState.score}` })
            : el('button', {
                type: 'button',
                onclick: () => onPlay(trainerState.trainerId, entry.puzzleDate),
                text: 'Play',
              }),
        ]),
      ),
    ]),
  );

  return el('div', {}, [
    el('h1', { class: 'page-title', text: 'Archive' }),
    el('p', { class: 'page-intro', text: 'Any day you have not played yet is still open. Results count exactly like today\'s.' }),
    el('table', {}, [
      el('thead', {}, el('tr', {}, [
        el('th', { text: 'Date' }),
        ...entries[0].trainers.map((t) => el('th', { text: t.name })),
      ])),
      el('tbody', {}, rows),
    ]),
  ]);
}

/* ----------------------------------------------------------------- progress */

export function progressView({ trainers, progress }) {
  const sections = trainers.map((trainer) => {
    const history = progress.history(trainer.id);
    const summary = progress.summaryFor(trainer.id);

    if (history.length === 0) {
      return el('section', { class: 'section' }, [
        el('h2', { text: trainer.name }),
        // An explanatory empty state, not a blank chart (FR-74).
        el('p', { class: 'empty-state', text: 'No puzzles played yet. Play a round and your history will appear here.' }),
      ]);
    }

    const scorePoints = history.map((entry) => ({
      puzzleDate: entry.puzzleDate, value: entry.score, difficulty: entry.difficulty,
    }));
    const accuracyPoints = history.map((entry) => ({
      puzzleDate: entry.puzzleDate, value: entry.accuracy, difficulty: entry.difficulty,
    }));

    const weak = trainer.supportsCategories
      ? analyseWeakAreas(history.flatMap((entry) => entry.categoryStats ?? []))
      : null;

    return el('section', { class: 'section' }, [
      el('h2', { text: trainer.name }),
      el('div', { class: 'result-grid' }, [
        stat('Puzzles', summary.puzzlesCompleted),
        stat('Best', summary.personalBest),
        stat('Time practised', formatDuration(summary.totalTimeMs)),
      ]),
      el('h3', { text: trainer.scoreLabel }),
      lineChart({ points: scorePoints, label: `${trainer.name} score` }),
      el('h3', { text: 'Accuracy' }),
      lineChart({ points: accuracyPoints, label: `${trainer.name} accuracy`, suffix: '%' }),
      chartLegend(),
      weak && weak.categories.length > 0
        ? el('div', { class: 'section' }, [
            el('h3', { text: 'Across your whole history' }),
            el('p', { text: weak.message }),
            categoryTable(weak.categories),
          ])
        : null,
    ]);
  });

  return el('div', {}, [
    el('h1', { class: 'page-title', text: 'Your progress' }),
    el('p', { class: 'page-intro', text: 'Each point is one puzzle, placed on the date it belongs to. The colour shows how hard that day was.' }),
    ...sections,
  ]);
}
