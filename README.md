# G138 — Claudes Copilot

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Medlemmer

- Daniel Skotheimsvik

## Prosjekt: LearningHub

**LearningHub** er en nettside der du trener hverdagsferdigheter i korte, poengdrevne runder — hoderegning, hukommelse og geografi i første versjon. Alle trenerne bruker den samme kjerneløkken:

> prompt → svar → umiddelbar tilbakemelding → poeng/streak → neste

Men hver trener bestemmer selv hvordan runden **slutter**:

| Trener | Slutter når | Poengsum |
|---|---|---|
| Hoderegning | Tiden går ut | Antall riktige svar |
| Geografi | Du er tom for liv (3 liv) | Antall riktige svar |
| Hukommelse | Første feil — du har ett liv | Hvilket nivå du nådde |

Hukommelse har ingen slutt. Et mønster av ruter lyser opp i et rutenett, og du skal gjenskape det. Hvert nivå legger til én rute til, og det fortsetter så lenge du klarer det. Du har ett liv, så runden ender alltid med en feil — spørsmålet er bare hvor langt du kom.

**Du velger ikke vanskelighetsgrad.** Datoen bestemmer. Noen dager er lette, noen er harde, og alle får nøyaktig den samme oppgaven. Det er det som gjør en poengsum verdt å ha. Parametere som følger av vanskelighetsgraden settes også av datoen — på en hard dag får du for eksempel mer tid i hoderegning, slik at en hard dag faktisk blir vanskeligere og ikke bare tregere.

Du får **ett forsøk per trener per dag**. Når dagens forsøk er brukt, er den treneren ferdig til i morgen. Vil du spille mer, ligger alle tidligere dagers oppgaver i **arkivet**, og de teller likt med dagens resultat. Oppgavene genereres deterministisk ut fra datoen.

Etter hver runde ser du antall riktige, nøyaktighet, hastighet og streak — og hvordan du gjorde det sammenlignet med **forrige forsøk** og **din beste noensinne**. Det er den egentlige motivasjonen: din virkelige motstander er deg selv i går. Du kan også følge utviklingen din over tid i progresjonsgrafer og se hvilke områder du er svakest på.

De tre trenerne i v1 er et **utgangspunkt**, ikke hele settet. Drill Engine er bygget slik at nye trenere og nye runde-typer kan legges til uten å skrive om motoren.

Målet er ikke høy score i appen, men at ferdighetene sitter i hverdagen: hoderegning i butikken, huske navn og koder, og vite hvor steder ligger. Noen få minutter om dagen, for hvem som helst — ikke bare for elever og studenter.

> **Merk om dagsgrensen:** den lagres i nettleseren, ikke på en server. Den kan omgås ved å tømme lagring eller bruke privat vindu. Det er et bevisst valg i v1 — grensen skal bygge vane, ikke håndheve noe. Reell håndheving krever innlogging og server, som ligger i fase 2.

Full beskrivelse av konsept, omfang og suksesskriterier ligger i [product-brief.md](product-brief.md).

### Hvorfor vi byttet idé

Prosjektet startet som **GameHub**, en tjeneste for å oppdage spill og velge hva man skulle spille. Vi gikk bort fra den idéen 5. oktober 2026 av to grunner.

**Avhengighet av eksterne tjenester.** Alt innhold måtte hentes fra et eksternt spill-API, og flere av de planlagte funksjonene krevde ytterligere betalte eller nøkkelbeskyttede tjenester. Det bryter med prinsippet om «no strings attached» og ville gjort at sensor ikke kunne kjøre applikasjonen uten våre egne API-nøkler.

**Kjernefunksjonen lot seg ikke bygge.** GameHub skulle anbefale hva du burde spille ut fra hvor mye du hadde spilt noe og når du sist spilte det. De dataene ligger inne hos hver enkelt plattform. Å hente spilletid ut av Steam, Epic, Xbox og PlayStation ville krevd en egen integrasjon mot hver av dem — og for et spill som Minecraft, som kjører gjennom flere ulike launchere uten én autoritativ kilde for spilletid, var det i praksis umulig. Uten pålitelig spilletid ville anbefalingene blitt gjetning.

LearningHub gir like mye egen logikk å utvikle og teste — spørsmålsgeneratorer, tidtaking, poengberegning og progresjonsanalyse — med innhold vi eier selv og data applikasjonen produserer selv. Den forkastede GameHub-briefen er fjernet fra repoet. Begrunnelsen er dokumentert i §14 i produktbriefen.

## Kjøre prosjektet

