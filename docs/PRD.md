# Product Requirements Document — LearningHub v1

**Status:** Draft v2
**Author:** Daniel Skotheimsvik, with AI support (BMAD Product Manager role)
**Course:** IBE160 Programmering med KI, Høgskolen i Molde, autumn 2026
**Source document:** [product-brief.md](../product-brief.md) (Draft v3)
**Date:** 2026-10-10

> Written in English to match the product brief. The README is in Norwegian for the course.

---

## 1. Purpose and Scope

This document turns the LearningHub product brief into numbered, testable requirements that architecture, stories and tests can be traced back to.

**In scope:** everything listed as v1 (MVP) in brief §7 — the Drill Engine with two round modes, the daily-attempt rule and archive, deterministic puzzle generation, three trainers, progress history with charts, weak-area tracking, `localStorage` persistence, theming and accessibility.

**Out of scope:** everything in brief §7 "Deferred to later phases" and "Explicitly out of scope" — accounts, server storage, enforced daily limits, further trainers and round modes, leaderboards, day-streak tracking, spaced repetition, third-party APIs, AI features inside the app.

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
| **Drill Engine** | Shared runtime owning the loop, answer checking, scoring, streaks, round end conditions, results, persistence, the daily-attempt rule and the archive |
| **Round mode** | How a round ends. v1 supports `timed` and `lives` |
| **Timed round** | Ends when the clock reaches zero. Used by Mental Math |
| **Lives round** | Ends when the player runs out of lives. Used by Geography (3) and Memory Recall (1) |
| **Round** | One play of a puzzle: a trainer, a puzzle date, a difficulty tier, and the trainer's round mode |
| **Puzzle** | The deterministic prompt sequence for a given trainer, date and difficulty |
| **Puzzle date** | The calendar date a puzzle belongs to, in the user's local time zone |
| **Attempt** | A player's single scored play of a given trainer on a given puzzle date. One per trainer per date |
| **Today's puzzle** | The puzzle whose date is the current local date |
| **Archive** | The set of puzzles from dates before today, playable if not already attempted |
| **Seed** | The deterministic input to puzzle generation, derived from trainer, puzzle date and difficulty |
| **Prompt** | A single question shown to the user |
| **Streak** | Count of consecutive correct answers within a round; resets to 0 on a wrong answer |
| **Difficulty tier** | Beginner, Intermediate, Advanced or Expert — controls question complexity |
| **Category** | A sub-type of prompt within a trainer, e.g. `fractions` in Mental Math. Used for weak-area tracking |
| **Personal best** | Highest correct-count for a given trainer + difficulty + mode-parameter combination |
| **Accuracy** | `correctCount / totalAnswered`, expressed as a percentage; 0 % when nothing was answered |

---

## 3. Data Model

All data is client-side. No personal data is collected.

### 3.1 Entities

```
RoundResult
  id              string      unique, generated
  trainerId       string      "mental-math" | "memory-recall" | "geography"
  puzzleDate      string      ISO date, e.g. "2026-10-12", local time zone
  difficulty      string      "beginner" | "intermediate" | "advanced" | "expert"
  roundMode       string      "timed" | "lives"
  modeParam       number      durationSec when timed; total lives when lives
  playedAt        number      epoch ms, when the round was actually played
  endedBy         string      "time-expired" | "lives-exhausted" | "prompts-exhausted"
  elapsedMs       number      actual round duration
  totalAnswered   number      >= 0
  correctCount    number      0..totalAnswered
  accuracy        number      0..100, derived
  avgAnswerTimeMs number      >= 0, 0 when totalAnswered is 0
  bestStreak      number      >= 0
  livesRemaining  number|null null for timed rounds
  categoryStats   CategoryStat[]

CategoryStat
  categoryId      string
  label           string      human-readable, e.g. "Fractions"
  asked           number      >= 1
  correct         number      0..asked

TrainerProgress
  trainerId       string
  attempts        Record<puzzleDate, RoundResult>   one entry per played date
  personalBests   Record<string, number>            key: "<difficulty>:<roundMode>:<modeParam>"

Settings
  theme           string      "dark" | "light" | "system"
  lastTrainerId   string | null
  lastDifficulty  string | null
  lastDurationSec number | null     applies to timed trainers only
```

`attempts` is keyed by puzzle date, which enforces the one-attempt-per-day rule structurally: a date either has a result or it does not.

### 3.2 Trainer configuration

Each trainer declares its round mode and parameters. v1 values:

| Trainer | Round mode | Mode parameter | Player-selectable |
|---|---|---|---|
| Mental Math Sprint | `timed` | 30, 60 or 120 seconds | Yes — duration |
| Memory Recall Trainer | `lives` | 1 life | No |
| Geography Speed Trainer | `lives` | 3 lives | No |

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
| FR-1 | The home screen lists all available trainers as cards showing name, one-line description, round mode, and whether today's attempt is still available | M | S2, S13 |
| FR-2 | A trainer card shows the user's personal best where one exists | S | — |
| FR-3 | Selecting an available trainer opens a round-setup screen showing difficulty tier and, for timed trainers, round duration | M | S2 |
| FR-4 | Round setup states the round mode in plain language, e.g. "60 seconds" or "3 lives — one mistake costs a life" | M | — |
| FR-5 | Round setup pre-selects the user's last-used difficulty and duration for that trainer; it defaults to Beginner and 60 s on first use | S | — |
| FR-6 | The user can abandon a round in progress and return to the home screen | M | — |
| FR-7 | Abandoning a round does not consume the day's attempt and writes no result | M | S13 |
| FR-8 | The user can navigate between home, archive, round setup, active round, results and progress views without a page reload | M | — |

