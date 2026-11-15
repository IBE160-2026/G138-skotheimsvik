/**
 * Word Chain (Last-Letter Relay) — 90-second category word relay.
 *
 * Start with a seeded starter word in the chosen category. Each word you type
 * must belong to the category AND start with the LAST letter of the previous
 * word (e.g. Pizza -> Apple -> Eggplant -> Taco). No repeats allowed!
 * Uses both the rich curated category lists and the live public API verification
 * engine (TheMealDB, Datamuse, Wikipedia) for unseen words.
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';
import { normaliseText, compactKey, matchWordRushEntry } from '../../core/answer.js';
import {
  buildWordRushCategories,
  verifyWordRushCandidateOnline,
} from '../word-rush/index.js';

export const WORD_CHAIN_DURATION_SECONDS = 90;

/**
 * Extract the last alphabetic letter (A-Z) of a word.
 * @param {string} word
 * @returns {string}
 */
export function lastAlphaLetter(word) {
  const norm = normaliseText(word);
  for (let i = norm.length - 1; i >= 0; i -= 1) {
    const ch = norm[i];
    if (ch >= 'a' && ch <= 'z') return ch.toUpperCase();
  }
  return 'A';
}

export function createWordChainTrainer({ countries = [], people = [] } = {}) {
  const rawCategories = buildWordRushCategories({ countries, people });

  function normaliseCategoryItems(items = []) {
    const out = [];
    const seen = new Set();
    for (const raw of items) {
      const label = typeof raw === 'string' ? raw : raw?.label;
      if (!label) continue;
      const k = compactKey(label);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push({
        label,
        alternatives: typeof raw === 'object' && Array.isArray(raw.alternatives) ? raw.alternatives : [],
      });
    }
    return out;
  }

  // Build an "all" open-domain category plus the main themed categories
  const allEntriesMap = new Map();
  for (const cat of Object.values(rawCategories)) {
    for (const entry of normaliseCategoryItems(cat.items)) {
      const k = compactKey(entry.label);
      if (k && !allEntriesMap.has(k)) {
        allEntriesMap.set(k, entry);
      }
    }
  }

  function wrapCat(cat) {
    if (!cat) return null;
    return {
      id: cat.id,
      label: cat.label,
      group: cat.group,
      entries: normaliseCategoryItems(cat.items),
    };
  }

  const categoriesMap = {
    all: {
      id: 'all',
      label: 'All Categories (Open Relay)',
      group: 'General',
      entries: [...allEntriesMap.values()],
    },
    food: wrapCat(rawCategories.food),
    countries: wrapCat(rawCategories.countries),
    sport: wrapCat(rawCategories.sport),
    gaming: wrapCat(rawCategories.gaming),
    movies: wrapCat(rawCategories.movies),
    music: wrapCat(rawCategories.music),
  };

  const categoryKeys = Object.keys(categoriesMap).filter((k) => categoriesMap[k]);
  const variantLabels = {
    daily: 'Daily Challenge (Shared)',
    ...Object.fromEntries(categoryKeys.map((k) => [k, categoriesMap[k].label])),
  };

  function resolveWordChainSetup( { puzzleDate, variantKey, practice = false, filters = null }) {
    const rng = createRng(
      practice
        ? practiceSeed()
        : seedFor('word-chain', `${variantKey}:${puzzleDate}`, puzzleDate),
    );

    let chosenCategoryId = variantKey;
    if (practice && filters?.category && categoriesMap[filters.category]) {
      chosenCategoryId = filters.category;
    } else if (!categoriesMap[chosenCategoryId]) {
      chosenCategoryId = rng.pick(categoryKeys);
    }

    const category = categoriesMap[chosenCategoryId];
    // Pick a starter word whose ending letter has at least 4 valid follow-up words
    const byStartLetter = new Map();
    for (const entry of category.entries) {
      const first = normaliseText(entry.label).charAt(0).toUpperCase();
      if (!first) continue;
      if (!byStartLetter.has(first)) byStartLetter.set(first, []);
      byStartLetter.get(first).push(entry);
    }

    const goodStarters = category.entries.filter((entry) => {
      const endL = lastAlphaLetter(entry.label);
      return (byStartLetter.get(endL)?.length ?? 0) >= 4;
    });

    const starterPool = goodStarters.length > 0 ? goodStarters : category.entries;
    const starterEntry = rng.pick(starterPool) ?? { label: 'Apple', alternatives: [] };

    return {
      categoryId: category.id,
      categoryLabel: category.label,
      categoryGroup: category.group,
      allEntries: category.entries.map((e) => ({
        label: e.label,
        alternatives: [...(e.alternatives ?? [])],
      })),
      starterWord: starterEntry.label,
    };
  }

  return {
    id: 'word-chain',
    categoryId: 'word-chain',
    name: 'Word Chain',
    description:
      '90-second last-letter word relay. Every word you type must belong to the category and begin with the LAST letter of the previous word!',
    roundMode: 'timed',
    variantKind: 'pool',
    variants: ['daily', ...categoryKeys],
    variantLabels,
    scoreDirection: 'higher',
    headlineScore: 'correct',
    renderer: 'word-chain',
    scoreLabel: 'Chain length',
    modeParam: WORD_CHAIN_DURATION_SECONDS,
    topics: categoryKeys.map((id) => ({ id, label: categoriesMap[id].label })),

    practiceFilters: {
      category: {
        label: 'Category',
        kind: 'single',
        options: categoryKeys.map((id) => ({ id, label: categoriesMap[id].label })),
        default: 'food',
      },
    },

    verifyCandidateOnline(word, prompt, fetchImpl) {
      return verifyWordRushCandidateOnline({
        word,
        letter: prompt?.letter ?? '',
        categoryId: prompt?.topicId === 'all' ? 'food' : (prompt?.topicId ?? ''),
        categoryGroup: prompt?.categoryGroup ?? '',
        fetchImpl,
      });
    },

    createGenerator({ puzzleDate, variantKey, practice = false, filters = null }) {
      const setup = resolveWordChainSetup({
        puzzleDate,
        variantKey,
        practice,
        filters,
      });

      const chain = [setup.starterWord];
      const usedCompact = new Set([compactKey(setup.starterWord)]);

      return {
        next(context) {
          if (context?.lastCorrect && context?.lastSubmission) {
            const currentReqLetter = lastAlphaLetter(chain[chain.length - 1]);
            const validForLetter = setup.allEntries.filter(
              (entry) => normaliseText(entry.label).charAt(0).toUpperCase() === currentReqLetter,
            );
            const matched = matchWordRushEntry(
              {
                validWords: validForLetter,
                foundWords: [],
                letter: currentReqLetter,
              },
              context.lastSubmission,
            );
            const canonicalLabel =
              matched.matchedEntry?.label ?? String(context.lastSubmission).trim();
            const key = compactKey(canonicalLabel);
            if (key && !usedCompact.has(key)) {
              usedCompact.add(key);
              chain.push(canonicalLabel);
            }
          }

          const lastWord = chain[chain.length - 1];
          const requiredLetter = lastAlphaLetter(lastWord);
          const validWordsForStep = setup.allEntries.filter(
            (entry) => normaliseText(entry.label).charAt(0).toUpperCase() === requiredLetter,
          );

          // If a rare ending letter has very few words in a narrow category, include fallback open pool
          const activeValidWords =
            validWordsForStep.length >= 2
              ? validWordsForStep
              : allEntriesMap.size > 0
                ? [...allEntriesMap.values()].filter(
                    (entry) =>
                      normaliseText(entry.label).charAt(0).toUpperCase() === requiredLetter,
                  )
                : validWordsForStep;

          const firstUnused = activeValidWords.find(
            (e) => !usedCompact.has(compactKey(e.label)),
          );
          if (!firstUnused) return null;

          return {
            kind: 'word-rush',
            isWordChain: true,
            key: `word-chain:${setup.categoryId}:${chain.length}:${lastWord}`,
            topicId: setup.categoryId,
            topicLabel: setup.categoryLabel,
            categoryGroup: setup.categoryGroup,
            question: `Next word must start with "${requiredLetter}" (from ${lastWord})`,
            previousWord: lastWord,
            letter: requiredLetter,
            answer: firstUnused.label,
            validWords: activeValidWords,
            foundWords: chain.slice(1),
            chainWords: [...chain],
            totalPossible: activeValidWords.length,
          };
        },
      };
    },
  };
}
