/**
 * Screen builders.
 *
 * Every function here returns DOM and takes callbacks; none of them touch the
 * engine or storage directly, which keeps the routing in app.js the only place
 * that knows how the pieces fit together.
 *
 * Covers FR-1 to FR-8, FR-39, FR-51 to FR-57, FR-77 to FR-91.
 */

import { el, render, stat, formatDate, formatDuration } from './dom.js';
import { lineChart, chartLegend } from './chart.js';
import { variantLabel, variantsFor, describeRound, VARIANT_AXIS_LABEL } from '../core/variants.js';
import { analyseWeakAreas, aggregateTopics } from '../core/weak-areas.js';

const ROUND_MODE_LABEL = {
  timed: 'Against the clock',
  lives: 'Until you run out of lives',
  completion: 'Until the board is clear',
};

const END_REASON_LABEL = {
  'time-expired': 'Time ran out',
  'lives-exhausted': 'You ran out of lives',
  'board-complete': 'You cleared the board',
  'prompts-exhausted': 'You ran out of questions',
  abandoned: 'You left the round early',
};

const CATEGORY_LOGO_SVG = {
  'word-rush': `<svg viewBox="0 0 36 36" width="28" height="28" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="32" height="32" rx="8" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2"/>
    <path d="M19.5 7L10 20h7.5l-1 9L26 16h-7.5l1-9z" fill="currentColor"/>
  </svg>`,
  math: `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <path d="M9 12h18M9 24h18M14 7l-3 22M25 7l-3 22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,
  memory: `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <rect x="6" y="6" width="10" height="10" rx="2.5" fill="currentColor"/>
    <rect x="20" y="6" width="10" height="10" rx="2.5" stroke="currentColor" stroke-width="2"/>
    <rect x="6" y="20" width="10" height="10" rx="2.5" stroke="currentColor" stroke-width="2"/>
    <rect x="20" y="20" width="10" height="10" rx="2.5" fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="2"/>
  </svg>`,
  geography: `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <circle cx="18" cy="18" r="12" stroke="currentColor" stroke-width="2"/>
    <ellipse cx="18" cy="18" rx="5.5" ry="12" stroke="currentColor" stroke-width="1.8"/>
    <path d="M6.5 14.5h23M6.5 21.5h23" stroke="currentColor" stroke-width="1.8"/>
  </svg>`,
  people: `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <circle cx="18" cy="13" r="5" stroke="currentColor" stroke-width="2"/>
    <path d="M8.5 29c1.8-4.6 5.1-7 9.5-7s7.7 2.4 9.5 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
};

