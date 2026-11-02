# Product Requirements Document — LearningHub v1

**Status:** Draft v4
**Author:** Daniel Skotheimsvik, with AI support (BMAD Product Manager role)
**Course:** IBE160 Programmering med KI, Høgskolen i Molde, autumn 2026
**Source document:** [product-brief.md](../product-brief.md) (Draft v5)
**Date:** 2026-11-02

> Written in English to match the product brief. The README is in Norwegian for the course.

---

## 1. Purpose and Scope

This document turns the LearningHub product brief into numbered, testable requirements that architecture, stories and tests trace back to.

**In scope:** everything listed as v1 in brief §7 — the Drill Engine with three round modes, the category/trainer/topic hierarchy, player-chosen difficulty bands, board sizes for Memory, deterministic daily puzzles, one attempt per trainer per variant per day, the archive, practice mode with filters, six trainers across three categories, results comparison, progress charts, weak-topic tracking, `localStorage` persistence, theming and accessibility.

**Out of scope:** everything in brief §7 "Deferred" and "Explicitly out of scope" — accounts, server storage, enforced daily limits, filters inside daily puzzles, difficulty bands for Memory, recorded practice statistics, leaderboards, day-streak tracking, spaced repetition, third-party APIs, AI features inside the app.

**Primary user:** the everyday self-improver, per brief §4.

### 1.1 Requirement ID conventions

| Prefix | Meaning |
|---|---|
| `FR-n` | Functional requirement |
| `NFR-n` | Non-functional requirement |
| `E-n` | Epic |
| `US-n.n` | User story |
| `S-n` | Success criterion from brief §9 |

Priority uses MoSCoW: **M** = must, **S** = should, **C** = could. Every **M** requirement must be implemented for v1 to be done.

---

## 2. Domain Glossary

| Term | Definition |
|---|---|
| **Category** | A skill area holding one or more trainers. v1 ships Math, Memory and Geography |
| **Trainer** | One game inside a category. v1 ships six |
| **Topic** | A tagged sub-type of prompt within a trainer, used both for weak-area analysis and as a practice-mode filter. Replaces the term *category* used in earlier versions of this document |
| **Drill Engine** | Shared runtime owning the loop, answer checking, scoring, streaks, round end conditions, results, persistence, daily attempts and the archive |
| **Round mode** | How a round ends: `timed`, `lives` or `completion` |
| **Completion round** | Ends when the board is finished. Used by Figure Pairs |
| **Band** | A difficulty level — `beginner`, `intermediate`, `advanced` or `expert`. **Chosen by the player** |
| **Board size** | Memory's replacement for bands, e.g. `4x4`. Chosen by the player |
| **Variant** | The generic term for whichever axis a trainer uses to split its daily puzzles — a band for most trainers, a board size for Memory. A trainer declares which kind it uses |
| **Variant key** | The stable string identifying a variant, e.g. `expert` or `5x5` |
| **Puzzle** | The deterministic prompt sequence for a given trainer, variant and date |
| **Puzzle date** | The calendar date a puzzle belongs to, in the user's local time zone |
| **Attempt** | A player's single scored play of a given trainer, variant and date. One per combination |
| **Archive** | Puzzles from dates before today, playable if not already attempted |
| **Practice mode** | Unlimited, filterable, unscored play. Never written to history, never affects a personal best |
| **Filter** | A practice-mode setting narrowing what a generator may produce — topics, regions, board size, round length |
| **Seed** | The deterministic input to puzzle generation, derived from trainer, variant and puzzle date |
| **Score direction** | Whether a higher or lower score is better. Higher for most trainers, **lower for Figure Pairs**, which scores mistakes |
| **Streak** | Consecutive correct answers within a round; resets to 0 on a wrong answer |
| **Personal best** | The best score ever recorded for a specific trainer **and variant**, honouring the trainer's score direction |
| **Accuracy** | `correctCount / totalAnswered` as a percentage; 0 % when nothing was answered |

---

## 3. Data Model

All data is client-side. No personal data is collected.

### 3.1 Entities

```
RoundResult
  id              string      unique, generated
  categoryId      string      "math" | "memory" | "geography"
  trainerId       string      e.g. "mental-math", "figure-pairs", "outline-guesser"
  variantKind     string      "band" | "boardSize"
  variantKey      string      "beginner".."expert", or "3x3".."6x6"
  puzzleDate      string      ISO date, local time zone
  roundMode       string      "timed" | "lives" | "completion"
  modeParam       number      durationSec, total lives, or total pairs
  score           number      headline number; interpreted per scoreDirection
  playedAt        number      epoch ms, when the round was actually played
  endedBy         string      "time-expired" | "lives-exhausted" | "board-complete"
                              | "prompts-exhausted" | "abandoned"
  elapsedMs       number
  totalAnswered   number      >= 0
  correctCount    number      0..totalAnswered
  accuracy        number      0..100, derived
  avgAnswerTimeMs number
  bestStreak      number      >= 0
  livesRemaining  number|null null unless roundMode is "lives"
  maxLevel        number|null Pattern Memory only
  mistakes        number|null Figure Pairs only: unmatched turns
  topicStats      TopicStat[]

TopicStat
  topicId         string
  label           string
  asked           number      >= 1
  correct         number      0..asked

VariantProgress
  attempts        Record<puzzleDate, RoundResult>
  personalBest    number|null

TrainerProgress
  trainerId       string
  variants        Record<variantKey, VariantProgress>

Settings
  theme           string      "dark" | "light" | "system"

PracticePreferences
  Record<trainerId, { filters: object }>   last-used practice filters, convenience only
```

Three consequences of the v5 redesign:

- `personalBest` lives on the **variant**, not the trainer. Beating your Beginner record does not touch your Expert record, which is the only honest reading when the player chooses the band.
- `variantKind` lets Memory use board sizes while every other trainer uses bands, without the engine special-casing Memory.
- Practice rounds produce a `RoundResult` for the results screen but it is **never persisted**, so no storage entity represents them.

### 3.2 Trainer configuration

| Category | Trainer | Round mode | Variant kind | Variants | Score | Direction |
|---|---|---|---|---|---|---|
| Math | Mental Math Sprint | `timed` | band | beginner…expert | Correct answers | higher |
| Memory | Pattern Memory | `lives` (1) | boardSize | 3x3, 4x4, 5x5, 6x6 | Level reached | higher |
| Memory | Figure Pairs | `completion` | boardSize | 4x3, 4x4, 6x4, 6x6 | Mistakes | **lower** |
| Geography | Flag Guesser | `lives` (3) | band | beginner…expert | Correct answers | higher |
| Geography | Outline Guesser | `lives` (3) | band | beginner…expert | Correct answers | higher |
| Geography | Capital Guesser | `lives` (3) | band | beginner…expert | Correct answers | higher |

**Mental Math duration by band:** Beginner 45 s, Intermediate 60 s, Advanced 75 s, Expert 90 s.

### 3.3 Storage

| Key | Contents |
|---|---|
| `learninghub.v2.progress` | `Record<trainerId, TrainerProgress>` |
| `learninghub.v2.settings` | `Settings` |
| `learninghub.v2.practice` | `PracticePreferences` |

The key version moves from `v1` to `v2` because the shape has changed incompatibly. A `schemaVersion` field is stored alongside each so future versions can migrate or discard rather than crash.

---

## 4. Functional Requirements

