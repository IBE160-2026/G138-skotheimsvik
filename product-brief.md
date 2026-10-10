# Product Brief — LearningHub (working name)

**Alternative names:** SkillSprint · DrillDeck · BrainReps
**Status:** Draft v4
**Author:** Daniel Skotheimsvik, with AI support (BMAD Analyst role)
**Course:** IBE160 Programmering med KI, Høgskolen i Molde, autumn 2026
**Supersedes:** the earlier GameHub concept — see §14 Project history

---

## 0. Executive Summary

LearningHub is a browser-based training site where you practise everyday skills in short, score-driven rounds and watch your numbers go up.

Every trainer gives you **one attempt per day**, and **everyone gets the same puzzle**. There is no difficulty selector: the date decides how hard today is. Some days are gentle, some are brutal, and that is the point — your score today means something because the person next to you faced exactly the same thing. Miss a day, or want more practice? The **archive** lets you play any previous day you have not yet attempted.

Every trainer runs on one reusable **Drill Engine** with the same core loop — prompt → answer → instant feedback → score/streak → next — but each trainer decides how its round *ends*. Mental Math is against the clock. Geography gives you three lives. Memory gives you one life and no ceiling: the pattern keeps growing until you slip, and your only real opponent is yesterday's score.

The three trainers in version 1 are a starting point, not the final set. The engine exists so new trainers and new round types can be added without rewriting it.

The problem it solves: people who want to get better at a concrete, useful skill are stuck between full courses that are too slow and single-purpose apps that do not talk to each other. LearningHub gives many skills one consistent practice loop, one progress history, and a daily rhythm that turns practice into a habit.

Version 1 is a static site — HTML, CSS, JavaScript, content in JSON files, progress in `localStorage`. No third-party APIs, no paid services, no login. A reviewer can clone the repository, open the page, and use the whole application.

---

## 1. Problem Statement

People want to get measurably better at skills they actually use — mental math, memory, geography, music reading, ear training, spelling, chess tactics — but existing tools fall into two camps:

- **Full courses** (Khan Academy, Duolingo) teach thoroughly but are far too slow when you only want to sharpen one weak spot for five minutes.
- **Single-purpose apps** (Monkeytype for typing, Seterra for maps, Lichess puzzles for chess) are fast and addictive, but fragmented: separate sites, separate accounts, separate progress, and no shared sense of "am I actually improving?"

There is no Monkeytype-style site that offers **fast, score-driven drills** across many skills with one consistent progress system.

Underneath both gaps sit two further problems. Most drill tools optimise for being fun to use rather than for teaching something you can use afterwards — getting better at the app is not the same as getting better at the thing. And unlimited practice at a difficulty you choose yourself sounds generous but rarely builds a habit: when you can play any number of rounds at any setting, no single round matters, your scores are not comparable to anyone else's, and most people drift away.

Concrete situations:

- Someone splitting a restaurant bill or checking a discount in a shop reaches for their phone, because the arithmetic no longer comes automatically — and they would like it to.
- Someone is told a name, a door code or a four-item shopping list, and it is gone a minute later.
- A country comes up in the news and someone realises they could not place it on a map, or name its capital.
- Someone practises on three different drill sites and has no idea whether they are improving, because no site keeps a history they can compare.

---

## 2. Vision

A single website where every skill is trained through the same core loop:

> **prompt → answer → instant feedback → score / streak → next**

Each trainer sets its own stakes — a clock, or a number of lives. Each day sets its own difficulty, the same for everybody. You get **one attempt per trainer per day**, so the attempt counts, and the archive is there when you want more.

Users build a daily habit across a handful of minutes, watch their numbers improve over weeks, and see which areas keep letting them down. The measure of success is not the score on the screen — it is noticing, a month later, that the mental arithmetic in a shop happens without effort.

---

## 3. What Makes This Different

LearningHub borrows the *format* of speed-drill sites but changes the *content* so that practice transfers to real tasks, and changes the *rhythm* so that practice becomes a habit.

