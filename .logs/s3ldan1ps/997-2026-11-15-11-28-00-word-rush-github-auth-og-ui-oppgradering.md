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
- **Autocomplete & autokorrektur (deaktivert i Word Rush)**: Tekstbaserte gjettespill (Flag, Outline, Capital, Famous People) har live prefiks-dropdown og autokorrigerer til nærmeste gyldige svar ved innsending. I **Word Rush** er ordhjelp/autocomplete og autokorrektur helt deaktivert (`suggestions` fjernet fra Word Rush-prompter og `hasSuggestions` / `resolveClosestMatch` skrudd av for `kind === 'word-rush'`), slik at man ikke får opp alle svarene ved å skrive startbokstaven og må stave ordene riktig selv.
- **Word Rush med eget logo-merke, ren tittel og forenklet forsidekort**: Endret tittel overalt til kun **Word Rush** kombinert med `wordRushLogoMark`. Fjernet den dupliserte Word Rush-banneren øverst på forsiden, og fjernet fremdriftslinje (`meter`), `X / Y open`-merke og antall mulige svar før og under runden slik at Word Rush-kortet kun viser beskrivelse og en grønn `Open Word Rush`-knapp som åpner utvalget direkte.
- **Kun ekte spillere på Leaderboards og ekte 4-stegs GitHub OAuth-innlogging**: Fjernet alle pre-seedede fiktive/refererende brukere (`RIVAL_PLAYERS`, `baselineEntriesForDate`, `baselineAllTimeEntries`) fra `src/core/leaderboard.js`. Implementerte den fulle 4-stegs GitHub OAuth-flyten (`https://github.com/login/oauth/authorize` -> `?code=<AUTH_CODE>` -> backend token-utveksling i `api/github-auth.js` mot `https://github.com/login/oauth/access_token` og henting av verifisert bruker fra `https://api.github.com/user`, samt støtte i `tools/serve.js` og `api/github-config.js`, med støtte for både `GITHUB_CLIENT_ID` og `GITHUB_CLIENT_KEY` i miljøvariabler). Ingen kan logge inn ved å bare skrive et vilkårlig brukernavn.
- **Rent UI med grønne knapper og nøytrale kort**: Fjernet AI-typiske oransje kontrast-badges, tunge skygger og overflødige merkelapper i `index.html`, `src/ui/styles.css` og `src/ui/views.js`, og innførte skogsgrønne primærknapper (`#16a34a` / `#15803d`), ren typografi (`Inter` + `JetBrains Mono`) og nøytrale kortflater.
- **Tilgjengelighetsrevisjon av Famous People og README-oppdatering**: Gjennomførte tilgjengelighetsrevisjon av Famous People (overskriftshierarki, `alt`-attributter, skjemakontroller og kontrast i mørkt/lyst tema) og hevet `--text-faint` til >= 5,9:1 kontrast (WCAG AA). Oppdaterte `README.md` med Word Rush, 195 landomriss, 100 % portrettdekning, GitHub-innlogging og Leaderboards.
- **Tester og verifisering**: Alle 104 automatiserte tester i `npm test` (`tests/engine.test.js`, `tests/matrix.test.js`, `tests/trainers.test.js`) passerer, og hele flyten er verifisert visuelt i nettleser.

### Åpne punkter
- Leaderboards lagrer kun ekte runder i nettleserens `localStorage`; en delt sky-database (f.eks. Vercel KV / Supabase) kreves dersom sanntids-leaderboards på tvers av ulike fysiske enheter ønskes senere.
