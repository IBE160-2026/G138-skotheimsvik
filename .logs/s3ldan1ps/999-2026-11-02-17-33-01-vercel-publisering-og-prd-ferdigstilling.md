# Vercel-publisering og ferdigstilling av PRD

## 2026-11-02 kl. 17:33 — S3lDan1PS

### Oppgave
Fullføre arbeidet fra forrige økt og få på plass to nye krav fra faglærer: publisering av nettsiden via Vercel, og installasjon av GitHub CLI. Samtidig sikre at PRD-en er ferdig til fristen torsdag 5. november 2026.

### Plan
- Kartlegge faktisk tilstand i repoet — implementasjonen viste seg å ligge ukommittert i arbeidskopien.
- Verifisere at testsuiten går grønt før noe annet gjøres.
- Lese koden for å bekrefte de faktiske arkitekturverdiene, ikke stole på README.
- Legge til `vercel.json` tilpasset en ren statisk side uten byggesteg.
- Oppdatere PRD §9 fra åpne spørsmål til dokumenterte beslutninger, slik at PRD-en er ferdig til fristen.
- Rydde README for utdaterte seksjoner og dokumentere publiseringen.

### Resultat

**Tilstand ved oppstart.** Hele v1-implementasjonen (`index.html`, `package.json`, `src/`, `tests/`, `tools/`) lå ukommittert. Testsuiten kjørte 75 av 75 grønt både før og etter endringene.

**Verifiserte arkitekturverdier** (lest direkte fra koden, ikke fra dokumentasjonen):

| Spørsmål | Verdi | Fil |
|---|---|---|
| PRNG | mulberry32 seedet med FNV-1a av `trenerId:dato` | `src/core/rng.js` |
| Fordeling av vanskelighetsgrad | 20 / 40 / 25 / 15 % | `src/core/difficulty.js` |
| Tidligste arkivdato | `2026-10-01`, 60 dager per side | `src/core/archive.js` |
| Datoskifte | `setInterval` 30 s + `visibilitychange` | `src/ui/app.js` |
| Rutenett i Hukommelse | Start 4×4, vokser ved over 40 % fyllgrad | `src/trainers/memory/index.js` |
| Flagg | Unicode regional-indicator-tegn, ingen bildefiler | `src/trainers/geography/countries.json` |

Flaggløsningen avklarer lisensspørsmålet helt: det finnes ingen tredjepartsressurser å lisensiere.

**Publisering.** La til `vercel.json`: `framework: null`, tom `installCommand` og `buildCommand`, `outputDirectory: "."`. Prosjektet har null avhengigheter og intet byggesteg (NFR-12), så både install- og byggesteget hoppes over. Satte også sikkerhetsheadere: CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` og HSTS. CSP-en tillater `'unsafe-inline'` for `style-src` fordi `src/ui/round-view.js` setter `grid-template-columns` som style-attributt på rutenettet; `script-src` er streng `'self'`. Verifiserte at siden ikke laster noe fra eksterne domener — eneste `fetch` er `countries.json` relativt til modulen.

**GitHub CLI.** Installert med `winget install --id GitHub.cli` (versjon 2.103.3) og autentisert med `gh auth login --web` som `S3lDan1PS`. Første forsøk gikk ut på tid fordi engangskoden utløp før nettleserstegget ble fullført; andre forsøk gikk gjennom. `gh` er satt opp som credential helper for git over HTTPS. Token-scopes: `gist`, `read:org`, `repo`, `workflow`. Verifisert at `gh repo view` når `IBE160-2026/G138-skotheimsvik`, og at repoet er **offentlig** — det er et krav for at hele gruppen skal kunne publisere på Vercels gratisplan.

**PRD.** Oppdatert til v3.1: §9 gjort om fra «åpne spørsmål» til dokumenterte arkitekturbeslutninger, elleve av tolv løst og implementert. §9.1 omskrevet fra «antakelser til bekreftelse» til «antakelser, nå implementert», med kostnaden ved å reversere hver enkelt. La til NFR-20 for automatisk publisering til en offentlig URL.

**README.** La til seksjonen «Publisering» med Vercel-oppsettet og en plassholder for URL-en. Fylte ut arkitekturtabellen med spørsmål 11 og 12. Fjernet to utdaterte seksjoner som sa at applikasjonen ikke var implementert ennå, og som beskrev en Python-server vi ikke bruker.

**Commits.** `8321a88` — implementasjon av v1 pluss Vercel-oppsett, rebaset på faglærers `dfb2ebb` og pushet til `origin/main`.

**Siste to beslutninger bekreftet av produkteier.** Produktnavnet er **LearningHub** — ikke lenger et arbeidsnavn. Hukommelse skal vurdere et nivå som et **sett** av ruter, ikke en sekvens: rekkefølgen du velger dem i betyr ingenting. Det var den dyreste antakelsen å reversere, og den er nå bekreftet som tiltenkt design. Følger av dette:

- Briefen: fjernet «working name» og de alternative navnene, og gjorde §13 om fra åpne beslutninger til en tabell over avklarte beslutninger.
- PRD v3.2: §9 spørsmål 12 lukket, §9.1 markerer sett-regelen som bekreftet (FR-99). Ingen åpne spørsmål gjenstår i PRD-en.
- README: navnet bekreftet i arkitekturtabellen.

Ingen kodeendringer var nødvendige — begge beslutningene bekrefter det som allerede er implementert.

**Publisert og verifisert.** Appen er live på <https://g138-skotheimsvik.vercel.app/>. Adressen er lagt inn i README. Verifisert mot den publiserte siden, ikke bare lokalt:

- `200 OK`, og alle fem sikkerhetsheadere fra `vercel.json` kommer gjennom (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
- JS, CSS og `countries.json` leveres med riktige MIME-typer — ES-modulene laster som `application/javascript`.
- Dagens vanskelighetsgrad ble tildelt automatisk til *Beginner*, og Hoderegning viste 45 sekunder, som er riktig verdi for det båndet.
- Briefingskærmen har ingen valg for vanskelighetsgrad (FR-4).
- Rutenettet i Hukommelse rendres som 4×4. CSP-en blokkerte ikke `grid-template-columns`, som settes som style-attributt — beregnet verdi ble `98px 98px 98px 98px`.
- Å avbryte en runde brukte ikke opp dagens forsøk (FR-6).

### Åpne punkter
Ingen.
