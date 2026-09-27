# Product Brief — LearningHub (working name)

**Alternative names:** SkillSprint · DrillDeck · BrainReps
**Status:** Draft v1
**Author:** Mary (Business Analyst)

---

## 1. Problem Statement

People want to get measurably better at practical skills — mental math, memory, geography, music reading, ear training, spelling, chess tactics — but existing tools are either full courses (too slow) or single-purpose apps (fragmented). There is no Monkeytype-style site that offers **fast, timed, score-driven drills** across many skills with one consistent progress system.

## 2. Vision

A single website where every skill is trained through the same addictive loop:

> **prompt → answer → instant feedback → score / streak → next**

Users pick a trainer, run a 60-second round, see accuracy, speed, and streak, and watch their progress improve over days and weeks.

## 3. Target Users

| Segment | Need |
|---|---|
| Students (12–25) | Quick drills for math, spelling, geography, test prep |
| Musicians / learners | Note reading, interval and chord recognition |
| Hobbyist chess players | Tactical pattern recognition without full games |
| ESL learners | Vocabulary and spelling speed |
| Self-improvers | Memory and mental-math training with visible progress |

## 4. Core Concept: One Engine, Many Trainers

Build a reusable **Drill Engine** once. Each trainer is only:

1. a **question generator** (or a content JSON file), and
2. a small **renderer** for the prompt type (text, image, staff, audio, board).

The engine handles timing, scoring, streaks, difficulty tiers, results screen, and progress storage.

## 5. Trainer Catalogue

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

## 6. Key Features

- Timed rounds (30s / 60s / 120s) with accuracy, speed, and streak
- Difficulty tiers per trainer (Beginner → Expert)
- Results screen with per-round stats and personal bests
- Progress history and charts over time
- Weak-area tracking (e.g. "you miss fractions most")
- Keyboard-first UI, dark/light mode, mobile-friendly
- Later: accounts, leaderboards, spaced repetition

## 7. Technical Approach ("no strings attached")

**Principle:** no third-party APIs, no paid services, standard library first.

| Layer | Phase 1 (MVP) | Phase 2+ |
|---|---|---|
| Frontend | Static HTML/CSS/vanilla JS (or a light framework) | Same |
| Hosting | GitHub Pages (free) | GitHub Pages + small Node host |
| Progress storage | Browser `localStorage` | Server-side per user |
| Accounts | None | Node.js + **SQLite** (`node:sqlite`, built-in in Node 22+) |
| Passwords | — | Hashed with `crypto.scrypt` (standard library) + per-user salt |
| Content | JSON files in repo | JSON files in repo |
| Audio | — | Web Audio API (no samples needed for pure tones) |

**Why not a JSON file for user accounts?** Concurrent writes can corrupt it and there's no locking. SQLite is equally dependency-free (single file on disk) and safe. JSON remains ideal for *content* (question banks).

## 8. Roadmap

| Phase | Estimated effort | Deliverables |
|---|---|---|
| **1 — MVP** | 3–5 weekends | Drill Engine, Mental Math, Memory Recall, Geography, localStorage progress, GitHub Pages deploy |
| **2 — Expansion + accounts** | 2–3 months | Spelling, Music Reading, Ear Training, Chess Patterns, Node/SQLite login, synced progress |
| **3 — Growth** | Ongoing | Code Syntax, Sign Language, Reading Comprehension, leaderboards, spaced repetition |

## 9. Success Metrics

- MVP live on GitHub Pages with 3 trainers
- Median session ≥ 3 rounds
- 7-day return rate ≥ 25%
- Measurable per-user improvement in accuracy/speed over 2 weeks

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope creep (10 trainers at once) | Strict phasing; engine first, 3 trainers only in MVP |
| Content authoring effort | Prefer generated content; JSON files for the rest |
| Audio complexity | Pure-tone synthesis via Web Audio API, no sample files |
| Backend maintenance | Defer accounts to Phase 2; SQLite + stdlib only |

## 11. Open Decisions

- Final product name
- Vanilla JS vs. lightweight framework
- Whether Phase 1 ships with dark mode
