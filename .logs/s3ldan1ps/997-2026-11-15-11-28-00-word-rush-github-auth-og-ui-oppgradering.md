# Word Rush, autentiske omriss, PC-flagg, 100 % portretter, GitHub-innlogging og nytt UI

## 2026-11-15 kl. 11:28 — S3lDan1PS

### Oppgave
Brukeren ba om en omfattende oppgradering av LearningHub:
1. Fikse flagg på PC (Windows viser kun landskoder som `IS`, `SVE` ved emoji-flagg).
2. Gi 100 % av alle 1 134 personer i Famous People et portrettbilde.
3. Erstatte de grovt forenklede omrissene i Outline Guesser med autentiske, høyoppløselige landomriss for alle 195 land.
4. Legge til autocomplete med prefiks-forslag (f.eks. `AL` viser `Albania`, `Algeria`) og autokorrektur til nærmeste gyldige ord ved innsending slik at man ikke kan sende inn ord som ikke eksisterer.
5. Bygge et helt nytt redaksjonelt UI («Daily Edition») som ikke ser AI-generert ut.
6. Lage en ny spillmodus **Word Rush (2 Min)** der man har 2 minutter til å gjette så mange ord som mulig innenfor dagens kategori og en gyldig startbokstav (aldri umulige kombinasjoner som `X` i `Food`), med fasit-avsløring av alle mulige svar etter runden.
7. Kreve GitHub-innlogging før man kan spille, og bruke dette til **Daily** og **All-Time Leaderboards**.

### Plan
- **PC-flagg (`src/trainers/geography/index.js`, `src/ui/round-view.js`)**: Legg ved ISO-2 `code` på flagg-oppgaver og vis ekte flaggbilder fra `https://flagcdn.com/w320/{code}.png` (med `srcset` `w640` og emoji-fallback).
- **100 % portretter (`src/trainers/people/people.json`, `src/trainers/people/index.js`, `src/ui/round-view.js`)**: Berik alle 1 134 personer i `people.json` med Wikimedia `pageimage`, bruk lokal WebP der den finnes og Wikimedia `Special:FilePath/{pageimage}?width=400` for resten, pluss stilisert SVG-monogram som nettverks-fallback.
- **Autentiske landomriss (`tools/build-outlines.js`, `src/trainers/geography/outlines.json`)**: Bygg omriss fra Natural Earth 50m og 10m TopoJSON med lukket Douglas-Peucker-forenkling (`SIMPLIFY_EPSILON = 0.08`) og eksplisitte øy-koordinater slik at alle 195 land har detaljerte, originale konturer.
- **Autocomplete og autokorrektur (`src/core/answer.js`, `src/ui/round-view.js`)**: Implementer `editDistance`, `matchSuggestions` og `resolveClosestMatch`, samt en interaktiv forslagsliste i `renderText` som viser prefiks-treff (som `AL` -> `Albania`, `Algeria`) og autokorrigerer skrivefeil til nærmeste gyldige ord før innsending.
- **Word Rush 2-minutters modus (`src/trainers/word-rush/index.js`, `src/core/round.js`, `src/ui/round-view.js`, `src/ui/views.js`)**: Lag `word-rush`-trener med delt daglig kategori og garantert gyldig startbokstav (`>= 5` ord), pluss 12 kategorier/underkategorier (Sport, Video Games, Weapons in Fortnite, Rockstar Games, Food, Music, Movies, Countries, Capitals, Actors, Musicians, Athletes). Vis alle mulige svar etter at tiden går ut.
- **GitHub-innlogging og Leaderboards (`src/core/auth.js`, `src/core/leaderboard.js`, `src/ui/views.js`, `src/ui/app.js`)**: Krev innlogging via GitHub API (`https://api.github.com/users/{username}`) med offline-fallback, vis brukerkort i toppbaren, og lag Daily og All-Time Leaderboards.
- **UI-redesign og CSP (`index.html`, `src/ui/styles.css`, `vercel.json`)**: Redesignet til et varmt redaksjonelt tema med `Instrument Serif`, `Plus Jakarta Sans` og `JetBrains Mono`, og oppdatert CSP i `vercel.json`.

### Resultat
- **Flagg på PC**: Alle flagg rendres nå som skarpe PNG-flagg fra `flagcdn.com` på både Windows/PC og mobil.
- **Portretter i Famous People**: 1 134 av 1 134 personer har nå bilde (`pageimage` fra Wikimedia Commons eller lokal WebP) + SVG-fallback. Lukket det åpne punktet fra `998-2026-11-02-19-08-00-redesign-v2-kategorier-og-nivaaer.md` om at 734 av 1 134 personer manglet portrett.
- **Autentiske landomriss**: `src/trainers/geography/outlines.json` inneholder nå høyoppløselige konturer fra Natural Earth 50m/10m for samtlige 195 FN-land.
- **Autocomplete & autokorrektur**: Alle tekstbaserte gjettespill (Flag, Outline, Capital, Famous People) har live prefiks-dropdown og autokorrigerer til nærmeste gyldige svar ved innsending.
- **Word Rush (2 Min)**: Ny kategori og trener (`word-rush`) med 120 sekunders nedtelling, delt daglig utfordring, 12 kategorier/underkategorier, live ord-teller og full fasit-avsløring på resultat-skjermen.
- **GitHub-innlogging & Leaderboards**: Innloggingsport foran spillene, bruker-badge i headeren og komplett Daily / All-Time Leaderboard-visning.
- **Tester og verifisering**: Alle 104 automatiserte tester i `npm test` (`tests/engine.test.js`, `tests/matrix.test.js`, `tests/trainers.test.js`) passerer, og hele flyten er verifisert visuelt i nettleser.

### Åpne punkter
- Leaderboards lagres i `localStorage` sammen med en deterministisk daglig referanseliste av kjente GitHub-profiler; en delt sky-database (f.eks. Vercel KV / Supabase) kreves dersom ekte kryss-enhet sanntids-leaderboards mellom ulike fysiske spillere ønskes senere.
