# GameHub — Product Brief

**Tagline:** Stop deciding. Start playing.
**Version:** 0.2 · **Status:** Draft · **Author:** Mary (Business Analyst, BMAD)

---

## 1. Vision

**Statement.** GameHub is a web platform that ends decision paralysis for gamers by unifying game discovery, a personal library and wishlist, ratings, and personalized recommendations into one modern, gaming-native experience that covers every game — not just the ones a user already owns.

**Mission.** Help gamers spend less time deciding and more time playing, by making discovering and choosing games fun instead of a chore.

### 1.1 Problem statement

Gamers face two linked problems. First, **decision paralysis**: with thousands of games available and personal libraries often numbering in the hundreds, players spend more time deciding what to play than actually playing. Second, **discovery friction**: players who want something new often don't know what to search for, and existing stores and databases present games as catalogues to be browsed rather than as choices to be guided toward. Ownership, wishlists, ratings and backlog tracking are scattered across launchers (Steam, Epic, Xbox, PlayStation) and third-party sites, so there is no single place that knows what a player owns, likes, and hasn't touched in a while.

| Problem | Impact | Affected users | Current solutions |
|---|---|---|---|
| Decision paralysis in large libraries | Lost play sessions, backlog guilt | Players with 50+ games | Launcher library views, spreadsheets, Backloggd — none recommend |
| Discovery friction — can't express "something relaxing for a weekend" as a search | Default to hype titles; fitting smaller games never found | All players, esp. non-AAA audience | Store algorithms, Reddit, YouTube — not personalized or cross-platform |
| Fragmented tracking across launchers | No single source of truth | Multi-platform players | Backloggd, HowLongToBeat, multiple launchers |

### 1.2 Proposed solution

A single web application built around **intent-driven homepage entry points** — *I want a new game*, *What should I play?*, *I'm bored*, *My games*, *My wishlist*, *Discover* — backed by a full-catalogue games database (IGDB), a platform-agnostic personal library with statuses and 1–10 ratings, and a rule-based recommendation engine that learns from ratings, statuses and stated preferences.

| Aspect | Description | Rationale |
|---|---|---|
| Intent-first homepage | Choices framed as user intent instead of a catalogue grid | Attacks decision paralysis directly; differentiates from stores and CRUD trackers |
| Whole-catalogue coverage | Search/discovery span every game via IGDB (RAWG fallback) | Users must find *any* game, incl. non-Steam titles like Minecraft |
| Platform-agnostic library | Canonical game ID; playtime/last-played fields nullable, filled only by future imports | Playtime must come from Steam/Epic/etc., never manual entry |
| Rule-based recommendations first | Transparent rules over ratings, genres, statuses, wizard answers; AI is a later upgrade | Value with no AI cost; explainable; validates data model |
| Gaming-native UI | Dark, cover-art-driven, modern interface | Must not feel like a school CRUD project |

**Unique value proposition.** GameHub is the only place that both knows your entire cross-platform library *and* covers every game ever released — and turns that into a one-click answer to "what should I play right now?".

**Differentiators**
- Intent-driven entry points instead of catalogue browsing — GameHub makes the decision for you.
- Vendor-neutral — recommendations consider games from any platform.
- Library-aware *and* catalogue-aware in one engine — "I'm bored" checks your shelf first, then the world.

---

## 2. Target users

### The Backlog Owner
A player with a large library accumulated through sales and bundles who regularly fails to pick something and ends up replaying the same comfort game or not playing at all.
- **Demographics:** 18–40, hobbyist PC/console gamer, 50–500 owned titles
- **Goals:** Confident answer to "what should I play tonight?" in under a minute (high); finish more owned games (medium)
- **Needs:** Single cross-platform view with status tracking (critical); recommendations respecting mood, time, past ratings (high)
- **Pain points:** Scrolls launcher for 20 min and closes it (high, weekly); forgets which games were started and abandoned (medium)
- **Frustrations:** Launchers offer no guidance; trackers need tedious upkeep

### The Explorer
A player who wants something new but can only describe it by feel — genre, mood, session length, budget, co-op or solo — and is tired of store algorithms pushing the same hyped titles.
- **Demographics:** 16–35, curious gamer, often indie
- **Goals:** Find a genuinely new game fitting a described mood (high); keep a wishlist (medium)
- **Needs:** Guided questionnaire → concrete suggestions (critical); rich game pages with screenshots/trailer/platforms (high)
- **Pain points:** Doesn't know what keywords to search (high); vendor-locked, hype-biased recommendations (medium)
- **Frustrations:** Shallow filters; same 20 games recommended everywhere

---

## 3. Market context