| Existing tool | What it does well | Where it falls short | What LearningHub does instead |
|---|---|---|---|
| **Monkeytype** | Superb drill UX, instant stats, minimal keyboard-first interface | Trains typing on **random word sequences that nobody would ever write in a real sentence**. You get faster at the test itself, but the content teaches you nothing you can use afterwards. Unlimited retries at your own settings mean no single run matters | Keeps the tight loop and the stats screen, but every prompt is **real, usable content**: an actual arithmetic problem, an actual capital city, an actual pattern to memorise. One shared puzzle a day makes the run matter |
| **Wordle** | One puzzle, one attempt, same for everyone — the format that turned a trivial game into a daily habit | A single puzzle type, no skill progression, nothing to practise when you want more | Takes the same rhythm and applies it to a growing set of skills, with an archive for people who want more and a progress history that shows improvement over time |
| **Seterra** | Large, high-quality geography question bank | Geography only; you pick the quiz and the scope, so progress is per-quiz rather than a personal history; no cross-skill view | Geography is one trainer among many, with the day deciding the scope, sharing the same scoring, history and weak-area tracking as every other trainer |
| **Lichess puzzles** | Excellent streak mechanics, and a daily puzzle with an archive | Chess only, and it assumes you already play chess | The daily-plus-archive structure and the streak mechanics are generalised into the Drill Engine so *any* skill gets them |
| **Human Benchmark** | Clean, honest measurement of raw cognitive tasks including visual memory | Pure testing with no daily structure and no sense of progress beyond a single number | The same kind of task becomes a daily puzzle with a history behind it, so you can see whether you are actually getting better |
| **Anki** | Proven spaced repetition, fully user-controlled | Slow card-by-card pace, no competitive loop, heavy setup before you learn anything | Zero setup: open the site, play today's puzzle. Spaced repetition is a later phase layered onto an already enjoyable loop |
| **Duolingo** | Streaks and gamification that keep people coming back | One domain, heavily monetised, progress optimised for engagement rather than mastery | The same motivational mechanics, no monetisation, and the numbers shown are honest accuracy and speed figures |

**The honest version of the pitch.** None of the individual pieces are new. Score-driven rounds exist, question banks exist, streaks exist, daily puzzles exist. What does not exist is one place where the *same* drill loop, the *same* score model, the *same* shared daily puzzle and the *same* progress history apply across unrelated skills — and where content is chosen for transfer value rather than for being easy to generate.

**Honest limitations.** LearningHub will not beat Seterra on geography breadth or Lichess on chess depth in version 1. Its advantage is breadth plus consistency, not depth in a single domain. Two deliberate trades are worth stating plainly. The daily limit builds habit at the cost of letting keen users practise freely, which the archive only partly offsets. And removing the difficulty selector means a beginner will sometimes meet a hard day and a strong player will sometimes meet an easy one — comparability is bought at the cost of personal fit.

---

## 4. Who This Serves

**Primary user for v1 — the everyday self-improver.**
Someone who wants the skills they use in ordinary life to get sharper: working out a price or a split bill in their head without reaching for a phone, remembering a code, a shopping list or a name they were just told, and knowing where places are when they come up in conversation or in the news. They are not studying for anything in particular and have no teacher setting them tasks — they simply want to be a bit better next month than they are today.

They have a few spare minutes at a time, not evenings. They will not sit through a course, will not create an account before seeing whether the thing is any good, and will stop using anything that feels like homework. What keeps them coming back is seeing a number go up, knowing the practice was worth something outside the app, and having a reason to return tomorrow.

Age and occupation vary — a pupil, a student, someone working full time, someone retired. What unites them is the motivation: **practical everyday usefulness, trained in small daily doses**, not qualification or exam results.

Why this user: the trainers map onto everyday situations rather than onto a syllabus. Mental Math is the arithmetic you do while shopping or splitting a bill. Memory is remembering where things are and what you were just shown. Geography is general knowledge that comes up constantly. The once-a-day format fits a person with a few spare minutes far better than an open-ended practice session would, and removing the difficulty selector removes the one decision most likely to stall them before they start.

**Secondary users — served later, not designed for in v1:**

| Segment | Need | Phase |
|---|---|---|
| Musicians and music learners | Note reading, interval and chord recognition | 2 |
| Hobbyist chess players | Tactical pattern recognition without playing full games | 2 |
| ESL learners | Vocabulary and spelling speed | 2 |
| Pupils and students revising | The same trainers, used for test preparation rather than daily upkeep | 1 (benefits from v1, not designed around) |

