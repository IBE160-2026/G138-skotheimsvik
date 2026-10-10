# Product Requirements Document — LearningHub v1

**Status:** Draft v3
**Author:** Daniel Skotheimsvik, with AI support (BMAD Product Manager role)
**Course:** IBE160 Programmering med KI, Høgskolen i Molde, autumn 2026
**Source document:** [product-brief.md](../product-brief.md) (Draft v4)
**Date:** 2026-10-10

> Written in English to match the product brief. The README is in Norwegian for the course.

---

## 1. Purpose and Scope

This document turns the LearningHub product brief into numbered, testable requirements that architecture, stories and tests can be traced back to.

**In scope:** everything listed as v1 (MVP) in brief §7 — the Drill Engine with two round modes, date-assigned difficulty, the daily-attempt rule and archive, deterministic puzzle generation, three trainers, comparison against previous and best, progress history with charts, weak-area tracking, `localStorage` persistence, theming and accessibility.

**Out of scope:** everything in brief §7 "Deferred to later phases" and "Explicitly out of scope" — accounts, server storage, enforced daily limits, player-selected difficulty, free-practice mode, further trainers and round modes, leaderboards, day-streak tracking, spaced repetition, third-party APIs, AI features inside the app.

**Primary user:** the everyday self-improver, per brief §4 — someone sharpening skills they use in ordinary life, in a few spare minutes at a time, with no teacher and no exam.

### 1.1 Requirement ID conventions

| Prefix | Meaning |
|---|---|
| `FR-n` | Functional requirement |
| `NFR-n` | Non-functional requirement |
| `E-n` | Epic |
| `US-n.n` | User story |
| `S-n` | Success criterion from brief §9 |

Priority uses MoSCoW: **M** = must, **S** = should, **C** = could. Every **M** requirement must be implemented for v1 to be considered done.

---

## 2. Domain Glossary

| Term | Definition |
|---|---|
| **Trainer** | A skill module: a question generator or content file, a renderer, and a declared round mode. v1 ships three; the set is designed to grow |
| **Drill Engine** | Shared runtime owning the loop, answer checking, scoring, streaks, round end conditions, results, persistence, daily difficulty, the daily-attempt rule and the archive |
| **Round mode** | How a round ends. v1 supports `timed` and `lives` |
| **Timed round** | Ends when the clock reaches zero. Used by Mental Math |
| **Lives round** | Ends when the player runs out of lives. Used by Geography (3) and Memory (1) |
| **Round** | One play of a puzzle: a trainer, a puzzle date, and the trainer's round mode |
| **Puzzle** | The deterministic difficulty, parameters and prompt sequence for a given trainer and date |
| **Puzzle date** | The calendar date a puzzle belongs to, in the user's local time zone |
| **Daily difficulty** | The difficulty band assigned to a puzzle date by the engine. Not selectable by the player |
| **Difficulty band** | `beginner`, `intermediate`, `advanced` or `expert` — controls question complexity and derived parameters |
| **Attempt** | A player's single scored play of a given trainer on a given puzzle date. One per trainer per date |
| **Today's puzzle** | The puzzle whose date is the current local date |
| **Archive** | The set of puzzles from dates before today, playable if not already attempted |
| **Seed** | The deterministic input to puzzle generation, derived from trainer and puzzle date |
| **Prompt** | A single question shown to the user |
| **Level** | In Memory, one pattern of a given tile count. Level *n* has *n* more tiles than level 1 |
| **Score** | The trainer's headline number: correct answers for Mental Math and Geography, highest level reached for Memory |
| **Streak** | Count of consecutive correct answers within a round; resets to 0 on a wrong answer |
| **Category** | A sub-type of prompt within a trainer, e.g. `fractions` in Mental Math. Used for weak-area tracking |
| **Personal best** | Highest score ever recorded for a trainer, across all dates and difficulties |
| **Previous attempt** | The most recently played round for a trainer, by puzzle date |
| **Accuracy** | `correctCount / totalAnswered`, expressed as a percentage; 0 % when nothing was answered |

---

## 3. Data Model

All data is client-side. No personal data is collected.

### 3.1 Entities

```
RoundResult
  id              string      unique, generated
  trainerId       string      "mental-math" | "memory" | "geography"
  puzzleDate      string      ISO date, e.g. "2026-10-12", local time zone
  difficulty      string      "beginner" | "intermediate" | "advanced" | "expert"
                              assigned by the date, recorded for display and filtering
  roundMode       string      "timed" | "lives"
  modeParam       number      durationSec when timed; total lives when lives
  score           number      headline number; see glossary
  playedAt        number      epoch ms, when the round was actually played
  endedBy         string      "time-expired" | "lives-exhausted" | "prompts-exhausted"
  elapsedMs       number      actual round duration
  totalAnswered   number      >= 0
  correctCount    number      0..totalAnswered
  accuracy        number      0..100, derived
  avgAnswerTimeMs number      >= 0, 0 when totalAnswered is 0
  bestStreak      number      >= 0
  livesRemaining  number|null null for timed rounds
  maxLevel        number|null Memory only: highest level reached
  categoryStats   CategoryStat[]

CategoryStat
  categoryId      string
  label           string      human-readable, e.g. "Fractions"
  asked           number      >= 1
  correct         number      0..asked

TrainerProgress
  trainerId       string
  attempts        Record<puzzleDate, RoundResult>   one entry per played date
  personalBest    number                            highest score ever

Settings
  theme           string      "dark" | "light" | "system"
```

Two consequences of removing difficulty selection:

- `personalBest` is a single number per trainer, not a map keyed by difficulty and mode parameter. The player cannot choose easier conditions to farm a better score, so one best per trainer is honest.
- `Settings` no longer stores a last-used difficulty or duration, because there is nothing left to remember.

`attempts` is keyed by puzzle date, which enforces the one-attempt-per-day rule structurally: a date either has a result or it does not.

### 3.2 Trainer configuration

Each trainer declares its round mode. Mode parameters are **derived from the day's difficulty**, never chosen by the player.

| Trainer | Round mode | Mode parameter | Derived how |
|---|---|---|---|
| Mental Math Sprint | `timed` | Round duration in seconds | Scales with the day's difficulty — harder arithmetic gets more time |
| Memory | `lives` | 1 life | Fixed |
| Geography Speed | `lives` | 3 lives | Fixed |

**Mental Math duration by band** (initial values, see §9.1):

| Band | Duration |
|---|---|
| Beginner | 45 s |
| Intermediate | 60 s |
| Advanced | 75 s |
| Expert | 90 s |

### 3.3 Storage

| Key | Contents |
|---|---|
| `learninghub.v1.progress` | `Record<trainerId, TrainerProgress>` |
| `learninghub.v1.settings` | `Settings` |

