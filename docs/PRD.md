# Product Requirements Document — LearningHub v1

**Status:** Draft v1
**Author:** Daniel Skotheimsvik, with AI support (BMAD Product Manager role)
**Course:** IBE160 Programmering med KI, Høgskolen i Molde, autumn 2026
**Source document:** [product-brief.md](../product-brief.md) (Draft v2)
**Date:** 2026-10-10

> Written in English to match the product brief. The README is in Norwegian for the course.

---

## 1. Purpose and Scope

This document turns the LearningHub product brief into numbered, testable requirements that architecture, stories and tests can be traced back to.

**In scope:** everything listed as v1 (MVP) in brief §7 — the Drill Engine, three trainers, progress history with charts, weak-area tracking, `localStorage` persistence, theming and accessibility.

**Out of scope:** everything in brief §7 "Deferred to later phases" and "Explicitly out of scope" — accounts, server storage, the remaining seven trainers, leaderboards, spaced repetition, third-party APIs, AI features inside the app.

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
| **Trainer** | A skill module: a question generator or content file plus a renderer. v1 ships three |
| **Drill Engine** | Shared runtime owning timing, answer checking, scoring, streaks, results and persistence |
| **Round** | One timed practice session: a trainer, a difficulty tier, and a duration |
| **Prompt** | A single question shown to the user |
| **Streak** | Count of consecutive correct answers within a round; resets to 0 on a wrong answer |
| **Difficulty tier** | Beginner, Intermediate, Advanced or Expert — controls question complexity |
| **Category** | A sub-type of prompt within a trainer, e.g. `fractions` in Mental Math. Used for weak-area tracking |
| **Personal best** | Highest correct-count for a given trainer + difficulty + duration combination |
| **Accuracy** | `correctCount / totalAnswered`, expressed as a percentage; 0 % when nothing was answered |

---

## 3. Data Model

All data is client-side. No personal data is collected.

### 3.1 Entities

```
RoundResult
  id              string      unique, generated
  trainerId       string      "mental-math" | "memory-recall" | "geography"
  difficulty      string      "beginner" | "intermediate" | "advanced" | "expert"
  durationSec     number      30 | 60 | 120
  startedAt       number      epoch ms
  completedAt     number      epoch ms
  totalAnswered   number      >= 0
  correctCount    number      0..totalAnswered
  accuracy        number      0..100, derived
  avgAnswerTimeMs number      >= 0, 0 when totalAnswered is 0
  bestStreak      number      >= 0
  categoryStats   CategoryStat[]

CategoryStat
  categoryId      string
  label           string      human-readable, e.g. "Fractions"
  asked           number      >= 1
  correct         number      0..asked

TrainerProgress
  trainerId       string
  history         RoundResult[]        newest last, capped at 200 entries
  personalBests   Record<string, number>   key: "<difficulty>:<durationSec>"

Settings
  theme           string      "dark" | "light" | "system"
  lastTrainerId   string | null
  lastDifficulty  string | null
  lastDurationSec number | null
```

### 3.2 Storage

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
| FR-1 | The home screen lists all available trainers as cards showing name, one-line description, and the user's personal best if one exists | M | S2 |
| FR-2 | Selecting a trainer opens a round-setup screen where the user chooses difficulty tier and round duration | M | S2 |
| FR-3 | Round setup pre-selects the user's last-used difficulty and duration for that trainer; it defaults to Beginner and 60 s on first use | S | — |
| FR-4 | The user can abandon a round in progress and return to the home screen; an abandoned round is discarded and not written to history | M | — |
| FR-5 | The user can navigate between home, round setup, active round, results and progress views without a page reload | M | — |

