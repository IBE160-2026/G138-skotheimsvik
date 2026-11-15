/**
 * Timeline Sort (Chronology Rush).
 *
 * A card-placement timeline game: you start with a chronological timeline of
 * historical milestones, inventions, cultural moments, and video game releases.
 * Each turn presents a new event card (without its year), and you must place
 * it in the right chronological slot (Before, Between, or After the cards
 * already on your timeline). Every correct placement grows the timeline by 1
 * card, making subsequent placements tighter and more challenging!
 */

import { createRng, seedFor, practiceSeed } from '../../core/rng.js';

export const TIMELINE_EVENTS = Object.freeze([
  // Ancient & Medieval (Tier 1 & 2)
  { title: 'Great Pyramid of Giza completed', year: -2560, category: 'History', tier: 1 },
  { title: 'First Olympic Games in Ancient Greece', year: -776, category: 'Sport & Culture', tier: 2 },
  { title: 'Roman Republic founded', year: -509, category: 'History', tier: 2 },
  { title: 'Assassination of Julius Caesar', year: -44, category: 'History', tier: 1 },
  { title: 'Destruction of Pompeii by Mount Vesuvius', year: 79, category: 'History', tier: 1 },
  { title: 'Fall of the Western Roman Empire', year: 476, category: 'History', tier: 1 },
  { title: 'Viking raid on Lindisfarne begins the Viking Age', year: 793, category: 'History', tier: 2 },
  { title: 'Battle of Hastings (Norman Conquest)', year: 1066, category: 'History', tier: 1 },
  { title: 'Signing of the Magna Carta', year: 1215, category: 'History', tier: 1 },
  { title: 'Black Death reaches Europe', year: 1347, category: 'History', tier: 1 },
  { title: 'Gutenberg invents the movable-type printing press', year: 1440, category: 'Science & Tech', tier: 1 },
  { title: 'Fall of Constantinople', year: 1453, category: 'History', tier: 2 },
  { title: 'Columbus reaches the Americas', year: 1492, category: 'History', tier: 1 },
  { title: 'Leonardo da Vinci begins painting the Mona Lisa', year: 1503, category: 'Art & Culture', tier: 1 },
  { title: 'Martin Luther posts the Ninety-five Theses', year: 1517, category: 'History', tier: 2 },
  { title: 'William Shakespeare writes Hamlet', year: 1600, category: 'Art & Culture', tier: 2 },
  { title: 'Galileo uses a telescope to observe Jupiter’s moons', year: 1610, category: 'Science & Tech', tier: 2 },
  { title: 'Isaac Newton publishes Principia Mathematica', year: 1687, category: 'Science & Tech', tier: 1 },

  // 18th & 19th Century
  { title: 'James Watt patents the improved steam engine', year: 1769, category: 'Science & Tech', tier: 2 },
  { title: 'United States Declaration of Independence', year: 1776, category: 'History', tier: 1 },
  { title: 'Storming of the Bastille (French Revolution)', year: 1789, category: 'History', tier: 1 },
  { title: 'Edward Jenner develops the smallpox vaccine', year: 1796, category: 'Science & Tech', tier: 2 },
  { title: 'Beethoven premieres Symphony No. 5', year: 1808, category: 'Art & Culture', tier: 2 },
  { title: 'Battle of Waterloo', year: 1815, category: 'History', tier: 1 },
  { title: 'First public steam railway opens in England', year: 1825, category: 'Science & Tech', tier: 2 },
  { title: 'Samuel Morse sends the first telegraph message', year: 1844, category: 'Science & Tech', tier: 2 },
  { title: 'Charles Darwin publishes On the Origin of Species', year: 1859, category: 'Science & Tech', tier: 1 },
  { title: 'Completion of the Suez Canal', year: 1869, category: 'History', tier: 2 },
  { title: 'Alexander Graham Bell patents the telephone', year: 1876, category: 'Science & Tech', tier: 1 },
  { title: 'Thomas Edison demonstrates the incandescent light bulb', year: 1879, category: 'Science & Tech', tier: 1 },
  { title: 'Karl Benz patents the first petrol automobile', year: 1886, category: 'Science & Tech', tier: 2 },
  { title: 'Eiffel Tower opens for the Paris World’s Fair', year: 1889, category: 'Art & Culture', tier: 1 },
  { title: 'Lumière brothers hold the first commercial film screening', year: 1895, category: 'Art & Culture', tier: 2 },
  { title: 'First modern Olympic Games held in Athens', year: 1896, category: 'Sport & Culture', tier: 1 },

  // 20th Century & Modern Era
  { title: 'Wright brothers make the first powered airplane flight', year: 1903, category: 'Science & Tech', tier: 1 },
  { title: 'Albert Einstein publishes Special Relativity (E=mc²)', year: 1905, category: 'Science & Tech', tier: 1 },
  { title: 'Roald Amundsen reaches the South Pole', year: 1911, category: 'History', tier: 2 },
  { title: 'Sinking of the RMS Titanic', year: 1912, category: 'History', tier: 1 },
  { title: 'Outbreak of World War I', year: 1914, category: 'History', tier: 1 },
  { title: 'Alexander Fleming discovers penicillin', year: 1928, category: 'Science & Tech', tier: 1 },
  { title: 'Wall Street Crash triggers the Great Depression', year: 1929, category: 'History', tier: 1 },
  { title: 'First FIFA World Cup held in Uruguay', year: 1930, category: 'Sport & Culture', tier: 2 },
  { title: 'Outbreak of World War II in Europe', year: 1939, category: 'History', tier: 1 },
  { title: 'United Nations founded after World War II', year: 1945, category: 'History', tier: 1 },
  { title: 'Invention of the transistor at Bell Labs', year: 1947, category: 'Science & Tech', tier: 3 },
  { title: 'Watson, Crick and Franklin reveal the structure of DNA', year: 1953, category: 'Science & Tech', tier: 2 },
  { title: 'Hillary and Tenzing reach the summit of Mount Everest', year: 1953, category: 'Sport & Culture', tier: 2 },
  { title: 'Soviet Union launches Sputnik 1, first artificial satellite', year: 1957, category: 'Science & Tech', tier: 1 },
  { title: 'Yuri Gagarin becomes the first human in space', year: 1961, category: 'Science & Tech', tier: 1 },
  { title: 'The Beatles release their debut album Please Please Me', year: 1963, category: 'Art & Culture', tier: 2 },
  { title: 'First Super Bowl played in Los Angeles', year: 1967, category: 'Sport & Culture', tier: 3 },
  { title: 'Apollo 11 Moon landing (Neil Armstrong & Buzz Aldrin)', year: 1969, category: 'Science & Tech', tier: 1 },
  { title: 'Atari releases Pong in arcades', year: 1972, category: 'Gaming & Pop Culture', tier: 2 },
  { title: 'Original Star Wars film premieres in cinemas', year: 1977, category: 'Art & Culture', tier: 1 },
  { title: 'Pac-Man released in arcades by Namco', year: 1980, category: 'Gaming & Pop Culture', tier: 2 },
  { title: 'Michael Jackson releases Thriller', year: 1982, category: 'Art & Culture', tier: 2 },
  { title: 'Super Mario Bros. launches on the NES', year: 1985, category: 'Gaming & Pop Culture', tier: 2 },
  { title: 'Chernobyl nuclear disaster', year: 1986, category: 'History', tier: 2 },
  { title: 'Fall of the Berlin Wall', year: 1989, category: 'History', tier: 1 },
  { title: 'Tim Berners-Lee proposes the World Wide Web', year: 1989, category: 'Science & Tech', tier: 2 },
  { title: 'Launch of the Hubble Space Telescope', year: 1990, category: 'Science & Tech', tier: 2 },
  { title: 'Dissolution of the Soviet Union', year: 1991, category: 'History', tier: 1 },
  { title: 'Nelson Mandela elected President of South Africa', year: 1994, category: 'History', tier: 1 },
  { title: 'Sony launches the original PlayStation in Japan', year: 1994, category: 'Gaming & Pop Culture', tier: 3 },
  { title: 'Dolly the sheep becomes the first cloned mammal', year: 1996, category: 'Science & Tech', tier: 2 },
  { title: 'Google is founded by Larry Page and Sergey Brin', year: 1998, category: 'Science & Tech', tier: 2 },
  { title: 'Launch of Wikipedia', year: 2001, category: 'Science & Tech', tier: 2 },
  { title: 'Euro banknotes and coins enter circulation', year: 2002, category: 'History', tier: 2 },
  { title: 'YouTube is founded and first video is uploaded', year: 2005, category: 'Science & Tech', tier: 2 },
  { title: 'Apple unveils the first iPhone', year: 2007, category: 'Science & Tech', tier: 1 },
  { title: 'Usain Bolt sets the 9.58s 100m world record in Berlin', year: 2009, category: 'Sport & Culture', tier: 2 },
  { title: 'Minecraft full 1.0 release by Mojang', year: 2011, category: 'Gaming & Pop Culture', tier: 2 },
  { title: 'CERN announces discovery of the Higgs boson', year: 2012, category: 'Science & Tech', tier: 3 },
  { title: 'Grand Theft Auto V launches worldwide', year: 2013, category: 'Gaming & Pop Culture', tier: 3 },
  { title: 'First direct detection of gravitational waves (LIGO)', year: 2015, category: 'Science & Tech', tier: 3 },
  { title: 'Fortnite Battle Royale launches', year: 2017, category: 'Gaming & Pop Culture', tier: 2 },
  { title: 'Event Horizon Telescope captures first image of a black hole', year: 2019, category: 'Science & Tech', tier: 2 },
  { title: 'James Webb Space Telescope launches on Christmas Day', year: 2021, category: 'Science & Tech', tier: 1 },
  { title: 'Argentina wins the FIFA World Cup in Qatar', year: 2022, category: 'Sport & Culture', tier: 2 },
]);

