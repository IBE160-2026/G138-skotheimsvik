# G138 — Claudes Copilot

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

**Live:** <https://g138-skotheimsvik.vercel.app/>

## Medlemmer

- Daniel Skotheimsvik

## Prosjekt: LearningHub

**LearningHub** er en nettside der du trener hverdagsferdigheter i korte, poengdrevne runder. Alle trenerne bruker den samme kjerneløkken:

> prompt → svar → umiddelbar tilbakemelding → poeng/streak → neste

Innholdet er delt i tre nivåer: **kategori → trener → tema**.

| Kategori | Trenere |
|---|---|
| **Math** | Mental Math Sprint |
| **Memory** | Pattern Memory, Figure Pairs |
| **Geography** | Flag Guesser, Outline Guesser, Capital Guesser |
| **People** | Famous People |

### Du velger nivået selv

Hver trener tilbyr fire vanskelighetsgrader — Beginner, Intermediate, Advanced og Expert — og **hver grad er sin egen dagsoppgave** med eget forsøk og egen rekord. Du kan spille Beginner om morgenen og Expert om kvelden; det er to forskjellige oppgaver.

Innenfor én grad er oppgaven **den samme for alle i hele verden den dagen**. Det er det som gjør en poengsum verdt å ha. Oppgavene genereres deterministisk fra treneren, nivået og datoen.

Hukommelse er unntaket: et tilfeldig mønster kan ikke meningsfullt forfattes som «intermediate», så der velger du **brettstørrelse** i stedet. Hver størrelse er sin egen dagsoppgave med sin egen rekord.

Famous People er det andre unntaket: der velger du **emne** — alt, musikk, film, sport, vitenskap eller historie. Hvert emne er sin egen dagsoppgave, så å være god på musikk telles for seg.

### Rundene slutter på tre måter

| Modus | Slutter når | Brukes av |
|---|---|---|
| **Timed** | Tiden går ut | Mental Math Sprint |
| **Lives** | Du er tom for liv | Geografi-trenerne (3 liv), Famous People (3 liv), Pattern Memory (1 liv) |
| **Completion** | Brettet er tomt | Figure Pairs |

Figure Pairs scorer **feil**, ikke riktige — der er lavest best. Famous People gir deg 15 personer per dag: gjetter du feil, får du se navnet før du går videre.

### Å starte en runde forbruker forsøket

Forsøket brukes opp i det du starter, ikke når du er ferdig. Går du ut underveis, blir runden registrert med det du hadde klart så langt. Bytter du nivå midt i en runde, avsluttes den du forlot på samme måte. Det finnes ingen gratis omstart og ingen måte å kikke på dagens oppgave og trekke seg.

### Practice mode

Ved siden av dagsoppgavene ligger en **practice mode**: ubegrenset, uten poeng og fullt konfigurerbar. Det er her filtrene bor — slå av alt unntatt algebra, velg bare Afrika, velg 6×6-brett. Practice-runder vises med full statistikk, men **lagres aldri** og påvirker aldri en rekord. En konfigurerbar runde er ikke sammenlignbar med noen andres.

### Arkiv

Alle tidligere dagers oppgaver ligger i **arkivet** og teller likt med dagens. Det betyr at en sensor alltid har noe å spille, selv om dagens forsøk er brukt opp. Arkivet går tilbake til 1. oktober 2026.

### Etter runden

Du ser antall riktige, nøyaktighet, hastighet og streak — og hvordan du gjorde det mot **forrige forsøk** og **din beste noensinne** på akkurat det nivået. Din virkelige motstander er deg selv i går.

> **Merk om dagsgrensen:** den lagres i nettleseren, ikke på en server. Den kan omgås ved å tømme lagring eller bruke privat vindu, og en sideoppdatering midt i en runde unnslipper også forbruksregelen. Det er et bevisst valg i v1 — grensen skal bygge vane, ikke håndheve noe. Reell håndheving krever innlogging og server, som ligger i fase 2.

Full beskrivelse av konsept, omfang og suksesskriterier ligger i [product-brief.md](product-brief.md), og kravene i [docs/PRD.md](docs/PRD.md).

### Hvorfor vi byttet idé