---

## 5. Core Concept: One Engine, Many Trainers

Build a reusable **Drill Engine** once. Each trainer supplies only:

1. a **question generator** (or a content JSON file),
2. a small **renderer** for the prompt type (text, grid, image, staff, audio, board), and
3. a declared **round mode** — how its rounds end.

The engine owns the loop, answer checking, scoring, streaks, the results screen, progress storage, weak-area analysis, the daily difficulty, the daily-attempt rule and the archive. Adding a trainer must not require changing engine code. This is the main architectural bet of the project, and it is why a fourth trainer is a stretch goal: it proves the abstraction holds.

### 5.1 Round modes

Version 1 ships two ways for a round to end. More can be added later without disturbing existing trainers.

| Mode | Round ends when | Used by | Rationale |
|---|---|---|---|
| **Timed** | The clock runs out | Mental Math Sprint | Arithmetic is about speed under pressure; "how many before time is up" is the natural measure |
| **Lives** | You run out of lives | Geography (3 lives), Memory (1 life) | Recognition and recall are about accuracy; "how far can you get before you slip" is the natural measure |

Candidate modes for later phases: fixed prompt count, sudden-death against a target, and time-attack where correct answers add seconds.

### 5.2 One shared puzzle a day

**No difficulty selector.** The player does not choose how hard the round is — the date does. Today's puzzle is the same for everyone, and difficulty varies from day to day: some days are easy, some are hard, most sit in between. This is what makes a score worth having. It also removes the first decision a new user would otherwise have to make before they can start.

Difficulty still exists internally, as a band from Beginner to Expert, but it is **assigned by the date rather than chosen**. Where a trainer has parameters that ought to follow difficulty, they are derived from it rather than set by the player — for example, Mental Math gives more time on a day with harder arithmetic, so that a hard day is harder, not merely slower.

Each trainer offers **one scored attempt per calendar day**. Once today's attempt is used, that trainer is done until tomorrow.

The **archive** holds every previous day's puzzle. Any past day you have not yet played can still be played, and counts towards your history on equal terms with today's result. This keeps the daily format meaningful without leaving a new user — or a reviewer — with nothing to do.

Daily puzzles are **deterministic**: the difficulty, the parameters and the prompts for a given trainer and date are all generated from a seed derived from that date, so every player gets the same puzzle and results are comparable. This also makes the generators straightforward to test.

**The limit is a soft one.** With no accounts, it is stored in the browser, so a determined user can clear their storage or open a private window and play again. Version 1 does not try to prevent this and does not claim to; the limit is there to shape a habit, not to police anyone. Enforcing it properly needs accounts and a server, which is Phase 2.

### 5.3 Your real opponent is yesterday

Because every day is a single shared puzzle, the natural motivation is not a leaderboard — it is your own record. After every round the results screen tells you how today compares with your **previous attempt** and with your **all-time best** for that trainer. Beating yesterday is the daily goal; beating your best is the long one.

---

## 6. Trainer Catalogue

The three trainers in version 1 are a **starting point**, chosen because they need no external content and exercise different parts of the engine. The catalogue is designed to grow; the table below is the current plan, not a ceiling.

| # | Trainer | Round mode | What you do | Content source | Phase |
|---|---|---|---|---|---|
| 1 | Mental Math Sprint | Timed | Answer as many arithmetic prompts as you can before the clock runs out | Generated | 1 |
| 2 | Memory | Lives (1) | A pattern of tiles lights up on a grid; reproduce it. Every level adds a tile, and it never stops — until you miss | Generated | 1 |
| 3 | Geography Speed | Lives (3) | Capitals, countries, flags and continents, three mistakes allowed | Own JSON (countries, capitals, flags) | 1 |
| 4 | Spelling & Vocabulary | Lives | — | Own JSON word lists | 2 |
| 5 | Music Reading Practice | Timed | — | Generated (SVG staff) | 2 |
| 6 | Ear Training | Lives | — | Generated (Web Audio API) | 2 |
| 7 | Chess Pattern Trainer | Lives | — | Own JSON puzzle set | 2 |
| 8 | Code Syntax Trainer | Timed | — | Own JSON snippets | 3 |
| 9 | Sign Language Flash | Lives | — | Own image set | 3 |
| 10 | Reading Comprehension Sprint | Timed | — | Own JSON passages | 3 |

