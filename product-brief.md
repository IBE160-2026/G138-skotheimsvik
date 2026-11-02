# Product Brief — LearningHub

**Status:** Draft v5
**Author:** Daniel Skotheimsvik, with AI support (BMAD Analyst role)
**Course:** IBE160 Programmering med KI, Høgskolen i Molde, autumn 2026
**Supersedes:** the earlier GameHub concept — see §14 Project history

---

## 0. Executive Summary

LearningHub is a browser-based training site where you practise everyday skills in short, score-driven rounds and watch your numbers go up.

The site is organised into **categories** — Math, Memory and Geography — and each category holds several **trainers**, which are the individual games. Geography alone has three: guess the country from its flag, from its outline, or name its capital.

Every trainer offers all four difficulty bands, from **Beginner to Expert**, and each band is its own puzzle with its own daily attempt. Pick Intermediate in the morning and Expert in the evening if you like — they are separate puzzles and separate records. Within a band, **everyone in the world gets the same puzzle that day**, so a score actually means something. Miss a day? The **archive** lets you play any previous day you have not yet attempted.

Alongside the daily puzzles there is a **practice mode**: unlimited, unscored, and fully configurable. This is where the filters live. Want only algebra and trigonometry? Want a 6×6 memory board? Practice mode gives you every knob. Daily puzzles deliberately give you none, because a shared puzzle stops being shared the moment two players configure it differently.

Every trainer runs on one reusable **Drill Engine** with the same core loop — prompt → answer → instant feedback → score/streak → next — but each trainer decides how its round *ends*: against a clock, or against a limited number of lives.

The problem it solves: people who want to get better at a concrete, useful skill are stuck between full courses that are too slow and single-purpose apps that do not talk to each other. LearningHub gives many skills one consistent practice loop, one progress history, and a daily rhythm that turns practice into a habit.

Version 1 is a static site — HTML, CSS, JavaScript, content in JSON files, progress in `localStorage`. No third-party APIs, no paid services, no login. A reviewer can clone the repository, open the page, and use the whole application.

---

## 1. Problem Statement

People want to get measurably better at skills they actually use — mental arithmetic, memory, geography, music reading, spelling — but existing tools fall into two camps:

- **Full courses** (Khan Academy, Duolingo) teach thoroughly but are far too slow when you only want to sharpen one weak spot for five minutes.
- **Single-purpose apps** (Monkeytype for typing, Flagle for flags, Worldle for country outlines, Seterra for maps) are fast and addictive, but fragmented: separate sites, separate progress, and no shared sense of "am I actually improving?"

The fragmentation is worst in geography. Someone who enjoys this kind of game ends up with four browser tabs open — one for flags, one for outlines, one for capitals — each with its own streak and none of them talking to each other. There is no reason these should be separate products.

Underneath that sit two further problems. Most drill tools optimise for being fun rather than for teaching something you can use afterwards — getting better at the app is not the same as getting better at the thing. And a tool that offers either *only* a fixed daily puzzle or *only* unlimited free play will lose half its audience: the daily-puzzle crowd wants a reason to come back tomorrow, while the grinder wants to drill the one topic they keep failing.

Concrete situations:

- Someone splitting a restaurant bill or checking a discount reaches for their phone, because the arithmetic no longer comes automatically.
- Someone is told a name, a door code or a four-item shopping list, and it is gone a minute later.
- A country comes up in the news and someone realises they could not place it on a map, name its capital, or recognise its flag.
- Someone keeps losing marks on algebra specifically, and no drill site lets them practise *only* algebra.

---

## 2. Vision

A single website where every skill is trained through the same core loop:

> **prompt → answer → instant feedback → score / streak → next**

Skills are grouped into categories, each category holds several trainers, and every trainer offers four difficulty bands. You choose the band; the date chooses the questions. One attempt per band per day, with an archive for the days you missed and a practice mode for when one attempt is not enough.

Users build a daily habit across a handful of minutes, watch their numbers improve over weeks, and see which topics keep letting them down. The measure of success is not the score on the screen — it is noticing, a month later, that the mental arithmetic in a shop happens without effort.

---

## 3. What Makes This Different

LearningHub borrows the *format* of speed-drill and daily-puzzle sites, but unifies what is currently scattered across a dozen separate products.