export function wordRushLogoMark(size = 36) {
  return el('span', {
    class: 'word-rush-logo',
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 40 40" width="${size}" height="${size}" fill="none">
      <rect x="2" y="2" width="36" height="36" rx="9" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2.2"/>
      <path d="M22 7L11 21.5h8.2L17.8 33 29 18.5h-8.2L22 7Z" fill="currentColor"/>
    </svg>`,
  });
}

/** A trainer may name its own variants; otherwise fall back to the generic label. */
function labelFor(trainer, key) {
  return trainer.variantLabels?.[key] ?? variantLabel(trainer.variantKind, key);
}

/** A thin progress rail showing how much of something is done. */
function meter(done, total) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return el('div', { class: `meter${percent === 100 ? ' meter-done' : ''}` }, [
    el('span', { class: 'meter-fill', style: `width: ${percent}%;` }),
  ]);
}

/** Top-right GitHub sign-in popover anchored in the header. */
export function loginPopoverView({ onLogin, onClose, error, loading }) {
  const input = el('input', {
    class: 'answer-input github-login-input',
    type: 'text',
    placeholder: 'username',
    autocomplete: 'username',
    autocapitalize: 'off',
    spellcheck: 'false',
    'aria-label': 'GitHub username',
  });

  const form = el(
    'form',
    {
      class: 'github-login-form',
      onSubmit: (e) => {
        e.preventDefault();
        if (loading) return;
        onLogin(input.value);
      },
    },
    [
      el('div', { class: 'github-input-group' }, [
        el('span', { class: 'github-prefix', text: 'github.com/' }),
        input,
      ]),
      el(
        'button',
        {
          type: 'submit',
          class: 'primary github-submit-btn',
          disabled: loading ? 'disabled' : null,
        },
        [
          el('span', {
            html: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.05 11.05 0 0 1 5.78 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z"/></svg>`,
          }),
          el('span', { text: loading ? 'Signing in...' : 'Sign in with GitHub' }),
        ],
      ),
    ],
  );

  queueMicrotask(() => input.focus());

  return el('div', { class: 'auth-popover', role: 'dialog', 'aria-label': 'Sign in with GitHub' }, [
    el('div', { class: 'auth-popover-header' }, [
      el('strong', { text: 'Sign in with GitHub' }),
      onClose
        ? el('button', {
            type: 'button',
            class: 'auth-popover-close',
            'aria-label': 'Close sign in',
            text: '×',
            onClick: onClose,
          })
        : null,
    ]),
    el('p', {
      class: 'muted small auth-popover-desc',
      text: 'Sign in with your GitHub account to play.',
    }),
    form,
    error ? el('p', { class: 'warning auth-error', text: error }) : null,
  ]);
}

/** Home: the categories and what is left in each today, plus the Daily Word Rush Spotlight (FR-1). */
export function categoriesView({
  today,
  categories,
  registry,
  progress,
  user,
  onCategory,
}) {
  let allTotal = 0;
  let allSpent = 0;

  const cards = categories.map((category) => {
    const isWordRush = category.id === 'word-rush';
    const trainers = registry.trainersIn(category.id);
    const total = trainers.reduce((sum, trainer) => sum + variantsFor(trainer).length, 0);
    const spent = trainers.reduce(
      (sum, trainer) => sum + progress.spentVariants(trainer.id, today).length,
      0,
    );
    if (!isWordRush) {
      allTotal += total;
      allSpent += spent;
    }

    return el(
      'article',
      {
        class: `card category-card${isWordRush ? ' category-card-word-rush' : ''}`,
      },
      [
        el('div', { class: 'category-card-top' }, [
          el('div', {
            class: 'category-icon',
            'aria-hidden': 'true',
            html: CATEGORY_LOGO_SVG[category.id] ?? category.icon,
          }),
          !isWordRush
            ? el('span', {
                class: 'remaining-pill',
                text: spent === total ? 'Completed' : `${total - spent} / ${total} open`,
              })
            : null,
        ]),
        el('h2', { text: category.name }),
        el('p', { class: 'muted', text: category.tagline }),
        !isWordRush ? meter(spent, total) : null,
        el('button', {
          type: 'button',
          class: 'primary',
          text: `Open ${category.name}`,
          onClick: () => onCategory(category.id),
        }),
      ],
    );
  });

  return el('section', {}, [
    el('div', { class: 'hero' }, [
      el('div', { class: 'hero-text' }, [
        el('h1', { text: 'Daily Drills' }),
        el('p', { class: 'muted' }, [
          `${formatDate(today)} — same daily puzzle seed for everyone.`,
        ]),
      ]),
      el('div', { class: 'hero-meter' }, [
        el('p', {
          class: 'hero-count',
          text: `${allTotal - allSpent} of ${allTotal} left today`,
        }),
        meter(allSpent, allTotal),
      ]),
    ]),

    el('div', { class: 'grid' }, cards),
  ]);
}