### 4.2 Drill Engine — round lifecycle and round modes

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-9 | A round starts on explicit user action and presents the first prompt immediately | M | S2 |
| FR-10 | The engine runs the loop: show prompt → accept answer → show immediate feedback → advance to next prompt, until the round's end condition is met | M | S2 |
| FR-11 | The engine supports two round modes in v1, `timed` and `lives`; a trainer declares which one it uses | M | — |
| FR-12 | A trainer is registered by supplying a question generator, a renderer and a round-mode declaration; adding a trainer or supporting a new mode requires no change to existing trainers | M | — |
| FR-13 | **Timed mode:** the round ends when the chosen duration elapses | M | S5 |
| FR-14 | **Timed mode:** no answer submitted after expiry is counted toward any statistic | M | S5 |
| FR-15 | **Timed mode:** remaining time is visible throughout the round | M | — |
| FR-16 | **Lives mode:** the round starts with the trainer's configured number of lives | M | S5 |
| FR-17 | **Lives mode:** an incorrect answer costs exactly one life | M | S5 |
| FR-18 | **Lives mode:** the round ends immediately when the last life is lost, and no further answer is accepted or counted | M | S5 |
| FR-19 | **Lives mode:** remaining lives are visible throughout the round | M | — |
| FR-20 | **Lives mode:** losing a life is signalled distinctly from an ordinary incorrect answer | S | — |
| FR-21 | Feedback after each answer states whether it was correct, and when incorrect shows the correct answer | M | S2 |
| FR-22 | Feedback is visible for a bounded interval (target ≤ 800 ms) and does not require a click to dismiss | S | — |
| FR-23 | Live correct-count, accuracy and current streak are visible in both modes and update after every answer | M | S1 |
| FR-24 | The engine never repeats the same prompt twice in a row within a round | S | — |
| FR-25 | If a puzzle's prompt sequence is exhausted before the end condition is met, the round ends with `endedBy` recorded as `prompts-exhausted` | S | — |

### 4.3 Daily puzzles, attempts and the archive

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-26 | Puzzle generation is deterministic: the same trainer, puzzle date and difficulty always produce the identical prompt sequence | M | S12 |
| FR-27 | Different puzzle dates produce different prompt sequences for the same trainer and difficulty | M | S12 |
| FR-28 | The puzzle date is determined from the user's local calendar date | M | S13 |
| FR-29 | Each trainer allows one scored attempt per puzzle date | M | S13 |
| FR-30 | When today's attempt at a trainer has been completed, the home screen shows it as done and does not offer another attempt for that date | M | S13 |
| FR-31 | Completing today's attempt at one trainer does not affect the availability of other trainers | M | S13 |
| FR-32 | When the local date changes, each trainer's attempt becomes available again without requiring a reload | S | S13 |
| FR-33 | An archive view lists previous puzzle dates, marking each as played or unplayed per trainer | M | S14 |
| FR-34 | An unplayed archive puzzle can be played, and its result is recorded against its own puzzle date | M | S14 |
| FR-35 | An archive puzzle that has already been attempted cannot be replayed | M | S13 |
| FR-36 | The archive reaches back to a defined earliest puzzle date and no further | M | — |
| FR-37 | Archive results count towards progress history, personal bests and weak-area analysis on equal terms with today's results | M | S14 |
| FR-38 | The interface states plainly that the daily limit is stored in the browser and is not enforced | S | — |

### 4.4 Answer handling

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-39 | Numeric prompts accept typed digits and submission via Enter | M | S4 |
| FR-40 | Text prompts accept typed text and submission via Enter | M | S4 |
| FR-41 | Multiple-choice prompts accept selection by mouse and by number key (1–4) | M | S10 |
| FR-42 | Answer checking ignores leading and trailing whitespace | M | S4 |
| FR-43 | Answer checking for text answers is case-insensitive | M | S4 |
| FR-44 | Text answers accept documented alternative spellings where the content file defines them, e.g. "USA" for "United States" | S | S4 |
| FR-45 | Empty submissions are ignored: they neither count as answered, nor break the streak, nor cost a life | M | S4 |
| FR-46 | The input is cleared and refocused automatically after each submission | M | S10 |

### 4.5 Scoring

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-47 | The engine counts total answered and correct answers for the round | M | S1 |
| FR-48 | Accuracy is `correctCount / totalAnswered × 100`, rounded to one decimal; it is 0 % when nothing was answered | M | S1 |
| FR-49 | Average answer time is the mean elapsed time per submitted answer in milliseconds | M | — |
| FR-50 | The current streak increments on a correct answer and resets to 0 on an incorrect answer | M | S1 |
| FR-51 | Best streak for the round is the highest value the current streak reached | M | S1 |
| FR-52 | A personal best is recorded per trainer + difficulty + round mode + mode parameter, keyed on correct-count | M | S8 |
| FR-53 | A personal best is updated only when the new correct-count is strictly greater than the stored value | M | S8 |
| FR-54 | The results screen indicates when a round set a new personal best | S | S8 |

### 4.6 Results screen

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-55 | After a round ends, a results screen shows correct answers, total answered, accuracy, average answer time and best streak | M | S1 |
| FR-56 | The results screen states why the round ended — time expired, or out of lives | M | S5 |
| FR-57 | The results screen shows the personal best for the matching trainer, difficulty and mode parameter | M | S8 |
| FR-58 | The results screen shows a weak-area summary when the trainer supports categories | M | S7 |
| FR-59 | The results screen offers a route to the archive and to the home screen, and does not offer a replay of the same puzzle | M | S13 |