| Existing tool | What it does well | Where it falls short | What LearningHub does instead |
|---|---|---|---|
| **Flagle** | One flag a day, revealed piece by piece — simple and genuinely habit-forming | Flags only, one puzzle a day, no difficulty, no history beyond a streak | Flag guessing is one trainer inside the Geography category, with four bands, an archive, and a progress history shared with every other trainer |
| **Worldle** | Country outlines with distance-and-direction feedback — an elegant hint system | Outlines only, and again a single daily puzzle with no way to practise more | The outline trainer sits beside the flag and capital trainers, so one site covers what currently takes three |
| **Monkeytype** | Superb drill UX, instant stats, minimal keyboard-first interface | Trains typing on **random word sequences nobody would ever write in a real sentence**. You get faster at the test, but the content teaches you nothing usable | Keeps the tight loop and the stats screen, but every prompt is **real, usable content** |
| **Wordle** | One puzzle, one attempt, same for everyone — the format that created the daily-habit genre | A single puzzle type, no skill progression, nothing to do when you want more | The same rhythm applied to a growing set of skills, with four bands a day instead of one puzzle, plus an archive and a practice mode |
| **Seterra** | Large, high-quality geography question bank with free configuration | Geography only, and progress is per-quiz rather than a personal history | Free configuration lives in practice mode, while daily puzzles stay comparable |
| **Human Benchmark** | Clean, honest measurement of raw cognitive tasks including visual memory | Pure testing, no daily structure, no sense of progress | The same tasks become daily puzzles with history behind them |
| **Anki** | Proven spaced repetition, fully user-controlled | Slow card-by-card pace, no competitive loop, heavy setup | Zero setup: open the site, play today's puzzle |
| **Duolingo** | Streaks and gamification that keep people coming back | One domain, heavily monetised, progress optimised for engagement over mastery | The same motivational mechanics, no monetisation, honest accuracy and speed figures |

**The honest version of the pitch.** None of the individual pieces are new. Score-driven rounds exist, question banks exist, streaks exist, daily puzzles exist, and Flagle and Worldle already do their one thing well. What does not exist is one place where the *same* drill loop, the *same* score model, the *same* four-band daily structure and the *same* progress history apply across unrelated skills — where a geography fan gets flags, outlines and capitals under one roof, and where a maths learner can switch off everything except the topic they keep failing.

**Honest limitations.** LearningHub will not beat Seterra on geography breadth, and its flag trainer will not have the polish of a product that does only flags. Its advantage is breadth plus consistency, not depth in any single domain. Two deliberate trades are worth stating plainly. Daily puzzles take away all configuration, which will frustrate anyone who wants to tune the experience — practice mode exists precisely to absorb that complaint. And offering four bands a day across six trainers means twenty-four daily puzzles, which nobody will finish; the daily list is a menu, not a to-do list.

---

## 4. Who This Serves

**Primary user for v1 — the everyday self-improver.**
Someone who wants the skills they use in ordinary life to get sharper: working out a price or a split bill in their head, remembering a code or a shopping list, and knowing where places are when they come up in conversation. They are not studying for anything in particular and have no teacher setting them tasks — they simply want to be a bit better next month than they are today.

They have a few spare minutes at a time, not evenings. They will not sit through a course, will not create an account before seeing whether the thing is any good, and will stop using anything that feels like homework. What keeps them coming back is seeing a number go up, knowing the practice was worth something outside the app, and having a reason to return tomorrow.

Why the structure suits them: the category list means they can follow whichever skill they are in the mood for without hunting through a flat list of games, and choosing their own band means a beginner is never humiliated and an expert is never bored. Practice mode is there for the day they get annoyed at one specific topic and want to hammer it.

**Secondary users — served later, not designed for in v1:**

| Segment | Need | Phase |
|---|---|---|
| Geography-quiz enthusiasts | Flags, outlines and capitals in one place with real progress tracking | 1 (well served, not the design target) |
| Pupils and students revising | Topic filters in practice mode, used for test preparation | 1 (benefits, not designed around) |
| Musicians and music learners | Note reading, interval and chord recognition | 2 |
| Hobbyist chess players | Tactical pattern recognition without playing full games | 2 |

---

## 5. Core Concept: Categories, Trainers, Bands

### 5.1 The hierarchy

Three levels, and the vocabulary is used consistently throughout this project:

| Level | Meaning | Examples |
|---|---|---|
| **Category** | A skill area | Math · Memory · Geography · People |
| **Trainer** | One game inside a category | Flag Guesser · Pattern Memory · Famous People |
| **Topic** | A tagged sub-type of prompt, used for weak-area analysis and for practice-mode filters | `algebra` · `trigonometry` · `capitals-of-africa` |

A single reusable **Drill Engine** sits underneath all of it. Each trainer supplies only a question generator, a renderer for its prompt type, and a declared round mode. The engine owns the loop, answer checking, scoring, streaks, results, persistence, weak-area analysis, daily attempts and the archive. Adding a trainer — or a whole new category — must not require changing engine code.

### 5.2 Round modes

| Mode | Round ends when | Used by |
|---|---|---|
| **Timed** | The clock runs out | Mental Math Sprint |
| **Lives** | You run out of lives | All Geography trainers, Pattern Memory |
| **Completion** | The board is finished | Figure Pairs — the round ends when every pair is matched |

### 5.3 Four bands, four puzzles, four attempts

Every trainer offers **Beginner, Intermediate, Advanced and Expert**. The player chooses. Each band is an independent puzzle with its own daily attempt and its own personal best, so playing Beginner in the morning does not stop you playing Expert in the evening.

Within a band, the puzzle is **the same for every player on that date**, generated deterministically from a seed derived from trainer + band + date. That is what makes a score comparable. The band changes *how hard* the questions are; the date changes *which* questions they are.

Difficulty means different things in different categories, and that is intentional:

- **Math** — bands control which topics appear and how large the numbers get. Beginner is addition and subtraction; Expert reaches algebra and trigonometry.
- **Geography** — bands control the country pool and the generosity of the hints. Beginner uses widely known countries with multiple choice; Expert uses the full set with free-text answers and fewer hints.
- **Memory** — **bands do not apply.** See §5.5.

### 5.4 Daily attempts, archive and practice mode

**One scored attempt per trainer, per band, per calendar day.** Once spent, that particular puzzle is done until tomorrow.

**Starting a round commits you.** The attempt is spent the moment you begin, not when you finish. Quit early and the round is recorded as it stood; switch to a different band or board size mid-round and the one you were playing ends the same way. There is no free restart, no peeking at today's questions and backing out. This is what makes a daily score worth anything — and practice mode is exempt, because that is the whole point of it.

The **archive** holds every previous day's puzzles. Any past day and band you have not yet played can still be played, and counts towards your history on equal terms.

**Practice mode** is the pressure valve. It is unlimited, available at any time, and fully configurable — this is the only place filters live. You can pick topics, board sizes, country regions and round length. Practice rounds show you full statistics at the end but are **not recorded in your history and never affect a personal best**, because a configurable round is not comparable to anyone else's.

**The daily limit is a soft one.** With no accounts it is stored in the browser, so a determined user can clear their storage and play again. Version 1 does not try to prevent this and does not claim to; the limit shapes a habit, it does not police anyone. Real enforcement needs accounts and a server, which is Phase 2.

### 5.5 Why Memory has no difficulty bands

A memory pattern is random. A 4×4 grid with five tiles is not meaningfully "intermediate" — it is just a 4×4 grid with five tiles, and whether you remember it depends on you, not on how cleverly the puzzle was authored. Bolting four bands onto it would be decoration.

So Memory replaces bands with **board size**. Each board size is its own daily attempt and its own personal best, exactly as bands are elsewhere. A 3×3 board and a 6×6 board are different challenges with different records, which is honest, where "Beginner 4×4" versus "Expert 4×4" would not be.

The board you pick is the board you keep. It never grows mid-round — you chose that size, and overriding your choice halfway through would be rude. A Pattern Memory round therefore ends naturally as the pattern approaches the board's capacity.

The numbers come from the **Corsi block-tapping test**, the standard visuo-spatial memory task since 1972. Corsi uses nine blocks, starts at two, and reports an average span of five to six. So LearningHub starts at two tiles and lets a pattern cover up to two thirds of the board — which means the smallest 3×3 board reaches six tiles, just past the average human limit, rather than stopping short of it.

### 5.6 Categories as the thing you choose

Not every trainer splits by difficulty or board size. **Famous People** splits by subject: pick Everything, or just music, film, sport, science or history before you start. Each is its own daily puzzle with its own record, so being good at music trivia is tracked separately from being good at science trivia — which is the honest way round, because they are different knowledge.