### 4.2 Drill Engine — round lifecycle

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-6 | A round starts on explicit user action and presents the first prompt immediately | M | S2 |
| FR-7 | The engine runs the loop: show prompt → accept answer → show immediate feedback → advance to next prompt, until the timer expires | M | S2 |
| FR-8 | Feedback after each answer states whether it was correct, and when incorrect shows the correct answer | M | S2 |
| FR-9 | Feedback is visible for a bounded interval (target ≤ 800 ms) and does not require a click to dismiss | S | — |
| FR-10 | The engine offers the chosen duration of 30 s, 60 s or 120 s and ends the round when it expires | M | S5 |
| FR-11 | The round ends at exactly the chosen duration; no answer submitted after expiry is counted toward any statistic | M | S5 |
| FR-12 | The remaining time is visible throughout the round | M | — |
| FR-13 | Live correct-count, accuracy and current streak are visible and update after every answer | M | S1 |
| FR-14 | The engine never repeats the same prompt twice in a row within a round | S | — |
| FR-15 | A trainer is registered with the engine by supplying a question generator and a renderer; adding a trainer requires no change to engine code | M | — |

### 4.3 Answer handling

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-16 | Numeric prompts accept typed digits and submission via Enter | M | S4 |
| FR-17 | Text prompts accept typed text and submission via Enter | M | S4 |
| FR-18 | Multiple-choice prompts accept selection by mouse and by number key (1–4) | M | S10 |
| FR-19 | Answer checking ignores leading and trailing whitespace | M | S4 |
| FR-20 | Answer checking for text answers is case-insensitive | M | S4 |
| FR-21 | Text answers accept documented alternative spellings where the content file defines them, e.g. "USA" for "United States" | S | S4 |
| FR-22 | Empty submissions are ignored: they neither count as answered nor break the streak | M | S4 |
| FR-23 | The input is cleared and refocused automatically after each submission | M | S10 |

### 4.4 Scoring

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-24 | The engine counts total answered and correct answers for the round | M | S1 |
| FR-25 | Accuracy is `correctCount / totalAnswered × 100`, rounded to one decimal; it is 0 % when nothing was answered | M | S1 |
| FR-26 | Average answer time is the mean elapsed time per submitted answer in milliseconds | M | — |
| FR-27 | The current streak increments on a correct answer and resets to 0 on an incorrect answer | M | S1 |
| FR-28 | Best streak for the round is the highest value the current streak reached | M | S1 |
| FR-29 | A personal best is recorded per trainer + difficulty + duration combination, keyed on correct-count | M | S8 |
| FR-30 | A personal best is updated only when the new correct-count is strictly greater than the stored value | M | S8 |
| FR-31 | The results screen indicates when a round set a new personal best | S | S8 |

### 4.5 Results screen

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-32 | After a round ends, a results screen shows correct answers, total answered, accuracy, average answer time and best streak | M | S1 |
| FR-33 | The results screen shows the personal best for that trainer + difficulty + duration | M | S8 |
| FR-34 | The results screen shows a weak-area summary for the round when the trainer supports categories | M | S7 |
| FR-35 | The results screen offers "play again with the same settings" and "back to home" | M | — |

### 4.6 Progress history and charts

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-36 | Every completed round is appended to that trainer's history | M | S6 |
| FR-37 | A progress view per trainer plots correct-count and accuracy over the user's previous rounds, in chronological order | M | S6 |
| FR-38 | The progress chart can be filtered by difficulty tier so unlike rounds are not compared directly | S | — |
| FR-39 | The progress view states the number of rounds played, total time practised and the all-time best per difficulty | S | — |
| FR-40 | When a trainer has no history, the progress view shows an explanatory empty state rather than an empty chart | M | — |
| FR-41 | History is capped at the 200 most recent rounds per trainer; the oldest entries are dropped first | S | NFR-5 |
| FR-42 | Charts are rendered without a third-party charting library | M | NFR-8 |

