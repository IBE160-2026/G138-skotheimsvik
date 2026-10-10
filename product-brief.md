# Product Brief — LearningHub (working name)

**Alternative names:** SkillSprint · DrillDeck · BrainReps
**Status:** Draft v2 (revised after supervisor feedback of 2026-10-06)
**Author:** Daniel Skotheimsvik, with AI support (BMAD Analyst role)
**Course:** IBE160 Programmering med KI, Høgskolen i Molde, autumn 2026
**Supersedes:** the earlier GameHub concept — see §14 Project history

---

## 0. Executive Summary

LearningHub is a browser-based training site where you practise real skills in short, timed rounds and watch your numbers go up. Pick a trainer — mental math, memory recall, or geography — run a 60-second round, answer as many prompts as you can, and get instant feedback on accuracy, speed and streak.

Everything runs on one reusable **Drill Engine**: the same loop (prompt → answer → instant feedback → score/streak → next) powers every trainer, so adding a new skill means writing a question generator and a small renderer, nothing more.

The problem it solves: people who want to get better at a concrete skill are stuck choosing between full courses that are too slow and single-purpose apps that do not talk to each other. LearningHub gives many skills one consistent practice loop and one progress history.

Version 1 is a static site — HTML, CSS, JavaScript, content in JSON files, progress in `localStorage`. No third-party APIs, no paid services, no login. A reviewer can clone the repository, open the page, and use the whole application.

---

## 1. Problem Statement

People want to get measurably better at practical skills — mental math, memory, geography, music reading, ear training, spelling, chess tactics — but existing tools fall into two camps:

- **Full courses** (Khan Academy, Duolingo) teach thoroughly but are far too slow when you only want to drill one weak spot for five minutes.
- **Single-purpose apps** (Monkeytype for typing, Seterra for maps, Lichess puzzles for chess) are fast and addictive, but fragmented: separate sites, separate accounts, separate progress, and no shared sense of "am I actually improving?"

There is no Monkeytype-style site that offers **fast, timed, score-driven drills** across many skills with one consistent progress system.

Concrete situations:

- A student has a maths test on Friday and wants ten minutes of fraction drills tonight — not a 40-minute video lesson.
- A student keeps mixing up European capitals and wants repeated exposure to exactly the ones they get wrong.
- Someone practises on three different drill sites and has no idea whether they are improving, because no site keeps a history they can compare.

---

## 2. Vision

A single website where every skill is trained through the same addictive loop:

> **prompt → answer → instant feedback → score / streak → next**

Users pick a trainer, run a 60-second round, see accuracy, speed and streak, and watch their progress improve over days and weeks. Over time the site shows them where they are weak and points them at it.

---

## 3. What Makes This Different

LearningHub borrows the *format* of speed-drill sites but changes the *content* so that practice transfers to real tasks.

| Existing tool | What it does well | Where it falls short | What LearningHub does instead |
|---|---|---|---|
| **Monkeytype** | Superb timed-drill UX, instant stats, minimal keyboard-first interface | Trains typing on **random word sequences that nobody would ever write in a real sentence**. You get faster at the test itself, but the content teaches you nothing you can use afterwards | Keeps the 60-second timed format and the stats screen, but every prompt is **real, usable content**: an actual arithmetic problem, an actual capital city, an actual sequence to memorise. Improving your score means you have genuinely learned something |
| **Seterra** | Large, high-quality geography question bank | Geography only; progress is per-quiz rather than a personal history; no cross-skill view | Geography is one trainer among many, sharing the same scoring, history and weak-area tracking as every other trainer |
| **Lichess puzzles** | Excellent difficulty adaptation and streak mechanics | Chess only, and it assumes you already play chess | The adaptive and streak ideas are generalised into the Drill Engine so *any* skill gets them |
| **Anki** | Proven spaced repetition, fully user-controlled | Slow card-by-card pace, no timed competitive loop, heavy setup before you learn anything | Zero setup: open the site, pick a trainer, start answering. Spaced repetition is a later phase layered onto an already enjoyable loop |
| **Duolingo** | Streaks and gamification that keep people coming back | One domain, heavily monetised, progress optimised for engagement rather than mastery | The same motivational mechanics, no monetisation, and the numbers shown are honest accuracy and speed figures |

**The honest version of the pitch.** None of the individual pieces are new. Timed rounds exist, question banks exist, streaks exist. What does not exist is one place where the *same* drill loop, the *same* score model and the *same* progress history apply across unrelated skills — and where content is chosen for transfer value rather than for being easy to generate.