Du trenger [Node.js](https://nodejs.org/) 18 eller nyere. Ingen andre avhengigheter, ingen API-nøkler, og ingen byggesteg.

```bash
git clone https://github.com/IBE160-2026/G138-skotheimsvik.git
cd G138-skotheimsvik
npm run serve
```

Åpne så `http://localhost:8080`.

> Applikasjonen må serveres over HTTP fordi nettleseren blokkerer ES-moduler og `fetch` av innholdsfila over `file://`. Serveren i `tools/serve.js` bruker kun Node sitt standardbibliotek.

### Kjøre testene

```bash
npm test
```

Testene kjører med Node sin innebygde test runner (`node --test`) — ingen testrammeverk å installere.

## Publisering

**Live:** _adressen fylles inn her når Vercel-prosjektet er opprettet (`<navn>.vercel.app`)._

Appen publiseres med **Vercel**, som er den eneste publiseringsløsningen emnet støtter. Hver endring som kommer inn i `main` publiseres automatisk, og hver pull request får sin egen forhåndsvisning.

Oppsettet ligger i [vercel.json](vercel.json):

| Innstilling | Verdi | Hvorfor |
|---|---|---|
| Framework Preset | `Other` (`framework: null`) | Dette er en ren statisk side, ikke Vite eller Next.js |
| Install Command | tom | Prosjektet har null avhengigheter — ingenting å installere |
| Build Command | tom | Ingen byggesteg; det er et krav i NFR-12 |
| Output Directory | `.` | `index.html` ligger i rota |
| Root Directory | `.` | Appen ligger ikke i en undermappe |

`vercel.json` setter også sikkerhetsheadere: `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` og `Strict-Transport-Security`. CSP-en tillater kun skript fra samme opphav, og siden laster ingenting fra eksterne domener.

**Ingen miljøvariabler og ingen hemmeligheter.** Appen har ingen backend, ingen API-nøkler og ingen database. Feltet *Environment Variables* i Vercel skal stå tomt.

## Repostruktur

```
index.html              Inngangsside
src/core/               Drill Engine — ren logikk, ingen DOM
  rng.js                Deterministisk tilfeldighet (mulberry32 + FNV-1a)
  clock.js              Injiserbar klokke og lokale datoer
  difficulty.js         Vanskelighetsgrad tildelt av datoen
  answer.js             Svarsjekking og normalisering
  scoring.js            Poeng, nøyaktighet og streaks
  round.js              Rundeløkke, timed- og lives-modus
  progress.js           Forsøk, personlige rekorder og sammenligning
  storage.js            localStorage med feilhåndtering
  weak-areas.js         Analyse av svake områder
  archive.js            Arkiv over tidligere dager
  registry.js           Registreringskontrakt for trenere
src/trainers/           En mappe per trener
src/ui/                 DOM, visninger og rundevisning
tests/                  Testsuite
tools/serve.js          Lokal statisk server
vercel.json             Publiseringsoppsett for Vercel
```

Skillet mellom `src/core/` og `src/ui/` er bevisst: all logikk som er verdt å teste ligger i `core` og kan kjøres uten DOM (NFR-14).

## Status

| Fase | Status |
|---|---|
| Product brief | Ferdig (v4) — [product-brief.md](product-brief.md) |
| PRD | Ferdig (v3.2) — [docs/PRD.md](docs/PRD.md) |
| Arkitektur | Avklart i koden — se §9-beslutningene nedenfor |
| Epics og stories | Definert i PRD |
| Implementasjon | v1 implementert — motor, tre trenere, arkiv, progresjon og UI |
| Publisering | Vercel-oppsett klart — se [Publisering](#publisering) |

### Arkitekturvalg (PRD §9)

| # | Spørsmål | Valg |
|---|---|---|
| 1 | Vanilla JS eller rammeverk? | Vanilla JS med ES-moduler — ingen avhengigheter |
| 2 | Testrunner? | Node sin innebygde `node --test`, kjører i Node uten DOM |
| 3 | Modulformat og bundler? | Native ES-moduler, ingen bundler, ingen byggesteg |
| 4 | Seeded PRNG? | mulberry32, seedet med FNV-1a-hash av `trenerId:dato` |
| 5 | Fordeling av vanskelighetsgrader | 20 % beginner, 40 % intermediate, 25 % advanced, 15 % expert |
| 6 | Tidligste arkivdato | 2026-10-01 |
| 7 | Deteksjon av datoskifte | Intervall hvert 30. sekund pluss `visibilitychange` |
| 8 | Når vokser rutenettet i Hukommelse? | Når mønsteret ville fylt mer enn 40 % av rutene |
| 9 | Grafer | Håndskrevet SVG, ingen tredjepartsbibliotek |
| 10 | Registreringskontrakt for trenere | Generator, renderer, rundemodus og poengtype — se `src/core/registry.js` |
| 11 | Lisens for geografiinnhold og flagg | Innholdet er faktaopplysninger vi har skrevet selv. Flaggene er Unicode-tegn, ikke bildefiler — ingenting å lisensiere |
| 12 | Endelig produktnavn | **LearningHub** — bekreftet 2026-11-02 |


PRD-en inneholder 125 funksjonelle krav, 20 ikke-funksjonelle krav, 10 epics og 75 brukerhistorier med akseptansekriterier, samt en sporbarhetsmatrise mot de 17 suksesskriteriene i briefen.

## KI i utviklingsprosessen

Prosjektet planlegges med BMAD-metodikken (product brief → PRD → arkitektur → epics og stories) og implementeres med KI-assistanse. Planleggingsdokumentene i `docs/` viser sporbarheten fra idé til kode.