### 4.7 Weak-area tracking

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-43 | Each prompt is tagged by the trainer with a category identifier | M | S7 |
| FR-44 | The engine aggregates asked and correct counts per category for the round | M | S7 |
| FR-45 | Weak-area analysis identifies the category with the lowest hit rate, considering only categories with at least 3 prompts asked | M | S7 |
| FR-46 | The weak area is presented in plain language, e.g. "You miss Fractions most — 2 of 7 correct" | M | S7 |
| FR-47 | When no category reaches the 3-prompt threshold, the analysis states that there is not enough data yet | M | S7 |
| FR-48 | The progress view shows weak-area hit rates aggregated across that trainer's full history, not only the last round | S | S7 |
| FR-49 | Mental Math and Geography must support categories in v1; Memory Recall may do so | M | S7 |

### 4.8 Persistence

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-50 | Round results, personal bests and settings persist in `localStorage` and are restored on page load | M | S1, S6 |
| FR-51 | If stored data is missing, corrupt or of an unknown schema version, the app starts with empty progress and shows a non-blocking notice instead of crashing | M | NFR-6 |
| FR-52 | The user can clear all stored progress from a settings screen, with a confirmation step | S | — |
| FR-53 | If `localStorage` is unavailable, the app remains fully playable for the session and informs the user that progress will not be saved | S | NFR-6 |

### 4.9 Trainer — Mental Math Sprint

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-54 | Generates arithmetic prompts across the categories: addition, subtraction, multiplication, division, fractions, percentages | M | S3 |
| FR-55 | Difficulty controls operand range and which categories are drawn. Beginner: addition and subtraction within 0–20. Intermediate: adds multiplication and division within tables to 10. Advanced: adds percentages and larger operands. Expert: adds fractions and multi-step prompts | M | S3 |
| FR-56 | Division prompts never divide by zero | M | S3 |
| FR-57 | Division prompts at Beginner, Intermediate and Advanced tiers always have an integer answer | M | S3 |
| FR-58 | Subtraction prompts at Beginner tier never produce a negative answer | M | S3 |
| FR-59 | Fraction prompts state the expected answer format and accept the documented equivalent forms | S | S4 |
| FR-60 | Answers are entered as free numeric input | M | S4 |

### 4.10 Trainer — Memory Recall

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-61 | Presents a sequence for a bounded display time, hides it, then asks the user to reproduce it | M | S2 |
| FR-62 | Sequence types: digits, letters and words | M | — |
| FR-63 | Difficulty controls sequence length and display time. Beginner: 3 items, 3 s. Intermediate: 5 items, 3 s. Advanced: 7 items, 2 s. Expert: 9 items, 2 s | M | S2 |
| FR-64 | An answer is correct only when the full sequence is reproduced in the correct order | M | S4 |
| FR-65 | The sequence is not retrievable from the page once hidden, including via the DOM | M | — |

### 4.11 Trainer — Geography Speed

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-66 | Content is loaded from a JSON file in the repository containing countries, capitals, continents and flag references | M | NFR-8 |
| FR-67 | Prompt categories: country → capital, capital → country, flag → country, country → continent | M | S7 |
| FR-68 | Difficulty controls the country pool. Beginner: widely known countries. Intermediate: adds mid-frequency countries. Advanced: full set. Expert: full set with free-text instead of multiple choice | M | S2 |
| FR-69 | Multiple-choice distractors are drawn from the same continent where possible, so they are plausible | S | — |
| FR-70 | Flag assets are stored in the repository; no external image requests are made | M | NFR-8 |
| FR-71 | The content file is validated at load; malformed entries are skipped and logged rather than crashing the trainer | M | NFR-6 |

### 4.12 Presentation, theming and accessibility

| ID | Requirement | Priority | Traces to |
|---|---|---|---|
| FR-72 | The interface supports dark and light mode, with the choice persisted | M | — |
| FR-73 | Theme defaults to the operating system preference on first visit | S | — |
| FR-74 | Every screen is usable with the keyboard alone, with no mouse interaction required | M | S10 |
| FR-75 | Focus moves to the answer input when a round starts and after each answer | M | S10 |
| FR-76 | Visible focus indicators are present on all interactive elements | M | S10 |
| FR-77 | The layout is usable down to 360 px width | M | — |
| FR-78 | Correct/incorrect feedback is conveyed by text or icon in addition to colour | M | S10 |
| FR-79 | Live score updates are announced to assistive technology via an ARIA live region | S | S10 |
| FR-80 | Reduced-motion preference is respected: non-essential animation is disabled | S | S10 |