/** One category's trainers (FR-2). */
export function categoryView({ today, category, trainers, progress, onTrainer, onBack }) {
  return el('section', {}, [
    el('button', { type: 'button', class: 'ghost back', text: '← All categories', onClick: onBack }),
    el('h1', { text: category.name }),
    el('p', { class: 'muted', text: category.tagline }),
    el(
      'div',
      { class: 'grid' },
      trainers.map((trainer) => {
        const isWordRush = trainer.id === 'word-rush';
        const variants = variantsFor(trainer);
        const spent = progress.spentVariants(trainer.id, today);
        return el('article', { class: 'card' }, [
          el('h2', { text: trainer.name }),
          el('p', { class: 'muted', text: trainer.description }),
          !isWordRush
            ? el('p', { class: 'mode-label', text: ROUND_MODE_LABEL[trainer.roundMode] })
            : null,
          !isWordRush
            ? el('p', {
                class: 'remaining',
                text:
                  spent.length === variants.length
                    ? 'All done today'
                    : `${variants.length - spent.length} of ${variants.length} left today`,
              })
            : null,
          !isWordRush ? meter(spent.length, variants.length) : null,
          el('button', {
            type: 'button',
            class: 'primary',
            text: isWordRush ? 'Open Word Rush' : 'Choose level',
            onClick: () => onTrainer(trainer.id),
          }),
        ]);
      }),
    ),
  ]);
}

/** A trainer's variants, marking what has already been spent (FR-3). */
export function trainerView({ today, trainer, progress, onPlay, onPractice, onBack }) {
  const spent = new Set(progress.spentVariants(trainer.id, today));
  const axisLabel = VARIANT_AXIS_LABEL[trainer.variantKind] ?? 'Level';

  const options = variantsFor(trainer).map((key) => {
    const played = spent.has(key);
    const best = progress.personalBest(trainer.id, key);
    return el('article', { class: `card variant-card${played ? ' variant-done' : ''}` }, [
      trainer.variantKind === 'band'
        ? el('span', { class: `band-stripe band-${key}`, 'aria-hidden': 'true' })
        : null,
      el('h3', { text: labelFor(trainer, key) }),
      el('p', { class: 'muted', text: describeRound(trainer, key) }),
      el('p', {
        class: 'muted small',
        text: best === null ? 'No personal best yet' : `Best: ${best}`,
      }),
      played
        ? el('p', { class: 'done-label', text: '✓ Played today' })
        : el('button', {
            type: 'button',
            class: 'primary',
            text: 'Play',
            onClick: () => onPlay(key),
          }),
    ]);
  });

  return el('section', {}, [
    el('button', { type: 'button', class: 'ghost back', text: '← Back', onClick: onBack }),
    el('h1', { text: trainer.name }),
    el('p', { class: 'muted', text: trainer.description }),
    el('h2', { class: 'section-label', text: axisLabel }),
    el('div', { class: 'grid' }, options),
    el('div', { class: 'row-actions' }, [
      el('button', {
        type: 'button',
        class: 'ghost',
        text: 'Practice freely (unscored)',
        onClick: onPractice,
      }),
    ]),
  ]);
}