### 5.6 Your real opponent is yesterday
Because every puzzle is a single shared challenge, the natural motivation is not a leaderboard — it is your own record. After every round the results screen tells you how you compare with your **previous attempt** at that trainer and band, and with your **all-time best**. Beating yesterday is the daily goal; beating your best is the long one.

---

## 6. Category and Trainer Catalogue

### 6.1 Math

| Trainer | Round mode | What you do | Phase |
|---|---|---|---|
| **Mental Math Sprint** | Timed | Answer as many arithmetic prompts as you can before the clock runs out | 1 |

Topics, switchable individually in practice mode and selected by band in daily puzzles:

| Topic | Beginner | Intermediate | Advanced | Expert |
|---|---|---|---|---|
| Addition and subtraction | ● | ● | ● | ● |
| Multiplication and division | | ● | ● | ● |
| Percentages | | | ● | ● |
| Fractions | | | ● | ● |
| Powers and roots | | | ● | ● |
| Algebra — solve for *x* | | | | ● |
| Trigonometry — exact-value sine, cosine and tangent | | | | ● |

Round duration scales with the band, so a harder day is harder rather than merely slower.

### 6.2 Memory

| Trainer | Round mode | What you do | Phase |
|---|---|---|---|
| **Pattern Memory** | Lives (1) | A pattern of tiles lights up, then hides. Reproduce it. Every level adds one tile and it never stops — until you miss | 1 |
| **Figure Pairs** | Completion | A board of face-down figures. Turn two at a time and match them all, remembering what you have seen | 1 |

Both use **board size** instead of difficulty bands. Pattern Memory offers 3×3 through 6×6; Figure Pairs offers 4×3 through 6×6, always an even number of cells. Each size is a separate daily attempt and a separate record.

Figure Pairs is scored on **mistakes, then time** — the fewest wrong turns wins, with elapsed time breaking ties. Turning over a pair you have already seen and failing to match it is the thing being measured.

### 6.3 Geography

| Trainer | Round mode | What you do | Phase |
|---|---|---|---|
| **Flag Guesser** | Lives (3) | Identify the country from its flag | 1 |
| **Outline Guesser** | Lives (3) | Identify the country from its silhouette, with distance-and-direction hints after a wrong guess | 1 |
| **Capital Guesser** | Lives (3) | Name the capital of the given country, or the country from its capital | 1 |

Bands control the country pool and the answer format: Beginner uses widely known countries with four-way multiple choice, Expert uses the full set with free-text answers.

The content covers **all 195 sovereign states** — every UN member plus Vatican City and Palestine. Flags are derived from each country's ISO code rather than stored as images, so there is nothing to download and nothing to license. Outlines exist for 166 of the 195; the 29 without are microstates and small island nations too small to appear in the public-domain map data, so they feature in the Flag and Capital trainers but not the Outline Guesser.

The Outline Guesser's hint system is lifted, openly, from Worldle: after a wrong guess you are told how far away your guess was, in which direction the target lies, and how close you are as a percentage. It is a genuinely good mechanic and there is no reason to invent a worse one. Each shape gives you three guesses, because a distance hint is worthless if a wrong answer moves straight on to the next country.

### 6.4 People

| Trainer | Round mode | What you do | Phase |
|---|---|---|---|
| **Famous People** | Lives (3) | Fifteen clues a day. Name the person, or find out who it was and move on | 1 |

This is the one trainer where the thing you choose is a **subject**, not a difficulty: Everything, Music, Film and TV, Sport, Science and invention, or History and leadership. Each is a separate daily puzzle with a separate record.

Most people come with a **portrait** as well as a clue — 133 of the 134 in the set. Every picture is public domain or under a licence that permits reuse, bundled in the repository and credited to its photographer on screen. The one person without a picture is still perfectly playable; the clue carries the prompt on its own.

The cast is deliberately international: Fela Kuti and Ravi Shankar alongside Mick Jagger and Willie Nelson, Mansa Musa and Toussaint Louverture alongside Churchill and Lincoln, Tu Youyou and Ibn al-Haytham alongside Newton and Curie.

Answers are typed rather than picked from a list. Four options would give a clue this specific away, and the point of seeing the name after a wrong guess is that you did not already have it in front of you. A surname on its own is accepted, and spelling is forgiving about accents — *Pele* passes for *Pelé*.

### 6.5 Later phases

