# Fiks av Word Chain-regler, 30s-timer i Word Rush, krone-ikon og full rens av Admin/Leaderboard

## 2026-11-18 kl. 19:05 — S3lDan1PS

### Oppgave
Brukeren rapporterte fem oppfølgingspunkter som måtte fikses raskt:
1. Admin-scores telte fortsatt på leaderboardet hvis runden ble startet i Admin Mode eller gjenopptatt.
2. Brukerens egne (`S3lDan1PS`) tidligere leaderboard-stats ble synkronisert tilbake fra nettleserens `localStorage` fordi systemklokken var `2026-11-18`.
3. Sensitiv informasjon (som `name`) lå fortsatt i eldre hurtigbufrede oppføringer i nettleseren.
4. Førsteplassen (`#1`) i hvert leaderboard skulle ha et SVG-kroneikon (ikke emoji).
5. «Eric Clapton» ble avvist under musiker/musikk, Word Rush manglet 30s-timer per ord, og Word Chain skulle starte med en tilfeldig bokstav (f.eks. `J` → `J. Cole` → neste må starte på `E` som `Eric Clapton` → neste på `N` osv.).

### Plan
- Oppdatere `S3LDAN_RESET_CUTOFF_MS` til `1795026000000` (18. nov 2026), bumpe `STORAGE_KEYS.leaderboard` til `learninghub.v3.leaderboard` (og slette `learninghub.v2.leaderboard` ved oppstart) samt KV-nøkkel til `lh_v3_clean` i `api/leaderboard.js` og `src/core/leaderboard.js`, og kun hviteliste ikke-sensitive felter i `cleanEntry`.
- Låse `adminMode` på selve runde-objektet i `createRound` (`src/core/round.js` og `src/ui/app.js`) ved rundestart slik at runder startet i Admin Mode aldri kan lagres til leaderboard eller progress.
- Legge til SVG-kroneikon (`.rank-crown-icon` og `.player-crown-icon`, ikke emoji) for 1.-plass (`row.rank === 1`) i `src/ui/views.js` og `src/ui/styles.css`.
- Sette Word Rush (`src/trainers/word-rush/index.js`) til 30 sekunders timer per ord (`roundMode: 'lives'`, `noLives: true`, `promptTimeLimitSeconds: 30`) på samme måte som Word Chain.
- Flette `STATIC_MUSICIANS` inn i `music`, `STATIC_ATHLETES` inn i `sport` og `STATIC_ACTORS` inn i `movies`, forbedre `verifyWordRushCandidateOnline` med iTunes Search API + Wikipedia/Wikidata-støtte for både fornavn og etternavn, og oppdatere Word Chain (`src/trainers/word-chain/index.js`) slik at spillet starter med en tilfeldig startbokstav (f.eks. `J` → `J. Cole` → `E` → `Eric Clapton` → `N`).

### Resultat
- **Admin Mode & profil-rens**: Runder startet i Admin Mode flagges ved opprettelse (`round.isAdminMode`) og blokkeres 100 % fra leaderboardet. `learninghub.v2.leaderboard` slettes automatisk i nettleseren og cutoff for gamle `S3lDan1PS`-oppføringer dekker 18. november 2026 (`1795026000000`). Ingen `name`-felter kan overleve `cleanEntry` eller `sanitizeEntry`.
- **Kroneikon (SVG) på 1.-plass**: Alle leaderboards viser nå et gullfarget inline SVG-kroneikon ved `#1` og spillerens brukernavn.
- **Word Rush 30s-timer & musiker-søk**: Word Rush bruker nå 30 sekunder per ord (timeren nullstilles for hvert riktig ord). `Eric Clapton` ligger inne i både `musicians` og `music`, og ukjente artister/navn verifiseres live mot iTunes Search API, Wikidata og Wikipedia (med `_`-formatering).
- **Word Chain (bokstav-stafett)**: Starter nå med en tilfeldig bokstav (f.eks. `J`), der spilleren skriver f.eks. `J. Cole`, og neste svar må starte på siste bokstav (`E` → `Eric Clapton` → `N` osv.), med 30 sekunders timer per ord i stedet for liv (timeren nullstilles på hvert gyldig ord, og runden slutter når tiden går ut). Fjernet «All Categories»-alternativet slik at man alltid spiller i en fast kategori.
- **Tester**: Alle 81 tester i `npm test` passerer.

### Åpne punkter
Ingen.
