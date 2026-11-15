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
  'prompts-exhausted': 'Daily challenge completed!',
  abandoned: 'You left the round early',
};

const CATEGORY_LOGO_SVG = {
  'word-rush': `<svg viewBox="0 0 36 36" width="28" height="28" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="32" height="32" rx="8" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2"/>
    <path d="M19.5 7L10 20h7.5l-1 9L26 16h-7.5l1-9z" fill="currentColor"/>
  </svg>`,
  'word-chain': `<svg viewBox="0 0 36 36" width="28" height="28" fill="none" aria-hidden="true">
    <rect x="2" y="2" width="32" height="32" rx="8" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2"/>
    <path d="M14 22l8-8M12 16l-2 2a4.5 4.5 0 0 0 6.4 6.4l2-2M24 20l2-2a4.5 4.5 0 0 0-6.4-6.4l-2 2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,
  'timeline-sort': `<svg viewBox="0 0 36 36" width="28" height="28" fill="none" aria-hidden="true">
    <line x1="5" y1="18" x2="31" y2="18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="11" y1="18" x2="11" y2="12" stroke="currentColor" stroke-width="1.8"/>
    <rect x="6" y="6" width="10" height="6" rx="1.5" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.8"/>
    <line x1="18" y1="18" x2="18" y2="24" stroke="currentColor" stroke-width="1.8"/>
    <rect x="13" y="24" width="10" height="6" rx="1.5" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.8"/>
    <line x1="25" y1="18" x2="25" y2="12" stroke="currentColor" stroke-width="1.8"/>
    <rect x="20" y="6" width="10" height="6" rx="1.5" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.8"/>
  </svg>`,
  'connection-grid': `<svg viewBox="0 0 36 36" width="28" height="28" fill="none" aria-hidden="true">
    <rect x="5" y="5" width="11" height="11" rx="2.5" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="2"/>
    <rect x="20" y="5" width="11" height="11" rx="2.5" stroke="currentColor" stroke-width="2"/>
    <rect x="5" y="20" width="11" height="11" rx="2.5" stroke="currentColor" stroke-width="2"/>
    <rect x="20" y="20" width="11" height="11" rx="2.5" fill="currentColor" fill-opacity="0.25" stroke="currentColor" stroke-width="2"/>
    <path d="M16 10.5h4M10.5 16v4M25.5 16v4M16 25.5h4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`,
  math: `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <path d="M9 12h18M9 24h18M14 7l-3 22M25 7l-3 22" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`,
  'pattern-memory': `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <rect x="6" y="6" width="10" height="10" rx="2.5" fill="currentColor"/>
    <rect x="20" y="6" width="10" height="10" rx="2.5" stroke="currentColor" stroke-width="2"/>
    <rect x="6" y="20" width="10" height="10" rx="2.5" stroke="currentColor" stroke-width="2"/>
    <rect x="20" y="20" width="10" height="10" rx="2.5" fill="currentColor" fill-opacity="0.35" stroke="currentColor" stroke-width="2"/>
  </svg>`,
  'figure-pairs': `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <rect x="6" y="8" width="14" height="20" rx="3" stroke="currentColor" stroke-width="2"/>
    <rect x="16" y="6" width="14" height="20" rx="3" fill="currentColor" fill-opacity="0.16" stroke="currentColor" stroke-width="2"/>
    <circle cx="23" cy="16" r="3" fill="currentColor"/>
  </svg>`,
  'flag-guesser': `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <path d="M9 6v24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M9 8h18l-3 5.5 3 5.5H9" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
  </svg>`,
  'outline-guesser': `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <circle cx="18" cy="18" r="12" stroke="currentColor" stroke-width="2"/>
    <ellipse cx="18" cy="18" rx="5.5" ry="12" stroke="currentColor" stroke-width="1.8"/>
    <path d="M6.5 14.5h23M6.5 21.5h23" stroke="currentColor" stroke-width="1.8"/>
  </svg>`,
  'capital-guesser': `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <path d="M6 28h24M8 28V16h20v12M18 7l12 7H6l12-7Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
    <path d="M13 28v-8M18 28v-8M23 28v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
  'border-hop': `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <circle cx="9" cy="25" r="3.5" fill="currentColor"/>
    <circle cx="27" cy="11" r="3.5" stroke="currentColor" stroke-width="2"/>
    <path d="M12.5 24c4.5-1 4.5-11 11-12" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>
  </svg>`,
  people: `<svg viewBox="0 0 36 36" width="26" height="26" fill="none" aria-hidden="true">
    <circle cx="18" cy="13" r="5" stroke="currentColor" stroke-width="2"/>
    <path d="M8.5 29c1.8-4.6 5.1-7 9.5-7s7.7 2.4 9.5 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>`,
};