### 4.7 Progress history and charts

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-60 | Every completed round is stored against its trainer and puzzle date | M | S6 |
| FR-61 | A progress view per trainer plots correct-count and accuracy against puzzle date, in chronological order | M | S6, S14 |
| FR-62 | The progress chart can be filtered by difficulty tier so unlike rounds are not compared directly | S | — |
| FR-63 | The progress view states puzzles completed, total time practised and the all-time best per difficulty | S | — |
| FR-64 | When a trainer has no history, the progress view shows an explanatory empty state rather than an empty chart | M | — |
| FR-65 | Charts are rendered without a third-party charting library | M | NFR-9 |

### 4.8 Weak-area tracking

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-66 | Each prompt is tagged by the trainer with a category identifier | M | S7 |
| FR-67 | The engine aggregates asked and correct counts per category for the round | M | S7 |
| FR-68 | Weak-area analysis identifies the category with the lowest hit rate, considering only categories with at least 3 prompts asked | M | S7 |
| FR-69 | The weak area is presented in plain language, e.g. "You miss Fractions most — 2 of 7 correct" | M | S7 |
| FR-70 | When no category reaches the 3-prompt threshold, the analysis states that there is not enough data yet | M | S7 |
| FR-71 | The progress view shows weak-area hit rates aggregated across that trainer's full history, not only the last round | S | S7 |
| FR-72 | Mental Math and Geography must support categories in v1; Memory Recall may do so | M | S7 |

### 4.9 Persistence

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-73 | Round results, attempt records, personal bests and settings persist in `localStorage` and are restored on page load | M | S1, S6, S13 |
| FR-74 | If stored data is missing, corrupt or of an unknown schema version, the app starts with empty progress and shows a non-blocking notice instead of crashing | M | NFR-7 |
| FR-75 | The user can clear all stored progress from a settings screen, with a confirmation step; this also clears attempt records | S | — |
| FR-76 | If `localStorage` is unavailable, the app remains fully playable for the session, no attempt limit is applied, and the user is told progress will not be saved | S | NFR-7 |

### 4.10 Trainer — Mental Math Sprint (timed)

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-77 | Runs in timed mode with a player-selected duration of 30, 60 or 120 seconds | M | S5 |
| FR-78 | Generates arithmetic prompts across the categories: addition, subtraction, multiplication, division, fractions, percentages | M | S3 |
| FR-79 | Difficulty controls operand range and which categories are drawn. Beginner: addition and subtraction within 0–20. Intermediate: adds multiplication and division within tables to 10. Advanced: adds percentages and larger operands. Expert: adds fractions and multi-step prompts | M | S3 |
| FR-80 | Division prompts never divide by zero | M | S3 |
| FR-81 | Division prompts at Beginner, Intermediate and Advanced tiers always have an integer answer | M | S3 |
| FR-82 | Subtraction prompts at Beginner tier never produce a negative answer | M | S3 |
| FR-83 | Fraction prompts state the expected answer format and accept the documented equivalent forms | S | S4 |
| FR-84 | Answers are entered as free numeric input | M | S4 |

### 4.11 Trainer — Memory Recall (lives, 1 life)

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-85 | Runs in lives mode with exactly 1 life: the first incorrect answer ends the round | M | S5 |
| FR-86 | Presents a sequence for a bounded display time, hides it, then asks the user to reproduce it | M | S2 |
| FR-87 | Sequence types: digits, letters and words | M | — |
| FR-88 | Difficulty controls starting sequence length and display time. Beginner: 3 items, 3 s. Intermediate: 5 items, 3 s. Advanced: 7 items, 2 s. Expert: 9 items, 2 s | M | S2 |
| FR-89 | Sequence length increases as the round progresses, so the round measures how far the player gets before a mistake | M | — |
| FR-90 | An answer is correct only when the full sequence is reproduced in the correct order | M | S4 |
| FR-91 | The sequence is not retrievable from the page once hidden, including via the DOM | M | — |
| FR-92 | The results screen reports the longest sequence correctly recalled | S | — |

### 4.12 Trainer — Geography Speed (lives, 3 lives)

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-93 | Runs in lives mode with exactly 3 lives | M | S5 |
| FR-94 | Content is loaded from a JSON file in the repository containing countries, capitals, continents and flag references | M | NFR-9 |
| FR-95 | Prompt categories: country → capital, capital → country, flag → country, country → continent | M | S7 |
| FR-96 | Difficulty controls the country pool. Beginner: widely known countries. Intermediate: adds mid-frequency countries. Advanced: full set. Expert: full set with free-text instead of multiple choice | M | S2 |
| FR-97 | Multiple-choice distractors are drawn from the same continent where possible, so they are plausible | S | — |
| FR-98 | Flag assets are stored in the repository; no external image requests are made | M | NFR-9 |
| FR-99 | The content file is validated at load; malformed entries are skipped and logged rather than crashing the trainer | M | NFR-7 |

### 4.13 Presentation, theming and accessibility

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-100 | The interface supports dark and light mode, with the choice persisted | M | — |
| FR-101 | Theme defaults to the operating system preference on first visit | S | — |
| FR-102 | Every screen is usable with the keyboard alone, with no mouse interaction required | M | S10 |
| FR-103 | Focus moves to the answer input when a round starts and after each answer | M | S10 |
| FR-104 | Visible focus indicators are present on all interactive elements | M | S10 |
| FR-105 | The layout is usable down to 360 px width | M | — |
| FR-106 | Correct/incorrect feedback, and the loss of a life, are conveyed by text or icon in addition to colour | M | S10 |
| FR-107 | Live score and lives updates are announced to assistive technology via an ARIA live region | S | S10 |
| FR-108 | Reduced-motion preference is respected: non-essential animation is disabled | S | S10 |