### 6.1 Memory: endless by design

Memory is the one trainer with no finish line. You get one life and the pattern grows by one tile every level, so the round always ends in failure — the only question is how far you got. The day decides where you start and which patterns appear; your score is the level you reached.

This is deliberate. A fixed-length memory round with one life is over in seconds and tells you almost nothing. An endless one turns every day into a direct, legible comparison with yesterday.

---

## 7. Key Features

### In v1 (MVP)

- **Three trainers**, each with its own round mode: Mental Math (timed), Memory (1 life, endless), Geography (3 lives)
- **No difficulty selection** — the date sets the difficulty, the same for every player
- **One scored attempt per trainer per calendar day**, with a clear indication of what is still available today
- **Archive** of previous days' puzzles, playable at any time, counting towards history on equal terms
- **Deterministic daily puzzles** — the same date and trainer always produce the same difficulty, parameters and prompts
- **Comparison against your previous attempt and your all-time best** on every results screen
- Live round display appropriate to the mode: remaining time for timed rounds, remaining lives for lives rounds, plus correct-count, accuracy and streak in both
- Results screen: correct answers, accuracy, average answer time, best streak, personal best, and why the round ended
- **Progress history with charts over time** — score and accuracy per trainer, plotted by puzzle date, with the day's difficulty visible
- **Weak-area tracking** — per-category hit rate with a plain-language summary ("you miss fractions most"), for at least Mental Math and Geography
- Progress persisted in `localStorage` and restored on reload
- Keyboard-first UI including full keyboard control of the Memory grid, dark and light mode, mobile-friendly, accessible
- Runs as a static site with no login and no network calls

### Deferred to later phases

- User accounts and server-synced progress, which would also allow the daily limit to be enforced properly (Phase 2)
- Leaderboards and comparison against other players, which the shared daily puzzle makes possible (Phase 3)
- Further trainers and further round modes (Phases 2–3)
- Day-streak tracking and catch-up mechanics (Phase 2)
- Spaced repetition scheduling (Phase 3)
- A practice mode at a difficulty of your choosing, if daily-only proves too restrictive (Phase 2)

### Explicitly out of scope

| Item | Reason |
|---|---|
| Third-party APIs or paid services | "No strings attached" principle; a reviewer must be able to run it without keys |
| AI or LLM features inside the app | AI is used to *build* the project, not to run it; keeps behaviour deterministic and testable |
| Player-selected difficulty | Deliberate product decision — a shared daily puzzle is the point |
| Enforcing the daily limit against a determined user | Impossible without accounts and a server; documented as a soft limit |
| Native mobile apps | A responsive web app is sufficient |
| Collecting personal data | No accounts in v1, therefore no personal data at all |

---

## 8. Scope Summary

**v1 is done when** a user can open the site, see which of the three trainers they still have an attempt for today and how hard today is, play that attempt under the trainer's own round mode, see a results screen that tells them how they did against yesterday and against their best, play older puzzles from the archive, view their progress chart and weak areas, and find all of it still there after closing and reopening the browser.

---

## 9. Success Criteria

### Functional criteria (verifiable by a reviewer, no real users needed)

