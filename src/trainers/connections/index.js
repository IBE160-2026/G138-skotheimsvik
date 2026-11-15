/**
 * ConnectionGrid — 4x4 Category Link Puzzle.
 *
 * A grid of 16 words is dealt from 4 distinct hidden categories of 4 words each.
 * Select 4 words that share a common thread and submit to lock in the group.
 * Three mistakes are allowed before the round ends!
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';

export const CONNECTION_GROUPS = Object.freeze([
  // Tier 1 — Clear, distinct everyday & knowledge categories
  { id: 'planets', title: 'Planets in our Solar System', words: ['Mercury', 'Venus', 'Mars', 'Saturn'], tier: 1 },
  { id: 'nordic', title: 'Nordic Countries', words: ['Norway', 'Sweden', 'Denmark', 'Finland'], tier: 1 },
  { id: 'citrus', title: 'Citrus Fruits', words: ['Lemon', 'Lime', 'Orange', 'Grapefruit'], tier: 1 },
  { id: 'chess', title: 'Chess Pieces', words: ['Rook', 'Bishop', 'Knight', 'Pawn'], tier: 1 },
  { id: 'pasta', title: 'Types of Pasta', words: ['Penne', 'Fusilli', 'Rigatoni', 'Farfalle'], tier: 1 },
  { id: 'noble-gases', title: 'Noble Gases', words: ['Helium', 'Neon', 'Argon', 'Krypton'], tier: 1 },
  { id: 'strings', title: 'Stringed Instruments', words: ['Violin', 'Cello', 'Harp', 'Ukulele'], tier: 1 },
  { id: 'oceans', title: 'World Oceans', words: ['Pacific', 'Atlantic', 'Indian', 'Arctic'], tier: 1 },
  { id: 'browsers', title: 'Web Browsers', words: ['Chrome', 'Firefox', 'Safari', 'Edge'], tier: 1 },
  { id: 'gemstones', title: 'Precious Gemstones', words: ['Ruby', 'Emerald', 'Sapphire', 'Diamond'], tier: 1 },
  { id: 'cheese', title: 'Varieties of Cheese', words: ['Cheddar', 'Gouda', 'Brie', 'Mozzarella'], tier: 1 },
  { id: 'coffee', title: 'Espresso Drinks', words: ['Latte', 'Cappuccino', 'Macchiato', 'Americano'], tier: 1 },

  // Tier 2 — Pop culture, gaming, geography & science connections
  { id: 'rockstar-protags', title: 'Rockstar Games Protagonists', words: ['Arthur', 'Trevor', 'Niko', 'CJ'], tier: 2 },
  { id: 'fortnite-pois', title: 'Classic Fortnite Locations', words: ['Tilted', 'Pleasant', 'Retail', 'Salty'], tier: 2 },
  { id: 'zelda-items', title: 'Legend of Zelda Items', words: ['Hookshot', 'Ocarina', 'Rupee', 'Triforce'], tier: 2 },
  { id: 'greek-gods', title: 'Olympian Gods', words: ['Apollo', 'Athena', 'Hermes', 'Poseidon'], tier: 2 },
  { id: 'tarantino', title: 'Quentin Tarantino Films', words: ['Django', 'Jackie', 'Inglourious', 'Reservoir'], tier: 2 },
  { id: 'nolan', title: 'Christopher Nolan Films', words: ['Inception', 'Memento', 'Tenet', 'Dunkirk'], tier: 2 },
  { id: 'prog-langs', title: 'Programming Languages', words: ['Python', 'Rust', 'Swift', 'Kotlin'], tier: 2 },
  { id: 'currencies', title: 'World Currencies', words: ['Yen', 'Peso', 'Krone', 'Rupee'], tier: 2 },
  { id: 'martial-arts', title: 'Martial Arts', words: ['Judo', 'Karate', 'Aikido', 'Kendo'], tier: 2 },
  { id: 'clouds', title: 'Types of Clouds', words: ['Cirrus', 'Cumulus', 'Stratus', 'Nimbus'], tier: 2 },
  { id: 'bones', title: 'Bones in the Human Body', words: ['Femur', 'Tibia', 'Radius', 'Ulna'], tier: 2 },
  { id: 'island-nations', title: 'Island Nations', words: ['Iceland', 'Madagascar', 'Cuba', 'Malta'], tier: 2 },

  // Tier 3 — Clever wordplay, homographs & tricky overlaps
  { id: 'keyboard-keys', title: 'Keys on a Computer Keyboard', words: ['Shift', 'Return', 'Escape', 'Tab'], tier: 3 },
  { id: 'card-games', title: 'Classic Card Games', words: ['Bridge', 'Hearts', 'Spades', 'Poker'], tier: 3 },
  { id: 'shakespeare', title: 'Shakespeare Tragedies', words: ['Hamlet', 'Othello', 'Macbeth', 'Lear'], tier: 3 },
  { id: 'moon-missions', title: 'Spacecraft & Missions', words: ['Apollo', 'Gemini', 'Voyager', 'Cassini'], tier: 3 },
  { id: 'palindromes', title: 'Palindromes (Read Same Backwards)', words: ['Kayak', 'Radar', 'Civic', 'Level'], tier: 3 },
  { id: 'silent-k', title: 'Words Starting with a Silent K', words: ['Knight', 'Knuckle', 'Knead', 'Knack'], tier: 3 },
  { id: 'fire-words', title: 'Words That Can Follow "Fire"', words: ['Wall', 'Work', 'Fly', 'Place'], tier: 3 },
  { id: 'gold-words', title: 'Words That Can Follow "Gold"', words: ['Rush', 'Mine', 'Fish', 'Leaf'], tier: 3 },
  { id: 'baltic-capitals', title: 'European Capitals', words: ['Riga', 'Tallinn', 'Vilnius', 'Bern'], tier: 3 },
  { id: 'landlocked-sa', title: 'South American Countries', words: ['Bolivia', 'Paraguay', 'Chile', 'Peru'], tier: 3 },
]);

const BAND_MAX_TIER = Object.freeze({
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 3,
});

/**
 * Pick 4 groups of 4 words such that all 16 words are completely unique.
 */