Prosjektet startet som **GameHub**, en tjeneste for å oppdage spill og velge hva man skulle spille. Vi gikk bort fra den idéen 5. oktober 2026 av to grunner.

**Avhengighet av eksterne tjenester.** Alt innhold måtte hentes fra et eksternt spill-API, og flere av de planlagte funksjonene krevde ytterligere betalte eller nøkkelbeskyttede tjenester. Det bryter med prinsippet om «no strings attached» og ville gjort at sensor ikke kunne kjøre applikasjonen uten våre egne API-nøkler.

**Kjernefunksjonen lot seg ikke bygge.** GameHub skulle anbefale hva du burde spille ut fra hvor mye du hadde spilt noe og når du sist spilte det. De dataene ligger inne hos hver enkelt plattform. Å hente spilletid ut av Steam, Epic, Xbox og PlayStation ville krevd en egen integrasjon mot hver av dem — og for et spill som Minecraft, som kjører gjennom flere ulike launchere uten én autoritativ kilde for spilletid, var det i praksis umulig. Uten pålitelig spilletid ville anbefalingene blitt gjetning.

LearningHub gir like mye egen logikk å utvikle og teste — spørsmålsgeneratorer, tidtaking, poengberegning og progresjonsanalyse — med innhold vi eier selv og data applikasjonen produserer selv.

## Kjøre prosjektet