/** Pre-round briefing: no controls, and a warning that starting commits (FR-4, FR-5, FR-10d). */
export function briefingView({ trainer, variantKey, puzzleDate, isArchive, onStart, onBack }) {
  const wordRushChallenge =
    trainer.id === 'word-rush' && trainer.getChallenge
      ? trainer.getChallenge(puzzleDate, variantKey)
      : null;

  return el('section', { class: 'briefing' }, [
    el('button', { type: 'button', class: 'ghost back', text: '← Back', onClick: onBack }),
    el('div', { class: 'trainer-heading-row' }, [
      trainer.id === 'word-rush' ? wordRushLogoMark(42) : null,
      el('h1', { text: trainer.name }),
    ]),
    el('p', { class: 'muted', text: trainer.description }),
    wordRushChallenge
      ? el('div', { class: 'word-rush-brief-card' }, [
          el('div', { class: 'word-rush-letter-badge' }, [
            el('span', { class: 'word-rush-letter-caption', text: 'Letter' }),
            el('strong', { class: 'word-rush-letter', text: wordRushChallenge.letter }),
          ]),
          el('div', { class: 'word-rush-meta' }, [
            el('span', { class: 'badge', text: wordRushChallenge.categoryGroup }),
            el('p', { class: 'word-rush-category-line' }, [
              el('strong', { text: wordRushChallenge.categoryLabel }),
            ]),
          ]),
        ])
      : null,
    el('div', { class: 'brief-stats' }, [
      stat('Date', formatDate(puzzleDate)),
      stat(VARIANT_AXIS_LABEL[trainer.variantKind] ?? 'Level', labelFor(trainer, variantKey)),
      stat('Round ends', ROUND_MODE_LABEL[trainer.roundMode]),
    ]),
    el('p', { class: 'brief-mode', text: describeRound(trainer, variantKey) }),
    el('p', { class: 'warning' }, [
      'Starting spends this attempt. If you leave early the round still counts, with whatever you scored.',
    ]),
    isArchive ? el('p', { class: 'muted', text: 'Playing from the archive.' }) : null,
    el('div', { class: 'row-actions' }, [
      el('button', { type: 'button', class: 'primary', text: 'Start Round', onClick: onStart }),
      el('button', { type: 'button', class: 'ghost', text: 'Back', onClick: onBack }),
    ]),
  ]);
}

/** Practice setup: the only place filters live (FR-51 to FR-57). */
export function practiceView({ trainer, filters, onChange, onStart, onBack, error }) {
  const definitions = trainer.practiceFilters ?? {};

  const controls = Object.entries(definitions).map(([name, definition]) => {
    const current = filters[name];

    if (definition.kind === 'multi') {
      return el('fieldset', { class: 'filter' }, [
        el('legend', { text: definition.label }),
        el(
          'div',
          { class: 'filter-options' },
          definition.options.map((option) => {
            const checked = Array.isArray(current) && current.includes(option.id);
            const input = el('input', {
              type: 'checkbox',
              checked: checked ? 'checked' : null,
              onChange: () => {
                const next = new Set(Array.isArray(current) ? current : []);
                if (input.checked) next.add(option.id);
                else next.delete(option.id);
                onChange(name, [...next]);
              },
            });
            return el('label', { class: 'filter-option' }, [input, el('span', { text: option.label })]);
          }),
        ),
      ]);
    }

    return el('fieldset', { class: 'filter' }, [
      el('legend', { text: definition.label }),
      el(
        'div',
        { class: 'filter-options' },
        definition.options.map((option) => {
          const input = el('input', {
            type: 'radio',
            name: `filter-${name}`,
            checked: current === option.id ? 'checked' : null,
            onChange: () => onChange(name, option.id),
          });
          return el('label', { class: 'filter-option' }, [input, el('span', { text: option.label })]);
        }),
      ),
    ]);
  });

  return el('section', {}, [
    el('button', { type: 'button', class: 'ghost back', text: '← Back', onClick: onBack }),
    el('h1', { text: `Practise ${trainer.name}` }),
    el('p', { class: 'muted' }, [
      'Unlimited and unscored. Nothing here touches your history or your personal bests.',
    ]),
    ...controls,
    error ? el('p', { class: 'warning', text: error }) : null,
    el('div', { class: 'row-actions' }, [
      el('button', { type: 'button', class: 'primary', text: 'Start practice', onClick: onStart }),
    ]),
  ]);
}