---

## 5. Non-Functional Requirements

| ID | Requirement | Verification | Traces to |
|---|---|---|---|
| NFR-1 | Answer feedback renders within 100 ms of submission on a mid-range laptop | Manual timing | — |
| NFR-2 | The timer is accurate to within 100 ms over a 120 s round | Automated test with a mocked clock | S5 |
| NFR-3 | A lives round ends within one prompt of the last life being lost, with no further prompt rendered | Automated test | S5 |
| NFR-4 | Puzzle generation is pure and reproducible: given the same seed it returns an identical sequence, with no reliance on `Math.random`, wall-clock time during generation, or any other ambient state | Automated test comparing repeated generations | S12 |
| NFR-5 | First meaningful paint within 2 s on a local file open | Lighthouse | — |
| NFR-6 | The application works fully offline after first load | DevTools, offline mode | S9 |
| NFR-7 | No unhandled exception reaches the user; failures degrade to a readable message | Fault-injection tests on storage and content loading | S9 |
| NFR-8 | Stored progress stays below 1 MB after two years of daily play across all trainers | Calculation plus test with generated data | FR-73 |
| NFR-9 | No third-party runtime dependencies, no network requests to external hosts, no API keys | Dependency review plus network inspection | S9, S11 |
| NFR-10 | The app runs in current Chrome, Firefox and Edge | Manual cross-browser check | S11 |
| NFR-11 | The app can be run by opening the entry page from a clone, or via a plain static file server, with no build step | Fresh-clone test on a second machine | S11 |
| NFR-12 | No personal data is collected, transmitted or stored | Code review | — |
| NFR-13 | Pure logic — generators, seeding, answer checking, scoring, streaks, end conditions, attempt rules, weak-area analysis — is isolated from DOM code so it can be unit-tested | Code review; tests import logic without a DOM | S3–S8, S12, S13 |
| NFR-14 | Date handling is injectable so tests can simulate any local date without changing the system clock | Code review; tests with a mocked clock | S13, S14 |
| NFR-15 | Automated tests cover all question generators, seeding and determinism, answer checking, scoring, streaks, both round-end conditions, personal bests, attempt rules and weak-area analysis | Test run; coverage report | S3–S8, S12–S14 |
| NFR-16 | The test suite runs with a single documented command | README check | S11 |
| NFR-17 | Lighthouse accessibility score ≥ 90 on the home, round and results screens | Lighthouse audit | S10 |
| NFR-18 | The README documents purpose, how to run locally, how to run tests, the daily-attempt rule and the archive, and the repository structure | Review | S11 |

---

## 6. Epics

| ID | Epic | Goal | Depends on |
|---|---|---|---|
| E-1 | Project foundation and test harness | Runnable skeleton, test runner, repository structure | — |
| E-2 | Drill Engine core and round modes | Loop, answer checking, scoring, streaks, timed and lives end conditions | E-1 |
| E-3 | Deterministic puzzles, daily attempts and archive | Seeded generation, one attempt per trainer per date, archive browsing | E-2 |
| E-4 | Mental Math Sprint (timed) | First trainer, validating the timed mode | E-2 |
| E-5 | Memory Recall Trainer (1 life) | Second trainer, validating the lives mode at its strictest | E-2 |
| E-6 | Geography Speed Trainer (3 lives) | Third trainer, content-file driven, validating the engine contract without engine changes | E-2, E-3 |
| E-7 | Persistence and progress history | Storage, attempt records, history, charts | E-2, E-3 |
| E-8 | Weak-area tracking | Category aggregation and plain-language analysis | E-2, E-7 |
| E-9 | UI shell, theming and accessibility | Navigation, archive view, dark/light, keyboard-first, responsive | E-2, E-3 |
| E-10 | Quality, documentation and release | Cross-browser checks, accessibility audit, README | all |

**Build order rationale.** E-4 and E-5 are deliberately built before the engine contract is frozen, and they use *different* round modes — this is what exposes whether the abstraction is right, as noted in brief §12. E-6 then tests the contract by adding a third trainer without changing engine code.

---

## 7. User Stories

Format: *As a learner, I want … so that …* Acceptance criteria are written Given/When/Then so they map directly onto test cases.

### E-1 — Project foundation and test harness

**US-1.1** — Set up repository structure and entry page
*Acceptance:* Given a fresh clone, when I open the entry page, then a placeholder home screen renders with no console errors and no network requests to external hosts.
*Covers:* NFR-9, NFR-11

**US-1.2** — Set up the test runner
*Acceptance:* Given the repository, when I run the documented test command, then the suite executes and reports results; a deliberately failing sample test causes a non-zero exit code.
*Covers:* NFR-16

**US-1.3** — Define the trainer registration contract
*Acceptance:* Given the engine, when a trainer module supplies a generator, a renderer and a round-mode declaration, then it appears on the home screen without any engine file being modified.
*Covers:* FR-12

**US-1.4** — Make the clock injectable
*Acceptance:* Given a test, when a fixed local date is supplied to the application, then all date-dependent behaviour uses it rather than the system clock.
*Covers:* NFR-14

### E-2 — Drill Engine core and round modes

**US-2.1** — Start a round
*Acceptance:* Given a chosen trainer and difficulty, when I start a round, then the first prompt appears immediately and the mode indicator shows either remaining time or remaining lives.
*Covers:* FR-9, FR-15, FR-19