### 4.1 Hierarchy, navigation and registration

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-1 | The home screen lists the three categories, each showing its name, a one-line description and how many of its daily attempts remain today | M | S2 |
| FR-2 | Selecting a category lists its trainers, each showing name, description, round mode and remaining attempts today | M | S21 |
| FR-3 | A trainer's screen lists its variants — four bands, or its board sizes — marking each as available or already played today | M | S13 |
| FR-4 | Selecting a variant opens a briefing screen stating the trainer, the variant, the round mode and the mode parameter in plain language | M | — |
| FR-5 | The briefing screen for a daily puzzle offers no filters, only start or back | M | S18 |
| FR-6 | A trainer is registered by declaring its category, round mode, variant kind, variant list, score direction, topic list, a generator and a renderer | M | S21 |
| FR-7 | Adding a trainer or a category requires no modification to engine files or to existing trainers | M | S21 |
| FR-8 | The user can navigate between home, category, trainer, briefing, round, results, archive, practice and progress views without a page reload | M | — |
| FR-9 | The user can leave a round in progress and return to the trainer screen | M | S13 |
| FR-10 | **Starting a daily or archive round commits the attempt.** Leaving it early ends the round, records the result achieved so far with `endedBy` of `abandoned`, and consumes the attempt for that trainer, variant and date | M | S13 |
| FR-10a | Leaving a daily round requires an explicit confirmation stating that the attempt will be spent | M | S13 |
| FR-10b | Switching to a different variant while a round is in progress ends the current round under FR-10 and starts the new one; it is never a free restart | M | S13 |
| FR-10c | Leaving a **practice** round costs nothing, writes no result and requires no confirmation | M | S17 |
| FR-10d | The briefing screen states that starting will spend the attempt, so the commitment is known before it is made | M | — |
| FR-10e | Navigating away through the header while a round is running triggers the same confirmation and the same forfeit as the Leave button, so no route out of a round is free | M | S13 |

### 4.2 Drill Engine — loop and round modes

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-11 | A round starts on explicit user action and presents the first prompt immediately | M | S2 |
| FR-12 | The engine runs the loop prompt → answer → feedback → next until the round's end condition is met | M | S2 |
| FR-13 | The engine supports three round modes: `timed`, `lives` and `completion` | M | S5 |
| FR-14 | **Timed:** the round ends when the configured duration elapses, and nothing submitted afterwards is counted | M | S5 |
| FR-15 | **Timed:** remaining time is visible throughout | M | — |
| FR-16 | **Lives:** the round starts with the configured lives, an incorrect answer costs exactly one, and the round ends immediately when the last is lost | M | S5 |
| FR-17 | **Lives:** remaining lives are visible throughout, and losing one is signalled distinctly from an ordinary wrong answer | M | — |
| FR-18 | **Completion:** the round ends when every pair on the board is matched, and not before | M | S19 |
| FR-19 | **Completion:** pairs remaining and mistakes so far are visible throughout | M | — |
| FR-20 | Feedback after each answer states whether it was correct and, when incorrect, shows the correct answer | M | S2 |
| FR-21 | Feedback is visible for a bounded interval (target ≤ 800 ms) without requiring a click | S | — |
| FR-22 | Live score, accuracy and current streak are visible and update after every answer | M | S1 |
| FR-23 | Prompts may be generated lazily, so a round with no fixed length is possible | M | S15 |
| FR-24 | The engine never presents the same prompt twice in a row within a round | S | — |
| FR-25 | If a generator's prompt supply is exhausted before the end condition, the round ends with `endedBy` recorded as `prompts-exhausted` | S | — |

### 4.3 Bands, board sizes and deterministic puzzles

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-26 | Every trainer using `variantKind: band` offers exactly four bands: beginner, intermediate, advanced, expert | M | S2 |
| FR-27 | The player chooses the band. No date, setting or prior result restricts which bands are available | M | S13 |
| FR-28 | Trainers using `variantKind: boardSize` offer no bands at all, and the interface never implies a difficulty for them | M | — |
| FR-29 | Parameters that follow from the band are derived from it, including the Mental Math duration in §3.2 | M | S12 |
| FR-30 | Puzzle generation is deterministic: the same trainer, variant and date always produce an identical prompt sequence | M | S12 |
| FR-31 | Two different variants of the same trainer on the same date produce different prompt sequences | M | S12 |
| FR-32 | Two different dates for the same trainer and variant produce different prompt sequences | M | S12 |
| FR-33 | Generation depends only on the seed — never on `Math.random`, wall-clock time, stored progress or any player input | M | S12 |
| FR-34 | The puzzle date is the user's local calendar date | M | S13 |

### 4.4 Daily attempts and the archive

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-35 | Each combination of trainer, variant and puzzle date allows exactly one scored attempt | M | S13 |
| FR-36 | Spending the attempt on one variant leaves every other variant of that trainer available | M | S13 |
| FR-37 | Spending an attempt on one trainer leaves every other trainer unaffected | M | S13 |
| FR-38 | When the local date changes, all attempts become available again without a page reload | S | S13 |
| FR-39 | The archive lists previous puzzle dates, showing per trainer and variant whether each was played | M | S14 |
| FR-40 | An unplayed archive puzzle can be played, and its result is recorded against its own puzzle date | M | S14 |
| FR-41 | An already-attempted archive puzzle cannot be replayed | M | S13 |
| FR-42 | The archive reaches back to a defined earliest puzzle date and no further | M | — |
| FR-43 | Archive results count towards history, personal bests and weak-topic analysis on equal terms | M | S14 |
| FR-44 | The interface states plainly that the daily limit is stored in the browser and is not enforced | S | — |
| FR-44a | The same disclosure covers the two ways the limit can be escaped without clearing storage: a page reload mid-round, and a second browser or private window. v1 does not attempt to prevent either | S | — |

### 4.5 Practice mode

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-45 | Every trainer is playable in practice mode, reachable from the trainer screen | M | S17 |
| FR-46 | Practice mode is unlimited: no attempt is consumed and no limit applies | M | S17 |
| FR-47 | A practice round is **never written to progress history** | M | S17 |
| FR-48 | A practice round **never updates a personal best**, however good the score | M | S17 |
| FR-49 | A practice round still shows a full results screen, clearly labelled as practice | M | S17 |
| FR-50 | The practice results screen shows no comparison against previous attempts or personal bests, because practice results are not comparable | M | S17 |
| FR-51 | Practice mode offers a filter panel appropriate to the trainer | M | S18 |
| FR-52 | **Math filters:** each topic in brief §6.1 can be switched on or off independently, plus a round-duration choice | M | S18 |
| FR-53 | **Memory filters:** board size, plus display time for Pattern Memory | M | S18 |
| FR-54 | **Geography filters:** continent or region selection, answer format (multiple choice or free text), and number of lives | M | S18 |
| FR-55 | Generators honour every active filter: no prompt may be produced from a disabled topic or an excluded region | M | S18 |
| FR-56 | If a filter combination would produce no valid prompts, the interface explains this and refuses to start rather than generating an empty round | M | S18 |
| FR-57 | Practice filters default to the trainer's Intermediate-equivalent settings on first use, and the last-used filters are remembered thereafter | S | — |
| FR-58 | Practice rounds are seeded from a non-deterministic source, so repeating a practice round gives different prompts | M | — |