---

## 5. Non-Functional Requirements

| ID | Requirement | Verification | Traces to |
|---|---|---|---|
| NFR-1 | Answer feedback renders within 100 ms of submission on a mid-range laptop | Manual timing | — |
| NFR-2 | The timer is accurate to within 100 ms over a 120 s round | Automated test with a mocked clock | S5 |
| NFR-3 | First meaningful paint within 2 s on a local file open | Lighthouse | — |
| NFR-4 | The application works fully offline after first load | DevTools, offline mode | S9 |
| NFR-5 | Stored progress stays below 1 MB for a user with the maximum retained history | Calculation plus test with generated data | FR-41 |
| NFR-6 | No unhandled exception reaches the user; failures degrade to a readable message | Fault-injection tests on storage and content loading | S9 |
| NFR-7 | The app runs in current Chrome, Firefox and Edge | Manual cross-browser check | S11 |
| NFR-8 | No third-party runtime dependencies, no network requests to external hosts, no API keys | Dependency review plus network inspection | S9, S11 |
| NFR-9 | The app can be run by opening the entry page from a clone, or via a plain static file server, with no build step | Fresh-clone test on a second machine | S11 |
| NFR-10 | No personal data is collected, transmitted or stored | Code review | — |
| NFR-11 | Pure logic — generators, answer checking, scoring, streaks, weak-area analysis — is isolated from DOM code so it can be unit-tested | Code review; tests import logic without a DOM | S3, S4, S7, S8 |
| NFR-12 | Automated tests cover all question generators, answer checking, scoring, streak logic, personal-best logic and weak-area analysis | Test run; coverage report | S3–S8 |
| NFR-13 | The test suite runs with a single documented command | README check | S11 |
| NFR-14 | Lighthouse accessibility score ≥ 90 on the home, round and results screens | Lighthouse audit | S10 |
| NFR-15 | The README documents purpose, how to run locally, how to run tests, and the repository structure | Review | S11 |

---

## 6. Epics

| ID | Epic | Goal | Depends on |
|---|---|---|---|
| E-1 | Project foundation and test harness | Runnable skeleton, test runner, repository structure | — |
| E-2 | Drill Engine core | Round lifecycle, timing, answer checking, scoring, streaks | E-1 |
| E-3 | Mental Math Sprint | First trainer, validating the engine contract | E-2 |
| E-4 | Memory Recall Trainer | Second trainer with a different prompt lifecycle | E-2 |
| E-5 | Geography Speed Trainer | Third trainer, content-file driven | E-2 |
| E-6 | Persistence and progress history | Storage, history, charts | E-2 |
| E-7 | Weak-area tracking | Category aggregation and plain-language analysis | E-2, E-6 |
| E-8 | UI shell, theming and accessibility | Navigation, dark/light, keyboard-first, responsive | E-2 |
| E-9 | Quality, documentation and release | Cross-browser checks, accessibility audit, README | all |

**Build order rationale.** E-3 and E-4 are deliberately built before the engine contract is frozen: two concrete trainers expose whether the abstraction is right, as noted in brief §12. E-5 then tests the contract without changing engine code.

---

## 7. User Stories

Format: *As a learner, I want … so that …* Acceptance criteria are written Given/When/Then so they map directly onto test cases.

### E-1 — Project foundation and test harness

**US-1.1** — Set up repository structure and entry page
*Acceptance:* Given a fresh clone, when I open the entry page, then a placeholder home screen renders with no console errors and no network requests to external hosts.
*Covers:* NFR-8, NFR-9