**US-2.2** — End a timed round exactly on time
*Acceptance:* Given a 60 s round, when the clock reaches zero, then input is disabled and the results screen appears; and given an answer submitted after expiry, when scoring runs, then that answer is not counted.
*Covers:* FR-13, FR-14 · *Verifies:* S5

**US-2.3** — End a lives round on the last life
*Acceptance:* Given a round with 3 lives and 2 already lost, when I answer incorrectly, then the round ends immediately, no further prompt is rendered, and the results screen states the round ended because lives ran out.
*Covers:* FR-16, FR-17, FR-18, FR-56 · *Verifies:* S5

**US-2.4** — Lose a life visibly
*Acceptance:* Given a lives round, when I answer incorrectly, then the remaining-lives indicator decreases by exactly one and the loss is signalled by text or icon as well as colour.
*Covers:* FR-19, FR-20, FR-106

**US-2.5** — Submit and check answers
*Acceptance:* Given a prompt, when I type an answer and press Enter, then it is checked, feedback is shown, and the next prompt appears with the input cleared and refocused.
*Covers:* FR-10, FR-39, FR-40, FR-46

**US-2.6** — Tolerant answer checking
*Acceptance:* Given a text prompt with answer "Oslo", when I submit " oslo ", then it is accepted; and when I submit an empty string, then nothing is counted, my streak is unaffected, and no life is lost.
*Covers:* FR-42, FR-43, FR-45 · *Verifies:* S4

**US-2.7** — Show corrective feedback
*Acceptance:* Given an incorrect answer, when feedback appears, then it states the answer was wrong and shows the correct answer, using text or an icon as well as colour.
*Covers:* FR-21, FR-106

**US-2.8** — Track score and streak live
*Acceptance:* Given a round in progress, when I answer correctly, then correct-count and streak both increase; and when I answer incorrectly, then the streak resets to 0 while best streak retains its highest value.
*Covers:* FR-23, FR-47, FR-50, FR-51 · *Verifies:* S1

**US-2.9** — Compute round statistics
*Acceptance:* Given 10 answers of which 7 are correct, when the round ends, then accuracy reads 70.0 %; and given zero answers, then accuracy reads 0 % and average answer time reads 0 without a division error.
*Covers:* FR-48, FR-49 · *Verifies:* S1

**US-2.10** — Avoid immediate repeats
*Acceptance:* Given a round, when prompts are presented, then no prompt is identical to the one directly before it.
*Covers:* FR-24

**US-2.11** — Abandon a round without penalty
*Acceptance:* Given a round in progress, when I choose to quit, then I return to the home screen, no result is written, and today's attempt for that trainer is still available.
*Covers:* FR-6, FR-7 · *Verifies:* S13

**US-2.12** — Multiple-choice input
*Acceptance:* Given a four-option prompt, when I press the 2 key, then the second option is submitted; and clicking the option has the identical effect.
*Covers:* FR-41

**US-2.13** — Handle an exhausted prompt sequence
*Acceptance:* Given a puzzle whose prompts run out before the end condition is met, when the last prompt is answered, then the round ends cleanly and records `prompts-exhausted`.
*Covers:* FR-25

### E-3 — Deterministic puzzles, daily attempts and archive

**US-3.1** — Generate puzzles deterministically
*Acceptance:* Given the same trainer, puzzle date and difficulty, when the puzzle is generated twice, then the two prompt sequences are identical; and given two different dates, then the sequences differ.
*Covers:* FR-26, FR-27, NFR-4 · *Verifies:* S12

**US-3.2** — Use the local calendar date
*Acceptance:* Given a mocked local date, when the home screen loads, then today's puzzle is the one for that date.
*Covers:* FR-28, NFR-14

**US-3.3** — Consume the daily attempt
*Acceptance:* Given I complete today's Mental Math round, when I return to the home screen, then Mental Math is shown as done for today and cannot be started again; and Memory Recall and Geography remain available.
*Covers:* FR-29, FR-30, FR-31 · *Verifies:* S13

**US-3.4** — Release the attempt on a new day
*Acceptance:* Given today's attempt is used and the local date advances, when the home screen refreshes, then the trainer is available again.
*Covers:* FR-32 · *Verifies:* S13

**US-3.5** — Browse the archive
*Acceptance:* Given previous puzzle dates exist, when I open the archive, then each date is listed with its played or unplayed state per trainer, back to the earliest puzzle date and no further.
*Covers:* FR-33, FR-36 · *Verifies:* S14

**US-3.6** — Play an archive puzzle
*Acceptance:* Given an unplayed archive date, when I play it, then the result is recorded against that puzzle date rather than today's; and given an already-played archive date, then it cannot be replayed.
*Covers:* FR-34, FR-35, FR-37 · *Verifies:* S14

**US-3.7** — Disclose the soft limit
*Acceptance:* Given the home screen or an explanatory view, when I read it, then it states plainly that the daily limit is kept in the browser and is not enforced.
*Covers:* FR-38

### E-4 — Mental Math Sprint (timed)

**US-4.1** — Choose a duration
*Acceptance:* Given Mental Math round setup, when it renders, then 30, 60 and 120 seconds are offered, and the chosen value governs the round length.
*Covers:* FR-77, FR-3

**US-4.2** — Generate valid arithmetic prompts
*Acceptance:* Given 1000 generated prompts per tier, when they are validated, then none divide by zero, every Beginner/Intermediate/Advanced division has an integer answer, and no Beginner subtraction yields a negative result.
*Covers:* FR-78, FR-80, FR-81, FR-82 · *Verifies:* S3