/** Results, with comparison for scored rounds only (FR-77 to FR-85), plus full Word Rush answer reveal & leaderboard. */
export function resultsView({
  result,
  trainer,
  comparison,
  isPractice,
  leaderboard,
  currentUser,
  onBack,
  onArchive,
  onProgress,
  onLeaderboard,
}) {
  const weak = analyseWeakAreas(result.topicStats ?? []);
  const wr = result.wordRush ?? null;
  const foundSet = new Set((wr?.foundWords ?? []).map((w) => w.toLocaleLowerCase()));

  const wordRushRevealSection = wr
    ? el('div', { class: 'word-rush-reveal' }, [
        el('div', { class: 'word-rush-reveal-header' }, [
          el('h2', {
            class: 'section-label',
            text: `All Possible Answers — ${wr.categoryLabel} ("${wr.letter}")`,
          }),
          el('span', {
            class: 'badge badge-accent',
            text: `You found ${wr.foundWords.length} of ${wr.validWords.length} (${Math.round((wr.foundWords.length / Math.max(1, wr.validWords.length)) * 100)}%)`,
          }),
        ]),
        el(
          'ul',
          { class: 'word-rush-chips word-rush-reveal-grid', 'aria-label': 'All possible answers' },
          wr.validWords.map((word) => {
            const isFound = foundSet.has(word.toLocaleLowerCase());
            return el(
              'li',
              {
                class: `word-rush-chip ${isFound ? 'is-found' : 'is-missed'}`,
              },
              [
                el('span', { class: 'chip-mark', text: isFound ? '✓' : '·' }),
                el('span', { text: word }),
              ],
            );
          }),
        ),
      ])
    : null;

  const dailyBoard =
    wr && leaderboard
      ? leaderboard.dailyLeaderboard(result.puzzleDate, {
          trainerId: 'word-rush',
          maxPossible: wr.validWords.length,
        })
      : null;

  const miniLeaderboardSection = dailyBoard
    ? el('div', { class: 'results-leaderboard' }, [
        el('div', { class: 'word-rush-reveal-header' }, [
          el('h2', { class: 'section-label', text: `Today’s Leaderboard (${formatDate(result.puzzleDate)})` }),
          onLeaderboard
            ? el('button', {
                type: 'button',
                class: 'ghost small',
                text: 'Full Daily & All-Time Leaderboards →',
                onClick: onLeaderboard,
              })
            : null,
        ]),
        renderLeaderboardTable(dailyBoard.slice(0, 8), currentUser, 'daily'),
      ])
    : null;

  return el('section', { class: 'results' }, [
    el('h1', { text: isPractice ? 'Practice complete' : 'Round complete' }),
    el('p', { class: 'muted' }, [
      `${trainer.name} — ${labelFor(trainer, result.variantKey)}`,
    ]),
    el('p', { class: 'end-reason', text: END_REASON_LABEL[result.endedBy] ?? 'Round over' }),

    el('div', { class: 'result-stats' }, [
      stat(trainer.scoreLabel ?? 'Score', String(result.score), 'stat-headline'),
      stat(
        wr ? 'Pool Coverage' : 'Correct',
        wr
          ? `${wr.foundWords.length} of ${wr.validWords.length}`
          : `${result.correctCount} of ${result.totalAnswered}`,
      ),
      stat('Accuracy', `${result.accuracy}%`),
      stat('Average time', `${(result.avgAnswerTimeMs / 1000).toFixed(1)}s`),
      stat('Best streak', String(result.bestStreak)),
      stat('Round length', formatDuration(result.elapsedMs)),
    ]),

    wordRushRevealSection,
    miniLeaderboardSection,

    isPractice
      ? el('p', { class: 'muted practice-note' }, [
          'Practice rounds are not recorded, so there is nothing to compare against.',
        ])
      : comparison
        ? el('div', { class: 'comparison' }, [
            el('p', { class: `compare compare-${comparison.vsPrevious.status}`, text: comparison.vsPrevious.message }),
            el('p', { class: `compare compare-${comparison.vsBest.status}`, text: comparison.vsBest.message }),
          ])
        : null,

    !wr && (weak.status === 'ok' || weak.status === 'insufficient-data')
      ? el('p', { class: 'weak-area', text: weak.message })
      : null,

    el('div', { class: 'row-actions' }, [
      el('button', { type: 'button', class: 'primary', text: 'Back to trainer', onClick: onBack }),
      onLeaderboard
        ? el('button', { type: 'button', class: 'ghost', text: 'Leaderboards', onClick: onLeaderboard })
        : null,
      el('button', { type: 'button', class: 'ghost', text: 'Archive', onClick: onArchive }),
      el('button', { type: 'button', class: 'ghost', text: 'Progress', onClick: onProgress }),
    ]),
  ]);
}