A `schemaVersion` field is stored alongside both so future versions can migrate or discard incompatible data rather than crash.

---

## 4. Functional Requirements

### 4.1 Application shell and navigation

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-1 | The home screen lists all available trainers as cards showing name, one-line description, round mode, and whether today's attempt is still available | M | S2, S14 |
| FR-2 | A trainer card shows today's difficulty band and the user's personal best where one exists | M | S13 |
| FR-3 | Selecting an available trainer opens a pre-round briefing screen stating the day's difficulty, the round mode and the mode parameter in plain language, e.g. "Expert — 90 seconds" or "3 lives, one mistake costs a life" | M | — |
| FR-4 | The briefing screen offers no difficulty or duration choice; it offers only to start or to go back | M | — |
| FR-5 | The user can abandon a round in progress and return to the home screen | M | — |
| FR-6 | Abandoning a round does not consume the day's attempt and writes no result | M | S14 |
| FR-7 | The user can navigate between home, archive, briefing, active round, results and progress views without a page reload | M | — |

### 4.2 Drill Engine — round lifecycle and round modes

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-8 | A round starts on explicit user action and presents the first prompt immediately | M | S2 |
| FR-9 | The engine runs the loop: show prompt → accept answer → show immediate feedback → advance to next prompt, until the round's end condition is met | M | S2 |
| FR-10 | The engine supports two round modes in v1, `timed` and `lives`; a trainer declares which one it uses | M | — |
| FR-11 | A trainer is registered by supplying a question generator, a renderer and a round-mode declaration; adding a trainer or supporting a new mode requires no change to existing trainers | M | — |
| FR-12 | **Timed mode:** the round ends when the day's duration elapses | M | S5 |
| FR-13 | **Timed mode:** no answer submitted after expiry is counted toward any statistic | M | S5 |
| FR-14 | **Timed mode:** remaining time is visible throughout the round | M | — |
| FR-15 | **Lives mode:** the round starts with the trainer's configured number of lives | M | S5 |
| FR-16 | **Lives mode:** an incorrect answer costs exactly one life | M | S5 |
| FR-17 | **Lives mode:** the round ends immediately when the last life is lost, and no further answer is accepted or counted | M | S5 |
| FR-18 | **Lives mode:** remaining lives are visible throughout the round | M | — |
| FR-19 | **Lives mode:** losing a life is signalled distinctly from an ordinary incorrect answer | S | — |
| FR-20 | Feedback after each answer states whether it was correct, and when incorrect shows the correct answer | M | S2 |
| FR-21 | Feedback is visible for a bounded interval (target ≤ 800 ms) and does not require a click to dismiss | S | — |
| FR-22 | Live score, accuracy and current streak are visible in both modes and update after every answer | M | S1 |
| FR-23 | The engine never repeats the same prompt twice in a row within a round | S | — |
| FR-24 | Prompts may be generated lazily, so a round with no fixed length is possible | M | S16 |
| FR-25 | If a trainer's prompt supply is exhausted before the end condition is met, the round ends with `endedBy` recorded as `prompts-exhausted` | S | — |

### 4.3 Daily difficulty

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-26 | Each puzzle date is assigned a difficulty band by the engine, derived deterministically from the date | M | S12, S13 |
| FR-27 | The difficulty band is identical for every player on a given date and cannot be influenced by any player input | M | S13 |
| FR-28 | Over any long run of dates, all four bands occur, and the distribution matches a documented target | M | S13 |
| FR-29 | Trainer parameters that depend on difficulty are derived from the band, not chosen — including the Mental Math round duration per §3.2 | M | S12 |
| FR-30 | The day's difficulty band is shown to the player before the round starts and on the results screen | M | — |
| FR-31 | The difficulty band is recorded on the round result, so history can show how hard each day was | M | — |

### 4.4 Daily puzzles, attempts and the archive

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-32 | Puzzle generation is deterministic: the same trainer and puzzle date always produce the identical difficulty, parameters and prompt sequence | M | S12 |
| FR-33 | Different puzzle dates produce different prompt sequences for the same trainer | M | S12 |
| FR-34 | The puzzle date is determined from the user's local calendar date | M | S14 |
| FR-35 | Each trainer allows one scored attempt per puzzle date | M | S14 |
| FR-36 | When today's attempt at a trainer has been completed, the home screen shows it as done and does not offer another attempt for that date | M | S14 |
| FR-37 | Completing today's attempt at one trainer does not affect the availability of other trainers | M | S14 |
| FR-38 | When the local date changes, each trainer's attempt becomes available again without requiring a reload | S | S14 |
| FR-39 | An archive view lists previous puzzle dates, marking each as played or unplayed per trainer and showing that date's difficulty band | M | S15 |
| FR-40 | An unplayed archive puzzle can be played, and its result is recorded against its own puzzle date | M | S15 |
| FR-41 | An archive puzzle that has already been attempted cannot be replayed | M | S14 |
| FR-42 | The archive reaches back to a defined earliest puzzle date and no further | M | — |
| FR-43 | Archive results count towards progress history, personal bests and weak-area analysis on equal terms with today's results | M | S15 |
| FR-44 | The interface states plainly that the daily limit is stored in the browser and is not enforced | S | — |

### 4.5 Answer handling

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-45 | Numeric prompts accept typed digits and submission via Enter | M | S4 |
| FR-46 | Text prompts accept typed text and submission via Enter | M | S4 |
| FR-47 | Multiple-choice prompts accept selection by mouse and by number key (1–4) | M | S10 |
| FR-48 | Grid prompts accept tile selection by mouse and by keyboard | M | S10 |
| FR-49 | Answer checking ignores leading and trailing whitespace | M | S4 |
| FR-50 | Answer checking for text answers is case-insensitive | M | S4 |
| FR-51 | Text answers accept documented alternative spellings where the content file defines them, e.g. "USA" for "United States" | S | S4 |
| FR-52 | Empty submissions are ignored: they neither count as answered, nor break the streak, nor cost a life | M | S4 |
| FR-53 | The input is cleared and refocused automatically after each submission | M | S10 |

### 4.6 Scoring

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-54 | The engine counts total answered and correct answers for the round | M | S1 |
| FR-55 | Each trainer declares which value is its headline score: correct answers for Mental Math and Geography, highest level reached for Memory | M | S16 |
| FR-56 | Accuracy is `correctCount / totalAnswered × 100`, rounded to one decimal; it is 0 % when nothing was answered | M | S1 |
| FR-57 | Average answer time is the mean elapsed time per submitted answer in milliseconds | M | — |
| FR-58 | The current streak increments on a correct answer and resets to 0 on an incorrect answer | M | S1 |
| FR-59 | Best streak for the round is the highest value the current streak reached | M | S1 |
| FR-60 | A single personal best is recorded per trainer, across all dates and difficulty bands | M | S8 |
| FR-61 | A personal best is updated only when the new score is strictly greater than the stored value | M | S8 |