| # | Criterion | How it is checked |
|---|---|---|
| S1 | A Mental Math round shows the correct number of correct answers, accuracy percentage and best streak, and the result is still stored after the page is reloaded | Manual test plus automated tests on scoring and persistence |
| S2 | All three trainers run the full loop (prompt → answer → feedback → next) without errors across a sample of puzzle dates spanning every difficulty band | Manual test matrix, 3 trainers × 4 difficulty bands drawn from archive dates |
| S3 | Question generators produce only valid questions — for example Mental Math never divides by zero and never produces a non-integer answer in the easier bands | Unit tests over 1000 generated questions per band |
| S4 | Answer checking accepts correct answers and rejects incorrect ones, including whitespace and letter-case variants for text answers | Unit tests on the answer-checking function |
| S5 | Each round ends exactly on its own end condition — a timed round when the clock reaches zero, a lives round when the last life is lost — and no answer submitted afterwards is counted | Unit tests with a mocked clock and a scripted answer sequence |
| S6 | After five completed puzzles the progress chart shows five data points in puzzle-date order with the correct values | Manual test plus tests on the history store |
| S7 | Weak-area tracking identifies the correct weakest category when a round is answered with a deliberately skewed pattern | Unit test with a scripted answer sequence |
| S8 | Personal best only updates when a round genuinely beats the previous best | Unit test |
| S9 | The whole application works offline after first load, with no requests to third parties | DevTools network inspection |
| S10 | The site is fully operable with the keyboard alone, including selecting tiles on the Memory grid, and passes a basic accessibility audit | Manual keyboard walkthrough plus Lighthouse accessibility audit |
| S11 | A reviewer can run the app locally by following the README, with no keys, accounts or build step | Fresh-clone test on another machine |
| S12 | The same trainer and date always generate an identical difficulty, parameter set and prompt sequence, and two different dates generate different ones | Unit test comparing generated puzzles |
| S13 | Daily difficulty varies across dates and covers every band over a long run, with no player input able to change it | Unit test over 365 simulated dates checking the distribution |
| S14 | After today's attempt at a trainer is completed, that trainer is locked until the next local day, while the archive remains playable | Manual test plus unit test with a mocked clock |
| S15 | A puzzle played from the archive is recorded against its own date and appears in the correct position in the progress chart | Manual test plus unit test |
| S16 | Memory continues generating levels indefinitely, with each level one tile larger, until the player makes a mistake | Unit test driving 50 consecutive correct levels |
| S17 | The results screen correctly reports whether the round beat the previous attempt and the all-time best | Unit test across the cases: first ever attempt, worse, equal, better |

### Aspirational criteria (require real users over time — measured only if a test group is available)

- A typical active user completes at least 2 of the 3 daily puzzles on a day they visit
- 7-day return rate of at least 25 %
- Measurable per-user improvement in score over two weeks

---

## 10. Technical Approach ("no strings attached")

**Principle:** no third-party APIs, no paid services, standard library first.

| Layer | Phase 1 (MVP) | Phase 2+ |
|---|---|---|
| Frontend | Static HTML, CSS and vanilla JavaScript | Same |
| Hosting | Opened directly from disk; GitHub Pages optional | GitHub Pages plus a small Node host |
| Progress storage | Browser `localStorage` | Server-side per user |
| Daily puzzle generation | Seeded pseudo-random generator, seeded from trainer + date; difficulty and parameters derived from the same seed | Same, with the seed authoritative on the server |
| Charts | Hand-drawn SVG or Canvas, no chart library | Same |
| Accounts | None | Node.js with **SQLite** (`node:sqlite`, built into Node 22+) |
| Passwords | — | Hashed with `crypto.scrypt` from the standard library, with a per-user salt |
| Content | JSON files in the repository | JSON files in the repository |
| Audio | — | Web Audio API, pure tones, no sample files |
| Testing | A JavaScript test runner chosen at the architecture stage, set up from the first story | Same |

**Why not a JSON file for user accounts?** Concurrent writes can corrupt it and there is no locking. SQLite is equally dependency-free, a single file on disk, and safe. JSON remains ideal for *content* such as question banks.

Detailed technology decisions belong in the architecture document rather than in this brief.

---

## 11. Roadmap

| Phase | Deliverables |
|---|---|
| **1 — MVP** | Drill Engine with timed and lives modes, date-assigned difficulty, daily-attempt rule, archive, deterministic generation, Mental Math, Memory, Geography, results comparison against previous and best, progress charts, weak-area tracking, `localStorage` persistence, dark and light mode, test suite, README |
| **2 — Expansion and accounts** | Further trainers and round modes, day-streak tracking, Node and SQLite login, synced progress, enforced daily limit, optional free-practice mode |
| **3 — Growth** | Remaining trainers, leaderboards built on the shared daily puzzle, spaced repetition |