Backlog tracking and discovery are served by launcher stores, community databases and tracker sites. None combine cross-platform library awareness with guided, mood-based recommendation.

**Trends:** growing libraries via subscriptions/bundles/sales → worsening paralysis; multi-launcher PC ecosystems → vendor-locked recs less useful; AI-assisted personalization → future upgrade path.

| Competitor | Strengths | Weaknesses |
|---|---|---|
| Steam | Owns purchase/playtime data; huge user base | Steam-only; recommendations optimized for sales |
| Backloggd | Clean status tracking; social lists | No "what should I play"; fully manual |
| HowLongToBeat | Unique completion-length data | Dated UI; no personalized discovery |

GameHub positions between them as a **decision engine rather than a database**.

---

## 4. Success metrics

| Metric | Target | Timeframe | Measurement |
|---|---|---|---|
| Time to decision | < 60 s median | MVP demo | Client-side timing, homepage → recommendation accept |
| Recommendation acceptance rate | ≥ 30 % | MVP demo | Accept actions ÷ recommendations shown |
| Catalogue coverage (50-title test list incl. Minecraft, console exclusives) | ≥ 95 % | Architecture spike | Manual spike against API |
| Library engagement (games with status/rating per user) | ≥ 10 | MVP demo | DB aggregate |
| Perceived product quality ("feels like a real gaming platform") | ≥ 4/5 | MVP demo | Post-demo survey |

---

## 5. Scope (MoSCoW)

MVP focuses on the single-player decision loop: find any game, track it, rate it, and get told what to play. Social, platform imports, pricing and AI are deferred — but the data model must not block them.