### 4.7 Results screen and comparison

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-62 | After a round ends, a results screen shows the score, correct answers, total answered, accuracy, average answer time and best streak | M | S1 |
| FR-63 | The results screen states why the round ended — time expired, or out of lives | M | S5 |
| FR-64 | The results screen shows the day's difficulty band | M | — |
| FR-65 | The results screen compares this round against the **previous attempt** at that trainer, stating whether it was better, worse or equal, and by how much | M | S17 |
| FR-66 | The results screen compares this round against the **all-time best** and indicates clearly when a new best was set | M | S8, S17 |
| FR-67 | When this is the first ever attempt at a trainer, the comparison states that there is nothing to compare against yet | M | S17 |
| FR-68 | The results screen shows a weak-area summary when the trainer supports categories | M | S7 |
| FR-69 | The results screen offers a route to the archive and to the home screen, and does not offer a replay of the same puzzle | M | S14 |

### 4.8 Progress history and charts

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-70 | Every completed round is stored against its trainer and puzzle date | M | S6 |
| FR-71 | A progress view per trainer plots score and accuracy against puzzle date, in chronological order | M | S6, S15 |
| FR-72 | The chart conveys each day's difficulty band, so a dip on a hard day is not mistaken for decline | M | — |
| FR-73 | The progress view states puzzles completed, total time practised and the all-time best | S | — |
| FR-74 | When a trainer has no history, the progress view shows an explanatory empty state rather than an empty chart | M | — |
| FR-75 | Charts are rendered without a third-party charting library | M | NFR-9 |

### 4.9 Weak-area tracking

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-76 | Each prompt is tagged by the trainer with a category identifier | M | S7 |
| FR-77 | The engine aggregates asked and correct counts per category for the round | M | S7 |
| FR-78 | Weak-area analysis identifies the category with the lowest hit rate, considering only categories with at least 3 prompts asked | M | S7 |
| FR-79 | The weak area is presented in plain language, e.g. "You miss Fractions most — 2 of 7 correct" | M | S7 |
| FR-80 | When no category reaches the 3-prompt threshold, the analysis states that there is not enough data yet | M | S7 |
| FR-81 | The progress view shows weak-area hit rates aggregated across that trainer's full history, not only the last round | S | S7 |
| FR-82 | Mental Math and Geography must support categories in v1; Memory need not | M | S7 |

### 4.10 Persistence

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-83 | Round results, attempt records, personal bests and settings persist in `localStorage` and are restored on page load | M | S1, S6, S14 |
| FR-84 | If stored data is missing, corrupt or of an unknown schema version, the app starts with empty progress and shows a non-blocking notice instead of crashing | M | NFR-7 |
| FR-85 | The user can clear all stored progress from a settings screen, with a confirmation step; this also clears attempt records | S | — |
| FR-86 | If `localStorage` is unavailable, the app remains fully playable for the session, no attempt limit is applied, and the user is told progress will not be saved | S | NFR-7 |

### 4.11 Trainer — Mental Math Sprint (timed)

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-87 | Runs in timed mode with the duration derived from the day's difficulty band, per §3.2 | M | S5, S12 |
| FR-88 | Generates arithmetic prompts across the categories: addition, subtraction, multiplication, division, fractions, percentages | M | S3 |
| FR-89 | The day's difficulty band controls operand range and which categories are drawn. Beginner: addition and subtraction within 0–20. Intermediate: adds multiplication and division within tables to 10. Advanced: adds percentages and larger operands. Expert: adds fractions and multi-step prompts | M | S3 |
| FR-90 | Division prompts never divide by zero | M | S3 |
| FR-91 | Division prompts in the Beginner, Intermediate and Advanced bands always have an integer answer | M | S3 |
| FR-92 | Subtraction prompts in the Beginner band never produce a negative answer | M | S3 |
| FR-93 | Fraction prompts state the expected answer format and accept the documented equivalent forms | S | S4 |
| FR-94 | Answers are entered as free numeric input | M | S4 |
| FR-95 | The headline score is the number of correct answers | M | — |

### 4.12 Trainer — Memory (lives, 1 life, endless)

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-96 | Presents a grid of tiles. A subset of tiles is highlighted for a bounded display time, then hidden; the player reproduces the highlighted set by selecting tiles | M | S2 |
| FR-97 | Runs in lives mode with exactly 1 life: the first incorrect level ends the round | M | S5 |
| FR-98 | A level is correct only when exactly the highlighted tiles are selected — no omissions and no extras | M | S4 |
| FR-99 | Tile selection order does not affect correctness | M | S4 |
| FR-100 | Level 1 starts at the day's starting tile count, and each subsequent level adds exactly one tile | M | S16 |
| FR-101 | The round has no maximum level: levels continue to be generated for as long as the player keeps succeeding | M | S16 |
| FR-102 | The grid grows when the tile count would otherwise crowd it, per a documented threshold, so the task stays legible at high levels | M | S16 |
| FR-103 | The day's difficulty band sets the starting tile count and the display time | M | S12, S13 |
| FR-104 | The headline score is the highest level completed | M | S16 |
| FR-105 | The current level is visible throughout the round | M | — |
| FR-106 | The highlighted tiles are not retrievable from the page once hidden, including via the DOM | M | — |
| FR-107 | The grid is fully operable by keyboard: arrow keys move between tiles, a key selects and deselects, and a key submits the level | M | S10 |
| FR-108 | Selected tiles are visually distinct from unselected ones by means other than colour alone | M | S10 |

### 4.13 Trainer — Geography Speed (lives, 3 lives)

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-109 | Runs in lives mode with exactly 3 lives | M | S5 |
| FR-110 | Content is loaded from a JSON file in the repository containing countries, capitals, continents and flag references | M | NFR-9 |
| FR-111 | Prompt categories: country → capital, capital → country, flag → country, country → continent | M | S7 |
| FR-112 | The day's difficulty band controls the country pool. Beginner: widely known countries. Intermediate: adds mid-frequency countries. Advanced: full set. Expert: full set with free-text instead of multiple choice | M | S2, S13 |
| FR-113 | Multiple-choice distractors are drawn from the same continent where possible, so they are plausible | S | — |
| FR-114 | Flag assets are stored in the repository; no external image requests are made | M | NFR-9 |
| FR-115 | The content file is validated at load; malformed entries are skipped and logged rather than crashing the trainer | M | NFR-7 |
| FR-116 | The headline score is the number of correct answers | M | — |