**US-4.3** — Scale difficulty across tiers
*Acceptance:* Given each tier, when prompts are generated, then only that tier's permitted categories and operand ranges occur, per FR-79.
*Covers:* FR-79 · *Verifies:* S2

**US-4.4** — Tag prompts with categories
*Acceptance:* Given a completed round, when category statistics are read, then every prompt is attributed to exactly one of the six Mental Math categories and the counts sum to total answered.
*Covers:* FR-66, FR-72

**US-4.5** — Handle fraction prompts
*Acceptance:* Given an Expert fraction prompt, when it is displayed, then the expected answer format is stated; and when I submit a documented equivalent form, then it is accepted.
*Covers:* FR-83

### E-5 — Memory Recall Trainer (1 life)

**US-5.1** — End on the first mistake
*Acceptance:* Given a Memory Recall round, when I answer my first sequence incorrectly, then the round ends immediately and the results screen states that lives ran out.
*Covers:* FR-85 · *Verifies:* S5

**US-5.2** — Show and hide a sequence
*Acceptance:* Given a Beginner round, when a prompt starts, then 3 items are displayed for 3 s and then hidden, and the input becomes active.
*Covers:* FR-86, FR-88

**US-5.3** — Escalate sequence length
*Acceptance:* Given consecutive correct answers, when each new prompt is generated, then the sequence is at least as long as the previous one and grows over the round.
*Covers:* FR-89

**US-5.4** — Check full-sequence answers
*Acceptance:* Given the sequence 4-7-2, when I submit "472", then it is correct; and when I submit "427" or "47", then it is incorrect and the round ends.
*Covers:* FR-90

**US-5.5** — Support sequence types
*Acceptance:* Given repeated rounds, when prompts are generated, then digit, letter and word sequences all occur and are valid for the tier.
*Covers:* FR-87

**US-5.6** — Prevent cheating via the DOM
*Acceptance:* Given a hidden sequence, when the DOM is inspected, then the sequence is not present in the rendered markup.
*Covers:* FR-91

**US-5.7** — Report the longest sequence
*Acceptance:* Given a finished round, when the results screen renders, then it states the longest sequence recalled correctly.
*Covers:* FR-92

### E-6 — Geography Speed Trainer (3 lives)

**US-6.1** — Run with three lives
*Acceptance:* Given a Geography round, when I answer incorrectly twice, then the round continues with one life left; and on the third incorrect answer it ends.
*Covers:* FR-93 · *Verifies:* S5

**US-6.2** — Load and validate content
*Acceptance:* Given the content JSON, when it loads, then valid entries are available to the generator; and given a deliberately malformed entry, then it is skipped and logged while the trainer still runs.
*Covers:* FR-94, FR-99 · *Verifies:* S9

**US-6.3** — Generate the four prompt categories
*Acceptance:* Given a round, when prompts are generated, then all four categories occur and each prompt is tagged with its category.
*Covers:* FR-95, FR-66

**US-6.4** — Scale the country pool by tier
*Acceptance:* Given Beginner, when prompts are generated, then only countries from the widely-known pool appear; and given Expert, then answers are free-text rather than multiple choice.
*Covers:* FR-96

**US-6.5** — Plausible distractors
*Acceptance:* Given a multiple-choice prompt, when distractors are chosen, then they come from the same continent where the pool allows, and the correct answer never appears twice.
*Covers:* FR-97

**US-6.6** — Serve flags locally
*Acceptance:* Given a flag prompt, when the page loads the image, then it is served from the repository and no external request is made.
*Covers:* FR-98 · *Verifies:* S9

**US-6.7** — Accept documented alternative names
*Acceptance:* Given a country with documented alternatives, when I submit any documented form, then it is accepted.
*Covers:* FR-44

**US-6.8** — Add a trainer without touching the engine
*Acceptance:* Given Geography is implemented after the engine is complete, when it is registered, then no engine file required modification.
*Covers:* FR-12

### E-7 — Persistence and progress history

**US-7.1** — Persist results and attempts
*Acceptance:* Given a completed round, when I reload the page, then the result still appears in history with identical values and the attempt is still recorded as used for that date.
*Covers:* FR-60, FR-73 · *Verifies:* S1, S13

**US-7.2** — Maintain personal bests
*Acceptance:* Given a stored best of 18 for a trainer/difficulty/mode-parameter, when I score 17, then the best is unchanged; and when I score 19, then the best becomes 19 and the results screen says so.
*Covers:* FR-52, FR-53, FR-54, FR-57 · *Verifies:* S8

**US-7.3** — Show a results screen
*Acceptance:* Given a finished round, when the results screen appears, then correct answers, total answered, accuracy, average answer time, best streak, personal best and the reason the round ended are all displayed.
*Covers:* FR-55, FR-56, FR-57 · *Verifies:* S1

**US-7.4** — Route onward from results
*Acceptance:* Given the results screen, when it renders, then it offers the archive and the home screen and offers no replay of the same puzzle.
*Covers:* FR-59 · *Verifies:* S13

**US-7.5** — Plot progress over time
*Acceptance:* Given five completed puzzles, when I open the progress view, then five data points appear ordered by puzzle date with values matching the stored results.
*Covers:* FR-61, FR-65 · *Verifies:* S6

**US-7.6** — Place archive results correctly
*Acceptance:* Given a puzzle from an earlier date played today, when I open the progress view, then its data point sits at its puzzle date, not at today.
*Covers:* FR-61, FR-37 · *Verifies:* S14