### 4.6 Answer handling

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-59 | Numeric prompts accept typed digits and submission via Enter | M | S4 |
| FR-60 | Text prompts accept typed text and submission via Enter | M | S4 |
| FR-61 | Multiple-choice prompts accept mouse selection and number keys 1–4 | M | S10 |
| FR-62 | Grid prompts accept tile selection by mouse and keyboard | M | S10 |
| FR-63 | Answer checking ignores leading and trailing whitespace | M | S4 |
| FR-64 | Text answer checking is case-insensitive and accent-insensitive | M | S4 |
| FR-65 | Text answers accept documented alternative spellings defined in the content file, e.g. "USA" for "United States" | M | S4 |
| FR-66 | Empty submissions are ignored: not counted, streak unaffected, no life lost | M | S4 |
| FR-67 | The input is cleared and refocused after each submission | M | S10 |

### 4.7 Scoring and personal bests

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-68 | The engine counts total answered and correct answers | M | S1 |
| FR-69 | Each trainer declares its headline score and its score direction per §3.2 | M | S19 |
| FR-70 | Accuracy is `correctCount / totalAnswered × 100`, one decimal, 0 % when nothing was answered | M | S1 |
| FR-71 | Average answer time is the mean elapsed time per submitted answer | M | — |
| FR-72 | The streak increments on a correct answer and resets to 0 on an incorrect one | M | S1 |
| FR-73 | Best streak is the highest value the streak reached during the round | M | S1 |
| FR-74 | A personal best is recorded per trainer **and variant** | M | S8 |
| FR-75 | A personal best updates only when the new score strictly beats the stored one in the direction declared by the trainer — greater for `higher`, smaller for `lower` | M | S8, S19 |
| FR-76 | The first recorded result for a trainer and variant becomes the personal best regardless of direction | M | S8 |

### 4.8 Results screen and comparison

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-77 | The results screen shows score, correct answers, total answered, accuracy, average answer time and best streak | M | S1 |
| FR-78 | The results screen states why the round ended | M | S5 |
| FR-79 | The results screen shows the trainer and the variant played | M | — |
| FR-80 | For daily and archive rounds, the results screen compares against the **previous attempt** at that trainer and variant, stating better, worse or equal and by how much | M | S16 |
| FR-81 | For daily and archive rounds, the results screen compares against the **all-time best** for that trainer and variant, announcing a new best when one is set | M | S16 |
| FR-82 | When no previous result exists, the comparison states there is nothing to compare against yet | M | S16 |
| FR-83 | Comparisons respect score direction — for Figure Pairs, fewer mistakes is an improvement | M | S19 |
| FR-84 | The results screen shows a weak-topic summary when the trainer declares topics | M | S7 |
| FR-85 | The results screen offers routes onward and never offers a replay of the same daily puzzle | M | S13 |

### 4.9 Progress history and charts

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-86 | Every completed daily or archive round is stored against its trainer, variant and puzzle date | M | S6 |
| FR-87 | A progress view per trainer plots score and accuracy against puzzle date in chronological order | M | S6 |
| FR-88 | The progress view lets the user switch between variants, since scores across bands are not comparable | M | S6 |
| FR-89 | The progress view states puzzles completed, total time practised and the personal best per variant | S | — |
| FR-90 | A trainer with no history shows an explanatory empty state rather than an empty chart | M | — |
| FR-91 | Charts are rendered without a third-party charting library | M | NFR-9 |

### 4.10 Weak-topic tracking

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-92 | Each prompt is tagged by its trainer with a topic identifier | M | S7 |
| FR-93 | The engine aggregates asked and correct counts per topic for the round | M | S7 |
| FR-94 | Analysis identifies the topic with the lowest hit rate among topics with at least 3 prompts asked | M | S7 |
| FR-95 | The weak topic is presented in plain language, e.g. "You miss Algebra most — 2 of 7 correct" | M | S7 |
| FR-96 | When no topic reaches the threshold, the analysis says there is not enough data yet | M | S7 |
| FR-97 | The progress view shows topic hit rates aggregated across the trainer's full history | S | S7 |
| FR-98 | Mental Math and all three Geography trainers must support topics; the two Memory trainers need not | M | S7 |

### 4.11 Persistence

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-99 | Results, attempt records, personal bests and settings persist in `localStorage` and are restored on load | M | S1, S13 |
| FR-100 | Missing, corrupt or unknown-schema data causes the app to start with empty progress and a non-blocking notice, never a crash | M | NFR-7 |
| FR-101 | The user can clear all stored progress from a settings screen, behind a confirmation | S | — |
| FR-102 | If `localStorage` is unavailable the app stays fully playable for the session, applies no attempt limit, and says progress will not be saved | S | NFR-7 |

### 4.12 Math — Mental Math Sprint

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-103 | Runs in timed mode with the duration derived from the band per §3.2 | M | S5 |
| FR-104 | Supports the seven topics in brief §6.1, each tagged on its prompts | M | S7 |
| FR-105 | Band membership follows the table in brief §6.1 — Expert is the only band including algebra and trigonometry | M | S3 |
| FR-106 | Division prompts never divide by zero | M | S3 |
| FR-107 | Division prompts outside the Expert band always have an integer answer | M | S3 |
| FR-108 | Beginner subtraction never produces a negative answer | M | S3 |
| FR-109 | Algebra prompts are linear equations with a single unknown and an integer solution | M | S3 |
| FR-110 | Trigonometry prompts use only angles with exact values — 0°, 30°, 45°, 60°, 90° and their equivalents — and state the expected answer format | M | S3 |
| FR-111 | Fraction and root prompts state the expected format and accept documented equivalent forms | M | S4 |
| FR-112 | Answers are entered as free numeric or short-text input | M | S4 |

### 4.13 Memory — Pattern Memory

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-113 | Presents a grid at the chosen board size; a subset of tiles is highlighted for a bounded display time, then hidden, and the player reproduces the set | M | S2 |
| FR-114 | Runs in lives mode with exactly 1 life | M | S5 |
| FR-115 | A level is correct only when exactly the highlighted tiles are selected — no omissions, no extras | M | S4 |
| FR-116 | Tile selection order does not affect correctness | M | S4 |
| FR-117 | Each level adds exactly one tile to the previous level | M | S15 |
| FR-118 | The round has no maximum level; levels are generated for as long as the player succeeds | M | S15 |
| FR-119 | The board does not grow during a round — the chosen size is fixed, and the round ends naturally when the pattern approaches the board's capacity | M | S15 |
| FR-120 | The headline score is the highest level completed | M | — |
| FR-121 | The current level is visible throughout | M | — |
| FR-122 | Hidden tiles are not identifiable from the DOM | M | — |
| FR-123 | The grid is fully keyboard operable: arrows move, a key selects and deselects, a key submits | M | S10 |
| FR-124 | Selected tiles are distinguishable by more than colour alone | M | S10 |

### 4.14 Memory — Figure Pairs

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-125 | Presents a board of face-down cards at the chosen size, each figure appearing exactly twice | M | S19 |
| FR-126 | Board sizes always contain an even number of cells | M | S19 |
| FR-127 | Turning two cards reveals them; a match leaves them face up, a mismatch turns them back after a bounded delay | M | S19 |
| FR-128 | A mismatched turn increments the mistake count by exactly one | M | S19 |
| FR-129 | Runs in completion mode: the round ends when every pair is matched | M | S19 |
| FR-130 | The headline score is the mistake count, with score direction `lower` | M | S19 |
| FR-131 | Elapsed time is recorded and breaks ties between equal mistake counts | M | S19 |
| FR-132 | Figures are rendered from a bundled set requiring no network request, and are distinguishable without relying on colour alone | M | S9, S10 |
| FR-133 | The board is fully keyboard operable | M | S10 |
| FR-134 | Face-down card identities are not retrievable from the DOM | M | — |