function renderLeaderboardTable(rows, currentUser, mode = 'daily') {
  if (!rows || rows.length === 0) {
    return el('div', { class: 'empty-state leaderboard-empty' }, [
      el('p', {
        class: 'muted',
        text:
          mode === 'all-time'
            ? 'No players on the All-Time leaderboard yet. Play a round of Word Rush to claim #1!'
            : 'No scores recorded for this day yet. Play Word Rush to be first on the board!',
      }),
    ]);
  }
  const currentLogin = currentUser?.login?.toLowerCase() ?? null;
  return el('div', { class: 'leaderboard-table-wrap' }, [
    el('table', { class: 'leaderboard-table' }, [
      el('thead', {}, [
        el('tr', {}, [
          el('th', { text: 'Rank' }),
          el('th', { text: 'GitHub Player' }),
          el('th', { text: mode === 'all-time' ? 'Total Words' : 'Words Found' }),
          el('th', { text: mode === 'all-time' ? 'Personal Best' : 'Time' }),
        ]),
      ]),
      el(
        'tbody',
        {},
        rows.map((row) => {
          const isMe = currentLogin && row.login.toLowerCase() === currentLogin;
          return el('tr', { class: isMe ? 'leaderboard-row-me' : '' }, [
            el('td', { class: 'rank-cell' }, [
              el('span', {
                class: `rank-pill rank-${row.rank}`,
                text: `#${row.rank}`,
              }),
            ]),
            el('td', { class: 'player-cell' }, [
              el('img', {
                class: 'player-avatar',
                src: row.avatarUrl || `https://github.com/${row.login}.png?size=80`,
                alt: `${row.login} avatar`,
                loading: 'lazy',
              }),
              el('div', { class: 'player-meta' }, [
                el('strong', { class: 'player-name', text: row.name || row.login }),
                el('span', { class: 'player-handle', text: `@${row.login}${isMe ? ' (You)' : ''}` }),
              ]),
            ]),
            el('td', {
              class: 'score-cell',
              text: String(mode === 'all-time' ? row.totalWords : row.score),
            }),
            el('td', {
              class: 'meta-cell',
              text:
                mode === 'all-time'
                  ? `${row.bestScore} best · ${row.roundsPlayed}d`
                  : formatDuration(row.elapsedMs ?? 120000),
            }),
          ]);
        }),
      ),
    ]),
  ]);
}