**US-7.7** — Filter progress by difficulty
*Acceptance:* Given puzzles played at mixed tiers, when I filter to Intermediate, then only Intermediate results are plotted.
*Covers:* FR-62

**US-7.8** — Summarise practice
*Acceptance:* Given existing history, when I open the progress view, then puzzles completed, total time practised and all-time best per difficulty are shown.
*Covers:* FR-63

**US-7.9** — Handle an empty history
*Acceptance:* Given a trainer never played, when I open its progress view, then an explanatory empty state appears instead of a blank chart.
*Covers:* FR-64

**US-7.10** — Survive corrupt storage
*Acceptance:* Given invalid JSON in the storage key, when the app loads, then it starts with empty progress, shows a non-blocking notice and remains usable.
*Covers:* FR-74 · *Verifies:* S9

**US-7.11** — Clear progress
*Acceptance:* Given stored progress, when I choose to clear it and confirm, then all results, attempts and personal bests are removed and every trainer is available again.
*Covers:* FR-75

**US-7.12** — Degrade without storage
*Acceptance:* Given `localStorage` is unavailable, when I play a round, then the round completes normally, no attempt limit is applied, and I am told progress will not be saved.
*Covers:* FR-76

**US-7.13** — Keep storage small
*Acceptance:* Given two years of simulated daily results across all trainers, when storage size is measured, then it is below 1 MB.
*Covers:* NFR-8

### E-8 — Weak-area tracking

**US-8.1** — Aggregate per category
*Acceptance:* Given a completed round, when category statistics are computed, then asked and correct counts per category match the answers given, and asked totals equal total answered.
*Covers:* FR-67

**US-8.2** — Identify the weakest category
*Acceptance:* Given a scripted round where fractions are answered 2 of 7 correct and every other category is above 80 %, when analysis runs, then fractions is reported as the weakest area.
*Covers:* FR-68 · *Verifies:* S7

**US-8.3** — Ignore thin categories
*Acceptance:* Given a category with only 2 prompts asked and both wrong, when analysis runs, then that category is excluded from the weakest-area result.
*Covers:* FR-68

**US-8.4** — Explain in plain language
*Acceptance:* Given an identified weak area, when the results screen renders, then it reads in the form "You miss Fractions most — 2 of 7 correct".
*Covers:* FR-69, FR-58

**US-8.5** — Handle insufficient data
*Acceptance:* Given a round where no category reached 3 prompts, when the results screen renders, then it states that there is not enough data yet.
*Covers:* FR-70

**US-8.6** — Aggregate across history
*Acceptance:* Given several completed puzzles, when I open the progress view, then per-category hit rates are shown across the full history for that trainer.
*Covers:* FR-71

### E-9 — UI shell, theming and accessibility

**US-9.1** — Home screen shows today's state
*Acceptance:* Given the home screen, when it renders, then every registered trainer appears with name, description, round mode, and whether today's attempt is still available.
*Covers:* FR-1, FR-4 · *Verifies:* S13

**US-9.2** — Show personal bests on cards
*Acceptance:* Given a trainer with a recorded best, when the home screen renders, then that best is shown on the card.
*Covers:* FR-2

**US-9.3** — Round setup
*Acceptance:* Given a selected trainer, when the setup screen opens, then difficulty can be chosen, duration is offered only for timed trainers, and my previous choices are preselected.
*Covers:* FR-3, FR-5

**US-9.4** — Client-side navigation
*Acceptance:* Given any screen, when I navigate between home, archive, setup, round, results and progress, then the view changes without a full page reload.
*Covers:* FR-8

**US-9.5** — Dark and light mode
*Acceptance:* Given the theme toggle, when I switch theme, then it applies immediately and survives a reload; and on first visit the OS preference is used.
*Covers:* FR-100, FR-101

**US-9.6** — Keyboard-only operation
*Acceptance:* Given only a keyboard, when I navigate from home through a full round to results and into the archive, then every action is reachable and focus is always visible.
*Covers:* FR-102, FR-104 · *Verifies:* S10

**US-9.7** — Focus management
*Acceptance:* Given a round starts, when the first prompt appears, then the answer input holds focus; and after each submission focus returns to it.
*Covers:* FR-103

**US-9.8** — Responsive layout
*Acceptance:* Given a 360 px viewport, when I run a round, then all controls, the mode indicator and the statistics are usable without horizontal scrolling.
*Covers:* FR-105

**US-9.9** — Announce updates to assistive technology
*Acceptance:* Given a screen reader, when my score changes or a life is lost, then the update is announced via a live region without interrupting input.
*Covers:* FR-107

**US-9.10** — Respect reduced motion
*Acceptance:* Given the OS reduced-motion preference, when the app renders, then non-essential animation is disabled.
*Covers:* FR-108

### E-10 — Quality, documentation and release

**US-10.1** — Full manual test matrix
*Acceptance:* Given 3 trainers × 4 difficulty tiers, when each combination is played from the archive, then every round completes without error and produces a correct results screen.
*Covers:* NFR-10 · *Verifies:* S2

**US-10.2** — Verify offline operation
*Acceptance:* Given the app has loaded once, when the network is disabled, then every feature continues to work and no external request is attempted.
*Covers:* NFR-6 · *Verifies:* S9

**US-10.3** — Accessibility audit
*Acceptance:* Given the home, round and results screens, when a Lighthouse accessibility audit runs, then each scores at least 90 and reported issues are fixed or documented.
*Covers:* NFR-17 · *Verifies:* S10

**US-10.4** — Cross-browser verification
*Acceptance:* Given current Chrome, Firefox and Edge, when a full round is played in each, then behaviour and layout are correct.
*Covers:* NFR-10