export function dealConnectionBoard(rng, maxTier = 3) {
  const candidates = rng.shuffle(CONNECTION_GROUPS.filter((g) => g.tier <= maxTier));
  const pickedGroups = [];
  const usedWords = new Set();

  for (const group of candidates) {
    if (pickedGroups.length >= 4) break;
    const lowerWords = group.words.map((w) => w.toLocaleLowerCase());
    if (lowerWords.some((w) => usedWords.has(w))) continue;
    for (const w of lowerWords) usedWords.add(w);
    pickedGroups.push({
      id: group.id,
      title: group.title,
      words: [...group.words],
    });
  }

  // Fallback to full pool if filtered tier had fewer than 4 disjoint groups
  if (pickedGroups.length < 4) {
    for (const group of rng.shuffle(CONNECTION_GROUPS)) {
      if (pickedGroups.length >= 4) break;
      const lowerWords = group.words.map((w) => w.toLocaleLowerCase());
      if (lowerWords.some((w) => usedWords.has(w))) continue;
      for (const w of lowerWords) usedWords.add(w);
      pickedGroups.push({
        id: group.id,
        title: group.title,
        words: [...group.words],
      });
    }
  }

  const allCells = [];
  for (const group of pickedGroups) {
    for (const word of group.words) {
      allCells.push({ word, groupId: group.id, groupTitle: group.title });
    }
  }

  return {
    groups: pickedGroups,
    cells: rng.shuffle(allCells),
  };
}

export function normaliseSelectionKey(words) {
  if (!Array.isArray(words)) return '';
  return words
    .map((w) => String(w).trim().toLocaleLowerCase())
    .sort()
    .join('|');
}

export const connectionGridTrainer = {
  id: 'connection-grid',
  categoryId: 'connection-grid',
  name: 'ConnectionGrid',
  description:
    'Find the 4 hidden categories that link 16 words into groups of 4. Watch out for overlapping red herrings — three mistakes allowed!',
  roundMode: 'lives',
  variantKind: 'band',
  scoreDirection: 'higher',
  headlineScore: 'correct',
  renderer: 'connection-grid',
  scoreLabel: 'Groups solved',
  modeParam: 3,
  topics: [
    { id: 'tier-1', label: 'Direct Categories' },
    { id: 'tier-2', label: 'Knowledge & Pop Culture' },
    { id: 'tier-3', label: 'Wordplay & Red Herrings' },
  ],

  practiceFilters: {
    band: {
      label: 'Difficulty',
      kind: 'single',
      options: [
        { id: 'beginner', label: 'Beginner' },
        { id: 'intermediate', label: 'Intermediate' },
        { id: 'advanced', label: 'Advanced' },
        { id: 'expert', label: 'Expert' },
      ],
      default: 'intermediate',
    },
  },

  createGenerator({ puzzleDate, variantKey = 'beginner', practice = false, filters = null }) {
    const activeBand = practice ? (filters?.band ?? variantKey) : variantKey;
    const rng = createRng(
      practice ? practiceSeed() : seedFor('connection-grid', activeBand, puzzleDate),
    );
    const maxTier = BAND_MAX_TIER[activeBand] ?? 3;

    let board = dealConnectionBoard(rng, maxTier);
    let solvedGroupIds = new Set();

    return {
      next(context) {
        if (context?.lastCorrect && Array.isArray(context.lastSubmission)) {
          const submittedKey = normaliseSelectionKey(context.lastSubmission);
          const matchedGroup = board.groups.find(
            (g) => normaliseSelectionKey(g.words) === submittedKey,
          );
          if (matchedGroup) {
            solvedGroupIds.add(matchedGroup.id);
          }
        }

        // When all 4 groups on the current board are solved, end the round cleanly!
        if (solvedGroupIds.size >= board.groups.length) {
          return null;
        }

        const unsolvedGroups = board.groups.filter((g) => !solvedGroupIds.has(g.id));
        const solvedGroups = board.groups.filter((g) => solvedGroupIds.has(g.id));
        const remainingCells = board.cells.filter((c) => !solvedGroupIds.has(c.groupId));

        return {
          kind: 'connection-grid',
          key: `connection-grid:${solvedGroupIds.size}:${context?.index ?? 0}`,
          topicId: `tier-${maxTier}`,
          topicLabel: 'Category Link',
          question: 'Select 4 words that share a common connection',
          groups: board.groups,
          solvedGroups,
          unsolvedGroups,
          remainingCells,
          // Used by matrix tests & formatExpected
          answer: unsolvedGroups[0]?.words ?? [],
          displayAnswer: unsolvedGroups[0]
            ? `${unsolvedGroups[0].title}: ${unsolvedGroups[0].words.join(', ')}`
            : '4 matching words',
        };
      },
    };
  },
};