/** Dedicated Daily & All-Time Leaderboards screen. */
export function leaderboardView({
  today,
  selectedDate,
  tab = 'daily',
  leaderboard,
  wordRushTrainer,
  currentUser,
  onSelectTab,
  onSelectDate,
  onPlayToday,
  onBack,
}) {
  const activeDate = selectedDate || today;
  const challenge = wordRushTrainer?.getChallenge?.(activeDate, 'daily') ?? null;
  const dailyRows = leaderboard.dailyLeaderboard(activeDate, {
    trainerId: 'word-rush',
    maxPossible: challenge?.validWords?.length ?? 25,
  });
  const allTimeRows = leaderboard.allTimeLeaderboard({ trainerId: 'word-rush' });

  // Last 7 days quick date selector for daily leaderboard
  const recentDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });

  return el('section', { class: 'leaderboards-screen' }, [
    el('button', { type: 'button', class: 'ghost back', text: '← Back', onClick: onBack }),
    el('div', { class: 'leaderboard-hero' }, [
      el('div', {}, [
        el('h1', { text: 'Word Rush Leaderboards' }),
        el('p', { class: 'muted' }, [
          'Ranked by the most words guessed in the 2-Minute Daily Word Rush.',
        ]),
      ]),
      onPlayToday
        ? el('button', {
            type: 'button',
            class: 'primary',
            text: 'Play Today’s Word Rush',
            onClick: onPlayToday,
          })
        : null,
    ]),

    el('div', { class: 'leaderboard-tabs' }, [
      el('button', {
        type: 'button',
        class: `tab-btn${tab === 'daily' ? ' is-active' : ''}`,
        text: 'Daily Leaderboard',
        onClick: () => onSelectTab('daily'),
      }),
      el('button', {
        type: 'button',
        class: `tab-btn${tab === 'all-time' ? ' is-active' : ''}`,
        text: 'All-Time Most Words',
        onClick: () => onSelectTab('all-time'),
      }),
    ]),

    tab === 'daily'
      ? el('div', {}, [
          el('div', { class: 'leaderboard-date-bar' }, [
            el(
              'div',
              { class: 'date-pills' },
              recentDates.map((d) =>
                el('button', {
                  type: 'button',
                  class: `ghost small${d === activeDate ? ' is-selected' : ''}`,
                  text: d === today ? `Today (${formatDate(d)})` : formatDate(d),
                  onClick: () => onSelectDate(d),
                }),
              ),
            ),
            challenge
              ? el('div', { class: 'daily-challenge-pill' }, [
                  el('span', { class: 'badge badge-accent', text: `Letter "${challenge.letter}"` }),
                  el('span', { text: challenge.categoryLabel }),
                ])
              : null,
          ]),
          renderLeaderboardTable(dailyRows, currentUser, 'daily'),
        ])
      : el('div', {}, [
          el('p', {
            class: 'muted leaderboard-caption',
            text: 'Cumulative words discovered and single-round personal bests across all daily Word Rush challenges.',
          }),
          renderLeaderboardTable(allTimeRows, currentUser, 'all-time'),
        ]),
  ]);
}

/** Archive: every past day, with what is left per trainer and variant (FR-39). */
export function archiveView({ entries, onPlay, onBack }) {
  if (entries.length === 0) {
    return el('section', {}, [
      el('h1', { text: 'Archive' }),
      el('p', { class: 'muted', text: 'No earlier puzzles yet — come back tomorrow.' }),
    ]);
  }

  return el('section', {}, [
    el('button', { type: 'button', class: 'ghost back', text: '← Back', onClick: onBack }),
    el('h1', { text: 'Archive' }),
    el('p', { class: 'muted' }, [
      'Every day you have not played yet. Archive rounds count towards your history exactly like today’s.',
    ]),
    el(
      'div',
      { class: 'archive-list' },
      entries.map((entry) =>
        el('details', { class: 'archive-day' }, [
          el('summary', {}, [
            el('span', { text: formatDate(entry.puzzleDate) }),
            el('span', {
              class: entry.anyUnplayed ? 'badge' : 'badge badge-done',
              text: entry.anyUnplayed ? `${entry.remaining} left` : 'All played',
            }),
          ]),
          el(
            'div',
            { class: 'archive-trainers' },
            entry.trainers.map((trainerState) =>
              el('div', { class: 'archive-trainer' }, [
                el('h2', { text: trainerState.name }),
                el(
                  'div',
                  { class: 'archive-variants' },
                  trainerState.variants.map((variant) =>
                    variant.played
                      ? el('span', {
                          class: 'badge badge-done',
                          text: `${trainerState.variantLabels?.[variant.key] ?? variantLabel(trainerState.variantKind, variant.key)} · ${variant.score}`,
                        })
                      : el('button', {
                          type: 'button',
                          class: 'ghost small',
                          text: trainerState.variantLabels?.[variant.key] ?? variantLabel(trainerState.variantKind, variant.key),
                          onClick: () => onPlay(trainerState.trainerId, variant.key, entry.puzzleDate),
                        }),
                  ),
                ),
              ]),
            ),
          ),
        ]),
      ),
    ),
  ]);
}