### 4.15 Geography — shared behaviour

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-135 | All three Geography trainers draw from one validated content file covering **all 195 sovereign states** — the 193 UN member states plus Vatican City and Palestine — with capital, continent, ISO 3166-1 alpha-2 code and tier | M | S9 |
| FR-135a | Flag glyphs are **derived from the ISO code** at runtime by mapping each letter to its Unicode regional indicator, never stored per country | M | S9 |
| FR-135b | The Outline Guesser draws only from countries that have an outline; the 29 microstates and small island nations absent from the source data are excluded from that trainer and remain fully available in the Flag and Capital trainers | M | S20 |
| FR-136 | The content file is validated at load; malformed entries are skipped and logged, never crashing the trainer | M | NFR-7 |
| FR-137 | Bands control the country pool: Beginner widely known, Intermediate adds mid-frequency, Advanced and Expert the full set | M | S2 |
| FR-138 | Beginner, Intermediate and Advanced use four-way multiple choice; Expert uses free text | M | S2 |
| FR-139 | Multiple-choice distractors come from the same continent where the pool allows, and the correct answer never appears twice | S | — |
| FR-140 | Each trainer runs in lives mode with exactly 3 lives | M | S5 |
| FR-141 | Prompts are tagged by topic, at minimum by continent | M | S7 |

### 4.16 Geography — Flag Guesser

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-142 | Shows a flag and asks for the country | M | S2 |
| FR-143 | Flags are rendered without any network request | M | S9 |
| FR-144 | At Advanced and Expert the flag is partially masked, revealing more of it after each wrong guess within the prompt | S | — |

### 4.17 Geography — Outline Guesser

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-145 | Shows a country's outline as an SVG silhouette, without labels, borders or surrounding context, and asks for the country | M | S20 |
| FR-146 | Outlines come from simplified public-domain Natural Earth data bundled in the repository | M | S9 |
| FR-147 | Outlines are normalised to a consistent display size, so relative area is not a giveaway | S | — |
| FR-148 | A country is shown up to **three times** before it is graded: a wrong free-text guess costs no life and instead reports the **great-circle distance** from the guess to the target. Only the third wrong guess, or a correct one, ends the prompt | M | S20 |
| FR-148a | Intermediate guesses are never recorded as answers — one country still produces exactly one graded result | M | S20 |
| FR-149 | After a wrong guess the player is told the **compass direction** from their guess towards the target, to one of eight points | M | S20 |
| FR-150 | After a wrong guess the player is given a **proximity percentage**, 100 % meaning correct and falling with distance | M | S20 |
| FR-151 | Distance is reported in kilometres, computed from country centroids with the haversine formula | M | S20 |
| FR-152 | Hints are shown only in bands using free text; multiple-choice bands show the correct answer instead | M | S20 |

### 4.18 Geography — Capital Guesser

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-153 | Asks for the capital of a named country | M | S2 |
| FR-154 | Also asks the reverse — the country for a named capital — as a separate topic | M | S2 |
| FR-155 | Accepts documented alternative capital spellings and transliterations | M | S4 |

### 4.19 Presentation, theming and accessibility

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-156 | Dark and light mode, with the choice persisted and defaulting to the OS preference | M | — |
| FR-157 | Every screen is usable with the keyboard alone | M | S10 |
| FR-158 | Focus moves to the answer input or grid when a round starts and after each answer | M | S10 |
| FR-159 | Visible focus indicators on all interactive elements, including individual tiles and cards | M | S10 |
| FR-160 | The layout is usable down to 360 px width, including a 6×6 board | M | — |
| FR-161 | Feedback, life loss and match results are conveyed by text or icon as well as colour | M | S10 |
| FR-162 | Score, level, lives and pairs-remaining updates are announced via an ARIA live region | S | S10 |
| FR-163 | Reduced-motion preference is respected, including card-flip animation | S | S10 |

---

## 5. Non-Functional Requirements

| ID | Requirement | Verification | Traces to |
|---|---|---|---|
| NFR-1 | Answer feedback renders within 100 ms of submission | Manual timing | — |
| NFR-2 | The timer is accurate to within 100 ms over a 90 s round | Test with a mocked clock | S5 |
| NFR-3 | A lives round ends within one prompt of the last life being lost | Automated test | S5 |
| NFR-4 | Puzzle generation is pure and reproducible from its seed alone | Automated test | S12 |
| NFR-5 | Pattern Memory level generation is a pure function of seed and level number, at any depth | Test at levels 1, 10 and 50 | S15 |
| NFR-6 | First meaningful paint within 2 s | Lighthouse | — |
| NFR-7 | No unhandled exception reaches the user; failures degrade to a readable message | Fault-injection tests | S9 |
| NFR-8 | The application works fully offline after first load | DevTools offline mode | S9 |
| NFR-9 | No third-party runtime dependencies, no external network requests, no API keys | Dependency review and network inspection | S9, S11 |
| NFR-10 | Bundled outline data stays under 400 kB total and is loaded only by the trainer that needs it | Build inspection and network panel | FR-146 || NFR-11 | Stored progress stays below 2 MB after two years of daily play across all trainers and variants | Calculation plus generated-data test | FR-99 |
| NFR-12 | The app runs in current Chrome, Firefox and Edge | Manual cross-browser check | S11 |
| NFR-13 | The app runs from a clone with no build step | Fresh-clone test | S11 |
| NFR-14 | No personal data is collected, transmitted or stored | Code review | — |
| NFR-15 | Pure logic — generation, seeding, answer checking, scoring, end conditions, attempt rules, comparison, hint maths and weak-topic analysis — is isolated from DOM code and unit-testable | Code review; tests import logic without a DOM | S3–S8, S12–S20 |
| NFR-16 | Date handling is injectable so tests can simulate any local date | Code review; tests with a mocked clock | S13, S14 |
| NFR-17 | Automated tests cover all generators, seeding and determinism, filters, answer checking, scoring and score direction, all three round-end conditions, endless level generation, personal bests, comparison, attempt rules, practice isolation, hint maths and weak-topic analysis | Test run | S3–S8, S12–S20 |
| NFR-18 | The test suite runs with a single documented command | README check | S11 |
| NFR-19 | Lighthouse accessibility score ≥ 90 on home, round and results screens | Lighthouse audit | S10 |
| NFR-20 | The README documents purpose, local run, tests, the hierarchy, the band and board-size rules, daily attempts, practice mode, the archive and the repository structure | Review | S11 |
| NFR-21 | The app is published automatically from `main` to a public URL, with no install step, no build step and no environment variables | Deployment from a clean commit | S11 |
| NFR-22 | The provenance and processing of the Natural Earth outline data are documented in the repository | Review | FR-146 |

---

## 6. Epics