**Honest limitations.** LearningHub will not beat Seterra on geography breadth or Lichess on chess depth in version 1. Its advantage is breadth plus consistency, not depth in a single domain. A user who only ever wants to drill one skill is probably better served by a specialist tool.

---

## 4. Who This Serves

**Primary user for v1 — the exam-prep student (14–22).**
A secondary-school or first-year university student with a specific weak area (arithmetic speed, European geography, memorising sequences) and limited time. They want short repeatable sessions that fit between other obligations, instant feedback on what they got wrong, and visible proof that they are improving. They work on a laptop, prefer keyboard input, and will abandon anything that demands a sign-up before showing value.

Why this user: the three MVP trainers (Mental Math, Memory Recall, Geography) are exactly the skills this group drills before tests, so v1 serves one group completely instead of five groups partially.

**Secondary users — served later, not designed for in v1:**

| Segment | Need | Phase |
|---|---|---|
| Musicians and music learners | Note reading, interval and chord recognition | 2 |
| Hobbyist chess players | Tactical pattern recognition without playing full games | 2 |
| ESL learners | Vocabulary and spelling speed | 2 |
| Self-improvers | Memory and mental-math training with visible progress | 1 (overlaps with primary) |

---

## 5. Core Concept: One Engine, Many Trainers

Build a reusable **Drill Engine** once. Each trainer supplies only:

1. a **question generator** (or a content JSON file), and
2. a small **renderer** for the prompt type (text, image, staff, audio, board).

The engine owns timing, answer checking, scoring, streaks, difficulty tiers, the results screen, progress storage and weak-area classification. This is the main architectural bet of the project, and Phase 2 exists partly to prove it: adding a fourth trainer should require no engine changes.

---

## 6. Trainer Catalogue

| # | Trainer | Content source | Phase |
|---|---|---|---|
| 1 | Mental Math Sprint | Generated | 1 |
| 2 | Memory Recall Trainer | Generated | 1 |
| 3 | Geography Speed Trainer | Own JSON (countries, capitals, flags) | 1 |
| 4 | Spelling & Vocabulary | Own JSON word lists | 2 |
| 5 | Music Reading Practice | Generated (SVG staff) | 2 |
| 6 | Ear Training | Generated (Web Audio API) | 2 |
| 7 | Chess Pattern Trainer | Own JSON puzzle set | 2 |
| 8 | Code Syntax Trainer | Own JSON snippets | 3 |
| 9 | Sign Language Flash | Own image set | 3 |
| 10 | Reading Comprehension Sprint | Own JSON passages | 3 |

---

## 7. Key Features

### In v1 (MVP)

- Timed rounds (30 s / 60 s / 120 s) with live correct-count, accuracy and streak
- Three trainers: Mental Math Sprint, Memory Recall, Geography Speed
- Difficulty tiers per trainer (Beginner → Expert)
- Results screen: correct answers, accuracy percentage, average answer time, best streak, personal best
- **Progress history with charts over time** — accuracy and speed per trainer across previous rounds
- **Weak-area tracking** — per-category hit rate with a plain-language summary such as "you miss fractions most", for at least Mental Math and Geography
- Progress persisted in `localStorage` and restored on reload
- Keyboard-first UI, dark and light mode, mobile-friendly, accessible
- Runs as a static site with no login and no network calls

### Deferred to later phases

- User accounts and server-synced progress (Phase 2)
- The remaining seven trainers (Phases 2–3)
- Leaderboards and social comparison (Phase 3)
- Spaced repetition scheduling (Phase 3)

### Explicitly out of scope

| Item | Reason |
|---|---|
| Third-party APIs or paid services | "No strings attached" principle; a reviewer must be able to run it without keys |
| AI or LLM features inside the app | AI is used to *build* the project, not to run it; keeps behaviour deterministic and testable |
| Native mobile apps | A responsive web app is sufficient |
| Collecting personal data | No accounts in v1, therefore no personal data at all |

---

## 8. Scope Summary

**v1 is done when** a user can open the site, choose any of three trainers and a difficulty tier, run a timed round, see a correct results screen, view their progress chart and weak areas, and find all of it still there after closing and reopening the browser.

---

## 9. Success Criteria

### Functional criteria — verifiable by a reviewer, no real users required