### 4.14 Presentation, theming and accessibility

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-117 | The interface supports dark and light mode, with the choice persisted | M | — |
| FR-118 | Theme defaults to the operating system preference on first visit | S | — |
| FR-119 | Every screen is usable with the keyboard alone, with no mouse interaction required | M | S10 |
| FR-120 | Focus moves to the answer input, or to the grid, when a round starts and after each answer | M | S10 |
| FR-121 | Visible focus indicators are present on all interactive elements, including individual grid tiles | M | S10 |
| FR-122 | The layout is usable down to 360 px width, including the Memory grid at high levels | M | — |
| FR-123 | Correct/incorrect feedback, and the loss of a life, are conveyed by text or icon in addition to colour | M | S10 |
| FR-124 | Live score, level and lives updates are announced to assistive technology via an ARIA live region | S | S10 |
| FR-125 | Reduced-motion preference is respected: non-essential animation is disabled | S | S10 |

---

## 5. Non-Functional Requirements

| ID | Requirement | Verification | Traces to |
|---|---|---|---|
| NFR-1 | Answer feedback renders within 100 ms of submission on a mid-range laptop | Manual timing | — |
| NFR-2 | The timer is accurate to within 100 ms over a 90 s round | Automated test with a mocked clock | S5 |
| NFR-3 | A lives round ends within one prompt of the last life being lost, with no further prompt rendered | Automated test | S5 |
| NFR-4 | Puzzle generation is pure and reproducible: given the same seed it returns an identical difficulty, parameter set and prompt sequence, with no reliance on `Math.random`, wall-clock time during generation, or any other ambient state | Automated test comparing repeated generations | S12 |
| NFR-5 | Memory level generation remains deterministic at arbitrary depth: level *n* is a pure function of the seed and *n* | Automated test at levels 1, 10 and 50 | S16 |
| NFR-6 | First meaningful paint within 2 s on a local file open | Lighthouse | — |
| NFR-7 | No unhandled exception reaches the user; failures degrade to a readable message | Fault-injection tests on storage and content loading | S9 |
| NFR-8 | The application works fully offline after first load | DevTools, offline mode | S9 |
| NFR-9 | No third-party runtime dependencies, no network requests to external hosts, no API keys | Dependency review plus network inspection | S9, S11 |
| NFR-10 | Stored progress stays below 1 MB after two years of daily play across all trainers | Calculation plus test with generated data | FR-83 |
| NFR-11 | The app runs in current Chrome, Firefox and Edge | Manual cross-browser check | S11 |
| NFR-12 | The app can be run by opening the entry page from a clone, or via a plain static file server, with no build step | Fresh-clone test on a second machine | S11 |
| NFR-13 | No personal data is collected, transmitted or stored | Code review | — |
| NFR-14 | Pure logic — generators, seeding, difficulty assignment, answer checking, scoring, streaks, end conditions, attempt rules, comparison and weak-area analysis — is isolated from DOM code so it can be unit-tested | Code review; tests import logic without a DOM | S3–S8, S12–S17 |
| NFR-15 | Date handling is injectable so tests can simulate any local date without changing the system clock | Code review; tests with a mocked clock | S13, S14, S15 |
| NFR-16 | Automated tests cover all question generators, seeding and determinism, difficulty assignment and distribution, answer checking, scoring, streaks, both round-end conditions, endless level generation, personal bests, comparison, attempt rules and weak-area analysis | Test run; coverage report | S3–S8, S12–S17 |
| NFR-17 | The test suite runs with a single documented command | README check | S11 |
| NFR-18 | Lighthouse accessibility score ≥ 90 on the home, round and results screens | Lighthouse audit | S10 |
| NFR-19 | The README documents purpose, how to run locally, how to run tests, the daily-attempt rule, the absence of difficulty selection, the archive, and the repository structure | Review | S11 |

---

## 6. Epics

| ID | Epic | Goal | Depends on |
|---|---|---|---|
| E-1 | Project foundation and test harness | Runnable skeleton, test runner, injectable clock, repository structure | — |
| E-2 | Drill Engine core and round modes | Loop, answer checking, scoring, streaks, timed and lives end conditions, lazy prompt supply | E-1 |
| E-3 | Daily difficulty, deterministic puzzles, attempts and archive | Seeded generation, date-assigned difficulty, one attempt per trainer per date, archive browsing | E-2 |
| E-4 | Mental Math Sprint (timed) | First trainer, validating the timed mode and difficulty-derived parameters | E-2, E-3 |
| E-5 | Memory (1 life, endless grid) | Second trainer, validating the lives mode and unbounded lazy generation | E-2, E-3 |
| E-6 | Geography Speed (3 lives) | Third trainer, content-file driven, validating the engine contract without engine changes | E-2, E-3 |
| E-7 | Persistence, results comparison and progress history | Storage, attempt records, previous/best comparison, history, charts | E-2, E-3 |
| E-8 | Weak-area tracking | Category aggregation and plain-language analysis | E-2, E-7 |
| E-9 | UI shell, theming and accessibility | Navigation, archive view, dark/light, keyboard-first including the grid, responsive | E-2, E-3 |
| E-10 | Quality, documentation and release | Cross-browser checks, accessibility audit, README | all |

**Build order rationale.** E-4 and E-5 are deliberately built before the engine contract is frozen, and they stress it in different ways — one timed with a fixed prompt supply, one lives-based with unbounded lazy generation. That is what exposes whether the abstraction is right, as noted in brief §12. E-6 then tests the contract by adding a third trainer without changing engine code.

---

## 7. User Stories

Format: *As a learner, I want … so that …* Acceptance criteria are written Given/When/Then so they map directly onto test cases.

### E-1 — Project foundation and test harness

**US-1.1** — Set up repository structure and entry page
*Acceptance:* Given a fresh clone, when I open the entry page, then a placeholder home screen renders with no console errors and no network requests to external hosts.
*Covers:* NFR-9, NFR-12

**US-1.2** — Set up the test runner
*Acceptance:* Given the repository, when I run the documented test command, then the suite executes and reports results; a deliberately failing sample test causes a non-zero exit code.
*Covers:* NFR-17

**US-1.3** — Define the trainer registration contract
*Acceptance:* Given the engine, when a trainer module supplies a generator, a renderer, a round-mode declaration and a headline-score declaration, then it appears on the home screen without any engine file being modified.
*Covers:* FR-11, FR-55

**US-1.4** — Make the clock injectable
*Acceptance:* Given a test, when a fixed local date is supplied to the application, then all date-dependent behaviour uses it rather than the system clock.
*Covers:* NFR-15

### E-2 — Drill Engine core and round modes