| Category | Trainer | Phase |
|---|---|---|
| Language | Spelling and vocabulary | 2 |
| Music | Note reading, ear training | 2 |
| Chess | Tactical pattern trainer | 2 |
| Math | Unit conversion, estimation | 2 |
| Geography | Population and area comparison | 3 |
| Code | Syntax trainer | 3 |

---

## 7. Key Features

### In v1 (MVP)

- **Three categories holding six trainers**, all on one shared Drill Engine
- **Four difficulty bands per trainer**, chosen by the player, each an independent daily puzzle
- **Board sizes instead of bands for Memory**, each its own daily puzzle
- **One scored attempt per trainer, per band or board size, per calendar day**
- **Deterministic daily puzzles** — the same trainer, band and date always produce the same questions for every player
- **Archive** of previous days, playable at any time, counting towards history on equal terms
- **Practice mode** — unlimited, unscored, with full topic, board-size and region filters
- **Comparison against your previous attempt and your all-time best** on every results screen
- Live round display appropriate to the mode: clock, lives, or pairs remaining
- Results screen: score, accuracy, average answer time, best streak, personal best, and why the round ended
- **Progress history with charts over time**, per trainer and band
- **Weak-area tracking** by topic, with a plain-language summary ("you miss algebra most")
- Progress persisted in `localStorage` and restored on reload
- Keyboard-first UI including full keyboard control of every grid, dark and light mode, mobile-friendly, accessible
- Runs as a static site with no login and no network calls

### Deferred to later phases

- User accounts and server-synced progress, which would also allow the daily limit to be properly enforced (Phase 2)
- Leaderboards and comparison against other players, which the shared daily puzzle makes possible (Phase 3)
- Further categories and trainers (Phases 2–3)
- Day-streak tracking and catch-up mechanics (Phase 2)
- Spaced repetition scheduling (Phase 3)
- Recording practice-mode statistics separately from daily results (Phase 2)

### Explicitly out of scope

| Item | Reason |
|---|---|
| Third-party APIs or paid services | "No strings attached" principle; a reviewer must be able to run it without keys |
| AI or LLM features inside the app | AI is used to *build* the project, not to run it; keeps behaviour deterministic and testable |
| Filters in daily puzzles | Deliberate product decision — a configurable puzzle is not a shared puzzle |
| Difficulty bands for Memory | Deliberate product decision — see §5.5 |
| Enforcing the daily limit against a determined user | Impossible without accounts and a server; documented as a soft limit |
| Native mobile apps | A responsive web app is sufficient |
| Collecting personal data | No accounts in v1, therefore no personal data at all |

---

## 8. Scope Summary

**v1 is done when** a user can open the site, browse three categories, pick any of six trainers, choose a band or board size, see which attempts they still have today, play a round under that trainer's round mode, see a results screen comparing them with yesterday and with their best, play older puzzles from the archive, practise freely with filters, view progress charts and weak topics, and find all of it still there after closing and reopening the browser.

---

## 9. Success Criteria

### Functional criteria (verifiable by a reviewer, no real users needed)

