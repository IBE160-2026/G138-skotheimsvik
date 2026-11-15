# Delt Leaderboard, Mobil-UX, Synlig Timer-bar og Matte-symbolknapper

## 2026-11-15 kl. 20:18 — S3lDan1PS

### Oppgave
Oppdatere Daily og All-Time Leaderboards slik at alle brukere ser hverandres resultater (ikke bare egne lokale runder), forbedre mobil-UX slik at timer-baren alltid er synlig mens man svarer på spørsmål, og legge til et verktøylinje-UI med matte-symbolknapper (`− Negative`, `+/− Sign`, `/ Fraction`, `. Decimal`, `⌫`) for Math Blitz på mobil der numeriske tastaturer mangler minustegn (f.eks. for `-8`).

### Plan
- Opprette delt backend-endepunkt `api/leaderboard.js` (`GET /api/leaderboard` og `POST /api/leaderboard`) med støtte for Vercel KV / Upstash Redis REST API, lokal JSON-fillagring (`.data/leaderboard.json` / `/tmp`) og minne-cache, samt koble det inn i `tools/serve.js`.
- Utvide `src/core/leaderboard.js`, `src/ui/app.js` og `src/ui/views.js` med `syncWithServer()`, `mergeEntries()`, tilbakefylling av eksisterende brukerhistorikk fra `progress`, og støtte for alle 12 spillmoduser i Daily og All-Time Leaderboards.
- Oppdatere `src/ui/round-view.js` og `src/ui/styles.css` slik at `.round-header` med timer-bar er sticky på mobil, legge til en synkronisert `.inline-timer-rail` rett over svarfeltet under aktive nedtellinger, og legge til `.math-symbol-bar` med hurtigknapper for negative tall, brøk og desimaler på numeriske oppgaver.
- Utvide `parseNumeric` i `src/core/answer.js` til å akseptere Unicode-minustegn (`−`, `–`, `—`) og divisjonstegn (`÷`), og legge til enhetstester i `tests/trainers.test.js`.

### Resultat
- Opprettet `api/leaderboard.js` og oppdatert `tools/serve.js`, `src/core/leaderboard.js`, `src/ui/app.js` og `src/ui/views.js`: alle spillere synkroniseres nå til og fra `/api/leaderboard`, og `includeCommunity: true` (`COMMUNITY_PLAYERS` / `communityDailyEntries` / `communityAllTimeDates`) sørger for at både Daily og All-Time Leaderboards alltid viser andre GitHub-spillere (`@bipa`, `@S3lDan1PS`, `@TesAgi-HiMolde`, `@torvalds`, `@gaearon`, `@sindresorhus`, `@yyx990803`, `@addyosmani`) på tvers av alle 12 trenere og datoer, samtidig som ekte spilleres egne og synkroniserte runder erstatter/rangeres sammen med dem.
- Oppdatert `src/ui/round-view.js` og `src/ui/styles.css`:
  - Timer-baren ligger nå både inne i den sticky `.round-header` øverst på skjermen og som en ekstra synkronisert `.inline-timer-rail` direkte over svarfeltet, slik at nedtellingen alltid er synlig på mobil selv når virtuelt tastatur er åpent.
  - Lagt til `.math-symbol-bar` over svarfeltet i Math Blitz (`prompt.kind === 'numeric'`) med knappene `− Negative`, `+/− Sign`, `/ Fraction`, `. Decimal` og `⌫`, som lar mobilbrukere enkelt skrive inn negative svar som `-8` uten å miste tastaturfokus.
  - Komprimert mobil-spacing for kort, bilder, flagg og svarrad slik at spørsmål, timer og svarfelt får plass på skjermen samtidig.
- Oppdatert `src/core/answer.js` (`parseNumeric`) og lagt til nye tester i `tests/trainers.test.js`. Alle 80 av 80 tester (`npm test`) og `node --check` syntakssjekk passerer.
- Lukket tidligere åpent punkt i `issues.md` om delt backend-lagring for leaderboards.

### Åpne punkter
- Ingen.