**US-2.1** — Start a round
*Acceptance:* Given a trainer with an available attempt, when I start the round, then the first prompt appears immediately and the mode indicator shows either remaining time or remaining lives.
*Covers:* FR-8, FR-14, FR-18

**US-2.2** — End a timed round exactly on time
*Acceptance:* Given a round with the day's duration, when the clock reaches zero, then input is disabled and the results screen appears; and given an answer submitted after expiry, when scoring runs, then that answer is not counted.
*Covers:* FR-12, FR-13 · *Verifies:* S5

**US-2.3** — End a lives round on the last life
*Acceptance:* Given a round with 3 lives and 2 already lost, when I answer incorrectly, then the round ends immediately, no further prompt is rendered, and the results screen states the round ended because lives ran out.
*Covers:* FR-15, FR-16, FR-17, FR-63 · *Verifies:* S5

**US-2.4** — Lose a life visibly
*Acceptance:* Given a lives round, when I answer incorrectly, then the remaining-lives indicator decreases by exactly one and the loss is signalled by text or icon as well as colour.
*Covers:* FR-18, FR-19, FR-123

**US-2.5** — Submit and check answers
*Acceptance:* Given a prompt, when I submit an answer, then it is checked, feedback is shown, and the next prompt appears with the input cleared and refocused.
*Covers:* FR-9, FR-45, FR-46, FR-53

**US-2.6** — Tolerant answer checking
*Acceptance:* Given a text prompt with answer "Oslo", when I submit " oslo ", then it is accepted; and when I submit an empty string, then nothing is counted, my streak is unaffected, and no life is lost.
*Covers:* FR-49, FR-50, FR-52 · *Verifies:* S4

**US-2.7** — Show corrective feedback
*Acceptance:* Given an incorrect answer, when feedback appears, then it states the answer was wrong and shows the correct answer, using text or an icon as well as colour.
*Covers:* FR-20, FR-123

**US-2.8** — Track score and streak live
*Acceptance:* Given a round in progress, when I answer correctly, then score and streak both increase; and when I answer incorrectly, then the streak resets to 0 while best streak retains its highest value.
*Covers:* FR-22, FR-54, FR-58, FR-59 · *Verifies:* S1

**US-2.9** — Compute round statistics
*Acceptance:* Given 10 answers of which 7 are correct, when the round ends, then accuracy reads 70.0 %; and given zero answers, then accuracy reads 0 % and average answer time reads 0 without a division error.
*Covers:* FR-56, FR-57 · *Verifies:* S1

**US-2.10** — Supply prompts lazily
*Acceptance:* Given a trainer with no fixed prompt list, when the round runs, then each prompt is generated on demand and the round is not bounded by a pre-built list.
*Covers:* FR-24 · *Verifies:* S16

**US-2.11** — Avoid immediate repeats
*Acceptance:* Given a round, when prompts are presented, then no prompt is identical to the one directly before it.
*Covers:* FR-23

**US-2.12** — Abandon a round without penalty
*Acceptance:* Given a round in progress, when I choose to quit, then I return to the home screen, no result is written, and today's attempt for that trainer is still available.
*Covers:* FR-5, FR-6 · *Verifies:* S14

**US-2.13** — Multiple-choice input
*Acceptance:* Given a four-option prompt, when I press the 2 key, then the second option is submitted; and clicking the option has the identical effect.
*Covers:* FR-47

**US-2.14** — Handle an exhausted prompt supply
*Acceptance:* Given a trainer whose prompts run out before the end condition is met, when the last prompt is answered, then the round ends cleanly and records `prompts-exhausted`.
*Covers:* FR-25

### E-3 — Daily difficulty, deterministic puzzles, attempts and archive

**US-3.1** — Assign difficulty from the date
*Acceptance:* Given a puzzle date, when the difficulty is computed twice, then it is identical both times; and given no player input of any kind can reach the computation, then the band cannot be influenced.
*Covers:* FR-26, FR-27 · *Verifies:* S13

**US-3.2** — Vary difficulty across days
*Acceptance:* Given 365 consecutive simulated dates, when difficulty is computed for each, then all four bands occur and the distribution matches the documented target.
*Covers:* FR-28 · *Verifies:* S13

**US-3.3** — Derive parameters from difficulty
*Acceptance:* Given an Expert day, when Mental Math starts, then the round duration is 90 s; and given a Beginner day, then it is 45 s — with no way for the player to change it.
*Covers:* FR-29, FR-87, FR-4 · *Verifies:* S12

**US-3.4** — Generate puzzles deterministically
*Acceptance:* Given the same trainer and puzzle date, when the puzzle is generated twice, then the two prompt sequences are identical; and given two different dates, then the sequences differ.
*Covers:* FR-32, FR-33, NFR-4 · *Verifies:* S12

**US-3.5** — Use the local calendar date
*Acceptance:* Given a mocked local date, when the home screen loads, then today's puzzle is the one for that date.
*Covers:* FR-34, NFR-15

**US-3.6** — Show the day's difficulty before playing
*Acceptance:* Given the home screen and the briefing screen, when they render, then today's difficulty band is stated, along with the round mode and the derived parameter.
*Covers:* FR-2, FR-3, FR-30

**US-3.7** — Consume the daily attempt
*Acceptance:* Given I complete today's Mental Math round, when I return to the home screen, then Mental Math is shown as done for today and cannot be started again; and Memory and Geography remain available.
*Covers:* FR-35, FR-36, FR-37 · *Verifies:* S14

**US-3.8** — Release the attempt on a new day
*Acceptance:* Given today's attempt is used and the local date advances, when the home screen refreshes, then the trainer is available again.
*Covers:* FR-38 · *Verifies:* S14

**US-3.9** — Browse the archive
*Acceptance:* Given previous puzzle dates exist, when I open the archive, then each date is listed with its difficulty band and its played or unplayed state per trainer, back to the earliest puzzle date and no further.
*Covers:* FR-39, FR-42 · *Verifies:* S15

**US-3.10** — Play an archive puzzle
*Acceptance:* Given an unplayed archive date, when I play it, then the result is recorded against that puzzle date rather than today's; and given an already-played archive date, then it cannot be replayed.
*Covers:* FR-40, FR-41, FR-43 · *Verifies:* S15

**US-3.11** — Disclose the soft limit
*Acceptance:* Given the home screen or an explanatory view, when I read it, then it states plainly that the daily limit is kept in the browser and is not enforced.
*Covers:* FR-44

### E-4 — Mental Math Sprint (timed)

**US-4.1** — Generate valid arithmetic prompts
*Acceptance:* Given 1000 generated prompts per difficulty band, when they are validated, then none divide by zero, every Beginner/Intermediate/Advanced division has an integer answer, and no Beginner subtraction yields a negative result.
*Covers:* FR-88, FR-90, FR-91, FR-92 · *Verifies:* S3