const REACTION_ICON_SVG = {
  like: `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
    <path d="M10 4L15.5 10.5H12V16H8V10.5H4.5L10 4Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>
  </svg>`,
  dislike: `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
    <path d="M10 16L4.5 9.5H8V4H12V9.5H15.5L10 16Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>
  </svg>`,
  starFilled: `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
    <path d="M10 2.5L12.3 7.15L17.45 7.9L13.72 11.53L14.6 16.65L10 14.23L5.4 16.65L6.28 11.53L2.55 7.9L7.7 7.15L10 2.5Z" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  </svg>`,
  starOutline: `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" aria-hidden="true">
    <path d="M10 2.5L12.3 7.15L17.45 7.9L13.72 11.53L14.6 16.65L10 14.23L5.4 16.65L6.28 11.53L2.55 7.9L7.7 7.15L10 2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
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

function renderAnswerRevealSection(reveal) {
  if (!reveal) return null;
  const isSolved = Boolean(reveal.solved);

  if (reveal.kind === 'capital') {
    return el(
      'div',
      { class: `answer-reveal-card${isSolved ? ' is-solved' : ' is-missed'}` },
      [
        el('span', {
          class: 'answer-reveal-badge',
          text: isSolved ? 'Correct Answer' : 'The Correct Answer Was',
        }),
        el('div', { class: 'answer-reveal-main' }, [
          el('strong', { class: 'answer-reveal-value', text: reveal.capitalName }),
          el('span', {
            class: 'answer-reveal-sub',
            text: `Capital of ${reveal.countryName}`,
          }),
        ]),
        reveal.hints?.length > 0
          ? el(
              'ul',
              { class: 'answer-reveal-hints' },
              reveal.hints.map((h) => el('li', { text: h })),
            )
          : null,
      ],
    );
  }

  if (reveal.kind === 'flag' || reveal.kind === 'outline') {
    return el(
      'div',
      { class: `answer-reveal-card${isSolved ? ' is-solved' : ' is-missed'}` },
      [
        el('span', {
          class: 'answer-reveal-badge',
          text: isSolved ? 'Correct Answer' : 'The Correct Answer Was',
        }),
        el('div', { class: 'answer-reveal-main' }, [
          el('strong', { class: 'answer-reveal-value', text: reveal.countryName }),
          reveal.continent
            ? el('span', { class: 'answer-reveal-sub', text: `Continent: ${reveal.continent}` })
            : null,
        ]),
      ],
    );
  }

  if (reveal.kind === 'border-hop') {
    const route =
      reveal.shortestPath?.length > 0
        ? reveal.shortestPath.join(' → ')
        : `${reveal.startCountry} → … → ${reveal.targetCountry}`;
    return el(
      'div',
      { class: `answer-reveal-card${isSolved ? ' is-solved' : ' is-missed'}` },
      [
        el('span', {
          class: 'answer-reveal-badge',
          text: isSolved ? 'Route Completed' : 'Shortest Land Route Answer',
        }),
        el('div', { class: 'answer-reveal-main' }, [
          el('strong', { class: 'answer-reveal-value', text: route }),
          el('span', {
            class: 'answer-reveal-sub',
            text: `From ${reveal.startCountry} to ${reveal.targetCountry}`,
          }),
        ]),
      ],
    );
  }

  if (reveal.kind === 'person') {
    if (isSolved) return null;
    return el('div', { class: 'answer-reveal-card is-missed' }, [
      el('span', { class: 'answer-reveal-badge', text: 'The Person You Missed Was' }),
      el('div', { class: 'answer-reveal-main' }, [
        el('strong', { class: 'answer-reveal-value', text: reveal.personName }),
        reveal.category
          ? el('span', { class: 'answer-reveal-sub', text: reveal.category })
          : null,
        reveal.clue
          ? el('p', { class: 'answer-reveal-clue muted small', text: `“${reveal.clue}”` })
          : null,
      ]),
    ]);
  }

  if (reveal.kind === 'timeline-sort') {
    if (isSolved) return null;
    return el('div', { class: 'answer-reveal-card is-missed' }, [
      el('span', { class: 'answer-reveal-badge', text: 'The Event Year Was' }),
      el('div', { class: 'answer-reveal-main' }, [
        el('strong', {
          class: 'answer-reveal-value',
          text: `${reveal.card?.title ?? 'Event'} — ${reveal.card?.formattedYear ?? ''}`,
        }),
        reveal.expected
          ? el('span', { class: 'answer-reveal-sub', text: reveal.expected })
          : null,
      ]),
    ]);
  }

  if (reveal.kind === 'connection-grid' && reveal.groups?.length > 0) {
    return el(
      'div',
      { class: `answer-reveal-card${isSolved ? ' is-solved' : ' is-missed'}` },
      [
        el('span', {
          class: 'answer-reveal-badge',
          text: isSolved ? 'All 4 Categories Solved' : 'Today’s 4 Categories & Answers',
        }),
        el(
          'div',
          { class: 'connection-solved-list', style: 'margin-top: 0.65rem;' },
          reveal.groups.map((group) =>
            el('div', { class: 'connection-solved-banner' }, [
              el('strong', { class: 'connection-solved-title', text: group.title }),
              el('span', {
                class: 'connection-solved-words',
                text: group.words.join(' · '),
              }),
            ]),
          ),
        ),
      ],
    );
  }

  if (reveal.kind === 'prompt' && !isSolved && reveal.expected) {
    return el('div', { class: 'answer-reveal-card is-missed' }, [
      el('span', { class: 'answer-reveal-badge', text: 'The Answer To The Last Prompt Was' }),
      el('div', { class: 'answer-reveal-main' }, [
        el('strong', { class: 'answer-reveal-value', text: String(reveal.expected) }),
        reveal.question
          ? el('span', { class: 'answer-reveal-sub', text: `Prompt: ${reveal.question}` })
          : null,
      ]),
    ]);
  }

  return null;
}

/** A thin progress rail showing how much of something is done. */
function meter(done, total) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return el('div', { class: `meter${percent === 100 ? ' meter-done' : ''}` }, [
    el('span', { class: 'meter-fill', style: `width: ${percent}%;` }),
  ]);
}

/** Home: the categories and what is left in each today, plus the Daily Word Rush Spotlight (FR-1). */
export function categoriesView({
  today,
  categories,
  registry,
  progress,
  user,
  preferences = null,
  onCategory,
  onToggleFavorite = null,
  onMoveFavorite = null,
  onVote = null,
}) {
  let allTotal = 0;
  let allSpent = 0;

  const orderedCategories = preferences
    ? preferences.sortCategories(categories, user)
    : categories;
  const favoritesList = preferences ? preferences.getFavorites(user) : [];

  const cards = orderedCategories.map((category) => {
    const isWordRush = category.id === 'word-rush';
    const trainers = registry.trainersIn(category.id);
    const total = trainers.reduce((sum, trainer) => sum + variantsFor(trainer).length, 0);
    const spent = trainers.reduce(
      (sum, trainer) => sum + progress.spentVariants(trainer.id, today).length,
      0,
    );
    const isCompleted = total > 0 && spent >= total;
    const hasPractice = trainers.some((trainer) => !trainer.noPractice);

    allTotal += total;
    allSpent += spent;

    const favIndex = favoritesList.indexOf(category.id);
    const isFav = favIndex >= 0;
    const reaction = preferences
      ? preferences.getReaction(category.id, user)
      : { likes: 0, dislikes: 0, userVote: null };

    return el(
      'article',
      {
        class: `card category-card${isWordRush ? ' category-card-word-rush' : ''}${isFav ? ' category-card-favorite' : ''}`,
      },
      [
        el('div', { class: 'category-card-top' }, [
          el('div', {
            class: 'category-icon',
            'aria-hidden': 'true',
            html: CATEGORY_LOGO_SVG[category.id] ?? category.icon,
          }),
          el('div', { class: 'category-card-actions' }, [
            isFav && favoritesList.length > 1 && onMoveFavorite
              ? el('div', { class: 'fav-order-controls', role: 'group', 'aria-label': `Reorder ${category.name} favorite position` }, [
                  el('button', {
                    type: 'button',
                    class: 'fav-order-btn',
                    disabled: favIndex === 0,
                    title: 'Move earlier in favorites',
                    'aria-label': `Move ${category.name} earlier in favorites`,
                    text: '↑',
                    onClick: () => onMoveFavorite(category.id, -1),
                  }),
                  el('span', { class: 'fav-rank-badge', text: `#${favIndex + 1}` }),
                  el('button', {
                    type: 'button',
                    class: 'fav-order-btn',
                    disabled: favIndex === favoritesList.length - 1,
                    title: 'Move later in favorites',
                    'aria-label': `Move ${category.name} later in favorites`,
                    text: '↓',
                    onClick: () => onMoveFavorite(category.id, 1),
                  }),
                ])
              : isFav
                ? el('span', { class: 'fav-rank-badge', text: '#1' })
                : null,
            onToggleFavorite
              ? el(
                  'button',
                  {
                    type: 'button',
                    class: `fav-toggle-btn${isFav ? ' is-favorited' : ''}`,
                    'aria-pressed': String(isFav),
                    title: isFav ? 'Remove from favorites' : 'Favorite gamemode (pins to top)',
                    'aria-label': isFav
                      ? `Remove ${category.name} from favorites`
                      : `Favorite ${category.name}`,
                    onClick: () => onToggleFavorite(category.id),
                  },
                  [
                    el('span', {
                      class: 'reaction-icon',
                      'aria-hidden': 'true',
                      html: isFav ? REACTION_ICON_SVG.starFilled : REACTION_ICON_SVG.starOutline,
                    }),
                  ],
                )
              : null,
            el('span', {
              class: 'remaining-pill',
              text: isCompleted
                ? 'Completed'
                : total === 1
                  ? `${spent} / 1 attempt`
                  : `${total - spent} / ${total} open`,
            }),
          ]),
        ]),
        el('h2', { text: category.name }),
        el('p', { class: 'muted', text: category.tagline }),
        el('div', { class: 'card-bottom' }, [
          el('div', { class: 'card-meta-row' }, [
            onVote
              ? el(
                  'div',
                  {
                    class: 'reaction-bar',
                    role: 'group',
                    'aria-label': `Rate ${category.name}`,
                  },
                  [
                    el(
                      'button',
                      {
                        type: 'button',
                        class: `reaction-btn reaction-like${reaction.userVote === 'like' ? ' is-active' : ''}`,
                        'aria-pressed': String(reaction.userVote === 'like'),
                        title: 'Upvote this gamemode (1 vote per user)',
                        'aria-label': `Like ${category.name} (${reaction.likes})`,
                        onClick: () => onVote(category.id, 'like'),
                      },
                      [
                        el('span', {
                          class: 'reaction-icon',
                          'aria-hidden': 'true',
                          html: REACTION_ICON_SVG.like,
                        }),
                        el('span', { class: 'reaction-count', text: String(reaction.likes) }),
                      ],
                    ),
                    el(
                      'button',
                      {
                        type: 'button',
                        class: `reaction-btn reaction-dislike${reaction.userVote === 'dislike' ? ' is-active' : ''}`,
                        'aria-pressed': String(reaction.userVote === 'dislike'),
                        title: 'Downvote this gamemode (1 vote per user)',
                        'aria-label': `Dislike ${category.name} (${reaction.dislikes})`,
                        onClick: () => onVote(category.id, 'dislike'),
                      },
                      [
                        el('span', {
                          class: 'reaction-icon',
                          'aria-hidden': 'true',
                          html: REACTION_ICON_SVG.dislike,
                        }),
                        el('span', { class: 'reaction-count', text: String(reaction.dislikes) }),
                      ],
                    ),
                  ],
                )
              : null,
            hasPractice
              ? el('p', {
                  class: 'muted small practice-status',
                  text: 'Practice mode available',
                })
              : null,
          ]),
          meter(spent, total),
          el('button', {
            type: 'button',
            class: 'primary',
            text: `Open ${category.name}`,
            onClick: () => onCategory(category.id),
          }),
        ]),
      ],
    );
  });

  return el('section', {}, [
    el('div', { class: 'hero' }, [
      el('div', { class: 'hero-text' }, [
        el('h1', { text: 'Daily Drills' }),
        el('p', { class: 'muted' }, [
          `${formatDate(today)} — 12 daily brain challenges across geography, history, math, memory & words.`,
        ]),
      ]),
      el('div', { class: 'hero-meter' }, [
        el('p', {
          class: 'hero-count',
          text: `${allSpent} out of ${allTotal} gamemodes played today`,
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
        const isCompleted = spent.length >= variants.length;
        const hasPractice = !trainer.noPractice;
        return el('article', { class: 'card' }, [
          el('h2', { text: trainer.name }),
          el('p', { class: 'muted', text: trainer.description }),
          el('p', { class: 'mode-label', text: ROUND_MODE_LABEL[trainer.roundMode] }),
          el('p', {
            class: 'remaining',
            text: isCompleted
              ? 'Completed'
              : variants.length === 1
                ? `${spent.length} / 1 attempt today`
                : `${variants.length - spent.length} of ${variants.length} left today`,
          }),
          el('div', { class: 'card-bottom' }, [
            hasPractice
              ? el('p', {
                  class: 'muted small practice-status',
                  text: 'Practice mode available',
                })
              : null,
            meter(spent.length, variants.length),
            el('button', {
              type: 'button',
              class: 'primary',
              text: isWordRush ? 'Open Word Rush' : 'Choose level',
              onClick: () => onTrainer(trainer.id),
            }),
          ]),
        ]);
      }),
    ),
  ]);
}

/** A trainer's variants, marking what has already been spent (FR-3). */
export function trainerView({
  today,
  trainer,
  progress,
  adminMode = false,
  onPlay,
  onPractice,
  onLeaderboard,
  onBack,
}) {
  const variants = variantsFor(trainer);
  const spentList = progress.spentVariants(trainer.id, today);
  const spent = new Set(spentList);
  const isSingleAttempt = variants.length === 1;
  const isCompleted = spentList.length >= variants.length;
  const hasPractice = !trainer.noPractice;
  const axisLabel = VARIANT_AXIS_LABEL[trainer.variantKind] ?? 'Level';

  const options = variants.map((key) => {
    const played = spent.has(key);
    const best = progress.personalBest(trainer.id, key);
    return el('article', { class: `card variant-card${played && !adminMode ? ' variant-done' : ''}` }, [
      trainer.variantKind === 'band'
        ? el('span', { class: `band-stripe band-${key}`, 'aria-hidden': 'true' })
        : null,
      el('h3', { text: labelFor(trainer, key) }),
      el('p', { class: 'muted', text: describeRound(trainer, key, today) }),
      el('p', {
        class: 'muted small',
        text: best === null ? 'No personal best yet' : `Best: ${best}`,
      }),
      el('div', { class: 'card-bottom' }, [
        hasPractice
          ? el('p', {
              class: 'muted small practice-status',
              text: 'Practice mode available',
            })
          : null,
        isSingleAttempt ? meter(played ? 1 : 0, 1) : null,
        played && !adminMode
          ? el('p', { class: 'done-label', text: '✓ Completed today' })
          : el('button', {
              type: 'button',
              class: 'primary',
              text: played && adminMode ? 'Replay (Admin)' : 'Play',
              onClick: () => onPlay(key),
            }),
      ]),
    ]);
  });

  return el('section', {}, [
    el('button', { type: 'button', class: 'ghost back', text: '← Back', onClick: onBack }),
    el('h1', { text: trainer.name }),
    el('p', { class: 'muted', text: trainer.description }),
    isSingleAttempt
      ? el('div', { class: 'card', style: 'margin-bottom: 1rem;' }, [
          el('div', { class: 'category-card-top' }, [
            el('strong', { text: 'Daily Attempt Progress' }),
            el('span', {
              class: 'remaining-pill',
              text: isCompleted
                ? adminMode
                  ? 'Completed (Admin Unlimited)'
                  : 'Completed'
                : '0 / 1 attempt used',
            }),
          ]),
          hasPractice
            ? el('p', {
                class: 'muted small practice-status',
                text: 'Practice mode available',
              })
            : null,
          meter(spentList.length, variants.length),
        ])
      : null,
    el('h2', { class: 'section-label', text: axisLabel }),
    el('div', { class: 'grid' }, options),
    hasPractice || onLeaderboard
      ? el('div', { class: 'row-actions' }, [
          hasPractice && onPractice
            ? el('button', {
                type: 'button',
                class: 'ghost',
                text: 'Practice freely (unscored)',
                onClick: onPractice,
              })
            : null,
          onLeaderboard
            ? el('button', {
                type: 'button',
                class: 'ghost',
                text: 'Daily & All-Time Leaderboards →',
                onClick: onLeaderboard,
              })
            : null,
        ])
      : null,
  ]);
}

/** Pre-round briefing: no controls, and a warning that starting commits (FR-4, FR-5, FR-10d). */
export function briefingView({ trainer, variantKey, puzzleDate, isArchive, onStart, onBack }) {
  const isWordRush = trainer.id === 'word-rush';

  return el('section', { class: 'briefing' }, [
    el('button', { type: 'button', class: 'ghost back', text: '← Back', onClick: onBack }),
    el('div', { class: 'trainer-heading-row' }, [
      isWordRush ? wordRushLogoMark(42) : null,
      el('h1', { text: trainer.name }),
    ]),
    el('p', { class: 'muted', text: trainer.description }),
    isWordRush
      ? el('div', { class: 'word-rush-brief-card word-rush-hidden-notice' }, [
          el('div', { class: 'word-rush-letter-badge' }, [
            el('span', { class: 'word-rush-letter-caption', text: 'Letter' }),
            el('strong', { class: 'word-rush-letter', text: '?' }),
          ]),
          el('div', { class: 'word-rush-meta' }, [
            el('span', { class: 'badge', text: 'Hidden until start' }),
            el('p', { class: 'word-rush-category-line' }, [
              el('strong', {
                text: 'Category and starting letter are revealed once the 2-minute timer starts.',
              }),
            ]),
          ]),
        ])
      : null,
    el('div', { class: 'brief-stats' }, [
      stat('Date', formatDate(puzzleDate)),
      stat(
        VARIANT_AXIS_LABEL[trainer.variantKind] ?? 'Level',
        isWordRush && variantKey === 'daily' ? 'Daily Mystery' : labelFor(trainer, variantKey),
      ),
      stat('Round ends', ROUND_MODE_LABEL[trainer.roundMode]),
    ]),
    el('p', { class: 'brief-mode', text: describeRound(trainer, variantKey, puzzleDate) }),
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
  const isWordChain = Boolean(wr?.isWordChain || result.trainerId === 'word-chain');
  const chainWords = wr?.chainWords?.length
    ? wr.chainWords
    : wr?.starterWord
      ? [wr.starterWord, ...(wr.foundWords ?? [])]
      : wr?.foundWords ?? [];
  const allUsedSet = new Set(chainWords.map((w) => w.toLocaleLowerCase()));
  const foundSet = new Set((wr?.foundWords ?? []).map((w) => w.toLocaleLowerCase()));

  const wordRushRevealSection = wr
    ? isWordChain
      ? el('div', { class: 'word-rush-reveal' }, [
          el('div', { class: 'word-rush-reveal-header' }, [
            el('h2', {
              class: 'section-label',
              text: `Your Word Chain — ${wr.categoryLabel}`,
            }),
            el('span', {
              class: 'badge badge-accent',
              text:
                chainWords.length > 0
                  ? `${chainWords.length} word${chainWords.length === 1 ? '' : 's'} chained (started with "${chainWords[0]}")`
                  : '0 words chained',
            }),
          ]),
          chainWords.length > 0
            ? el(
                'ul',
                { class: 'word-rush-chips word-rush-reveal-grid', 'aria-label': 'Completed word chain' },
                chainWords.map((word, idx) =>
                  el('li', { class: 'word-rush-chip is-found' }, [
                    el('span', { class: 'chip-mark', text: `${idx + 1}.` }),
                    el('span', { text: word }),
                  ]),
                ),
              )
            : el('p', { class: 'muted', text: 'No words were added to the chain.' }),
          wr.validWords?.length > 0
            ? el('div', { class: 'word-rush-reveal-header', style: 'margin-top: 1rem;' }, [
                el('h3', {
                  class: 'section-label',
                  text: wr.letter
                    ? `Possible Next Words Starting With "${wr.letter}" (from ${chainWords[chainWords.length - 1] ?? ''})`
                    : `Possible ${wr.categoryLabel} Words`,
                }),
              ])
            : null,
          wr.validWords?.length > 0
            ? el(
                'ul',
                { class: 'word-rush-chips word-rush-reveal-grid', 'aria-label': 'Possible next words' },
                wr.validWords.map((word) => {
                  const alreadyUsed = allUsedSet.has(word.toLocaleLowerCase());
                  return el(
                    'li',
                    {
                      class: `word-rush-chip ${alreadyUsed ? 'is-found' : 'is-missed'}`,
                    },
                    [
                      el('span', { class: 'chip-mark', text: alreadyUsed ? '✓' : '→' }),
                      el('span', { text: word }),
                    ],
                  );
                }),
              )
            : null,
        ])
      : el('div', { class: 'word-rush-reveal' }, [
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

  const activeTrainerId = result.trainerId ?? trainer?.id ?? 'word-rush';
  const modeLeaderboardMeta = LEADERBOARD_MODES[activeTrainerId] ?? null;
  const isFigurePairs = activeTrainerId === 'figure-pairs';
  const hasLeaderboard = Boolean(modeLeaderboardMeta);
  const leaderboardTrainerId = activeTrainerId;

  const dailyBoard =
    hasLeaderboard && leaderboard
      ? leaderboard.dailyLeaderboard(result.puzzleDate, {
          trainerId: leaderboardTrainerId,
          maxPossible: wr?.validWords?.length ?? 1000,
        })
      : null;

  const allTimeBoard =
    hasLeaderboard && leaderboard
      ? leaderboard.allTimeLeaderboard({ trainerId: leaderboardTrainerId })
      : null;

  const miniLeaderboardSection = dailyBoard
    ? el('div', { class: 'results-leaderboard' }, [
        el('div', { class: 'word-rush-reveal-header' }, [
          el('h2', {
            class: 'section-label',
            text: `${modeLeaderboardMeta.dailyTab} (${formatDate(result.puzzleDate)})`,
          }),
          onLeaderboard
            ? el('button', {
                type: 'button',
                class: 'ghost small',
                text: 'Full Daily & All-Time Leaderboards →',
                onClick: onLeaderboard,
              })
            : null,
        ]),
        renderLeaderboardTable(dailyBoard.slice(0, 8), currentUser, 'daily', leaderboardTrainerId),
        allTimeBoard
          ? el('div', { style: 'margin-top: 1.25rem;' }, [
              el('div', { class: 'word-rush-reveal-header' }, [
                el('h2', {
                  class: 'section-label',
                  text: `${modeLeaderboardMeta.allTimeTab} (${modeLeaderboardMeta.title})`,
                }),
              ]),
              renderLeaderboardTable(allTimeBoard.slice(0, 8), currentUser, 'all-time', leaderboardTrainerId),
            ])
          : null,
      ])
    : null;

  const answerRevealSection = !wr ? renderAnswerRevealSection(result.answerReveal) : null;

  return el('section', { class: 'results' }, [
    el('h1', { text: isPractice ? 'Practice complete' : 'Round complete' }),
    el('p', { class: 'muted' }, [
      `${trainer.name} — ${labelFor(trainer, result.variantKey)}`,
    ]),
    el('p', { class: 'end-reason', text: END_REASON_LABEL[result.endedBy] ?? 'Round over' }),

    answerRevealSection,

    el('div', { class: 'result-stats' }, [
      stat(
        isFigurePairs ? 'Total Tries' : (trainer.scoreLabel ?? 'Score'),
        String(isFigurePairs ? result.totalAnswered : result.score),
        'stat-headline',
      ),
      stat(
        isWordChain ? 'Starter word' : wr ? 'Pool Coverage' : isFigurePairs ? 'Mistakes' : 'Correct',
        isWordChain
          ? String(wr?.starterWord ?? chainWords[0] ?? '—')
          : wr
            ? `${wr.foundWords.length} of ${wr.validWords.length}`
            : isFigurePairs
              ? String(result.mistakes ?? 0)
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
    ]),
  ]);
}

const LEADERBOARD_MODES = {
  'word-rush': {
    title: 'Word Rush',
    heading: 'Word Rush Leaderboards',
    subtitle: 'Ranked by the most words guessed in the 2-Minute Daily Word Rush.',
    playButton: 'Play Today’s Word Rush',
    variantKey: 'daily',
    dailyTab: 'Daily Leaderboard',
    allTimeTab: 'All-Time Most Words',
    dailyCol: 'Words Found',
    allTimeCol: 'Total Words',
    allTimeCaption:
      'Cumulative words discovered and single-round personal bests across all daily Word Rush challenges.',
  },
  'word-chain': {
    title: 'Word Chain',
    heading: 'Word Chain Leaderboards',
    subtitle: 'Ranked by the longest last-letter word chain built today and all-time.',
    playButton: 'Play Today’s Word Chain',
    variantKey: 'daily',
    dailyTab: 'Longest Chain Today',
    allTimeTab: 'All-Time Words Chained',
    dailyCol: 'Chain Length',
    allTimeCol: 'Total Chained',
    allTimeCaption:
      'Cumulative words chained and single-round personal bests across all daily Word Chain challenges.',
  },
  'timeline-sort': {
    title: 'Timeline Sort',
    heading: 'Timeline Sort Leaderboards',
    subtitle: 'Ranked by the most historical events placed in chronological order before 3 mistakes.',
    playButton: 'Play Today’s Timeline Sort',
    variantKey: 'daily',
    dailyTab: 'Most Events Today',
    allTimeTab: 'All-Time Events Placed',
    dailyCol: 'Events Placed',
    allTimeCol: 'Total Placed',
    allTimeCaption:
      'Cumulative historical events placed and single-run personal bests across all daily Timeline Sort challenges.',
  },
  'mental-math': {
    title: 'Math Blitz',
    heading: 'Math Blitz Leaderboards',
    subtitle: 'Ranked by the longest daily math streak solved under the 20s-per-question clock.',
    playButton: 'Play Today’s Math Blitz',
    variantKey: 'daily',
    dailyTab: 'Highest Score Today',
    allTimeTab: 'All-Time Correct Solved',
    dailyCol: 'Problems Solved',
    allTimeCol: 'Total Solved',
    allTimeCaption:
      'Cumulative problems solved and single-run personal bests across all daily Math Blitz challenges.',
  },
  'pattern-memory': {
    title: 'Pattern Memory',
    heading: 'Pattern Memory Leaderboards',
    subtitle: 'Ranked by highest sequential pattern level memorized with zero mistakes allowed.',
    playButton: 'Play Today’s Pattern Memory',
    variantKey: 'daily',
    dailyTab: 'Highest Level Today',
    allTimeTab: 'All-Time Levels Cleared',
    dailyCol: 'Levels Reached',
    allTimeCol: 'Total Levels',
    allTimeCaption:
      'Cumulative levels cleared and single-run personal bests across all daily Pattern Memory challenges.',
  },
  'figure-pairs': {
    title: 'Figure Pairs',
    heading: 'Figure Pairs Leaderboards',
    subtitle: 'Ranked by fewest attempts used before connecting all figures on today’s board.',
    playButton: 'Play Today’s Figure Pairs',
    variantKey: 'daily',
    dailyTab: 'Fewest Tries Today',
    allTimeTab: 'All-Time Fewest Tries',
    dailyCol: 'Attempts (Tries)',
    allTimeCol: 'Best Run (Tries)',
    allTimeCaption:
      'Ranked by fewest attempts used in a completed daily board and total rounds completed.',
  },
  'famous-people': {
    title: 'People Guesser',
    heading: 'People Guesser Leaderboards',
    subtitle: 'Ranked by most people guessed today and all-time in People Guesser.',
    playButton: 'Play Today’s People Guesser',
    variantKey: 'all',
    dailyTab: 'Most Guesses Today',
    allTimeTab: 'All-Time Most Guesses',
    dailyCol: 'People Guessed',
    allTimeCol: 'Total Guesses',
    allTimeCaption:
      'Cumulative people guessed and single-run personal bests across all daily People Guesser challenges.',
  },
};

function renderLeaderboardTable(rows, currentUser, mode = 'daily', trainerId = 'word-rush') {
  const meta = LEADERBOARD_MODES[trainerId] ?? LEADERBOARD_MODES['word-rush'];
  const isFigurePairs = trainerId === 'figure-pairs';
  if (!rows || rows.length === 0) {
    return el('div', { class: 'empty-state leaderboard-empty' }, [
      el('p', {
        class: 'muted',
        text:
          mode === 'all-time'
            ? `No players on the All-Time leaderboard yet. Play a round of ${meta.title} to claim #1!`
            : `No scores recorded for this day yet. Play ${meta.title} to be first on the board!`,
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
          el('th', {
            text: mode === 'all-time' ? meta.allTimeCol : meta.dailyCol,
          }),
          el('th', {
            text:
              mode === 'all-time'
                ? isFigurePairs
                  ? 'Avg Tries / Rounds'
                  : 'Personal Best'
                : 'Time',
          }),
        ]),
      ]),
      el(
        'tbody',
        {},
        rows.map((row) => {
          const isMe = currentLogin && row.login.toLowerCase() === currentLogin;
          const avgTries =
            row.roundsPlayed > 0 ? Math.round((row.totalWords / row.roundsPlayed) * 10) / 10 : row.bestScore;
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
              text: String(
                mode === 'all-time'
                  ? isFigurePairs
                    ? `${row.bestScore} tries`
                    : row.totalWords
                  : isFigurePairs
                    ? `${row.score} tries`
                    : row.score,
              ),
            }),
            el('td', {
              class: 'meta-cell',
              text:
                mode === 'all-time'
                  ? isFigurePairs
                    ? `${avgTries} avg · ${row.roundsPlayed}d`
                    : `${row.bestScore} best · ${row.roundsPlayed}d`
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
  trainerId = 'word-rush',
  leaderboard,
  wordRushTrainer,
  currentUser,
  progress,
  onSelectTab,
  onSelectTrainer,
  onSelectDate,
  onPlayToday,
  onBack,
}) {
  const meta = LEADERBOARD_MODES[trainerId] ?? LEADERBOARD_MODES['word-rush'];
  const isWordRush = trainerId === 'word-rush';
  const activeDate = selectedDate || today;
  const challenge = isWordRush ? (wordRushTrainer?.getChallenge?.(activeDate, 'daily') ?? null) : null;
  const hasPlayedActiveDate = Boolean(
    progress?.hasAttempt?.(trainerId, meta.variantKey, activeDate),
  );
  const dailyRows = leaderboard.dailyLeaderboard(activeDate, {
    trainerId,
    maxPossible: challenge?.validWords?.length ?? 25,
  });
  const allTimeRows = leaderboard.allTimeLeaderboard({ trainerId });

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
        el('h1', { text: meta.heading }),
        el('p', { class: 'muted' }, [meta.subtitle]),
      ]),
      onPlayToday
        ? el('button', {
            type: 'button',
            class: 'primary',
            text: meta.playButton,
            onClick: () => onPlayToday(trainerId),
          })
        : null,
    ]),

    onSelectTrainer
      ? el(
          'div',
          { class: 'leaderboard-tabs', style: 'margin-bottom: 0.5rem; flex-wrap: wrap;' },
          Object.entries(LEADERBOARD_MODES).map(([id, modeMeta]) =>
            el('button', {
              type: 'button',
              class: `tab-btn${trainerId === id ? ' is-active' : ''}`,
              text: modeMeta.title,
              onClick: () => onSelectTrainer(id),
            }),
          ),
        )
      : null,

    el('div', { class: 'leaderboard-tabs' }, [
      el('button', {
        type: 'button',
        class: `tab-btn${tab === 'daily' ? ' is-active' : ''}`,
        text: meta.dailyTab,
        onClick: () => onSelectTab('daily'),
      }),
      el('button', {
        type: 'button',
        class: `tab-btn${tab === 'all-time' ? ' is-active' : ''}`,
        text: meta.allTimeTab,
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
              ? hasPlayedActiveDate
                ? el('div', { class: 'daily-challenge-pill' }, [
                    el('span', { class: 'badge badge-accent', text: `Letter "${challenge.letter}"` }),
                    el('span', { text: challenge.categoryLabel }),
                  ])
                : el('div', { class: 'daily-challenge-pill' }, [
                    el('span', { class: 'badge', text: 'Hidden until played' }),
                  ])
              : null,
          ]),
          renderLeaderboardTable(dailyRows, currentUser, 'daily', trainerId),
        ])
      : el('div', {}, [
          el('p', {
            class: 'muted leaderboard-caption',
            text: meta.allTimeCaption,
          }),
          renderLeaderboardTable(allTimeRows, currentUser, 'all-time', trainerId),
        ]),
  ]);
}

/** Archive: every past day, with what is left per trainer and variant (FR-39). */
export function archiveView({ entries, adminMode = false, onPlay, onBack }) {
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
                    variant.played && !adminMode
                      ? el('span', {
                          class: 'badge badge-done',
                          text: `${trainerState.variantLabels?.[variant.key] ?? variantLabel(trainerState.variantKind, variant.key)} · ${variant.score}`,
                        })
                      : el('button', {
                          type: 'button',
                          class: 'ghost small',
                          text:
                            variant.played && adminMode
                              ? `${trainerState.variantLabels?.[variant.key] ?? variantLabel(trainerState.variantKind, variant.key)} · ${variant.score} (Replay)`
                              : trainerState.variantLabels?.[variant.key] ?? variantLabel(trainerState.variantKind, variant.key),
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