### Must-have
- User account (register/login/logout, secure password storage)
- Search across the full external games catalogue
- Game details page (title, cover, description, genres, developer, publisher, release date, platforms, player modes, screenshots, trailer, aggregate rating + user's own rating/status/library/wishlist state)
- Personal library with statuses: Want to play · Playing · Completed · Dropped · On hold
- Wishlist
- Personal 1–10 integer rating (IMDb-style) with optional notes/review
- Rule-based recommendation engine (ratings, statuses, genres, wizard answers)
- **"I want a new game"** guided questionnaire (genre, single/multi, time, platform, budget, mood, liked games) → unplayed recommendations
- **"What should I play?"** library picker (rating, status, date added)
- Modern gaming-native UI with intent-driven homepage

### Should-have
- **"I'm bored"** one-click pick: library first, then catalogue
- Basic dashboard: counts by status, wishlist size, average rating, favourite genres, completion %
- Discovery pages: trending, popular, new releases, highly rated, recommended for you, random, similar games
- Filters: genre, platform, release year, multiplayer/singleplayer, rating, free/paid

### Could-have
- User-defined custom statuses
- Game of the Day

### Out of scope (MVP)
| Item | Reason |
|---|---|
| Social features (friends, compare libraries, friend recs/ratings) | Needs user base and moderation |
| Steam / Epic / Xbox / PlayStation import | OAuth/API complexity; model stays import-ready |
| Manual entry of playtime / last-played | Must come only from platform integrations |
| Price tracking, alerts, discounts, store links | IGDB has no reliable pricing |
| AI/LLM recommendations | Rule-based first; AI is an upgrade path |
| Achievements, challenges, gaming goals | Gamification on top of a stable core |
| Community reviews, ratings, lists, collections | Requires community scale |
| Hidden gems, difficulty, game-length filters | Data the API may not expose |
| Public hosting, scaling, password reset, GDPR flows | Demo for now |
| Matchmaking, release calendar, notifications, DLC tracking, game comparison | Post-MVP |

### Future considerations
| Item | Timeframe | Dependencies |
|---|---|---|
| Steam import (library, playtime, last-played) | Phase 2 | Steam Web API, IGDB `external_games` mapping |
| Epic / Xbox / PlayStation imports | Phase 2–3 | Platform APIs / OAuth |
| AI recommendations, "describe your mood" input | Phase 3 | Rating dataset, AI budget |
| Social layer | Phase 3 | Public hosting, user base |
| Price tracking & store links | Phase 3 | Pricing source (e.g. IsThereAnyDeal) |
| Achievements, challenges, goals, Game of the Day | Phase 2+ | Core library stable |
| Public hosting with full account management | On leaving demo status | Hosting budget, security review |

### MVP definition
A working web app where a user can create an account, search any game, view its details, track it in a library with status and 1–10 rating, wishlist it, and receive rule-based answers to "I want a new game" and "What should I play?", in a modern gaming-native UI with a basic statistics dashboard.

**Success criteria:** any of 50 test titles (incl. Minecraft) found and viewable · a user with 10+ rated games gets relevant, explainable recommendations · decision flows complete in < 60 s · testers describe the UI as a real gaming platform.

---

## 6. Key features

| ID | Feature | Priority | Complexity | Depends on |
|---|---|---|---|---|
| F1 | Account | Must | Low | — |
| F2 | Game search | Must | Medium | External API |
| F3 | Game details page | Must | Medium | F2 |
| F4 | Personal library & statuses | Must | Medium | F1, F3 |
| F5 | Wishlist | Must | Low | F1, F3 |
| F6 | Rating & notes (1–10) | Must | Low | F4 |
| F7 | Rule-based recommendation engine | Must | High | F4, F6 |
| F8 | "I want a new game" | Must | Medium | F7 |
| F9 | "What should I play?" | Must | Medium | F7 |
| F10 | "I'm bored" | Should | Low | F8, F9 |
| F11 | Dashboard & statistics | Should | Low | F4, F6 |
| F12 | Discovery pages & filters | Should | Medium | F2 |
| F13 | Gaming-native UI | Must | Medium | — |
| F14 | Custom statuses | Could | Low | F4 |

---

## 7. Constraints

| Constraint | Type | Impact / Mitigation |
|---|---|---|
| All game data from external API (IGDB recommended, RAWG fallback) | Technical | Bounded by API fields & rate limits → server-side cache; 50-title spike |
| Playtime/last-played never manual; populated only by future imports | Business | "What should I play?" uses rating, status, date-added as proxies |
| Rating fixed at integers 1–10 (IMDb-style) | Business | Consistent across UI and engine |
| Demo product — no hosting/scaling | Business | Skip reset/GDPR/load tests; keep auth secure so hosting isn't blocked |
| Web app, stack undecided | Technical | Decided in architecture; mainstream, minimal dependencies |
| Built with AI + BMAD; process is a deliverable | Organizational | Traceability brief → requirements → epics → stories → tests |

## 8. Assumptions

| Assumption | Risk if wrong | Validation |
|---|---|---|
| IGDB covers essentially every released game incl. Minecraft and console exclusives | Search gaps break "works with ALL games" | 50-title spike |
| Rule-based recs feel personal with ~10 rated games | Generic recs; core value unproven | Acceptance ≥ 30 % |
| Users will rate and set statuses manually | Cold-start | Onboarding asks for liked games; measure engagement |
| Canonical IDs map later to Steam/Epic/Xbox/PS IDs | Library model rework | Confirm IGDB `external_games` in spike |

## 9. Risks

| Risk | Prob. | Impact | Mitigation | Contingency |
|---|---|---|---|---|
| Scope creep from ~60 ideas | High | High | Strict MoSCoW | Cut should-haves first |
| API rate limits / downtime / missing fields | Medium | High | Caching; provider abstraction | Swap to RAWG |
| Recommendation cold-start | High | Medium | Onboarding genres + liked games; popular fallback | Show discovery pages |
| UI looks like a CRUD demo | Medium | High | UX phase first; cover-art-first layouts | Polish iteration |
| "What should I play?" weak without playtime | Medium | Medium | Rating/status/date-added proxies | Prioritize Steam import in Phase 2 |

## 10. Dependencies
- **IGDB API** (Twitch developer credentials) — metadata, media, external store IDs. *Status: to be validated.*
- **RAWG API** — fallback catalogue. *Status: fallback.*

## 11. Timeline
Phased via BMAD: brief → requirements → architecture → epics/stories → implementation → tests. No fixed dates; demo-driven.

| Phase | Objectives |
|---|---|
| 1 — MVP | Account, search, details, library, wishlist, rating; rule engine with both decision flows; dashboard; gaming-native UI |
| 2 — Integrations | Steam import (library, playtime); discovery expansion; achievements/challenges |
| 3 — Social & AI | Friends and shared libraries; AI recommendations; price tracking |

## 12. Stakeholders
- **Product owner / developer** — prioritization, AI-assisted implementation, demo (decision-maker)
- **Demo testers (gamers)** — usability and recommendation feedback (contributors)

## 13. Open questions
| Question | Owner | Status |
|---|---|---|
| Does IGDB pass the 50-title coverage spike? | Architect | Open |
| What onboarding data solves cold-start? | UX / PM | Open |
| Show price at all in MVP, given no reliable source? | Product owner | Open |

## 14. Notes & references
- Price display uncertain (IGDB lacks pricing); "free/paid" filter may need a secondary source or be dropped.
- Custom statuses deferred to keep engine status logic simple.
- Source: GameHub brain dump and follow-up decisions (IGDB, no manual playtime, 1–10 rating, demo-only).