**US-4.2** — Scale content with the day's band
*Acceptance:* Given each band, when prompts are generated, then only that band's permitted categories and operand ranges occur, per FR-89.
*Covers:* FR-89 · *Verifies:* S2

**US-4.3** — Tag prompts with categories
*Acceptance:* Given a completed round, when category statistics are read, then every prompt is attributed to exactly one of the six Mental Math categories and the counts sum to total answered.
*Covers:* FR-76, FR-82

**US-4.4** — Handle fraction prompts
*Acceptance:* Given an Expert-band fraction prompt, when it is displayed, then the expected answer format is stated; and when I submit a documented equivalent form, then it is accepted.
*Covers:* FR-93

**US-4.5** — Report correct answers as the score
*Acceptance:* Given a finished round with 23 correct answers, when the result is recorded, then the headline score is 23.
*Covers:* FR-95, FR-55

### E-5 — Memory (1 life, endless grid)

**US-5.1** — Show and hide a tile pattern
*Acceptance:* Given a level starts, when the pattern is shown, then the highlighted tiles are visible for the day's display time and then hidden, and the grid becomes selectable.
*Covers:* FR-96, FR-103

**US-5.2** — Check a level by set, not order
*Acceptance:* Given highlighted tiles {A, C, F}, when I select C, then A, then F, then the level is correct; and when I select {A, C}, or {A, C, F, G}, then it is incorrect.
*Covers:* FR-98, FR-99

**US-5.3** — End on the first mistake
*Acceptance:* Given a Memory round, when I get my first level wrong, then the round ends immediately and the results screen states that lives ran out.
*Covers:* FR-97 · *Verifies:* S5

**US-5.4** — Grow by one tile per level
*Acceptance:* Given level *n* has *k* tiles, when I complete it, then level *n+1* has exactly *k+1* tiles.
*Covers:* FR-100 · *Verifies:* S16

**US-5.5** — Never run out of levels
*Acceptance:* Given 50 consecutive correct levels, when each next level is requested, then it is generated successfully and the round is still running.
*Covers:* FR-101, NFR-5 · *Verifies:* S16

**US-5.6** — Grow the grid when needed
*Acceptance:* Given the tile count reaches the documented threshold relative to grid size, when the next level is generated, then the grid dimensions increase and the pattern remains legible.
*Covers:* FR-102

**US-5.7** — Start from the day's parameters
*Acceptance:* Given an Expert day and a Beginner day, when each round starts, then the starting tile count and display time differ according to the band, and are identical for every player on that date.
*Covers:* FR-103 · *Verifies:* S12, S13

**US-5.8** — Report the level reached as the score
*Acceptance:* Given I complete level 7 and fail level 8, when the result is recorded, then the headline score is 7 and the results screen states the level reached.
*Covers:* FR-104, FR-55 · *Verifies:* S16

**US-5.9** — Show the current level
*Acceptance:* Given a round in progress, when a level starts, then the current level number is visible.
*Covers:* FR-105

**US-5.10** — Prevent cheating via the DOM
*Acceptance:* Given a hidden pattern, when the DOM is inspected, then the highlighted tiles are not identifiable from the rendered markup.
*Covers:* FR-106

**US-5.11** — Operate the grid by keyboard
*Acceptance:* Given only a keyboard, when I move with the arrow keys, select with a key and submit with a key, then I can complete a level without a mouse, with focus always visible.
*Covers:* FR-48, FR-107, FR-121 · *Verifies:* S10

**US-5.12** — Distinguish selection without colour
*Acceptance:* Given selected and unselected tiles, when they render, then they differ by more than colour alone.
*Covers:* FR-108

### E-6 — Geography Speed (3 lives)

**US-6.1** — Run with three lives
*Acceptance:* Given a Geography round, when I answer incorrectly twice, then the round continues with one life left; and on the third incorrect answer it ends.
*Covers:* FR-109 · *Verifies:* S5

**US-6.2** — Load and validate content
*Acceptance:* Given the content JSON, when it loads, then valid entries are available to the generator; and given a deliberately malformed entry, then it is skipped and logged while the trainer still runs.
*Covers:* FR-110, FR-115 · *Verifies:* S9

**US-6.3** — Generate the four prompt categories
*Acceptance:* Given a round, when prompts are generated, then all four categories occur and each prompt is tagged with its category.
*Covers:* FR-111, FR-76

**US-6.4** — Scale the country pool with the day's band
*Acceptance:* Given a Beginner day, when prompts are generated, then only countries from the widely-known pool appear; and given an Expert day, then answers are free-text rather than multiple choice.
*Covers:* FR-112 · *Verifies:* S13

**US-6.5** — Plausible distractors
*Acceptance:* Given a multiple-choice prompt, when distractors are chosen, then they come from the same continent where the pool allows, and the correct answer never appears twice.
*Covers:* FR-113

**US-6.6** — Serve flags locally
*Acceptance:* Given a flag prompt, when the page loads the image, then it is served from the repository and no external request is made.
*Covers:* FR-114 · *Verifies:* S9

**US-6.7** — Accept documented alternative names
*Acceptance:* Given a country with documented alternatives, when I submit any documented form, then it is accepted.
*Covers:* FR-51

**US-6.8** — Add a trainer without touching the engine
*Acceptance:* Given Geography is implemented after the engine is complete, when it is registered, then no engine file required modification.
*Covers:* FR-11

### E-7 — Persistence, results comparison and progress history

**US-7.1** — Persist results and attempts
*Acceptance:* Given a completed round, when I reload the page, then the result still appears in history with identical values and the attempt is still recorded as used for that date.
*Covers:* FR-70, FR-83 · *Verifies:* S1, S14

**US-7.2** — Maintain a single personal best
*Acceptance:* Given a stored best of 18 for a trainer, when I score 17, then the best is unchanged; and when I score 19, then the best becomes 19.
*Covers:* FR-60, FR-61 · *Verifies:* S8

**US-7.3** — Compare against the previous attempt
*Acceptance:* Given my previous Mental Math score was 20, when I score 23, then the results screen states I beat it by 3; when I score 17, then it states I fell short by 3; and when I score 20, then it states I matched it.
*Covers:* FR-65 · *Verifies:* S17

**US-7.4** — Compare against the all-time best
*Acceptance:* Given my best is 25 and I score 23, then the results screen shows the gap to my best; and when I score 26, then it announces a new best.
*Covers:* FR-66 · *Verifies:* S8, S17

**US-7.5** — Handle the first ever attempt
*Acceptance:* Given no previous result for a trainer, when the results screen renders, then it states there is nothing to compare against yet and records the score as the first best.
*Covers:* FR-67 · *Verifies:* S17