| ID | Epic | Goal | Depends on |
|---|---|---|---|
| E-1 | Foundation, hierarchy and registration | Category/trainer/topic model, registration contract, injectable clock, test harness | — |
| E-2 | Drill Engine core and three round modes | Loop, answer checking, scoring, score direction, timed/lives/completion | E-1 |
| E-3 | Variants, determinism, daily attempts and archive | Bands and board sizes, seeded generation, attempt rules, archive | E-2 |
| E-4 | Practice mode and filters | Unlimited unscored play, filter panels, generator filtering | E-2, E-3 |
| E-5 | Math category | Mental Math Sprint with seven topics including algebra and trigonometry | E-2, E-3 |
| E-6 | Memory category | Pattern Memory and Figure Pairs, board sizes, completion mode | E-2, E-3 |
| E-7 | Geography category | Shared content, Flag, Outline and Capital guessers, outline data pipeline, hint maths | E-2, E-3 |
| E-8 | Persistence, comparison and progress history | Storage, per-variant bests, previous/best comparison, charts | E-2, E-3 |
| E-9 | Weak-topic tracking | Topic aggregation and plain-language analysis | E-2, E-8 |
| E-10 | UI shell, theming and accessibility | Navigation, archive view, dark/light, keyboard-first, responsive | E-2, E-3 |
| E-11 | Quality, documentation and release | Cross-browser, accessibility audit, README, deployment | all |

**Build order rationale.** E-5 and E-6 are built before the engine contract is frozen, and they stress it in deliberately different ways — a timed round with band-derived parameters against a completion round with a lower-is-better score. That combination is what exposes whether the abstraction holds. E-7 then adds three trainers at once and must require no engine change, which is the real proof.

---

## 7. User Stories

Format: *As a learner, I want … so that …* Acceptance criteria are Given/When/Then so they map onto test cases.

### E-1 — Foundation, hierarchy and registration

**US-1.1** — Repository skeleton and entry page
*Given* a fresh clone, *when* I open the entry page, *then* a home screen renders with no console errors and no external network requests. · FR-1, NFR-9, NFR-13

**US-1.2** — Test runner
*Given* the repository, *when* I run the documented test command, *then* the suite runs; a deliberately failing test produces a non-zero exit code. · NFR-18

**US-1.3** — Registration contract
*Given* a trainer module declaring category, round mode, variant kind, variants, score direction, topics, generator and renderer, *when* it is registered, *then* it appears under its category with no engine file modified. · FR-6, FR-7 · *Verifies:* S21

**US-1.4** — Injectable clock
*Given* a test, *when* a fixed local date is supplied, *then* all date-dependent behaviour uses it rather than the system clock. · NFR-16

**US-1.5** — Category listing
*Given* the home screen, *when* it renders, *then* the three categories appear, each with its remaining attempts for today. · FR-1, FR-2

### E-2 — Drill Engine core and round modes

**US-2.1** — Start a round
*Given* an available variant, *when* I start, *then* the first prompt appears immediately with the correct mode indicator. · FR-11, FR-15, FR-17, FR-19

**US-2.2** — End a timed round on time
*Given* a 90 s round, *when* the clock reaches zero, *then* input is disabled, results appear, and an answer submitted after expiry is not counted. · FR-14 · *Verifies:* S5

**US-2.3** — End a lives round on the last life
*Given* 3 lives with 2 lost, *when* I answer incorrectly, *then* the round ends immediately, no further prompt renders, and results say lives ran out. · FR-16, FR-78 · *Verifies:* S5

**US-2.4** — End a completion round only when finished
*Given* a board with one pair left, *when* I match it, *then* the round ends; and *given* pairs remain, *then* it does not end however many mistakes I make. · FR-18 · *Verifies:* S19

**US-2.5** — Submit and check answers
*Given* a prompt, *when* I submit, *then* it is checked, feedback shows, and the next prompt appears with input cleared and refocused. · FR-12, FR-59, FR-60, FR-67

**US-2.6** — Tolerant answer checking
*Given* answer "Oslo", *when* I submit " oslo ", *then* it is accepted; *when* I submit "", *then* nothing is counted, the streak is unaffected and no life is lost. · FR-63, FR-64, FR-66 · *Verifies:* S4

**US-2.7** — Corrective feedback
*Given* a wrong answer, *when* feedback appears, *then* it says so and shows the correct answer, using text or icon as well as colour. · FR-20, FR-161

**US-2.8** — Live score and streak
*Given* a round, *when* I answer correctly, *then* score and streak rise; *when* incorrectly, *then* the streak resets while best streak keeps its peak. · FR-22, FR-68, FR-72, FR-73 · *Verifies:* S1

**US-2.9** — Round statistics
*Given* 10 answers with 7 correct, *then* accuracy reads 70.0 %; *given* zero answers, *then* accuracy reads 0 % and average time 0 with no division error. · FR-70, FR-71 · *Verifies:* S1

**US-2.10** — Lazy prompt supply
*Given* a trainer with no fixed list, *when* the round runs, *then* prompts are generated on demand. · FR-23 · *Verifies:* S15

**US-2.11** — Leaving a round spends it
*Given* a daily round in progress, *when* I choose to leave and confirm, *then* the round ends, the result so far is recorded as `abandoned`, and the attempt is no longer available; *given* I decline the confirmation, *then* the round continues. · FR-9, FR-10, FR-10a · *Verifies:* S13

**US-2.11b** — Switching variant is not a free restart
*Given* a round in progress at 4×4, *when* I switch to 5×5, *then* the 4×4 round is recorded as abandoned and its attempt is spent, and a 5×5 round begins. · FR-10b · *Verifies:* S13

**US-2.11c** — Leaving practice is free
*Given* a practice round in progress, *when* I leave, *then* no confirmation appears, no result is written and nothing is spent. · FR-10c · *Verifies:* S17

**US-2.12** — Multiple choice by keyboard
*Given* four options, *when* I press 2, *then* the second is submitted, identically to clicking it. · FR-61

### E-3 — Variants, determinism, daily attempts and archive

**US-3.1** — Choose a band freely
*Given* any band trainer, *when* I open it, *then* all four bands are offered and nothing restricts my choice. · FR-26, FR-27 · *Verifies:* S13

**US-3.2** — Board sizes instead of bands
*Given* a Memory trainer, *when* I open it, *then* board sizes are offered and no difficulty is shown anywhere. · FR-28

**US-3.3** — Derive parameters from the band
*Given* Expert Mental Math, *then* the round is 90 s; *given* Beginner, *then* 45 s — with no way to change it. · FR-29, FR-5, FR-103 · *Verifies:* S12

**US-3.4** — Deterministic puzzles
*Given* the same trainer, variant and date, *when* generated twice, *then* the sequences are identical. · FR-30, NFR-4 · *Verifies:* S12

**US-3.5** — Variants and dates differ
*Given* the same date, *then* Beginner and Expert produce different sequences; *given* the same variant, *then* two dates produce different sequences. · FR-31, FR-32 · *Verifies:* S12

**US-3.6** — Generation ignores ambient state
*Given* generation runs, *when* `Math.random` is stubbed to throw and stored progress is altered, *then* output is unchanged. · FR-33 · *Verifies:* S12

**US-3.7** — Independent attempts per variant
*Given* I finish Beginner today, *when* I return, *then* Beginner is marked played and Intermediate, Advanced and Expert remain available. · FR-35, FR-36 · *Verifies:* S13

**US-3.8** — Independent attempts per trainer
*Given* I finish Flag Guesser Expert, *then* Outline Guesser Expert is still available. · FR-37 · *Verifies:* S13

**US-3.9** — New day releases attempts
*Given* attempts spent and the local date advances, *when* the view refreshes, *then* they are available again. · FR-38

**US-3.10** — Browse the archive
*Given* previous dates exist, *when* I open the archive, *then* each date lists its trainers and variants with played state, back to the earliest date. · FR-39, FR-42 · *Verifies:* S14