| # | Criterion | How it is checked |
|---|---|---|
| S1 | A round records the correct score, accuracy and best streak, and the result survives a page reload | Manual test plus automated tests on scoring and persistence |
| S2 | All six trainers run the full loop without errors, across every band or board size they offer | Manual test matrix |
| S3 | Question generators produce only valid questions — Mental Math never divides by zero, algebra prompts always have the stated solution, trigonometry prompts only use exact values | Unit tests over 1000 generated questions per band |
| S4 | Answer checking accepts correct answers and rejects incorrect ones, including whitespace, letter-case and documented alternative spellings | Unit tests on the answer-checking function |
| S5 | Each round ends exactly on its own end condition — clock, lives, or board completion — and nothing submitted afterwards is counted | Unit tests with a mocked clock and a scripted answer sequence |
| S6 | After five completed puzzles the progress chart shows five points in puzzle-date order with the correct values | Manual test plus tests on the history store |
| S7 | Weak-area tracking identifies the correct weakest topic when a round is answered with a deliberately skewed pattern | Unit test with a scripted answer sequence |
| S8 | Personal best updates only when a round genuinely beats the previous best for that exact trainer and band | Unit test |
| S9 | The whole application works offline after first load, with no requests to third parties | DevTools network inspection |
| S10 | The site is fully operable with the keyboard alone, including every tile grid, and passes a basic accessibility audit | Manual keyboard walkthrough plus Lighthouse audit |
| S11 | A reviewer can run the app locally by following the README, with no keys, accounts or build step | Fresh-clone test on another machine |
| S12 | The same trainer, band and date always generate an identical prompt sequence; a different band or date generates a different one | Unit test comparing generated puzzles |
| S13 | Each band and board size holds an independent daily attempt — spending one leaves the others available | Unit test with a mocked clock |
| S14 | A puzzle played from the archive is recorded against its own date and appears in the correct chart position | Manual test plus unit test |
| S15 | Pattern Memory generates levels indefinitely, each one tile larger, until the player makes a mistake | Unit test driving 50 consecutive correct levels |
| S16 | The results screen correctly reports whether the round beat the previous attempt and the all-time best | Unit test across: first ever attempt, worse, equal, better |
| S17 | Practice rounds never write to history and never change a personal best, however well they go | Unit test playing a practice round that would otherwise set a record |
| S18 | Practice-mode filters are honoured — switching off a topic means no prompt from that topic appears | Unit test over 500 generated prompts per filter combination |
| S19 | Figure Pairs ends when and only when every pair is matched, and scores by mistakes with time as a tie-break | Unit test driving a scripted board to completion |
| S20 | The Outline Guesser's distance, direction and proximity hints are correct for known country pairs | Unit test against hand-checked reference values |
| S21 | Every trainer is reachable from its category, and adding a trainer requires no engine change | Code review plus a registration test |

### Aspirational criteria (require real users over time)

- A typical active user completes at least 3 daily puzzles on a day they visit
- 7-day return rate of at least 25 %
- Measurable per-user improvement in score over two weeks

---

## 10. Technical Approach ("no strings attached")

**Principle:** no third-party APIs, no paid services, standard library first.

| Layer | Phase 1 (MVP) | Phase 2+ |
|---|---|---|
| Frontend | Static HTML, CSS and vanilla JavaScript, native ES modules | Same |
| Hosting | Vercel, deployed automatically from `main` | Same, plus a small Node host |
| Progress storage | Browser `localStorage` | Server-side per user |
| Daily puzzle generation | Seeded PRNG, seeded from trainer + band + date | Same, with the seed authoritative on the server |
| Charts | Hand-drawn SVG, no chart library | Same |
| Accounts | None | Node.js with **SQLite** (`node:sqlite`, built into Node 22+) |
| Passwords | — | Hashed with `crypto.scrypt`, per-user salt |
| Content | JSON files in the repository | Same |
| Country outlines | Simplified SVG paths derived from **Natural Earth** public-domain data, bundled in the repository | Same |
| Portraits | Public-domain and Creative Commons images from Wikimedia, bundled in the repository with photographer and licence recorded | Same |
| Testing | Node's built-in `node --test` | Same |

**On the map data.** Country outlines are the one piece of content the project cannot author by hand. They come from Natural Earth, which is explicitly public domain, are simplified and converted to SVG paths at authoring time, and are committed to the repository. There is no runtime dependency, no API and no key — the "no strings attached" principle survives intact, and the provenance is documented.

**Why not a JSON file for user accounts?** Concurrent writes can corrupt it and there is no locking. SQLite is equally dependency-free, a single file on disk, and safe. JSON remains ideal for *content* such as question banks.

---

## 11. Roadmap

| Phase | Deliverables |
|---|---|
| **1 — MVP** | Drill Engine with three round modes, category/trainer/topic hierarchy, player-chosen bands, board sizes for Memory, daily attempts, archive, practice mode with filters, six trainers across three categories, results comparison, progress charts, weak-topic tracking, `localStorage` persistence, dark and light mode, test suite, README, Vercel deployment |
| **2 — Expansion and accounts** | Further categories and trainers, day-streak tracking, Node and SQLite login, synced progress, enforced daily limit, recorded practice statistics |
| **3 — Growth** | Remaining trainers, leaderboards built on the shared daily puzzle, spaced repetition |

Phase 1 is the only committed scope for this course.

---