/** Progress: one trainer and variant at a time, since scores differ by level (FR-87, FR-88). */
export function progressView({ trainers, progress, selection, onSelect, onBack }) {
  const trainer = trainers.find((entry) => entry.id === selection.trainerId) ?? trainers[0];
  const variants = variantsFor(trainer);
  const variantKey = variants.includes(selection.variantKey) ? selection.variantKey : variants[0];
  const history = progress.history(trainer.id, variantKey);
  const summary = progress.summaryFor(trainer.id, variantKey);

  const trainerPicker = el(
    'select',
    {
      'aria-label': 'Trainer',
      onChange: (event) => onSelect({ trainerId: event.target.value, variantKey: null }),
    },
    trainers.map((entry) =>
      el('option', {
        value: entry.id,
        selected: entry.id === trainer.id ? 'selected' : null,
        text: entry.name,
      }),
    ),
  );

  const variantPicker = el(
    'select',
    {
      'aria-label': VARIANT_AXIS_LABEL[trainer.variantKind] ?? 'Level',
      onChange: (event) => onSelect({ trainerId: trainer.id, variantKey: event.target.value }),
    },
    variants.map((key) =>
      el('option', {
        value: key,
        selected: key === variantKey ? 'selected' : null,
        text: labelFor(trainer, key),
      }),
    ),
  );

  const body =
    history.length === 0
      ? el('p', { class: 'muted empty-state' }, [
          'Nothing here yet. Play a round at this level and your scores will appear.',
        ])
      : el('div', {}, [
          el('div', { class: 'result-stats' }, [
            stat('Puzzles played', String(summary.puzzlesCompleted)),
            stat('Personal best', summary.personalBest === null ? '—' : String(summary.personalBest)),
            stat('Time practised', formatDuration(summary.totalTimeMs)),
          ]),
          el('h2', { class: 'section-label', text: trainer.scoreLabel ?? 'Score' }),
          lineChart({
            points: history.map((entry) => ({ x: entry.puzzleDate, y: entry.score })),
            label: trainer.scoreLabel ?? 'Score',
          }),
          el('h2', { class: 'section-label', text: 'Accuracy' }),
          lineChart({
            points: history.map((entry) => ({ x: entry.puzzleDate, y: entry.accuracy })),
            label: 'Accuracy',
            suffix: '%',
          }),
          chartLegend(),
          topicBreakdown(progress.fullHistory(trainer.id)),
        ]);

  return el('section', {}, [
    el('button', { type: 'button', class: 'ghost back', text: '← Back', onClick: onBack }),
    el('h1', { text: 'Progress' }),
    el('div', { class: 'row-actions' }, [trainerPicker, variantPicker]),
    body,
  ]);
}

/** Topic hit rates across a trainer's whole history (FR-97). */
function topicBreakdown(allResults) {
  const topics = aggregateTopics(allResults).sort((a, b) => a.hitRate - b.hitRate);
  if (topics.length === 0) return null;

  return el('div', { class: 'topic-breakdown' }, [
    el('h2', { class: 'section-label', text: 'By topic, all levels' }),
    el(
      'ul',
      { class: 'topic-list' },
      topics.map((topic) =>
        el('li', { class: 'topic-row' }, [
          el('span', { class: 'topic-name', text: topic.label }),
          el('span', { class: 'topic-bar' }, [
            el('span', { class: 'topic-fill', style: `width: ${topic.hitRate}%;` }),
          ]),
          el('span', { class: 'topic-value', text: `${topic.hitRate}% (${topic.correct}/${topic.asked})` }),
        ]),
      ),
    ),
  ]);
}

export { render };