Du trenger [Node.js](https://nodejs.org/) 18 eller nyere. Ingen andre avhengigheter, ingen API-nøkler, og ingen byggesteg.

```bash
git clone https://github.com/IBE160-2026/G138-skotheimsvik.git
cd G138-skotheimsvik
npm run serve
```

Åpne så `http://localhost:8080`.

> Applikasjonen må serveres over HTTP fordi nettleseren blokkerer ES-moduler og `fetch` av innholdsfilene over `file://`. Serveren i `tools/serve.js` bruker kun Node sitt standardbibliotek.

### Kjøre testene

```bash
npm test
```

84 tester kjører med Node sin innebygde test runner (`node --test`) — ingen testrammeverk å installere. Hver test er navngitt etter kravet og brukerhistorien den verifiserer, for eksempel `each level adds exactly one tile (FR-117, S15)`. Testmatrisen i `tests/matrix.test.js` spiller alle trener- og variantkombinasjoner til en naturlig slutt.

## Publisering

Appen publiseres med **Vercel**, som er den eneste publiseringsløsningen emnet støtter. Hver endring som kommer inn i `main` publiseres automatisk, og hver pull request får sin egen forhåndsvisning.

Oppsettet ligger i [vercel.json](vercel.json):

| Innstilling | Verdi | Hvorfor |
|---|---|---|
| Framework Preset | `Other` (`framework: null`) | Dette er en ren statisk side, ikke Vite eller Next.js |
| Install Command | tom | Prosjektet har null avhengigheter — ingenting å installere |
| Build Command | tom | Ingen byggesteg; det er et krav i NFR-13 |
| Output Directory | `.` | `index.html` ligger i rota |

`vercel.json` setter også sikkerhetsheadere: `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` og `Strict-Transport-Security`.

**Ingen miljøvariabler og ingen hemmeligheter.** Appen har ingen backend, ingen API-nøkler og ingen database. Feltet *Environment Variables* i Vercel skal stå tomt.

## Repostruktur

```
index.html              Inngangsside
src/core/               Drill Engine — ren logikk, ingen DOM
  rng.js                Deterministisk tilfeldighet (mulberry32 + FNV-1a)
  clock.js              Injiserbar klokke og lokale datoer
  variants.js           Nivåer og brettstørrelser — aksen en trener deler oppgavene sine langs
  answer.js             Svarsjekking og normalisering
  scoring.js            Poeng, nøyaktighet, streaks og score-retning
  round.js              Rundeløkke med timed-, lives- og completion-modus
  progress.js           Forsøk, rekorder per nivå og sammenligning
  storage.js            localStorage med feilhåndtering
  result-codec.js       Kompakt lagringsformat for resultater
  weak-areas.js         Analyse av svake temaer
  archive.js            Arkiv over tidligere dager
  registry.js           Registreringskontrakt for kategorier og trenere
src/trainers/           En mappe per kategori
  index.js              Eneste sted som kjenner hele katalogen
  math/                 Mental Math Sprint
  memory/               Pattern Memory og Figure Pairs
  geography/            Delt innhold, geo-matematikk og de tre trenerne
  people/               Famous People og personlista
src/ui/                 DOM, visninger, rundevisning og stilark
tests/                  Testsuite
tools/build-outlines.js Forfatterverktøy: TopoJSON → SVG-omriss
tools/serve.js          Lokal statisk server
vercel.json             Publiseringsoppsett
```

Skillet mellom `src/core/` og `src/ui/` er bevisst: all logikk som er verdt å teste ligger i `core` og kan kjøres uten DOM (NFR-15). `src/core/` importerer aldri en trener — bare motsatt vei. Alle seks trenerne ble lagt til uten å endre en eneste fil i `src/core/`.

## Status

| Fase | Status |
|---|---|
| Product brief | Ferdig (v5) — [product-brief.md](product-brief.md) |
| PRD | Ferdig (v4.1) — [docs/PRD.md](docs/PRD.md) |
| Arkitektur | Avklart i koden — se §9-beslutningene nedenfor |
| Epics og stories | Definert i PRD |
| Implementasjon | v1 implementert — motor, sju trenere, arkiv, practice mode, progresjon og UI |
| Publisering | Publisert — <https://g138-skotheimsvik.vercel.app/> |

PRD-en inneholder 166 funksjonelle krav, 22 ikke-funksjonelle krav, 11 epics og 93 brukerhistorier med akseptansekriterier, samt en sporbarhetsmatrise mot de 22 suksesskriteriene i briefen.

### Arkitekturvalg (PRD §9)

| # | Spørsmål | Valg |
|---|---|---|
| 1 | Vanilla JS eller rammeverk? | Vanilla JS med ES-moduler — ingen avhengigheter |
| 2 | Testrunner? | Node sin innebygde `node --test`, kjører i Node uten DOM |
| 3 | Modulformat og bundler? | Native ES-moduler, ingen bundler, ingen byggesteg |
| 4 | Seeded PRNG? | mulberry32, seedet med FNV-1a-hash av `trenerId:nivå:dato` |
| 5 | Nivåer | Spilleren velger selv; hvert nivå er en egen dagsoppgave |
| 6 | Tidligste arkivdato | 2026-10-01 |
| 7 | Deteksjon av datoskifte | Intervall hvert 30. sekund pluss `visibilitychange` |
| 8 | Brettstørrelse i Hukommelse | Valgt av spilleren og fast gjennom runden. Starter på 2 ruter, og mønsteret kan dekke maks 67 % av brettet — tallene er hentet fra **Corsi block-tapping-testen**, som bruker ni ruter, starter på to og rapporterer et snittspenn på fem til seks |
| 9 | Grafer | Håndskrevet SVG, ingen tredjepartsbibliotek |
| 10 | Registreringskontrakt for trenere | Kategori, rundemodus, variantakse, score-retning, temaer, generator og renderer — se `src/core/registry.js` |
| 11 | Lisens for geografiinnhold og flagg | Land og hovedsteder er faktaopplysninger vi har skrevet selv. Flagg utledes fra ISO-koden som Unicode-tegn. Omriss kommer fra Natural Earth, som er public domain |
| 12 | Endelig produktnavn | **LearningHub** |

### Om kartdataene

Landomrissene i Outline Guesser er det eneste innholdet prosjektet ikke kunne forfatte selv. De er avledet fra **Natural Earth**, som er public domain, konvertert til rene SVG-baner av `tools/build-outlines.js` og committet til repoet. Verktøyet kjøres for hånd; applikasjonen leser aldri TopoJSON og gjør aldri et nettverkskall. 166 av 195 land har omriss — de 29 uten er mikrostater og småøystater som ikke finnes i datasettet, og de er med i flagg- og hovedstadstrenerne i stedet.

## KI i utviklingsprosessen

Prosjektet planlegges med BMAD-metodikken (product brief → PRD → arkitektur → epics og stories) og implementeres med KI-assistanse. Planleggingsdokumentene i `docs/` viser sporbarheten fra idé til kode, og arbeidsøktene er dokumentert i `.logs/`.