export function formatYear(year) {
  if (year < 0) return `${Math.abs(year)} BCE`;
  return String(year);
}

const BAND_MAX_TIER = Object.freeze({
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 3,
});

/**
 * Determine the valid insertion slot indices for a candidate event with `year`
 * into a sorted timeline of `timeline` events.
 * Slot `i` (0 .. timeline.length) means inserting at index `i`.
 */
export function validSlotsForYear(timeline, year) {
  const valid = [];
  for (let i = 0; i <= timeline.length; i += 1) {
    const leftOk = i === 0 || timeline[i - 1].year <= year;
    const rightOk = i === timeline.length || year <= timeline[i].year;
    if (leftOk && rightOk) valid.push(String(i));
  }
  return valid;
}

export const timelineSortTrainer = {
  id: 'timeline-sort',
  categoryId: 'timeline-sort',
  name: 'Timeline Sort',
  description:
    'Place historical milestones, inventions, and cultural moments in the right chronological spot on a growing timeline. Three mistakes allowed.',
  roundMode: 'lives',
  variantKind: 'band',
  scoreDirection: 'higher',
  headlineScore: 'correct',
  renderer: 'timeline-sort',
  scoreLabel: 'Cards placed',
  modeParam: 3,
  topics: [
    { id: 'History', label: 'History' },
    { id: 'Science & Tech', label: 'Science & Tech' },
    { id: 'Art & Culture', label: 'Art & Culture' },
    { id: 'Sport & Culture', label: 'Sport & Culture' },
    { id: 'Gaming & Pop Culture', label: 'Gaming & Pop Culture' },
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
      practice ? practiceSeed() : seedFor('timeline-sort', activeBand, puzzleDate),
    );
    const maxTier = BAND_MAX_TIER[activeBand] ?? 3;

    // Deduplicate by year so slots are unambiguous, then shuffle
    const rawPool = TIMELINE_EVENTS.filter((e) => e.tier <= maxTier);
    const shuffled = rng.shuffle(rawPool);
    const seenYears = new Set();
    const deck = [];
    for (const item of shuffled) {
      if (!seenYears.has(item.year)) {
        seenYears.add(item.year);
        deck.push(item);
      }
    }

    const timeline = deck.length > 0 ? [deck.shift()] : [];
    let currentCard = null;

    return {
      next(context) {
        // Regardless of whether the player got the previous card right or wrong,
        // insert the revealed card into the timeline in its true chronological position
        // so the board keeps growing and stays accurate!
        if (currentCard && context?.index > 0) {
          timeline.push(currentCard);
          timeline.sort((a, b) => a.year - b.year);
          currentCard = null;
        }

        if (deck.length === 0) return null;
        currentCard = deck.shift();

        const validSlots = validSlotsForYear(timeline, currentCard.year);
        const primarySlot = validSlots[0] ?? '0';

        // Describe the expected position in human terms if wrong
        const slotIndex = Number(primarySlot);
        let expectedText = `${currentCard.title} (${formatYear(currentCard.year)})`;
        if (slotIndex === 0) {
          expectedText += ` — before ${formatYear(timeline[0].year)}`;
        } else if (slotIndex === timeline.length) {
          expectedText += ` — after ${formatYear(timeline[timeline.length - 1].year)}`;
        } else {
          expectedText += ` — between ${formatYear(timeline[slotIndex - 1].year)} and ${formatYear(timeline[slotIndex].year)}`;
        }

        return {
          kind: 'timeline-sort',
          key: `timeline:${currentCard.year}:${timeline.length}`,
          topicId: currentCard.category,
          topicLabel: currentCard.category,
          question: `When did "${currentCard.title}" happen?`,
          card: {
            title: currentCard.title,
            category: currentCard.category,
            year: currentCard.year,
            formattedYear: formatYear(currentCard.year),
          },
          timeline: timeline.map((ev) => ({
            title: ev.title,
            category: ev.category,
            year: ev.year,
            formattedYear: formatYear(ev.year),
          })),
          answer: primarySlot,
          alternatives: validSlots,
          displayAnswer: expectedText,
        };
      },
    };
  },
};