**US-7.6** — Show a results screen
*Acceptance:* Given a finished round, when the results screen appears, then score, correct answers, total answered, accuracy, average answer time, best streak, the day's difficulty and the reason the round ended are all displayed.
*Covers:* FR-62, FR-63, FR-64 · *Verifies:* S1

**US-7.7** — Route onward from results
*Acceptance:* Given the results screen, when it renders, then it offers the archive and the home screen and offers no replay of the same puzzle.
*Covers:* FR-69 · *Verifies:* S14

**US-7.8** — Plot progress over time
*Acceptance:* Given five completed puzzles, when I open the progress view, then five data points appear ordered by puzzle date with values matching the stored results.
*Covers:* FR-71, FR-75 · *Verifies:* S6

**US-7.9** — Show difficulty on the chart
*Acceptance:* Given puzzles played across different bands, when the chart renders, then each point conveys the day's difficulty band.
*Covers:* FR-72

**US-7.10** — Place archive results correctly
*Acceptance:* Given a puzzle from an earlier date played today, when I open the progress view, then its data point sits at its puzzle date, not at today.
*Covers:* FR-71, FR-43 · *Verifies:* S15

**US-7.11** — Summarise practice
*Acceptance:* Given existing history, when I open the progress view, then puzzles completed, total time practised and the all-time best are shown.
*Covers:* FR-73

**US-7.12** — Handle an empty history
*Acceptance:* Given a trainer never played, when I open its progress view, then an explanatory empty state appears instead of a blank chart.
*Covers:* FR-74

**US-7.13** — Survive corrupt storage
*Acceptance:* Given invalid JSON in the storage key, when the app loads, then it starts with empty progress, shows a non-blocking notice and remains usable.
*Covers:* FR-84 · *Verifies:* S9

**US-7.14** — Clear progress
*Acceptance:* Given stored progress, when I choose to clear it and confirm, then all results, attempts and personal bests are removed and every trainer is available again.
*Covers:* FR-85

**US-7.15** — Degrade without storage
*Acceptance:* Given `localStorage` is unavailable, when I play a round, then the round completes normally, no attempt limit is applied, and I am told progress will not be saved.
*Covers:* FR-86

**US-7.16** — Keep storage small
*Acceptance:* Given two years of simulated daily results across all trainers, when storage size is measured, then it is below 1 MB.
*Covers:* NFR-10

### E-8 — Weak-area tracking

**US-8.1** — Aggregate per category
*Acceptance:* Given a completed round, when category statistics are computed, then asked and correct counts per category match the answers given, and asked totals equal total answered.
*Covers:* FR-77

**US-8.2** — Identify the weakest category
*Acceptance:* Given a scripted round where fractions are answered 2 of 7 correct and every other category is above 80 %, when analysis runs, then fractions is reported as the weakest area.
*Covers:* FR-78 · *Verifies:* S7

**US-8.3** — Ignore thin categories
*Acceptance:* Given a category with only 2 prompts asked and both wrong, when analysis runs, then that category is excluded from the weakest-area result.
*Covers:* FR-78

**US-8.4** — Explain in plain language
*Acceptance:* Given an identified weak area, when the results screen renders, then it reads in the form "You miss Fractions most — 2 of 7 correct".
*Covers:* FR-79, FR-68

**US-8.5** — Handle insufficient data
*Acceptance:* Given a round where no category reached 3 prompts, when the results screen renders, then it states that there is not enough data yet.
*Covers:* FR-80

**US-8.6** — Aggregate across history
*Acceptance:* Given several completed puzzles, when I open the progress view, then per-category hit rates are shown across the full history for that trainer.
*Covers:* FR-81

### E-9 — UI shell, theming and accessibility

**US-9.1** — Home screen shows today's state
*Acceptance:* Given the home screen, when it renders, then every registered trainer appears with name, description, round mode, today's difficulty band, and whether today's attempt is still available.
*Covers:* FR-1, FR-2 · *Verifies:* S14

**US-9.2** — Pre-round briefing
*Acceptance:* Given a selected trainer, when the briefing screen opens, then it states the day's difficulty, the round mode and the derived parameter, and offers only start or back — no difficulty or duration control is present.
*Covers:* FR-3, FR-4

**US-9.3** — Client-side navigation
*Acceptance:* Given any screen, when I navigate between home, archive, briefing, round, results and progress, then the view changes without a full page reload.
*Covers:* FR-7

**US-9.4** — Dark and light mode
*Acceptance:* Given the theme toggle, when I switch theme, then it applies immediately and survives a reload; and on first visit the OS preference is used.
*Covers:* FR-117, FR-118

**US-9.5** — Keyboard-only operation
*Acceptance:* Given only a keyboard, when I navigate from home through a full round of each trainer to results and into the archive, then every action is reachable and focus is always visible.
*Covers:* FR-119, FR-121 · *Verifies:* S10

**US-9.6** — Focus management
*Acceptance:* Given a round starts, when the first prompt appears, then focus is on the answer input or the grid as appropriate; and after each submission focus returns there.
*Covers:* FR-120

**US-9.7** — Responsive layout
*Acceptance:* Given a 360 px viewport, when I run a round of each trainer, then all controls, the mode indicator, the Memory grid at level 15 and the statistics are usable without horizontal scrolling.
*Covers:* FR-122

**US-9.8** — Announce updates to assistive technology
*Acceptance:* Given a screen reader, when my score changes, a level advances or a life is lost, then the update is announced via a live region without interrupting input.
*Covers:* FR-124

**US-9.9** — Respect reduced motion
*Acceptance:* Given the OS reduced-motion preference, when the app renders, then non-essential animation is disabled.
*Covers:* FR-125

### E-10 — Quality, documentation and release

**US-10.1** — Full manual test matrix
*Acceptance:* Given 3 trainers and archive dates covering all four difficulty bands, when each combination is played, then every round completes without error and produces a correct results screen.
*Covers:* NFR-11 · *Verifies:* S2

**US-10.2** — Verify offline operation
*Acceptance:* Given the app has loaded once, when the network is disabled, then every feature continues to work and no external request is attempted.
*Covers:* NFR-8 · *Verifies:* S9

**US-10.3** — Accessibility audit
*Acceptance:* Given the home, round and results screens, when a Lighthouse accessibility audit runs, then each scores at least 90 and reported issues are fixed or documented.
*Covers:* NFR-18 · *Verifies:* S10

**US-10.4** — Cross-browser verification
*Acceptance:* Given current Chrome, Firefox and Edge, when a full round of each trainer is played, then behaviour and layout are correct.
*Covers:* NFR-11