## 12. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Scope creep — six trainers is double the previous plan | High | High | Engine first; trainers share generators and renderers wherever possible; Geography's three trainers differ only in prompt and hint, not in machinery |
| Twenty-four daily puzzles overwhelm the user | Medium | Medium | The home screen presents categories, not a flat list; the daily list is framed as a menu, not a checklist |
| Practice mode cannibalises the daily puzzles | Medium | Medium | Practice is unscored and unrecorded, so there is no reward in it beyond the practice itself |
| Map data is heavy and slows first load | Medium | Medium | Outlines are simplified aggressively at authoring time and loaded only by the trainer that needs them |
| Map data licensing is challenged | Low | High | Natural Earth is public domain; provenance and processing steps are documented in the repository |
| Determinism bugs make a puzzle differ between players | Medium | High | Seeded generator isolated from the DOM, covered by dedicated tests (S12) |
| The Drill Engine abstraction turns out to be wrong | Medium | High | Three round modes and six trainers stress it in genuinely different ways; a completion-mode trainer is the real test |
| Trigonometry and algebra prompts are ambiguous or unfair | Medium | Medium | Expert topics restricted to exact values and integer solutions, enforced by generator tests (S3) |
| Testing left until the end | Medium | High | Tests written alongside each generator, as they were in the previous version |

---

## 13. Decisions

| Decision | Outcome |
|---|---|
| Product name | **LearningHub** |
| Difficulty | Player chooses the band; each band is an independent daily puzzle with its own record |
| Filters | Daily puzzles have none; all filtering lives in practice mode |
| Memory difficulty | Replaced by board size — see §5.5 |
| Memory board size | Fixed for the whole round; it never grows mid-round |
| Leaving a round | Starting a daily round commits the attempt — quitting or switching variant spends it. Practice mode is exempt |
| Country outlines | Natural Earth public-domain data, simplified and bundled in the repository |
| Vanilla JavaScript or a framework | Vanilla JavaScript, native ES modules, zero runtime dependencies |
| Test runner | Node's built-in `node --test` |
| Archive depth | Reaches back to 2026-10-01 |
| Hosting | Vercel, automatic deployment from `main` |

---

## 14. Project History

| Date | Decision |
|---|---|
| 2026-09-27 | Initial concept: **GameHub**, a game-discovery and backlog-decision platform |
| 2026-10-05 | Switched to **LearningHub**. Two problems killed GameHub. First, it could not function without external services: all game data would have come from a third-party games API, and several planned features needed further paid or key-protected services. That conflicts with the "no strings attached" principle and would have left a reviewer unable to run the application without our credentials. Second, the core feature did not work. GameHub was meant to recommend what to play based on how much you had played something and when — but that data lives inside each platform. Pulling playtime out of Steam, Epic, Xbox and PlayStation would have meant a separate integration for each, and for a game like Minecraft, which runs through several launchers with no authoritative playtime source, it was effectively impossible. Without reliable playtime the recommendations would have been guesswork |
| 2026-10-06 | Supervisor feedback received on the brief |
| 2026-10-10 | Brief revised to v2: added an Executive Summary and a *What Makes This Different* section, narrowed to a single primary user, replaced engagement metrics with verifiable functional criteria, pulled progress charts and weak-area tracking into v1 |
| 2026-10-10 | Brief revised to v3: each trainer declares a **round mode**; added the **one attempt per day** rule with an **archive**, and the determinism requirement that follows |
| 2026-10-10 | Brief revised to v4: **difficulty selection removed**, with the date assigning the band; **Memory redefined** as an endless visual tile grid; added comparison against previous attempt and all-time best |
| 2026-11-02 | v1 implemented, tested and published to Vercel. Product name confirmed as LearningHub; Memory confirmed as a set-based rather than sequence-based task |
| 2026-11-02 | Brief revised to v5 after a structural redesign. **Difficulty selection returns**, reversing v4 — but in a stronger form: rather than the date assigning one band to everyone, every trainer offers all four bands, and **each band is an independent daily puzzle with its own attempt and its own record**. Comparability is preserved within a band, while the player regains control. Trainers are now grouped into **categories**, and the catalogue grows from three trainers to six: Math holds Mental Math Sprint with algebra and trigonometry at Expert; Memory holds Pattern Memory and the new Figure Pairs; Geography splits into Flag, Outline and Capital guessers, taking the hint mechanic from Worldle. **Practice mode** is introduced as the home for all filters, keeping daily puzzles configuration-free and therefore comparable. **Memory drops difficulty bands entirely** in favour of board sizes, because a random pattern cannot meaningfully be authored as "intermediate" |

**Where the BMAD flow stands:** brief v5 is complete. The PRD is being rewritten to match, after which the implementation is rebuilt against it.