**US-10.5** — README and run instructions
*Acceptance:* Given a fresh clone on another machine, when I follow the README, then I can run the app and the test suite without keys, accounts or a build step, and the README explains the daily-attempt rule and the archive.
*Covers:* NFR-11, NFR-16, NFR-18 · *Verifies:* S11

**US-10.6** — Timer accuracy test
*Acceptance:* Given a mocked clock, when a 120 s round runs, then the measured duration is within 100 ms of the target.
*Covers:* NFR-2 · *Verifies:* S5

**US-10.7** — Lives promptness test
*Acceptance:* Given a lives round, when the last life is lost, then no further prompt is rendered before the results screen appears.
*Covers:* NFR-3 · *Verifies:* S5

---

## 8. Traceability to Brief Success Criteria

| Criterion | Requirements | Stories |
|---|---|---|
| S1 — round statistics correct and persisted | FR-23, FR-47–51, FR-55, FR-73 | US-2.8, US-2.9, US-7.1, US-7.3 |
| S2 — all trainers run at every tier | FR-1, FR-9, FR-10, FR-79, FR-88, FR-96 | US-4.3, US-5.2, US-6.4, US-10.1 |
| S3 — generators produce only valid questions | FR-78, FR-80, FR-81, FR-82 | US-4.2 |
| S4 — answer checking correct and tolerant | FR-39–45, FR-90 | US-2.6, US-5.4, US-6.7 |
| S5 — rounds end exactly on their end condition | FR-13, FR-14, FR-16–18, FR-85, FR-93, NFR-2, NFR-3 | US-2.2, US-2.3, US-5.1, US-6.1, US-10.6, US-10.7 |
| S6 — progress chart correct | FR-60, FR-61 | US-7.5 |
| S7 — weak area identified correctly | FR-66–70 | US-8.2, US-8.3 |
| S8 — personal best only on genuine improvement | FR-52, FR-53 | US-7.2 |
| S9 — works offline, no third-party requests | NFR-6, NFR-7, NFR-9, FR-74, FR-98 | US-6.2, US-6.6, US-7.10, US-10.2 |
| S10 — keyboard-only and accessible | FR-102–108, NFR-17 | US-9.6, US-9.7, US-10.3 |
| S11 — runs from README with no keys | NFR-11, NFR-16, NFR-18 | US-10.5 |
| S12 — deterministic daily puzzles | FR-26, FR-27, NFR-4 | US-3.1 |
| S13 — one attempt per trainer per day | FR-7, FR-29–32, FR-35, FR-59 | US-2.11, US-3.3, US-3.4, US-7.1 |
| S14 — archive puzzles recorded against their own date | FR-33, FR-34, FR-37, FR-61 | US-3.5, US-3.6, US-7.6 |

Every success criterion in the brief is covered by at least one requirement and one story. No requirement exists without a traceable origin in the brief.

---

## 9. Open Questions for Architecture

Carried from brief §13, to be resolved in the architecture document:

| # | Question | Blocks |
|---|---|---|
| 1 | Vanilla JavaScript or a lightweight framework? | E-1, E-9 |
| 2 | Which test runner, and does it run in Node, a browser, or both? | E-1, NFR-13 |
| 3 | Module format and whether a bundler is needed, given NFR-11 forbids a build step | E-1 |
| 4 | Which seeded pseudo-random algorithm, and how the seed is derived from trainer + date + difficulty | E-3, NFR-4 |
| 5 | The earliest puzzle date, and how far back the archive reaches | E-3, FR-36 |
| 6 | Whether difficulty is player-chosen per attempt (current assumption) or fixed per day so all players face the same puzzle | E-3, FR-29 |
| 7 | How a local-date change is detected while the page stays open | E-3, FR-32 |
| 8 | SVG or Canvas for charts | E-7 |
| 9 | Exact shape of the trainer registration interface, including the round-mode declaration | E-1, FR-12 |
| 10 | Source and licence for the geography content and flag assets | E-6 |
| 11 | Final product name | E-10 |

### 9.1 Assumptions pending confirmation

| Assumption | Why it matters | If wrong |
|---|---|---|
| The player chooses difficulty for their daily attempt, and the attempt is consumed regardless of which difficulty was chosen | Determines whether daily results are comparable between players | Difficulty becomes a property of the date; FR-29 and the personal-best key change |
| Mental Math duration is player-selected from 30/60/120 and does not alter the prompt sequence, only how far into it the player gets | Keeps one seed per trainer/date/difficulty | Seed must include duration, multiplying stored puzzles |
| Archive results count towards personal bests on equal terms with today's results | Lets a reviewer build up history quickly | Bests would need to be split between daily and archive play |
| Memory Recall escalates sequence length within a round | Makes a 1-life round meaningful rather than trivially short | Round length depends only on difficulty tier |

---

## 10. Document Control

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-10 | Initial PRD derived from product brief Draft v2 |
| v2 | 2026-10-10 | Rewritten against product brief Draft v3. Rounds are no longer uniformly timed: added `timed` and `lives` round modes, with Mental Math timed, Memory Recall on 1 life and Geography on 3. Added deterministic seeded puzzle generation, one scored attempt per trainer per calendar date, and the archive. Data model re-keyed by puzzle date; personal-best key now includes round mode and mode parameter. Added epic E-3 and 10 new requirements covering determinism, attempts and archive; added success criteria S12–S14 |

**Next step in the BMAD flow:** the architecture document, resolving §9 and defining the module structure that satisfies NFR-13 and NFR-14.