| # | Criterion | How it is checked |
|---|---|---|
| S1 | A 60-second Mental Math round shows the correct number of correct answers, accuracy percentage and best streak, and the result is still stored after the page is reloaded | Manual test plus automated tests on scoring and persistence |
| S2 | All three trainers run the full loop (prompt → answer → feedback → next) without errors at every difficulty tier | Manual test matrix, 3 trainers × 4 tiers |
| S3 | Question generators produce only valid questions — for example Mental Math never divides by zero and never produces a non-integer answer at Beginner tier | Unit tests over 1000 generated questions per tier |
| S4 | Answer checking accepts correct answers and rejects incorrect ones, including whitespace and letter-case variants for text answers | Unit tests on the answer-checking function |
| S5 | The timer ends the round at exactly the chosen duration, and no answer submitted after expiry is counted | Unit test with a mocked clock |
| S6 | After five rounds the progress chart shows five data points in chronological order with the correct values | Manual test plus tests on the history store |
| S7 | Weak-area tracking identifies the correct weakest category when a round is answered with a deliberately skewed pattern | Unit test with a scripted answer sequence |
| S8 | Personal best updates only when a round genuinely beats the previous best | Unit test |
| S9 | The whole application works offline after first load, with no requests to third parties | DevTools network inspection |
| S10 | The site is fully operable with the keyboard alone and passes a basic accessibility audit | Manual keyboard walkthrough plus Lighthouse accessibility audit |
| S11 | A reviewer can run the app locally by following the README, with no keys, accounts or build step | Fresh-clone test on another machine |

### Aspirational criteria — require real users over time, measured only if a test group is available

- Median session of at least 3 rounds
- 7-day return rate of at least 25 %
- Measurable per-user improvement in accuracy or speed over two weeks

---

## 10. Technical Approach ("no strings attached")

**Principle:** no third-party APIs, no paid services, standard library first.

| Layer | Phase 1 (MVP) | Phase 2+ |
|---|---|---|
| Frontend | Static HTML, CSS and vanilla JavaScript | Same |
| Hosting | Opened directly from disk; GitHub Pages optional | GitHub Pages plus a small Node host |
| Progress storage | Browser `localStorage` | Server-side per user |
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
| **1 — MVP** | Drill Engine, Mental Math, Memory Recall, Geography, difficulty tiers, results screen, progress charts, weak-area tracking, `localStorage` persistence, dark and light mode, test suite, README |
| **2 — Expansion and accounts** | Spelling & Vocabulary (proves engine reuse), Music Reading, Ear Training, Chess Patterns, Node and SQLite login, synced progress |
| **3 — Growth** | Code Syntax, Sign Language, Reading Comprehension, leaderboards, spaced repetition |

Phase 1 is the only committed scope for this course. The first Phase 2 trainer, Spelling & Vocabulary, is a stretch goal included only if v1 is finished and tested, because it demonstrates that the Drill Engine is genuinely reusable.

---

## 12. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Scope creep (ten trainers at once) | High | High | Strict phasing; engine first, three trainers only in the MVP |
| MVP too small to demonstrate enough work | Medium | Medium | Progress charts and weak-area tracking pulled into v1; stretch goal of a fourth trainer |
| Content authoring effort | Medium | Medium | Prefer generated content; JSON files only where generation is impossible |
| The Drill Engine abstraction turns out to be wrong | Medium | High | Build two trainers before generalising; the fourth trainer validates the abstraction |
| Testing left until the end | Medium | High | Test framework set up in the first story; generators and scoring tested as they are written |
| Audio complexity | Low | Low | Deferred to Phase 2; pure-tone synthesis only |
| Backend maintenance | Low | Low | No backend in v1; SQLite and the standard library when it arrives |

---

## 13. Open Decisions

- Final product name
- Vanilla JavaScript versus a lightweight framework
- Which JavaScript test runner to use
- Exact difficulty-tier definitions per trainer
- Whether the stretch-goal fourth trainer is attempted

---

## 14. Project History

| Date | Decision |
|---|---|
| 2026-09-27 | Initial concept: **GameHub**, a game-discovery and backlog-decision platform |
| 2026-10-05 | Switched to **LearningHub**. GameHub depended on an external games API (IGDB or RAWG) for all of its content, which conflicts with the "no third-party APIs, no keys" principle and would have made the application impossible for a reviewer to run without credentials. LearningHub delivers comparable logical complexity — question generators, timing, scoring, progress analysis — with content the project fully owns |
| 2026-10-06 | Supervisor feedback received on the brief |
| 2026-10-10 | Brief revised to v2: added an Executive Summary and a *What Makes This Different* section, narrowed to a single primary user, replaced engagement-based success metrics with verifiable functional criteria, pulled progress charts and weak-area tracking into v1, removed the discarded GameHub brief, and restored `README.md` and `.gitignore` |

**Next step in the BMAD flow:** produce the PRD from this brief.
