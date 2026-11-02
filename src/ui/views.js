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
import { variantLabel, variantsFor, describeRound, modeParamFor } from '../core/variants.js';
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

/** A thin progress rail showing how much of something is done. */
function meter(done, total) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return el('div', { class: `meter${percent === 100 ? ' meter-done' : ''}` }, [
    el('span', { class: 'meter-fill', style: `width: ${percent}%;` }),
  ]);
}

/** Home: the three categories and what is left in each today (FR-1). */
export function categoriesView({ today, categories, registry, progress, onCategory, onArchive, onProgress }) {
  let allTotal = 0;
  let allSpent = 0;

  const cards = categories.map((category) => {
    const trainers = registry.trainersIn(category.id);
    const total = trainers.reduce((sum, trainer) => sum + variantsFor(trainer).length, 0);
    const spent = trainers.reduce(
      (sum, trainer) => sum + progress.spentVariants(trainer.id, today).length,
      0,
    );
    allTotal += total;
    allSpent += spent;

    return el('article', { class: 'card category-card' }, [
      el('div', { class: 'category-icon', 'aria-hidden': 'true', text: category.icon }),
      el('h3', { text: category.name }),
      el('p', { class: 'muted', text: category.tagline }),
      el('p', {
        class: 'remaining',
        text: spent === total ? 'All done today' : `${total - spent} of ${total} left today`,
      }),
      meter(spent, total),
      el('button', {
        type: 'button',
        class: 'primary',
        text: `Open ${category.name}`,
        onClick: () => onCategory(category.id),
      }),
    ]);
  });

  return el('section', {}, [
    el('div', { class: 'hero' }, [
      el('div', { class: 'hero-text' }, [
        el('h1', { text: "Today's puzzles" }),
        el('p', { class: 'muted' }, [
          `${formatDate(today)} — pick your own level. Everyone playing that level today gets the same puzzle.`,
        ]),
      ]),
      el('div', { class: 'hero-meter' }, [
        el('p', {
          class: 'hero-count',
          text: `${allTotal - allSpent} of ${allTotal} puzzles left`,
        }),
        meter(allSpent, allTotal),
      ]),
    ]),
    el('div', { class: 'grid' }, cards),
    el('div', { class: 'row-actions' }, [
      el('button', { type: 'button', class: 'ghost', text: 'Archive', onClick: onArchive }),
      el('button', { type: 'button', class: 'ghost', text: 'Progress', onClick: onProgress }),
    ]),
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
        const variants = variantsFor(trainer);
        const spent = progress.spentVariants(trainer.id, today);
        return el('article', { class: 'card' }, [
          el('h3', { text: trainer.name }),
          el('p', { class: 'muted', text: trainer.description }),
          el('p', { class: 'mode-label', text: ROUND_MODE_LABEL[trainer.roundMode] }),
          el('p', {
            class: 'remaining',
            text:
              spent.length === variants.length
                ? 'All done today'
                : `${variants.length - spent.length} of ${variants.length} left today`,
          }),
          meter(spent.length, variants.length),
          el('button', {
            type: 'button',
            class: 'primary',
            text: 'Choose level',
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
  const axisLabel = trainer.variantKind === 'band' ? 'Difficulty' : 'Board size';

  const options = variantsFor(trainer).map((key) => {
    const played = spent.has(key);
    const best = progress.personalBest(trainer.id, key);
    return el('article', { class: `card variant-card${played ? ' variant-done' : ''}` }, [
      trainer.variantKind === 'band'
        ? el('span', { class: `band-stripe band-${key}`, 'aria-hidden': 'true' })
        : null,
      el('h3', { text: variantLabel(trainer.variantKind, key) }),
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
  return el('section', { class: 'briefing' }, [
    el('button', { type: 'button', class: 'ghost back', text: '← Back', onClick: onBack }),
    el('h1', { text: trainer.name }),
    el('p', { class: 'muted', text: trainer.description }),
    el('div', { class: 'brief-stats' }, [
      stat('Date', formatDate(puzzleDate)),
      stat(trainer.variantKind === 'band' ? 'Difficulty' : 'Board', variantLabel(trainer.variantKind, variantKey)),
      stat('Round ends', ROUND_MODE_LABEL[trainer.roundMode]),
    ]),
    el('p', { class: 'brief-mode', text: describeRound(trainer, variantKey) }),
    el('p', { class: 'warning' }, [
      'Starting spends this attempt. If you leave early the round still counts, with whatever you scored.',
    ]),
    isArchive ? el('p', { class: 'muted', text: 'Playing from the archive.' }) : null,
    el('div', { class: 'row-actions' }, [
      el('button', { type: 'button', class: 'primary', text: 'Start', onClick: onStart }),
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

/** Results, with comparison for scored rounds only (FR-77 to FR-85). */
export function resultsView({ result, trainer, comparison, isPractice, onBack, onArchive, onProgress }) {
  const weak = analyseWeakAreas(result.topicStats ?? []);

  return el('section', { class: 'results' }, [
    el('h1', { text: isPractice ? 'Practice complete' : 'Round complete' }),
    el('p', { class: 'muted' }, [
      `${trainer.name} — ${variantLabel(trainer.variantKind, result.variantKey)}`,
    ]),
    el('p', { class: 'end-reason', text: END_REASON_LABEL[result.endedBy] ?? 'Round over' }),

    el('div', { class: 'result-stats' }, [
      stat(trainer.scoreLabel ?? 'Score', String(result.score), 'stat-headline'),
      stat('Correct', `${result.correctCount} of ${result.totalAnswered}`),
      stat('Accuracy', `${result.accuracy}%`),
      stat('Average time', `${(result.avgAnswerTimeMs / 1000).toFixed(1)}s`),
      stat('Best streak', String(result.bestStreak)),
      stat('Round length', formatDuration(result.elapsedMs)),
    ]),

    isPractice
      ? el('p', { class: 'muted practice-note' }, [
          'Practice rounds are not recorded, so there is nothing to compare against.',
        ])
      : el('div', { class: 'comparison' }, [
          el('p', { class: `compare compare-${comparison.vsPrevious.status}`, text: comparison.vsPrevious.message }),
          el('p', { class: `compare compare-${comparison.vsBest.status}`, text: comparison.vsBest.message }),
        ]),

    weak.status === 'ok' || weak.status === 'insufficient-data'
      ? el('p', { class: 'weak-area', text: weak.message })
      : null,

    el('div', { class: 'row-actions' }, [
      el('button', { type: 'button', class: 'primary', text: 'Back to trainer', onClick: onBack }),
      el('button', { type: 'button', class: 'ghost', text: 'Archive', onClick: onArchive }),
      el('button', { type: 'button', class: 'ghost', text: 'Progress', onClick: onProgress }),
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
                el('h4', { text: trainerState.name }),
                el(
                  'div',
                  { class: 'archive-variants' },
                  trainerState.variants.map((variant) =>
                    variant.played
                      ? el('span', {
                          class: 'badge badge-done',
                          text: `${variantLabel(trainerState.variantKind, variant.key)} · ${variant.score}`,
                        })
                      : el('button', {
                          type: 'button',
                          class: 'ghost small',
                          text: variantLabel(trainerState.variantKind, variant.key),
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
      'aria-label': trainer.variantKind === 'band' ? 'Difficulty' : 'Board size',
      onChange: (event) => onSelect({ trainerId: trainer.id, variantKey: event.target.value }),
    },
    variants.map((key) =>
      el('option', {
        value: key,
        selected: key === variantKey ? 'selected' : null,
        text: variantLabel(trainer.variantKind, key),
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
