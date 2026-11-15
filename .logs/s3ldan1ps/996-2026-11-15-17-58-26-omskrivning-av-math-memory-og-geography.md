# Omskrivning av Math Blitz, Pattern Memory, Figure Pairs og fire geografi-moduser

## 2026-11-15 kl. 17:58 — S3lDan1PS

### Oppgave
Brukeren ba om en fullstendig omskrivning av de opprinnelige kategoriene (`Math`, `Memory` og `Geography`) slik at alle 12 spillmoduser i LearningHub er selvstendige daglige utfordringer med 1 forsøk per dag (`12 of 12 left today`):
1. **Math Blitz** (tidligere Mental Math): 1 daglig forsøk med 3 liv, 20 sekunder per spørsmål, og gradvis økende vanskelighetsgrad etter hvert som man svarer riktig (`beginner` -> `intermediate` -> `advanced` -> `expert`). Practice mode beholdes med mulighet for å velge hvilke emner man vil øve på (addisjon, subtraksjon, multiplikasjon, divisjon, heltall, potenser, røtter, algebra og trigonometri).
2. **Pattern Memory** og **Figure Pairs** (delt opp fra Memory): To separate toppnivå-spillmoduser, 1 forsøk per dag der brettstørrelsen varierer fra dag til dag, ingen tidsfrist, ingen treningsmodus, og med både **Daily** og **All-Time Leaderboards**. I Pattern Memory har man 0 feil tillatt (1 liv) og brettet skalerer videre opp når man klarer kapasiteten på dagens startbrett. I Figure Pairs er det ingen liv — runden måles på hvor få forsøk (`tries`) man bruker på å koble sammen alle figurparene.
3. **Flag Guesser**, **Country Guesser**, **Capital Guesser** og **Border Hop** (delt opp fra Geography): Fire separate toppnivå-spillmoduser med 1 forsøk per dag, varierende daglig vanskelighetsgrad (`Easy`, `Medium`, `Hard`, `Very Hard`) og ingen treningsmodus:
   - **Flag Guesser**: 1 daglig flagg og 3 liv til å gjette riktig land.
   - **Country Guesser** (tidligere Outline Guesser): 1 daglig landomriss og 6 liv med avstands- og kompass-hint etter hvert feilgjett.
   - **Capital Guesser**: 1 daglig hovedstad (med bilde av byen via Wikipedia REST API + illustrert bysilhuett-fallback). Man kan kun gjette hovedstaden (ikke landet), og hvert av de 3 feilene låser opp et nytt hint før siste gjett: 1. feil gir nærmeste/største andre by i samme land, 2. feil gir en fun fact om byen, og 3. feil avslører hvilket land hovedstaden tilhører.
   - **Border Hop**: 1 daglig landrute med 3 liv. Viser omriss av både **Starting Country** og **Destination Country** side om side, slik at spilleren bygger en sammenhengende rute av naboland fra start til mål.

### Plan
- **Math Blitz (`src/trainers/math/mental-math.js`, `src/trainers/index.js`)**: Endre tittel til `Math Blitz`, bytt fra tidsstyrt runde med 4 bånd til `variants: ['daily']`, `roundMode: 'lives'`, `modeParam: 3` og `promptTimeLimitSeconds: 20`. Skaler vanskelighetsbåndet dynamisk basert på antall riktige svar (`bandForCorrectCount`), og behold Practice mode med valgbare emnefiltre.
- **Pattern Memory og Figure Pairs (`src/trainers/memory/pattern.js`, `src/trainers/memory/pairs.js`, `src/core/leaderboard.js`, `src/ui/views.js`, `src/ui/app.js`)**: Splitt `memory`-kategorien i to selvstendige kategorier (`pattern-memory` og `figure-pairs`) med `variants: ['daily']` og `noPractice: true`. Velg daglig brettstørrelse deterministisk fra datoen (`dailyBoardSizeFor` / `dailyPairsBoardSizeFor`). Legg til støtte i `createLeaderboardStore` for `pattern-memory` (høyeste nivå) og `figure-pairs` (færrest forsøk / `lowerIsBetter`).
- **Geografi i 4 frittstående moduser (`src/trainers/geography/index.js`, `src/trainers/geography/capitals-data.js`, `src/core/round.js`, `src/ui/round-view.js`, `src/ui/views.js`)**:
  - Opprett `src/trainers/geography/capitals-data.js` med kuraterte data (`city` + `fact`) for samtlige 195 hovedsteder.
  - Bygg om `createFlagTrainer`, `createOutlineTrainer` (`Country Guesser`), `createCapitalTrainer` og `createBorderHopTrainer` til 1-oppgaves daglige utfordringer med `variants: ['daily']`, `noPractice: true`, `stayOnWrongGuess: true` og `hideExpectedOnWrong: true`.
  - Legg til `renderCapital(prompt)` i `src/ui/round-view.js` som henter bybilde fra Wikipedia REST API (`https://en.wikipedia.org/api/rest_v1/page/summary/{capital}`) og viser de 3 progressive hint-kortene etter hvert som spilleren mister liv.
  - Oppdater `renderBorderHop(prompt)` i `src/ui/round-view.js` til å tegne SVG-omriss for både startlandet og mållandet.