**US-1.2** — Set up the test runner
*Acceptance:* Given the repository, when I run the documented test command, then the suite executes and reports results; a deliberately failing sample test causes a non-zero exit code.
*Covers:* NFR-13

**US-1.3** — Define the trainer registration contract
*Acceptance:* Given the engine, when a trainer module supplies a generator and a renderer, then it appears on the home screen without any engine file being modified.
*Covers:* FR-15

### E-2 — Drill Engine core

**US-2.1** — Run a timed round
*Acceptance:* Given a chosen trainer, difficulty and duration, when I start a round, then the first prompt appears immediately and the remaining time is displayed and counts down.
*Covers:* FR-6, FR-10, FR-12

**US-2.2** — End the round exactly on time
*Acceptance:* Given a 60 s round, when the timer reaches zero, then input is disabled and the results screen appears; and given an answer submitted after expiry, when scoring runs, then that answer is not counted.
*Covers:* FR-11 · *Verifies:* S5

**US-2.3** — Submit and check answers
*Acceptance:* Given a prompt, when I type an answer and press Enter, then it is checked, feedback is shown, and the next prompt appears with the input cleared and refocused.
*Covers:* FR-7, FR-16, FR-17, FR-23

**US-2.4** — Tolerant answer checking
*Acceptance:* Given a text prompt with answer "Oslo", when I submit " oslo ", then it is accepted; and when I submit an empty string, then nothing is counted and my streak is unaffected.
*Covers:* FR-19, FR-20, FR-22 · *Verifies:* S4

**US-2.5** — Show corrective feedback
*Acceptance:* Given an incorrect answer, when feedback appears, then it states the answer was wrong and shows the correct answer, using text or an icon as well as colour.
*Covers:* FR-8, FR-78

**US-2.6** — Track score and streak live
*Acceptance:* Given a round in progress, when I answer correctly, then correct-count and streak both increase; and when I answer incorrectly, then the streak resets to 0 while best streak retains its highest value.
*Covers:* FR-13, FR-24, FR-27, FR-28 · *Verifies:* S1

**US-2.7** — Compute round statistics
*Acceptance:* Given 10 answers of which 7 are correct, when the round ends, then accuracy reads 70.0 %; and given zero answers, then accuracy reads 0 % and average answer time reads 0 without a division error.
*Covers:* FR-25, FR-26 · *Verifies:* S1

**US-2.8** — Avoid immediate repeats
*Acceptance:* Given a round, when prompts are generated, then no prompt is identical to the one directly before it.
*Covers:* FR-14

**US-2.9** — Abandon a round
*Acceptance:* Given a round in progress, when I choose to quit, then I return to the home screen and no result is written to history.
*Covers:* FR-4

**US-2.10** — Multiple-choice input
*Acceptance:* Given a four-option prompt, when I press the 2 key, then the second option is submitted; and clicking the option has the identical effect.
*Covers:* FR-18

### E-3 — Mental Math Sprint

**US-3.1** — Generate valid arithmetic prompts
*Acceptance:* Given 1000 generated prompts per tier, when they are validated, then none divide by zero, every Beginner/Intermediate/Advanced division has an integer answer, and no Beginner subtraction yields a negative result.
*Covers:* FR-54, FR-56, FR-57, FR-58 · *Verifies:* S3

**US-3.2** — Scale difficulty across tiers
*Acceptance:* Given each tier, when prompts are generated, then only that tier's permitted categories and operand ranges occur, per FR-55.
*Covers:* FR-55 · *Verifies:* S2

**US-3.3** — Tag prompts with categories
*Acceptance:* Given a completed round, when category statistics are read, then every prompt is attributed to exactly one of the six Mental Math categories and the counts sum to total answered.
*Covers:* FR-43, FR-49

**US-3.4** — Handle fraction prompts
*Acceptance:* Given an Expert fraction prompt, when it is displayed, then the expected answer format is stated; and when I submit a documented equivalent form, then it is accepted.
*Covers:* FR-59