**US-3.11** — Play an archive puzzle
*Given* an unplayed archive entry, *when* I play it, *then* the result is recorded against that puzzle date; *given* a played one, *then* it cannot be replayed. · FR-40, FR-41, FR-43 · *Verifies:* S14

**US-3.12** — Disclose the soft limit
*Given* the interface, *when* I read it, *then* it states the limit is browser-stored and unenforced. · FR-44

### E-4 — Practice mode and filters

**US-4.1** — Practice is unlimited
*Given* every attempt spent today, *when* I open practice, *then* I can play as many rounds as I like. · FR-45, FR-46 · *Verifies:* S17

**US-4.2** — Practice never touches history
*Given* a practice round scoring far above my best, *when* it ends, *then* nothing is written to history and the personal best is unchanged. · FR-47, FR-48 · *Verifies:* S17

**US-4.3** — Practice results are labelled
*Given* a practice round ends, *then* the results screen shows full statistics, is labelled practice, and shows no previous-or-best comparison. · FR-49, FR-50 · *Verifies:* S17

**US-4.4** — Math topic filters
*Given* practice with only algebra enabled, *when* 500 prompts are generated, *then* every one is algebra. · FR-52, FR-55 · *Verifies:* S18

**US-4.5** — Memory board filter
*Given* practice with a 6×6 board, *when* a round starts, *then* the board is 6×6 and the display time matches my setting. · FR-53

**US-4.6** — Geography region filter
*Given* practice limited to Africa with free-text answers, *when* prompts are generated, *then* every country is African and no multiple choice appears. · FR-54, FR-55 · *Verifies:* S18

**US-4.7** — Impossible filter combinations
*Given* filters excluding every prompt, *when* I try to start, *then* the interface explains the problem and refuses rather than starting an empty round. · FR-56 · *Verifies:* S18

**US-4.8** — Remember filters
*Given* I set filters and return later, *then* my last-used filters are preselected. · FR-57

**US-4.9** — Practice is not deterministic
*Given* two practice rounds with identical filters, *then* the prompt sequences differ. · FR-58

### E-5 — Math category

**US-5.1** — Valid arithmetic
*Given* 1000 prompts per band, *then* none divides by zero, every non-Expert division is integral, and no Beginner subtraction is negative. · FR-106, FR-107, FR-108 · *Verifies:* S3

**US-5.2** — Topics follow the band
*Given* each band, *when* prompts are generated, *then* only that band's topics appear, and algebra and trigonometry appear only at Expert. · FR-104, FR-105 · *Verifies:* S3

**US-5.3** — Valid algebra
*Given* 1000 algebra prompts, *then* each is a linear equation with one unknown whose stated solution is an integer and satisfies the equation. · FR-109 · *Verifies:* S3

**US-5.4** — Valid trigonometry
*Given* 1000 trigonometry prompts, *then* every angle has an exact value, the expected format is stated, and tan 90° never appears. · FR-110 · *Verifies:* S3

**US-5.5** — Equivalent answer forms
*Given* a fraction or root prompt, *when* I submit a documented equivalent form, *then* it is accepted. · FR-111 · *Verifies:* S4

**US-5.6** — Score by correct answers
*Given* 23 correct answers, *then* the headline score is 23 with direction `higher`. · FR-69

### E-6 — Memory category

**US-6.1** — Pattern shown then hidden
*Given* a level starts, *then* the pattern is visible for the display time, then hidden, then the board becomes selectable. · FR-113

**US-6.2** — Set-based checking
*Given* highlighted {A, C, F}, *when* I select C, A, F in any order, *then* it is correct; *when* I select {A, C} or {A, C, F, G}, *then* it is not. · FR-115, FR-116 · *Verifies:* S4

**US-6.3** — One life
*Given* Pattern Memory, *when* I first get a level wrong, *then* the round ends. · FR-114 · *Verifies:* S5

**US-6.4** — One tile per level
*Given* level *n* has *k* tiles, *then* level *n+1* has *k+1*. · FR-117 · *Verifies:* S15

**US-6.5** — Endless levels
*Given* 50 consecutive correct levels on a 6×6 board, *then* each next level generates successfully. · FR-118, NFR-5 · *Verifies:* S15

**US-6.6** — Fixed board size
*Given* a 4×4 board, *when* levels advance, *then* the board stays 4×4 and the round ends naturally as the pattern approaches capacity. · FR-119

**US-6.7** — Keyboard grid
*Given* only a keyboard, *when* I move with arrows, select and submit, *then* I can complete a level with focus always visible. · FR-62, FR-123, FR-159 · *Verifies:* S10

**US-6.8** — Pairs board setup
*Given* a 6×4 Figure Pairs board, *then* it has 24 cells, 12 distinct figures, each appearing exactly twice. · FR-125, FR-126 · *Verifies:* S19

**US-6.9** — Turning and matching
*Given* two face-down cards, *when* I turn a matching pair, *then* they stay face up; *when* they do not match, *then* they turn back and mistakes increases by one. · FR-127, FR-128 · *Verifies:* S19

**US-6.10** — Pairs scoring
*Given* a completed board with 9 mistakes, *then* the score is 9 with direction `lower`, and elapsed time is recorded for tie-breaking. · FR-130, FR-131 · *Verifies:* S19

**US-6.11** — Lower is better
*Given* a stored best of 9 mistakes, *when* I finish with 7, *then* it becomes the new best; *when* I finish with 11, *then* it does not. · FR-75, FR-83 · *Verifies:* S8, S19

**US-6.12** — No DOM cheating
*Given* a face-down board, *when* the DOM is inspected, *then* card identities are not retrievable. · FR-122, FR-134

### E-7 — Geography category

**US-7.1** — Shared validated content
*Given* the content file, *when* it loads, *then* valid entries are available to all three trainers; *given* a malformed entry, *then* it is skipped and logged while trainers still run. · FR-135, FR-136 · *Verifies:* S9

**US-7.2** — Band controls pool and format
*Given* Beginner, *then* only widely known countries appear with four-way multiple choice; *given* Expert, *then* the full set appears with free-text answers. · FR-137, FR-138 · *Verifies:* S2

**US-7.3** — Plausible distractors
*Given* a multiple-choice prompt, *then* distractors share the continent where possible and the answer never repeats. · FR-139

**US-7.4** — Three lives
*Given* any Geography trainer, *when* I answer wrongly three times, *then* the round ends. · FR-140 · *Verifies:* S5

**US-7.5** — Flags without network
*Given* a flag prompt, *when* it renders, *then* no external request is made. · FR-142, FR-143 · *Verifies:* S9

**US-7.6** — Progressive flag reveal
*Given* an Expert flag prompt, *when* I guess wrongly within the prompt, *then* more of the flag is revealed. · FR-144

**US-7.7** — Outline rendering
*Given* an outline prompt, *then* a country silhouette renders with no labels, borders or context, normalised to a consistent size. · FR-145, FR-147 · *Verifies:* S20

**US-7.8** — Bundled outline data
*Given* the app runs offline, *when* an outline prompt appears, *then* it renders from bundled data with no network request, and the data totals under 400 kB. · FR-146, NFR-10, NFR-22 · *Verifies:* S9

**US-7.9** — Distance hint
*Given* a wrong guess of France when the answer is Germany, *then* the reported distance matches a hand-checked haversine value within 1 %. · FR-148, FR-151 · *Verifies:* S20

**US-7.10** — Direction hint
*Given* a wrong guess of Spain when the answer is Poland, *then* the direction reads north-east. · FR-149 · *Verifies:* S20