- **Tester (`tests/matrix.test.js`, `tests/trainers.test.js`)**: Oppdater testmatrisen og enhetstestene for alle 12 selvstendige spillmoduser.

### Resultat
- **Math Blitz**: Omskrevet i `src/trainers/math/mental-math.js` og registrert under `math`-kategorien som **Math Blitz** med 3 liv, 20-sekunders nedtelling per spørsmål, stigende vanskelighetsgrad (`0–3` riktige = `beginner`, `4–8` = `intermediate`, `9–14` = `advanced`, `15+` = `expert`) og full Practice mode med emnevelger.
- **Pattern Memory og Figure Pairs**:
  - `src/trainers/memory/pattern.js`: Selvstendig kategori (`pattern-memory`), 1 forsøk per dag, 1 liv (`0 mistakes allowed`), ingen treningsmodus, daglig varierende startbrett (`3x3`, `4x4`, `5x5`, `6x6`) som automatisk utvides til større rutenett når man passerer startbrettets kapasitet.
  - `src/trainers/memory/pairs.js`: Selvstendig kategori (`figure-pairs`), 1 forsøk per dag, `roundMode: 'completion'` uten liv der runden teller antall forsøk (`tries`) brukt for å finne alle parene på dagens brett (`4x3`, `4x4`, `6x4`, `6x6`).
  - Lagt til **Pattern Memory** (`Highest Level Today` / `All-Time Levels Cleared`) og **Figure Pairs** (`Fewest Tries Today` / `All-Time Fewest Tries`) i `src/core/leaderboard.js`, `src/ui/views.js` og `src/ui/app.js`.
- **Flag Guesser, Country Guesser, Capital Guesser og Border Hop**:
  - `src/trainers/geography/index.js` og `src/trainers/index.js`: Alle 4 er nå egne toppnivå-kategorier med 1 daglig forsøk, daglig varierende vanskelighetsgrad (`Easy`, `Medium`, `Hard`, `Very Hard`) og ingen treningsmodus.
  - `src/core/round.js` og `src/ui/round-view.js`: Støtter `prompt.stayOnWrongGuess` og `prompt.hideExpectedOnWrong` slik at enkelt-oppgave-spill blir stående på dagens flagg/land/hovedstad/rute når man gjetter feil og ikke avslører fasiten før runden er over.
  - `src/trainers/geography/capitals-data.js` + `renderCapital`: Samtlige 195 hovedsteder har nå nærmeste/største andre by i samme land (Hint 1), en egen fun fact om hovedstaden uten å røpe navnet (Hint 2), og landets navn (Hint 3), samt bybilde fra Wikipedia REST API.
  - `renderBorderHop`: Viser et dynamisk Travle-inspirert regionskart (`worldPath`, `bbox`, `mapViewBox`, `mapCountries`) der startlandet og mållandet vises i sine faktiske geografiske posisjoner og hvert gjettede land tegnes inn på kartet underveis i ruten.