Phase 1 is the only committed scope for this course. A fourth trainer is a stretch goal, attempted only if v1 is finished and tested, because it demonstrates that the Drill Engine is genuinely reusable.

---

## 12. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Scope creep from a growing trainer catalogue | High | High | Strict phasing; engine first, three trainers only in the MVP |
| The daily limit leaves a reviewer unable to evaluate the app | Medium | High | The archive makes every past day playable, so there is always something to assess; documented in the README |
| Removing difficulty selection frustrates users on days that do not suit them | Medium | Medium | Archive offers days of other difficulties; a free-practice mode is held in reserve for Phase 2 |
| Determinism bugs make a daily puzzle differ between players or reloads | Medium | High | Seeded generator isolated from the DOM and covered by dedicated tests (S12, S13) |
| Daily difficulty distribution turns out lopsided — too many hard or easy days | Medium | Medium | Distribution asserted by test over a simulated year (S13) |
| Endless Memory rounds run long enough to be tedious | Low | Medium | Growth by one tile per level makes failure arrive naturally; observed during testing |
| The Drill Engine abstraction turns out to be wrong | Medium | High | Build two trainers with *different* round modes before generalising; a fourth trainer validates the abstraction |
| Testing left until the end | Medium | High | Test framework set up in the first story; generators, scoring and end conditions tested as they are written |
| Content authoring effort | Medium | Medium | Prefer generated content; JSON files only where generation is impossible |
| Backend maintenance | Low | Low | No backend in v1; SQLite and the standard library when it arrives |

---

## 13. Open Decisions

- Final product name
- Vanilla JavaScript versus a lightweight framework
- Which JavaScript test runner
- How far back the archive should reach, and what the earliest puzzle date is
- The exact difficulty distribution across days — how often a hard day should come round
- Exact per-band parameters for each trainer
- Whether the stretch-goal fourth trainer is attempted

---

## 14. Project History

| Date | Decision |
|---|---|
| 2026-09-27 | Initial concept: **GameHub**, a game-discovery and backlog-decision platform |
| 2026-10-05 | Switched to **LearningHub**. Two problems killed GameHub. First, it could not function without external services: all game data would have come from a third-party games API, and several planned features needed further paid or key-protected services on top. That conflicts with the "no strings attached" principle and would have left a reviewer unable to run the application without our own credentials. Second, and more fundamentally, the core feature did not work. GameHub was meant to recommend what to play based on how much you had played something and when you last played it — but that data lives inside each platform. Pulling playtime out of Steam, Epic, Xbox and PlayStation would have meant a separate integration for every one of them, and for a game like Minecraft, which runs through several different launchers and has no single authoritative playtime source, it would have been effectively impossible. Without reliable playtime the recommendations would have been guesswork. LearningHub keeps comparable logical complexity — question generators, timing, scoring, progress analysis — using content the project fully owns and data it generates itself |
| 2026-10-06 | Supervisor feedback received on the brief |
| 2026-10-10 | Brief revised to v2: added an Executive Summary and a *What Makes This Different* section, narrowed to a single primary user, replaced engagement-based success metrics with verifiable functional criteria, pulled progress charts and weak-area tracking into v1, removed the discarded GameHub brief, and restored `README.md` and `.gitignore` |
| 2026-10-10 | Brief revised to v3 after a product decision on round structure. Rounds are no longer uniformly timed: each trainer declares a **round mode**, with *timed* and *lives* in v1 and room for more. Added the **one scored attempt per trainer per day** rule with an **archive** of previous days, and the determinism requirement that follows from it. Clarified that the three v1 trainers are a starting point rather than the final catalogue |
| 2026-10-10 | Brief revised to v4 after four further product decisions. **Difficulty selection removed entirely** — the date assigns difficulty and everyone faces the same puzzle, with trainer parameters such as the Mental Math clock derived from the day's difficulty rather than chosen. **Memory redefined** as a visual grid of tiles rather than digit and word sequences, and made **endless**: one life, one more tile each level, with the score being how far you got. Archive results confirmed as counting towards personal bests on equal terms. Added **comparison against your previous attempt and all-time best** as the core motivational loop in place of a leaderboard |

**Next step in the BMAD flow:** the architecture document.