**US-10.5** — README and run instructions
*Acceptance:* Given a fresh clone on another machine, when I follow the README, then I can run the app and the test suite without keys, accounts or a build step, and the README explains the daily-attempt rule, the absence of difficulty selection, and the archive.
*Covers:* NFR-12, NFR-17, NFR-19 · *Verifies:* S11

**US-10.6** — Timer accuracy test
*Acceptance:* Given a mocked clock, when a 90 s round runs, then the measured duration is within 100 ms of the target.
*Covers:* NFR-2 · *Verifies:* S5

**US-10.7** — Lives promptness test
*Acceptance:* Given a lives round, when the last life is lost, then no further prompt is rendered before the results screen appears.
*Covers:* NFR-3 · *Verifies:* S5

---

## 8. Traceability to Brief Success Criteria

| Criterion | Requirements | Stories |
|---|---|---|
| S1 — round statistics correct and persisted | FR-22, FR-54–59, FR-62, FR-83 | US-2.8, US-2.9, US-7.1, US-7.6 |
| S2 — all trainers run across all difficulty bands | FR-1, FR-8, FR-9, FR-89, FR-103, FR-112 | US-4.2, US-5.1, US-6.4, US-10.1 |
| S3 — generators produce only valid questions | FR-88, FR-90, FR-91, FR-92 | US-4.1 |
| S4 — answer checking correct and tolerant | FR-45–52, FR-98, FR-99 | US-2.6, US-5.2, US-6.7 |
| S5 — rounds end exactly on their end condition | FR-12, FR-13, FR-15–17, FR-97, FR-109, NFR-2, NFR-3 | US-2.2, US-2.3, US-5.3, US-6.1, US-10.6, US-10.7 |
| S6 — progress chart correct | FR-70, FR-71 | US-7.8 |
| S7 — weak area identified correctly | FR-76–80 | US-8.2, US-8.3 |
| S8 — personal best only on genuine improvement | FR-60, FR-61, FR-66 | US-7.2, US-7.4 |
| S9 — works offline, no third-party requests | NFR-7, NFR-8, NFR-9, FR-84, FR-114 | US-6.2, US-6.6, US-7.13, US-10.2 |
| S10 — keyboard-only and accessible, including the grid | FR-48, FR-107, FR-119–125, NFR-18 | US-5.11, US-9.5, US-9.6, US-10.3 |
| S11 — runs from README with no keys | NFR-12, NFR-17, NFR-19 | US-10.5 |
| S12 — deterministic daily puzzles | FR-29, FR-32, FR-33, NFR-4 | US-3.3, US-3.4, US-5.7 |
| S13 — difficulty assigned by date and varies | FR-26, FR-27, FR-28, FR-103, FR-112 | US-3.1, US-3.2, US-5.7, US-6.4 |
| S14 — one attempt per trainer per day | FR-6, FR-35–38, FR-41, FR-69 | US-2.12, US-3.7, US-3.8, US-7.1 |
| S15 — archive puzzles recorded against their own date | FR-39, FR-40, FR-43, FR-71 | US-3.9, US-3.10, US-7.10 |
| S16 — Memory is endless and grows by one tile | FR-24, FR-100, FR-101, FR-102, FR-104, NFR-5 | US-2.10, US-5.4, US-5.5, US-5.8 |
| S17 — comparison against previous and best is correct | FR-65, FR-66, FR-67 | US-7.3, US-7.4, US-7.5 |

Every success criterion in the brief is covered by at least one requirement and one story. No requirement exists without a traceable origin in the brief.

---

## 9. Open Questions for Architecture

Carried from brief §13, to be resolved in the architecture document:

| # | Question | Blocks |
|---|---|---|
| 1 | Vanilla JavaScript or a lightweight framework? | E-1, E-9 |
| 2 | Which test runner, and does it run in Node, a browser, or both? | E-1, NFR-14 |
| 3 | Module format and whether a bundler is needed, given NFR-12 forbids a build step | E-1 |
| 4 | Which seeded pseudo-random algorithm, and how the seed is derived from trainer + date | E-3, NFR-4 |
| 5 | The exact difficulty distribution across dates — how often each band should occur | E-3, FR-28 |
| 6 | The earliest puzzle date, and how far back the archive reaches | E-3, FR-42 |
| 7 | How a local-date change is detected while the page stays open | E-3, FR-38 |
| 8 | Memory grid growth rule — starting dimensions and the threshold at which the grid enlarges | E-5, FR-102 |
| 9 | SVG or Canvas for charts, and how difficulty is conveyed on them | E-7, FR-72 |
| 10 | Exact shape of the trainer registration interface, including round mode and headline score | E-1, FR-11 |
| 11 | Source and licence for the geography content and flag assets | E-6 |
| 12 | Final product name | E-10 |

### 9.1 Assumptions pending confirmation

These were chosen in the absence of a stated preference and are flagged so they can be overruled cheaply.

| Assumption | Why it matters | If wrong |
|---|---|---|
| Mental Math duration scales 45/60/75/90 s across the four bands | Harder days get more time, so a hard day is harder rather than merely slower | Values change; derivation mechanism unaffected |
| Memory levels are judged as a *set* — tile order does not matter | Decides whether the task is visual-memory or Simon-style sequence recall | FR-99 inverts; answer checking and the renderer both change |
| Memory starts at the day's tile count and grows by exactly one per level | Makes the score a clean "level reached" number | Growth rule changes; FR-100 and the score definition change |
| A single personal best per trainer, not split by difficulty band | Honest, because the player cannot choose an easier band | Best becomes a map keyed by band; comparison logic grows |
| Geography keeps 3 lives on every band, with difficulty expressed through the country pool | Keeps lives meaningful and comparable | Lives become band-derived like the Mental Math clock |

---

## 10. Document Control

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-10 | Initial PRD derived from product brief Draft v2 |
| v2 | 2026-10-10 | Rewritten against brief Draft v3. Added `timed` and `lives` round modes, deterministic seeded generation, one attempt per trainer per date, and the archive |
| v3 | 2026-10-10 | Rewritten against brief Draft v4. **Difficulty selection removed**: difficulty is assigned by the date (FR-26 to FR-31), trainer parameters are derived from it, and the pre-round screen became a briefing with no controls. **Memory redefined** as an endless visual tile grid judged by set rather than order, requiring lazy prompt supply (FR-24) and unbounded deterministic level generation (NFR-5). **Personal best simplified** to one number per trainer. Added **comparison against previous attempt and all-time best** (FR-65 to FR-67). Added success criteria S13, S16 and S17. FRs 108 → 125, NFRs 18 → 19, stories 63 → 75 |

**Next step in the BMAD flow:** the architecture document, resolving §9 and defining the module structure that satisfies NFR-14 and NFR-15.