**US-7.11** — Proximity hint
*Given* a wrong guess, *then* proximity is 0–100 %, falls as distance grows, and reads 100 % only for the correct answer. · FR-150 · *Verifies:* S20

**US-7.12** — Hints only where they fit
*Given* a multiple-choice band, *when* I answer wrongly, *then* the correct answer is shown and no distance hint appears. · FR-152

**US-7.13** — Capitals both ways
*Given* the Capital Guesser, *then* both country→capital and capital→country prompts appear as separate topics. · FR-153, FR-154

**US-7.14** — Alternative names
*Given* a country or capital with documented alternatives, *when* I submit any documented form, *then* it is accepted. · FR-65, FR-155 · *Verifies:* S4

**US-7.15** — Three trainers, no engine change
*Given* all three Geography trainers, *when* they are added, *then* no engine file required modification. · FR-7 · *Verifies:* S21

### E-8 — Persistence, comparison and progress history

**US-8.1** — Persist results and attempts
*Given* a completed round, *when* I reload, *then* the result is in history with identical values and the attempt is still marked used. · FR-86, FR-99 · *Verifies:* S1, S13

**US-8.2** — Per-variant personal bests
*Given* a Beginner best of 30 and an Expert best of 12, *when* I score 14 at Expert, *then* the Expert best becomes 14 and the Beginner best is untouched. · FR-74, FR-75 · *Verifies:* S8

**US-8.3** — First result sets the best
*Given* no prior result, *when* I finish, *then* that score becomes the best regardless of direction. · FR-76 · *Verifies:* S8

**US-8.4** — Compare with the previous attempt
*Given* a previous score of 20, *when* I score 23, *then* results say I beat it by 3; at 17, short by 3; at 20, matched. · FR-80 · *Verifies:* S16

**US-8.5** — Compare with the all-time best
*Given* a best of 25, *when* I score 23, *then* the gap is shown; at 26, a new best is announced. · FR-81 · *Verifies:* S16

**US-8.6** — First ever attempt
*Given* no previous result, *then* results say there is nothing to compare against yet. · FR-82 · *Verifies:* S16

**US-8.7** — Full results screen
*Given* a finished round, *then* score, correct, total, accuracy, average time, best streak, trainer, variant and end reason all appear. · FR-77, FR-78, FR-79 · *Verifies:* S1

**US-8.8** — No replay of a daily puzzle
*Given* the results screen, *then* it offers onward routes and no replay of the same puzzle. · FR-85 · *Verifies:* S13

**US-8.9** — Progress chart
*Given* five completed puzzles at one variant, *when* I open progress, *then* five points appear in puzzle-date order with stored values. · FR-87, FR-91 · *Verifies:* S6

**US-8.10** — Switch variant in progress
*Given* history at several variants, *when* I switch variant, *then* the chart shows only that variant. · FR-88 · *Verifies:* S6

**US-8.11** — Archive placement
*Given* an older puzzle played today, *then* its point sits at its puzzle date, not today. · FR-87, FR-43 · *Verifies:* S14

**US-8.12** — Practice summary
*Given* history, *when* I open progress, *then* puzzles completed, total time and per-variant bests are shown. · FR-89

**US-8.13** — Empty history
*Given* a trainer never played, *then* an explanatory empty state appears. · FR-90

**US-8.14** — Corrupt storage
*Given* invalid JSON in a storage key, *when* the app loads, *then* it starts empty with a non-blocking notice and stays usable. · FR-100 · *Verifies:* S9

**US-8.15** — Clear progress
*Given* stored progress, *when* I clear and confirm, *then* all results, attempts and bests are removed and every attempt is available. · FR-101

**US-8.16** — No storage available
*Given* `localStorage` is unavailable, *when* I play, *then* the round completes, no limit applies, and I am told progress will not be saved. · FR-102

**US-8.17** — Storage stays small
*Given* two years of simulated results across all trainers and variants, *then* storage is below 2 MB. · NFR-11

### E-9 — Weak-topic tracking

**US-9.1** — Aggregate by topic
*Given* a completed round, *then* asked and correct counts per topic match the answers given and sum to total answered. · FR-92, FR-93

**US-9.2** — Identify the weakest topic
*Given* algebra answered 2 of 7 with every other topic above 80 %, *then* algebra is reported as weakest. · FR-94 · *Verifies:* S7

**US-9.3** — Ignore thin topics
*Given* a topic asked only twice and both wrong, *then* it is excluded from the weakest-topic result. · FR-94 · *Verifies:* S7

**US-9.4** — Plain language
*Given* a weak topic, *then* the summary reads like "You miss Algebra most — 2 of 7 correct". · FR-95, FR-84

**US-9.5** — Not enough data
*Given* no topic reaching the threshold, *then* the screen says so. · FR-96

**US-9.6** — Aggregate across history
*Given* several completed puzzles, *when* I open progress, *then* topic hit rates span the trainer's full history. · FR-97

### E-10 — UI shell, theming and accessibility

**US-10.1** — Navigate the hierarchy
*Given* the home screen, *when* I pick a category then a trainer then a variant, *then* each step renders without a page reload and I can go back at every step. · FR-2, FR-3, FR-8

**US-10.2** — Briefing without controls
*Given* a daily briefing screen, *then* it states trainer, variant, mode and parameter, and offers only start or back. · FR-4, FR-5

**US-10.3** — Theme
*Given* the toggle, *when* I switch theme, *then* it applies immediately and survives a reload; first visit follows the OS preference. · FR-156

**US-10.4** — Keyboard-only run
*Given* only a keyboard, *when* I go from home through a full round of each of the six trainers to results, *then* every action is reachable with focus always visible. · FR-157, FR-159 · *Verifies:* S10

**US-10.5** — Focus management
*Given* a round starts, *then* focus is on the input or board; after each answer it returns there. · FR-158

**US-10.6** — Small screens
*Given* a 360 px viewport, *when* I play a 6×6 board, *then* everything is usable without horizontal scrolling. · FR-160

**US-10.7** — Screen-reader announcements
*Given* a screen reader, *when* score, level, lives or pairs remaining change, *then* it is announced without interrupting input. · FR-162

**US-10.8** — Reduced motion
*Given* the OS reduced-motion preference, *then* non-essential animation including card flips is disabled. · FR-163

### E-11 — Quality, documentation and release

**US-11.1** — Full manual matrix
*Given* six trainers across all their variants, *when* each is played, *then* every round completes without error with a correct results screen. · NFR-12 · *Verifies:* S2

**US-11.2** — Offline operation
*Given* the app has loaded once, *when* the network is disabled, *then* every feature works and no external request is attempted. · NFR-8 · *Verifies:* S9

**US-11.3** — Accessibility audit
*Given* home, round and results screens, *when* Lighthouse runs, *then* each scores at least 90. · NFR-19 · *Verifies:* S10

**US-11.4** — Cross-browser
*Given* current Chrome, Firefox and Edge, *when* a round of each trainer is played, *then* behaviour and layout are correct. · NFR-12

**US-11.5** — README
*Given* a fresh clone elsewhere, *when* I follow the README, *then* I can run the app and the tests with no keys or build step, and it explains the hierarchy, bands, board sizes, daily attempts, practice mode and the archive. · NFR-13, NFR-18, NFR-20 · *Verifies:* S11

**US-11.6** — Deployment
*Given* a commit to `main`, *when* it lands, *then* the public URL updates automatically with no environment variables. · NFR-21