### E-4 — Memory Recall Trainer

**US-4.1** — Show and hide a sequence
*Acceptance:* Given a Beginner round, when a prompt starts, then 3 items are displayed for 3 s and then hidden, and the input becomes active.
*Covers:* FR-61, FR-63

**US-4.2** — Check full-sequence answers
*Acceptance:* Given the sequence 4-7-2, when I submit "472", then it is correct; and when I submit "427" or "47", then it is incorrect.
*Covers:* FR-64

**US-4.3** — Support sequence types
*Acceptance:* Given repeated rounds, when prompts are generated, then digit, letter and word sequences all occur and are valid for the tier.
*Covers:* FR-62

**US-4.4** — Prevent cheating via the DOM
*Acceptance:* Given a hidden sequence, when the DOM is inspected, then the sequence is not present in the rendered markup.
*Covers:* FR-65

### E-5 — Geography Speed Trainer

**US-5.1** — Load and validate content
*Acceptance:* Given the content JSON, when it loads, then valid entries are available to the generator; and given a deliberately malformed entry, then it is skipped and logged while the trainer still runs.
*Covers:* FR-66, FR-71 · *Verifies:* S9

**US-5.2** — Generate the four prompt categories
*Acceptance:* Given a round, when prompts are generated, then all four categories occur and each prompt is tagged with its category.
*Covers:* FR-67, FR-43

**US-5.3** — Scale the country pool by tier
*Acceptance:* Given Beginner, when prompts are generated, then only countries from the widely-known pool appear; and given Expert, then answers are free-text rather than multiple choice.
*Covers:* FR-68

**US-5.4** — Plausible distractors
*Acceptance:* Given a multiple-choice prompt, when distractors are chosen, then they come from the same continent where the pool allows, and the correct answer never appears twice.
*Covers:* FR-69

**US-5.5** — Serve flags locally
*Acceptance:* Given a flag prompt, when the page loads the image, then it is served from the repository and no external request is made.
*Covers:* FR-70 · *Verifies:* S9

**US-5.6** — Accept documented alternative names
*Acceptance:* Given a country with documented alternatives, when I submit any documented form, then it is accepted.
*Covers:* FR-21

### E-6 — Persistence and progress history

**US-6.1** — Persist results
*Acceptance:* Given a completed round, when I reload the page, then the round still appears in history with identical values.
*Covers:* FR-36, FR-50 · *Verifies:* S1

**US-6.2** — Maintain personal bests
*Acceptance:* Given a stored best of 18 for a trainer/difficulty/duration, when I score 17, then the best is unchanged; and when I score 19, then the best becomes 19 and the results screen says so.
*Covers:* FR-29, FR-30, FR-31, FR-33 · *Verifies:* S8

**US-6.3** — Show a results screen
*Acceptance:* Given a finished round, when the results screen appears, then correct answers, total answered, accuracy, average answer time, best streak and personal best are all displayed.
*Covers:* FR-32, FR-33 · *Verifies:* S1

**US-6.4** — Replay or return
*Acceptance:* Given the results screen, when I choose "play again", then a new round starts with identical settings; and when I choose "home", then I return to the trainer list.
*Covers:* FR-35

**US-6.5** — Plot progress over time
*Acceptance:* Given five completed rounds, when I open the progress view, then five data points appear in chronological order with values matching the stored results.
*Covers:* FR-37, FR-42 · *Verifies:* S6

**US-6.6** — Filter progress by difficulty
*Acceptance:* Given rounds at mixed tiers, when I filter to Intermediate, then only Intermediate rounds are plotted.
*Covers:* FR-38

**US-6.7** — Summarise practice
*Acceptance:* Given existing history, when I open the progress view, then rounds played, total time practised and all-time best per difficulty are shown.
*Covers:* FR-39

**US-6.8** — Handle an empty history
*Acceptance:* Given a trainer never played, when I open its progress view, then an explanatory empty state appears instead of a blank chart.
*Covers:* FR-40

