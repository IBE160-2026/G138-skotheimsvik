/**
 * Word Chain (Last-Letter Relay) — 30-second per-word category relay.
 *
 * Starts with a random letter (e.g. "J"). You name an entry in the category that
 * starts with that letter (e.g. "J. Cole"). Its last letter ("E") becomes the
 * starting letter for your next entry (e.g. "Eric Clapton" -> "N" -> ...).
 * Every valid word resets the 30-second timer!
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';
import { normaliseText, compactKey, matchWordRushEntry } from '../../core/answer.js';
import {
  buildWordRushCategories,
  verifyWordRushCandidateOnline,
  registerLearnedWord,
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
      // Keep only alternatives that start with the same first letter as the canonical label
      // so that in Word Chain, an entry starting with 'E' ("Eric Clapton") is only matched on 'E',
      // while still allowing "J Cole" / "J. Cole".
      const firstChar = normaliseText(label).charAt(0);
      const rawAlts =
        typeof raw === 'object' && Array.isArray(raw.alternatives) ? raw.alternatives : [];
      const filteredAlts = rawAlts.filter(
        (alt) => normaliseText(alt).charAt(0) === firstChar,
      );
      out.push({
        label,
        alternatives: filteredAlts,
      });
    }
    return out;
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

  // Only fixed, defined categories — no open-ended "All Categories" option
  const categoriesMap = {
    musicians: wrapCat(rawCategories.musicians),
    actors: wrapCat(rawCategories.actors),
    athletes: wrapCat(rawCategories.athletes),
    music: wrapCat(rawCategories.music),
    movies: wrapCat(rawCategories.movies),
    sport: wrapCat(rawCategories.sport),
    food: wrapCat(rawCategories.food),
    countries: wrapCat(rawCategories.countries),
    capitals: wrapCat(rawCategories.capitals),
    gaming: wrapCat(rawCategories.gaming),
    'fortnite-weapons': wrapCat(rawCategories['fortnite-weapons']),
    'rockstar-games': wrapCat(rawCategories['rockstar-games']),
  };

  const categoryKeys = Object.keys(categoriesMap).filter(
    (k) => categoriesMap[k] && categoriesMap[k].entries.length > 0,
  );

  function resolveWordChainSetup({ puzzleDate, variantKey, practice = false, filters = null }) {
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
    // Group entries by starting letter so we pick a random starting letter with plenty of entries
    const byStartLetter = new Map();
    for (const entry of category.entries) {
      const first = normaliseText(entry.label).charAt(0).toUpperCase();
      if (!first) continue;
      if (!byStartLetter.has(first)) byStartLetter.set(first, []);
      byStartLetter.get(first).push(entry);
    }

    const validStartLetters = [...byStartLetter.entries()]
      .filter(([letter, list]) => list.length >= 5 && !['X', 'Q', 'Z'].includes(letter))
      .map(([letter]) => letter)
      .sort();

    const fallbackLetters = [...byStartLetter.keys()].sort();
    const starterLetter =
      rng.pick(validStartLetters.length > 0 ? validStartLetters : fallbackLetters) ?? 'J';
    const starterPool = byStartLetter.get(starterLetter) ?? category.entries;
    const starterEntry = rng.pick(starterPool) ?? { label: 'J. Cole', alternatives: [] };

    return {
      categoryId: category.id,
      categoryLabel: category.label,
      categoryGroup: category.group,
      allEntries: category.entries.map((e) => ({
        label: e.label,
        alternatives: [...(e.alternatives ?? [])],
      })),
      starterLetter,
      starterWord: starterEntry.label,
    };
  }

  return {
    id: 'word-chain',
    categoryId: 'word-chain',
    name: 'Word Chain',
    description:
      'Last-letter word relay. Start with today’s random letter (e.g. J → J. Cole), then each next entry must start with the LAST letter of the previous one (E → Eric Clapton → N...). 30 seconds per word!',
    roundMode: 'lives',
    noLives: true,
    promptTimeLimitSeconds: 30,
    variantKind: 'pool',
    variants: ['daily'],
    variantLabels: {
      daily: 'Daily Challenge (Shared)',
    },
    noPractice: true,
    scoreDirection: 'higher',
    headlineScore: 'correct',
    renderer: 'word-chain',
    scoreLabel: 'Chain length',
    modeParam: 1,
    topics: categoryKeys.map((id) => ({ id, label: categoriesMap[id].label })),

    async verifyCandidateOnline(word, prompt, fetchImpl) {
      const catId = prompt?.topicId ?? '';
      if (!catId || !categoriesMap[catId]) return { approved: false };
      const res = await verifyWordRushCandidateOnline({
        word,
        letter: prompt?.letter ?? '',
        categoryId: catId,
        categoryGroup: prompt?.categoryGroup ?? '',
        strictFirstLetter: true,
        fetchImpl,
      });
      if (res?.approved) {
        const canonical = res.canonicalLabel ?? String(word).trim();
        const firstChar = normaliseText(canonical).charAt(0);
        const rawAlt = String(word).trim();
        const alts = normaliseText(rawAlt).charAt(0) === firstChar ? [rawAlt] : [];
        const entry = { label: canonical, alternatives: alts };
        registerLearnedWord(rawCategories, {
          categoryId: catId,
          label: canonical,
          alternatives: alts,
          sync: fetchImpl === globalThis.fetch,
          fetchImpl,
        });
        const k = compactKey(canonical);
        if (categoriesMap[catId]?.entries) {
          const exists = categoriesMap[catId].entries.some((e) => compactKey(e.label) === k);
          if (!exists) categoriesMap[catId].entries.push(entry);
        }
      }
      return res;
    },

    createGenerator({ puzzleDate, variantKey, practice = false, filters = null }) {
      const setup = resolveWordChainSetup({
        puzzleDate,
        variantKey,
        practice,
        filters,
      });

      const chain = [];
      const usedCompact = new Set();

      return {
        next(context) {
          if (context?.lastCorrect && context?.lastSubmission) {
            const currentReqLetter =
              chain.length === 0 ? setup.starterLetter : lastAlphaLetter(chain[chain.length - 1]);
            const validForStep = setup.allEntries.filter(
              (entry) => normaliseText(entry.label).charAt(0).toUpperCase() === currentReqLetter,
            );
            const matched = matchWordRushEntry(
              {
                validWords: validForStep,
                foundWords: [],
                letter: currentReqLetter,
                strictFirstLetter: true,
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

          // First turn: the game gives the player the starting letter (e.g. "J"), and the player names the first entry starting with that letter!
          if (chain.length === 0) {
            const starterLetter = setup.starterLetter;
            const validStarters = setup.allEntries.filter(
              (entry) => normaliseText(entry.label).charAt(0).toUpperCase() === starterLetter,
            );
            const activeStarters =
              validStarters.length > 0 ? validStarters : setup.allEntries;
            const firstEntry = activeStarters[0];
            if (!firstEntry) return null;
            return {
              kind: 'word-rush',
              isWordChain: true,
              strictFirstLetter: true,
              key: `word-chain:${setup.categoryId}:0:${starterLetter}`,
              topicId: setup.categoryId,
              topicLabel: setup.categoryLabel,
              categoryGroup: setup.categoryGroup,
              question: `Start the chain with a ${setup.categoryLabel} entry starting with "${starterLetter}"!`,
              starterLetter,
              starterWord: null,
              previousWord: null,
              letter: starterLetter,
              answer: firstEntry.label,
              validWords: activeStarters,
              foundWords: [],
              chainWords: [],
              totalPossible: activeStarters.length,
            };
          }

          const lastWord = chain[chain.length - 1];
          const requiredLetter = lastAlphaLetter(lastWord);
          const validWordsForStep = setup.allEntries.filter(
            (entry) => normaliseText(entry.label).charAt(0).toUpperCase() === requiredLetter,
          );

          const activeValidWords = validWordsForStep;
          const firstUnused = activeValidWords.find(
            (e) => !usedCompact.has(compactKey(e.label)),
          );
          const fallbackAnswer = firstUnused?.label ?? `${requiredLetter}`;

          return {
            kind: 'word-rush',
            isWordChain: true,
            strictFirstLetter: true,
            key: `word-chain:${setup.categoryId}:${chain.length}:${lastWord}`,
            topicId: setup.categoryId,
            topicLabel: setup.categoryLabel,
            categoryGroup: setup.categoryGroup,
            question: `Next entry must start with "${requiredLetter}" (from ${lastWord})`,
            starterLetter: setup.starterLetter,
            starterWord: chain[0],
            previousWord: lastWord,
            letter: requiredLetter,
            answer: fallbackAnswer,
            validWords: activeValidWords,
            foundWords: [...chain],
            chainWords: [...chain],
            totalPossible: activeValidWords.length,
          };
        },
      };
    },
  };
}