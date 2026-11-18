# Leaderboard-opprydding, Word Chain 30s-timer og massiv ord/fasit-utvidelse

## 2026-11-18 kl. 18:42 — S3lDan1PS

### Oppgave
Brukeren ba om fem forbedringer:
1. Fjerne alle eksisterende leaderboard-scores for egen bruker (`S3lDan1PS`), men beholde andre spillere (`SimonSkotheimsvik`).
2. Sørge for at runder spilt med Admin Mode aktivert eller i Practice Mode aldri teller mot leaderboardet.
3. Fjerne liv (3 lives) fra Word Chain og erstatte det med en 30-sekunders nedtellingstimer per ord (som nullstilles ved hvert godkjent ord, og avslutter runden når den når 0).
4. Utvide ordbibliotekene kraftig i alle kategorier (spesielt idrettsutøvere som f.eks. «Mike Tyson» på M, skuespillere og musikere), forbedre live-søk når noen skriver et nytt ord, og lagre verifiserte nye ord permanent i fasit/database for neste spillere.
5. Fjerne lagring og visning av sensitiv personinformasjon (som ekte navn `name`, `email`, `bio`) fra GitHub-innlogging og leaderboardet, slik at kun GitHub-brukernavn (`login`) og avatar brukes.

### Plan
- Rense `.data/leaderboard.json` for `S3lDan1PS`-oppføringer og fjerne `name`-feltet fra alle eksisterende oppføringer, samt legge inn historisk cutoff og ny KV-nøkkel (`lh_v2_clean`) i `api/leaderboard.js` og `src/core/leaderboard.js` slik at slettede oppføringer ikke synkroniseres tilbake fra lokal lagring eller sky-KV.
- Fjerne `name`, `email`, `bio`, `publicRepos` og `followers` i `api/github-auth.js`, sanere lagret bruker i `src/core/auth.js`, og oppdatere `src/ui/views.js` til kun å vise `@login`.
- Sperre leaderboard-registrering når `adminMode` eller `isPractice` er aktiv i både `src/ui/app.js`, `src/core/leaderboard.js` og `api/leaderboard.js`, samt fjerne automatisk tilbakefylling fra lokal progresjon.
- Oppdatere Word Chain (`src/trainers/word-chain/index.js`, `src/core/round.js`, `src/ui/round-view.js`, `src/core/variants.js`, `src/trainers/index.js`) til `noLives: true` og `promptTimeLimitSeconds: 30` uten hjerte-liv.
- Utvide `src/trainers/word-rush/index.js` med ~650+ oppføringer i `sport` (inkludert hundrevis av kjente idrettsutøvere som Mike Tyson, Muhammad Ali, Michael Jordan osv.) samt egne innebygde lister på 450–600+ navn hver for `STATIC_ATHLETES`, `STATIC_ACTORS` og `STATIC_MUSICIANS` med automatisk etternavn-støtte.
- Utvide `verifyWordRushCandidateOnline` med Wikidata Entity Search API og Wikipedia Search API i tillegg til TheMealDB, Datamuse og Wikipedia REST Summary, og koble godkjente ord til `registerLearnedWord` + `/api/leaderboard` (`.data/learned-words.json` og `localStorage`) slik at nye ord legges rett inn i fasiten.

### Resultat
- **Personvern og leaderboard-rens**: `.data/leaderboard.json` inneholder nå kun `SimonSkotheimsvik` uten `name`-felt. `api/github-auth.js`, `src/core/auth.js`, `api/leaderboard.js`, `src/core/leaderboard.js` og `src/ui/views.js` lagrer og viser kun `login` og `avatarUrl`.
- **Admin Mode & Practice Mode ekskludert**: `src/ui/app.js`, `src/core/leaderboard.js` og `api/leaderboard.js` avviser enhver runde spilt i Admin Mode eller Practice Mode.
- **Word Chain 30s-timer**: Word Chain har ikke lenger 3 liv (`noLives: true`, `promptTimeLimitSeconds: 30`). Feil ord trekker ikke liv; hvert gyldig ord tilbakestiller 30s-timeren; runden avsluttes med `time-expired` når klokken når 0.
- **Massivt ordbibliotek + live-verifisering + varig fasit**: `src/trainers/word-rush/index.js` har nå tusenvis av ord og navn på tvers av alle kategorier (bl.a. `Mike Tyson` i både `sport` og `athletes`), forbedret søkemotor mot TheMealDB, Datamuse, Wikidata og Wikipedia, og permanent lagring av nyoppdagede ord til både `localStorage`, aktiv fasit i runden (`src/core/round.js`) og `.data/learned-words.json` via `api/leaderboard.js`.
- **Tester**: Alle 80 automatiserte tester i `npm test` (`tests/engine.test.js`, `tests/matrix.test.js`, `tests/trainers.test.js`) passerer.

### Åpne punkter
Ingen.