**US-6.9** — Survive corrupt storage
*Acceptance:* Given invalid JSON in the storage key, when the app loads, then it starts with empty progress, shows a non-blocking notice and remains usable.
*Covers:* FR-51 · *Verifies:* S9

**US-6.10** — Cap history growth
*Acceptance:* Given 205 stored rounds for a trainer, when a new round completes, then 200 remain and the oldest were removed.
*Covers:* FR-41, NFR-5

**US-6.11** — Clear progress
*Acceptance:* Given stored progress, when I choose to clear it and confirm, then all progress is removed and the home screen shows no personal bests.
*Covers:* FR-52

**US-6.12** — Degrade without storage
*Acceptance:* Given `localStorage` is unavailable, when I play a round, then the round completes normally and I am told progress will not be saved.
*Covers:* FR-53

### E-7 — Weak-area tracking

**US-7.1** — Aggregate per category
*Acceptance:* Given a completed round, when category statistics are computed, then asked and correct counts per category match the answers given, and asked totals equal total answered.
*Covers:* FR-44

**US-7.2** — Identify the weakest category
*Acceptance:* Given a scripted round where fractions are answered 2 of 7 correct and every other category is above 80 %, when analysis runs, then fractions is reported as the weakest area.
*Covers:* FR-45 · *Verifies:* S7

**US-7.3** — Ignore thin categories
*Acceptance:* Given a category with only 2 prompts asked and both wrong, when analysis runs, then that category is excluded from the weakest-area result.
*Covers:* FR-45

**US-7.4** — Explain in plain language
*Acceptance:* Given an identified weak area, when the results screen renders, then it reads in the form "You miss Fractions most — 2 of 7 correct".
*Covers:* FR-46

**US-7.5** — Handle insufficient data
*Acceptance:* Given a round where no category reached 3 prompts, when the results screen renders, then it states that there is not enough data yet.
*Covers:* FR-47

**US-7.6** — Aggregate across history
*Acceptance:* Given several completed rounds, when I open the progress view, then per-category hit rates are shown across the full history for that trainer.
*Covers:* FR-48

### E-8 — UI shell, theming and accessibility

**US-8.1** — Trainer list on the home screen
*Acceptance:* Given the home screen, when it renders, then every registered trainer appears with name, description and personal best where one exists.
*Covers:* FR-1

**US-8.2** — Round setup
*Acceptance:* Given a selected trainer, when the setup screen opens, then difficulty and duration can be chosen and my previous choices are preselected.
*Covers:* FR-2, FR-3

**US-8.3** — Client-side navigation
*Acceptance:* Given any screen, when I navigate, then the view changes without a full page reload and without losing round state unexpectedly.
*Covers:* FR-5

**US-8.4** — Dark and light mode
*Acceptance:* Given the theme toggle, when I switch theme, then it applies immediately and survives a reload; and on first visit the OS preference is used.
*Covers:* FR-72, FR-73

**US-8.5** — Keyboard-only operation
*Acceptance:* Given only a keyboard, when I navigate from home through a full round to results, then every action is reachable and focus is always visible.
*Covers:* FR-74, FR-76 · *Verifies:* S10

**US-8.6** — Focus management
*Acceptance:* Given a round starts, when the first prompt appears, then the answer input holds focus; and after each submission focus returns to it.
*Covers:* FR-75

**US-8.7** — Responsive layout
*Acceptance:* Given a 360 px viewport, when I run a round, then all controls and statistics are usable without horizontal scrolling.
*Covers:* FR-77

**US-8.8** — Announce updates to assistive technology
*Acceptance:* Given a screen reader, when my score changes, then the update is announced via a live region without interrupting input.
*Covers:* FR-79

**US-8.9** — Respect reduced motion
*Acceptance:* Given the OS reduced-motion preference, when the app renders, then non-essential animation is disabled.
*Covers:* FR-80