**US-11.7** — Data provenance
*Given* the repository, *when* I look for the outline data's origin, *then* its Natural Earth source, licence and processing steps are documented. · NFR-22

**US-11.8** — Timer accuracy
*Given* a mocked clock, *when* a 90 s round runs, *then* the measured duration is within 100 ms. · NFR-2 · *Verifies:* S5

---

## 8. Traceability to Brief Success Criteria

| Criterion | Requirements | Stories |
|---|---|---|
| S1 — statistics correct and persisted | FR-22, FR-68–73, FR-77, FR-99 | US-2.8, US-2.9, US-8.1, US-8.7 |
| S2 — all six trainers run across all variants | FR-1, FR-11, FR-12, FR-105, FR-137, FR-138 | US-5.2, US-7.2, US-11.1 |
| S3 — generators produce only valid questions | FR-106–110 | US-5.1, US-5.3, US-5.4 |
| S4 — answer checking correct and tolerant | FR-63–66, FR-111, FR-115, FR-116, FR-155 | US-2.6, US-5.5, US-6.2, US-7.14 |
| S5 — rounds end on their own condition | FR-14, FR-16, FR-18, FR-114, FR-140, NFR-2, NFR-3 | US-2.2, US-2.3, US-2.4, US-6.3, US-7.4, US-11.8 |
| S6 — progress chart correct | FR-86, FR-87, FR-88 | US-8.9, US-8.10 |
| S7 — weak topic identified correctly | FR-92–98 | US-9.2, US-9.3 |
| S8 — personal best per variant, direction-aware | FR-74, FR-75, FR-76, FR-81 | US-6.11, US-8.2, US-8.3, US-8.5 |
| S9 — offline, no third-party requests | NFR-7, NFR-8, NFR-9, FR-100, FR-143, FR-146 | US-7.1, US-7.5, US-7.8, US-8.14, US-11.2 |
| S10 — keyboard-only and accessible | FR-61, FR-62, FR-123, FR-133, FR-157–163, NFR-19 | US-6.7, US-10.4, US-10.5, US-11.3 |
| S11 — runs from README, no keys | NFR-13, NFR-18, NFR-20, NFR-21 | US-11.5, US-11.6 |
| S12 — deterministic puzzles | FR-29–33, NFR-4 | US-3.3, US-3.4, US-3.5, US-3.6 |
| S13 — one attempt per trainer, variant and day | FR-10, FR-10a, FR-10b, FR-27, FR-35–38, FR-41, FR-85 | US-2.11, US-2.11b, US-3.1, US-3.7, US-3.8, US-8.8 |
| S14 — archive recorded against its own date | FR-39, FR-40, FR-43, FR-87 | US-3.10, US-3.11, US-8.11 |
| S15 — Pattern Memory is endless | FR-23, FR-117, FR-118, NFR-5 | US-2.10, US-6.4, US-6.5 |
| S16 — comparison against previous and best | FR-80, FR-81, FR-82 | US-8.4, US-8.5, US-8.6 |
| S17 — practice never affects records | FR-45–50 | US-4.1, US-4.2, US-4.3 |
| S18 — filters are honoured | FR-51–56 | US-4.4, US-4.6, US-4.7 |
| S19 — Figure Pairs completion and scoring | FR-18, FR-125–131, FR-83 | US-2.4, US-6.8, US-6.9, US-6.10, US-6.11 |
| S20 — outline hints are correct | FR-145, FR-148–152 | US-7.7, US-7.9, US-7.10, US-7.11 |
| S21 — trainers reachable, engine untouched | FR-2, FR-6, FR-7 | US-1.3, US-7.15 |

Every success criterion is covered by at least one requirement and one story. No requirement exists without a traceable origin in the brief.

---

## 9. Decisions and Assumptions

### 9.1 Settled by the product owner

| Decision | Outcome |
|---|---|
| Difficulty | Player chooses; each band is an independent daily puzzle with its own record |
| Filters | Daily puzzles have none; all filtering lives in practice mode |
| Memory difficulty | Replaced by board size |
| Pattern Memory board | Fixed for the whole round — it never grows mid-round |
| Leaving a round | **Starting a daily round commits the attempt.** Quitting or switching variant ends it and spends it; practice is exempt |
| Outline data | Natural Earth public-domain data, bundled |
| Scope | v1 redesigned now — brief and PRD first, then the code rebuilt to match |
| Product name | LearningHub |

### 9.2 Assumptions pending confirmation

Chosen in the absence of a stated preference, and flagged so they can be overruled cheaply.

| Assumption | Why it matters | Cost of reversing |
|---|---|---|
| Pattern Memory board sizes 3×3 to 6×6; Figure Pairs 4×3 to 6×6 | Defines how many daily attempts Memory offers | Low — a list |
| Figure Pairs scores mistakes, with time only as a tie-break | Rewards memory rather than fast clicking | Medium — score direction and comparison logic |
| Practice rounds are discarded entirely rather than stored separately | Keeps the data model simple and history honest | Medium — adds a second history store |
| Trigonometry is exact values only — no decimal answers | Keeps answers unambiguous and checkable | Low — a generator constraint |
| Flags stay Unicode glyphs; only outlines use bundled data | Keeps payload small; glyph flags already work | Medium — would need bundled flag images |
| Geography keeps 3 lives at every band | Keeps rounds comparable across bands | Low |

---

## 10. Document Control

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-10 | Initial PRD from brief v2 |
| v2 | 2026-10-10 | Round modes, deterministic generation, daily attempts, archive |
| v3 | 2026-10-10 | Difficulty removed and date-assigned; Memory redefined as an endless tile grid |
| v3.1 | 2026-11-02 | §9 reconciled with the implementation; NFR added for publication |
| v3.2 | 2026-11-02 | Product name and the set-based Memory rule confirmed |
| v4 | 2026-11-02 | Rewritten against brief v5. **Difficulty selection restored** in a stronger form — four bands per trainer, each an independent daily puzzle with its own record (FR-26 to FR-37). Introduced the **category / trainer / topic hierarchy**, renaming the old weak-area "category" to **topic**. Added **practice mode** as the sole home of filters (FR-45 to FR-58). Added **completion** as a third round mode and **score direction** so a lower score can be better. Catalogue grows from three trainers to six, adding **Figure Pairs**, **Flag Guesser**, **Outline Guesser** and **Capital Guesser**, with Worldle-style distance, direction and proximity hints (FR-148 to FR-152) and bundled Natural Earth outline data. Storage keys move to `v2`. FRs 125 → 163, NFRs 20 → 22, epics 10 → 11, stories 75 → 93, success criteria 17 → 21 |
| v4.1 | 2026-11-02 | **Starting a daily round now commits the attempt** (FR-10, FR-10a to FR-10d). Quitting records the round as `abandoned` and spends it; switching variant mid-round does the same to the round being left, so it is never a free restart. Practice is exempt. This reverses the previous no-penalty rule, which would otherwise have made the switching rule trivially avoidable. Pattern Memory's fixed board confirmed as intended design rather than an assumption |
| v4.2 | 2026-11-02 | Reconciled with the built application. **FR-148 rewritten**: the Outline Guesser shows each country up to three times, because a distance hint is worthless if a wrong answer moves straight on to the next shape. Added **FR-10e**, so header navigation cannot be used to walk out of a round for free, and **FR-44a**, documenting that a mid-round reload escapes the commitment rule — the same class of limitation as the soft daily limit |

**Status:** implemented and deployed. The application at <https://g138-skotheimsvik.vercel.app/> reflects this document.