- **Oppfølgingsforbedringer (samme økt)**:
  - **Favoritter og Likes/Dislikes med rene SVG-ikoner (`src/core/preferences.js`, `src/core/storage.js`, `src/ui/views.js`, `src/ui/app.js`, `src/ui/styles.css`)**: Spillere kan stjernemerke favorittmoduser slik at de festes øverst i selvvalgt rekkefølge (`↑`/`↓`), samt stemme opp/ned (maks 1 stemme per bruker per spillmodus). Alle rå emojis (`👍`/`👎`) er erstattet med skarpe vektor-SVG-ikoner (`REACTION_ICON_SVG`).
  - **Admin-tilgang for `@bipa` (`src/core/auth.js`)**: Lagt til `'bipa'` i `ADMIN_LOGINS` slik at `@bipa` får Admin ON/OFF-knappen i toppmenyen.
  - **Horisontal tidslinje med bokser over og under linjen i Timeline Sort (`src/ui/round-view.js`, `src/ui/styles.css`, `src/ui/views.js`)**: Bygget om Timeline Sort etter brukerens skisse til en horisontal tidslinjeakse (`.timeline-h-rail`) der hendelsesboksene veksler over (`is-above`) og under (`is-below`) den horisontale linjen med vertikale koblingsstreker (`.timeline-stem`) og drag-and-drop-slippfelt mellom hendelsene.
  - **Fasit-visning etter runde / tapte liv (`src/core/round.js`, `src/trainers/geography/index.js`, `src/ui/views.js`, `src/ui/styles.css`)**: Lagt til `answerReveal` i runderesultatet og `renderAnswerRevealSection` i `resultsView`, slik at man etter å ha brukt opp livene (eller fullført runden) i **Capital Guesser**, **Flag Guesser**, **Country Guesser**, **Border Hop**, **People Guesser**, **Timeline Sort**, **ConnectionGrid** og **Math Blitz** alltid får vite hva det riktige svaret var.
  - **Sekvensiell Pattern Memory (`src/trainers/memory/pattern.js`, `src/core/answer.js`, `src/ui/round-view.js`, `src/ui/styles.css`)**: Omskrevet Pattern Memory slik at hver runde legger til 1 rute i sekvensen, rutene blinker én etter én i rekkefølge (`1 → N`), og spilleren må trykke på rutene i nøyaktig samme rekkefølge og posisjon (`sequenceEquals`).
  - **Kompakt drag-and-drop og pop-in-utvidelse i Timeline Sort (`src/ui/round-view.js`, `src/ui/styles.css`)**: Når spilleren drar utsagnsboksen, krymper den til en kompakt brikke (`.timeline-drag-chip` / `.is-dragging`) som passer inn i slippfeltene (`.timeline-drop-zone`), og når den slippes på plass på tidslinjen utvider den seg litt større (`.is-just-placed` med `timelinePopIn`-animasjon) og ruller mykt i fokus.
  - **Fjerning av Progress-fanen, oppdatert header og leaderboards (`index.html`, `src/ui/app.js`, `src/ui/views.js`)**:
    - Fjernet `Progress`-knappen fra toppnavigasjonen og resultatvisningen.
    - Oppdatert undertittelen under `Daily Drills` til `<dato> — 12 daily brain challenges across geography, history, math, memory & words.` og telleren til `X out of 12 gamemodes played today`.
    - Utvidet Leaderboards til alle 7 poeng-/rekke-/forsøksbaserte moduser (`word-rush`, `word-chain`, `timeline-sort`, `mental-math`, `pattern-memory`, `figure-pairs`, `famous-people`) og utelatt de 5 enkelt-svar-puslespillene.
  - **Mobil-UI og feilretting (`src/ui/round-view.js`, `src/ui/styles.css`)**:
    - Fikset `ReferenceError: normaliseText is not defined` ved innsending i `connection-grid`, og lagt til automatisk opprydding av ventende `setTimeout`-kall (`clearPendingTimeouts`) ved rundeavslutning/omtegning.
    - Tilpasset mobilvisning (`@media (max-width: 640px)`) for horisontale leaderboard-faner (7 faner med touch-scroll) og horisontal tidslinje.
- **Verifisering**: Alle 79 tester i `npm test` (`tests/engine.test.js`, `tests/matrix.test.js`, `tests/trainers.test.js`, inkl. `node --check` på alle filer) passerer, og alle nye funksjoner er verifisert.

### Åpne punkter
Ingen.