### E-9 — Quality, documentation and release

**US-9.1** — Full manual test matrix
*Acceptance:* Given 3 trainers × 4 difficulty tiers, when each combination is played, then every round completes without error and produces a correct results screen.
*Covers:* NFR-7 · *Verifies:* S2

**US-9.2** — Verify offline operation
*Acceptance:* Given the app has loaded once, when the network is disabled, then every feature continues to work and no external request is attempted.
*Covers:* NFR-4 · *Verifies:* S9

**US-9.3** — Accessibility audit
*Acceptance:* Given the home, round and results screens, when a Lighthouse accessibility audit runs, then each scores at least 90 and reported issues are fixed or documented.
*Covers:* NFR-14 · *Verifies:* S10

**US-9.4** — Cross-browser verification
*Acceptance:* Given current Chrome, Firefox and Edge, when a full round is played in each, then behaviour and layout are correct.
*Covers:* NFR-7

**US-9.5** — README and run instructions
*Acceptance:* Given a fresh clone on another machine, when I follow the README, then I can run the app and the test suite without keys, accounts or a build step.
*Covers:* NFR-9, NFR-13, NFR-15 · *Verifies:* S11

**US-9.6** — Timer accuracy test
*Acceptance:* Given a mocked clock, when a 120 s round runs, then the measured duration is within 100 ms of the target.
*Covers:* NFR-2 · *Verifies:* S5

---

## 8. Traceability to Brief Success Criteria

| Criterion | Requirements | Stories |
|---|---|---|
| S1 — round statistics correct and persisted | FR-13, FR-24–28, FR-32, FR-50 | US-2.6, US-2.7, US-6.1, US-6.3 |
| S2 — all trainers run at every tier | FR-1, FR-6, FR-7, FR-55, FR-63, FR-68 | US-3.2, US-4.1, US-5.3, US-9.1 |
| S3 — generators produce only valid questions | FR-54, FR-56, FR-57, FR-58 | US-3.1 |
| S4 — answer checking correct and tolerant | FR-16–22, FR-64 | US-2.4, US-4.2, US-5.6 |
| S5 — timer exact, late answers rejected | FR-10, FR-11, NFR-2 | US-2.2, US-9.6 |
| S6 — progress chart correct | FR-36, FR-37 | US-6.5 |
| S7 — weak area identified correctly | FR-43–47 | US-7.2, US-7.3 |
| S8 — personal best only on genuine improvement | FR-29, FR-30 | US-6.2 |
| S9 — works offline, no third-party requests | NFR-4, NFR-6, NFR-8, FR-51, FR-70 | US-5.1, US-5.5, US-6.9, US-9.2 |
| S10 — keyboard-only and accessible | FR-74–80, NFR-14 | US-8.5, US-8.6, US-9.3 |
| S11 — runs from README with no keys | NFR-9, NFR-13, NFR-15 | US-9.5 |

Every success criterion in the brief is covered by at least one requirement and one story. No requirement exists without a traceable origin in the brief.

---

## 9. Open Questions for Architecture

Carried from brief §13, to be resolved in the architecture document:

| # | Question | Blocks |
|---|---|---|
| 1 | Vanilla JavaScript or a lightweight framework? | E-1, E-8 |
| 2 | Which test runner, and does it run in Node, a browser, or both? | E-1, NFR-11 |
| 3 | Module format and whether a bundler is needed, given NFR-9 forbids a build step | E-1 |
| 4 | SVG or Canvas for charts | E-6 |
| 5 | Exact shape of the trainer registration interface | E-1, FR-15 |
| 6 | Source and licence for the geography content and flag assets | E-5 |
| 7 | Final product name | E-9 |

---

## 10. Document Control

| Version | Date | Change |
|---|---|---|
| v1 | 2026-10-10 | Initial PRD derived from product brief Draft v2 |

**Next step in the BMAD flow:** the architecture document, resolving §9 and defining the module structure that satisfies NFR-11.
