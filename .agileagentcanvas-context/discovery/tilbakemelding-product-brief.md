# Tilbakemelding på product brief

| | |
|---|---|
| **Gruppe** | G138 – G138-skotheimsvik |
| **Product brief** | `.agileagentcanvas-context/discovery/product-brief.json` (commit 9e2e4f2) |
| **Tilbakemelding fra** | Faglærer i IBE160 (utarbeidet med KI-støtte) |
| **Dato** | 2026-10-06 |

## Samlet vurdering

- **Bør revideres før dere går videre.** Rett punktene markert «Endre» før dere lager PRD og arkitektur.

Denne tilbakemeldingen gjelder GameHub-briefen i `.agileagentcanvas-context/discovery/product-brief.json` (versjon 0.2, laget med verktøyet Agile Agent Canvas). Dere har allerede fått tilbakemelding på LearningHub-briefen i `product-brief.md` i roten, se `../../tilbakemelding-product-brief.md`. De to briefene beskriver to helt ulike prosjekter. GameHub er altså en alternativ idé, ikke en eldre versjon av LearningHub. Commit-historikken viser at dere slettet GameHub-mappen 27.09 med begrunnelsen «this project does not fit because of all the API usage needed». Kort etter kom den tilbake gjennom en sammenslåing (merge). Slik repoet ser ut nå, kan ikke sensor se hvilket prosjekt dere faktisk skal lage. Vurderingen under tar GameHub-idéen på alvor og vurderer den fullt ut, slik at dere har et godt grunnlag for å velge.

**Det som er bra:**

1. Problemet er godt beskrevet og lett å kjenne seg igjen i. «Beslutningslammelse» i et stort spillbibliotek og vanskeligheten med å søke etter en følelse («something relaxing I can finish in a weekend») er konkrete situasjoner. De to personasene, The Backlog Owner og The Explorer, har tydelige mål og smertepunkter.
2. Briefen er bevisst på omfang. Den har MoSCoW-prioritering, en lang og begrunnet liste over hva som er utenfor MVP-en (sosiale funksjoner, Steam-import, KI-anbefalinger og priser), og den peker selv på «scope creep from ~60 brainstormed features» som høyeste risiko. Valget av en regelbasert anbefalingsmotor i stedet for KI er klokt. Den er forklarbar og koster ingenting.

**De viktigste endringene:**

1. Velg én gjeldende brief. Repoet har nå to briefer for to forskjellige produkter. Det gjør sporbarheten fra brief til PRD, stories og kode uklar (kriterium 1), og repoet blir rotete (kriterium 7). Bestem dere for LearningHub eller GameHub. Slett den andre, eller merk den tydelig som forkastet, og skriv kort hvorfor dere byttet. Commit-meldingen dere allerede har skrevet om API-bruken, er en god start på den begrunnelsen.
2. Skriv den gjeldende briefen som Markdown etter BMAD-flyten. Denne briefen er en JSON-fil fra et annet verktøy enn BMAD. Den er vanskelig å lese for sensor, og den passer ikke inn i flyten dere skal bruke (`bmad-product-brief` → `bmad-prd` → `bmad-architecture` → `bmad-create-epics-and-stories`). Velger dere GameHub, bør innholdet skrives om til en `product-brief.md` med BMAD-malens deler. Se gjerne faglærers eksempel i https://github.com/IBE160-2026/beergame.
3. Løs avhengigheten til IGDB før dere går videre. Hele katalogen, søket og detaljsidene bygger på IGDB, og det krever utviklernøkler fra Twitch. Sensor må kunne kjøre appen etter README uten deres nøkler. Velger dere GameHub, må dere planlegge for et lokalt datasett eller mock-data som appen kan kjøre på. Dere må også gjøre MVP-en mindre (se forslagene under).

## Vanskelighetsgrad og gjennomførbarhet

### Vurdert vanskelighetsgrad

- **Middels**

**Sammenlignbart med:** 2) AI CV- og søknadsassistent (middels) når det gjelder bredde: flere sammenhengende funksjoner, innlogging og personlige data. GameHub har ingen KI i appen, men har i stedet en ekstern API-integrasjon og en egen anbefalingsmotor. Med alle tolv MVP-funksjonene og IGDB nærmer prosjektet seg «vanskelig».

**Begrunnelse:**

| Faktor | Nivå (lav / middels / høy) | Kommentar |
|---|---|---|
| Domenelogikk – hvor mange og hvor kompliserte regler og beregninger må stemme? | Middels | Anbefalingsmotoren (F7) skal vekte sjangeraffinitet fra vurderinger, utelukke eide og droppede spill og bruke svar fra spørreskjemaet. Briefen merker den selv som «complexity: high». Reglene er ikke definert ennå, så det er uklart hva som er et riktig svar. |
| Datamodell – antall entiteter og relasjoner mellom dem | Middels | Bruker, spill (ekstern ID), bibliotekoppføring med status, ønskeliste, vurdering med notater og eventuelle egne statuser. I tillegg kommer importklare felt for spilletid og hurtigbuffer (cache) for API-svar. |
| Brukere, roller og innlogging | Middels | Registrering, innlogging og sikker lagring av passord er «must-have». Det er bare én rolle, men innlogging er alltid en egen arbeidsmengde. |
| KI-funksjonalitet i appen, f.eks. kall til språkmodell, prompts i koden og håndtering av usikre svar | Lav | Ingen KI i MVP-en. KI-anbefalinger er lagt til fase 3. Det er et godt valg. |
| Integrasjoner og eksterne tjenester, f.eks. API-er, betaling og e-post | Høy | IGDB (Twitch-nøkler) med RAWG som reserve, hurtigbuffer på serveren og et abstraksjonslag for å kunne bytte leverandør. Søk, detaljsider, oppdagelsessider og filtre er avhengige av dette. |
| Sanntid, samtidighet eller flere brukere som påvirker hverandre | Lav | Ingen sanntid eller samhandling mellom brukere i MVP-en. |
| Filhåndtering, f.eks. opplasting, PDF-lesing og eksport | Lav | Ingen opplasting. Bilder og trailere hentes fra API-et. |
| Sikkerhet og personvern | Middels | Kontoer og passord krever hashing og sikker øktbehandling. API-nøkler må holdes utenfor repoet. Briefen utsetter GDPR-håndtering fordi det er en demo. Det er greit, men bør nevnes i refleksjonen. |

**Hva vanskelighetsgraden betyr for dere:**

- _Middels:_ Et godt balansert valg. Pass på at kjerneflyten blir ferdig og stabil før dere legger til mer. For GameHub betyr det at bibliotek, vurdering og «What should I play?» bør virke fullt ut på et lokalt datasett før dere bruker tid på oppdagelsessider, filtre og et ekstra lag med API-integrasjon.

### Gjennomførbarhet med BMAD og Claude Code

Dere skal planlegge med BMAD (product brief → PRD → arkitektur → epics og stories) og implementere med Claude Code. Vurderingen under tar hensyn til at det må være tid til hele denne flyten, og til testing, retting og README til slutt.

| Spørsmål | Vurdering (OK / risiko / stor risiko) | Kommentar |
|---|---|---|
| **Tid og omfang** – kan v1 realistisk bli ferdig og stabil i løpet av semesteret, med tid til flere iterasjoner? | Stor risiko | MVP-definisjonen har tolv funksjoner, blant annet konto, søk i hele katalogen, rik detaljside med skjermbilder og trailer, tre anbefalingsflyter, dashbord og et «gaming-native» brukergrensesnitt. I tillegg kommer fire «should-have». Det er mye for et semester med hele BMAD-flyten. |
| **BMAD-flyten** – er briefen konkret nok til at PRD, arkitektur og stories kan lages uten store hull, og blir det overkommelig mange stories? | Risiko | Innholdet er detaljert, og F1–F14 med avhengigheter gir et godt utgangspunkt for stories. Men briefen er JSON fra et annet verktøy, ikke en BMAD-brief i Markdown. Tre åpne spørsmål (IGDB-dekning, onboarding og priser) må avklares før arkitekturen. |
| **Egnet for Claude Code** – bruker løsningen en vanlig, godt dokumentert teknologistakk som Claude Code håndterer godt, eller krever den nisjeteknologi, spesialmaskinvare eller mye manuell konfigurasjon? | Risiko | En vanlig webstakk med backend og database passer godt, men stakken er «undecided». IGDB krever OAuth-oppsett via Twitch og spørrespråket Apicalypse. Det er mindre vanlig og krever manuell konfigurasjon. |
| **Kontroll på KI-ens arbeid** – kan gruppen selv avgjøre om koden gjør det riktige? Krever domenet kunnskap gruppen ikke har, f.eks. avanserte beregninger eller fagregler, så er det vanskelig å kvalitetssikre. | Risiko | Bibliotek, statuser og dashbord er lette å kontrollere. Om en anbefaling er «relevant», er vanskelig å avgjøre så lenge reglene ikke er skrevet ned. Definer reglene i PRD-en, for eksempel «spill med status Dropped anbefales aldri», så kan de kontrolleres. |
| **Testbarhet** – finnes det tydelige regler og forventede resultater som tester kan skrives mot? | Risiko | Statusflyt, vurdering 1–10, ønskeliste og dashbordtall er godt testbare. Anbefalingsmotoren blir testbar først når poengreglene er konkrete. Tester mot et eksternt API må bruke mock-data. |
| **Kjørbar for sensor** – kan appen kjøres lokalt etter README, uten gruppens nøkler, betalte kontoer eller egen infrastruktur? | Stor risiko | Uten IGDB-nøkler virker verken søk, detaljsider eller oppdagelse. Sensor må da lage egen Twitch-utviklerkonto. Planlegg et lokalt datasett (seed-data) med for eksempel de 50 testtitlene, slik at appen kan kjøres uten nøkler. |
| **Avhengigheter og kostnader** – krever løsningen betalte API-er, f.eks. språkmodeller, og finnes det en plan for kostnad, testmodus eller mock-data? | Risiko | IGDB og RAWG er gratis for ikke-kommersiell bruk, men krever registrering, nøkler og respekt for bruksgrenser. Briefen har hurtigbuffer og reserveleverandør, men ingen testmodus eller mock-data. |

**Konklusjon om gjennomførbarhet:**

- **Gjennomførbart med justert omfang.** Se forslagene under.

**Forslag til justering av omfang eller vanskelighetsgrad:**

1. Bygg v1 på et lokalt datasett. Lag en JSON- eller databasefil med for eksempel 100–200 spill (inkludert testlisten på 50 titler) og la all funksjonalitet virke mot den. IGDB kan legges til som et valgfritt trinn 2 bak det abstraksjonslaget briefen allerede beskriver. Da kan sensor kjøre appen uten nøkler, og testene blir stabile.
2. Kutt MVP-en til én kjerneflyt: logg inn → søk eller bla i spill → legg i bibliotek med status og vurdering → få svar på «What should I play?». Flytt «I want a new game»-spørreskjemaet, oppdagelsessider, filtre, trailere og egne statuser til senere trinn. Skriv ned poengreglene for anbefalingene i PRD-en, slik at de kan testes.

## Hvorfor product brief er viktig for mappen

Product brief er utgangspunktet for PRD, arkitektur, stories og til slutt koden. Del 1 av mappen vurderes blant annet på om sensor kan følge en sporbar vei fra plan til ferdig app. Den vurderes også på om appen gjør det dere har beskrevet, om den er testet, om den er godt designet, og om den kan kjøres etter README. Et uklart, for stort eller for lite brief gjør alt dette vanskeligere senere. Det er mye enklere å rette nå enn sent i semesteret.

## 1. Gjennomgang av briefens deler

| Del av brief | Status | Kommentar |
|---|---|---|
| Executive Summary – er det klart hva appen er, og hvilket problem den løser? | OK | `vision.statement` og taglinen «Stop deciding. Start playing.» forklarer tydelig hva GameHub er. I en Markdown-brief bør dette stå som et kort sammendrag øverst. |
| The Problem – er problemet konkret, med reelle situasjoner og brukere? | OK | Tre konkrete problemer: beslutningslammelse, vanskelig oppdagelse og spredt sporing på tvers av Steam, Epic, Xbox og PlayStation. Hvert problem har konsekvens, berørte brukere og dagens løsninger. |
| The Solution – beskriver løsningen brukeropplevelsen, ikke bare teknologi? | OK | Forsiden med valg som «I want a new game», «What should I play?» og «I'm bored» beskriver opplevelsen godt. Detaljer om IGDB og importklare felt hører hjemme i arkitekturen. |
| What Makes This Different – er vurderingen ærlig og realistisk? | Juster | God sammenligning med Steam, Backloggd og HowLongToBeat. Men påstanden om å være «the only place that knows your entire cross-platform library» holder ikke i MVP-en, siden plattformimport er utsatt og alt føres manuelt. Gjør påstanden mer realistisk for v1. |
| Who This Serves – er primærbrukerne tydelige, og vet vi hva de trenger? | OK | The Backlog Owner og The Explorer er konkrete personas med mål, behov og frustrasjoner. Velg gjerne The Backlog Owner som primærbruker for v1, siden «What should I play?» er kjerneflyten. |
| Success Criteria – kan kriteriene faktisk sjekkes eller testes? | Juster | «Any of 50 test titles can be found and viewed» kan testes. «Acceptance rate ≥ 30 %», «Library engagement ≥ 10» og «≥ 4/5 perceived quality» krever ekte testbrukere. Legg til funksjonelle kriterier, for eksempel «et spill med status Dropped blir aldri foreslått av ‘What should I play?’». |
| Scope – er det klart hva som er med i første versjon, og hva som ikke er det? | Endre | Avgrensningen er tydelig, men for stor. Tolv must-have- og should-have-funksjoner med ekstern API-integrasjon er for mye for v1. Kutt til én kjerneflyt som beskrevet over. |
| Vision – henger visjonen sammen med resten uten å blåse opp omfanget? | OK | Steam-import, sosiale funksjoner, KI og priser er lagt i fase 2 og 3, og datamodellen skal ikke blokkere dem. Det er godt gjort. |

## 2. Utgangspunkt for del 1 av mappen

Punktene følger kriteriene i sensorveiledningen for del 1. Vektene i parentes viser hvor mye hvert kriterium teller i del 1.

| Kriterium i del 1 | Hva briefen bør legge til rette for | Status | Kommentar |
|---|---|---|---|
| **1. Prosess og KI-styring** (30 %) | Brief som er presis nok til at PRD og stories kan bygges direkte på den, slik at krav kan spores fra brief til kode. | Endre | Funksjonene F1–F14 er sporbare i seg selv, men to briefer for to ulike produkter gjør det umulig å se hvilken plan koden skal spores tilbake til. Velg én, og la den gjeldende briefen være en BMAD-brief i Markdown. Dokumenter beslutningen om å bytte eller beholde idé. |
| **2. Funksjonalitet og omfang** (20 %) | Realistisk omfang for gruppen og semesteret: en tydelig kjerneflyt som kan bli ferdig og stabil, og nok innhold til å vise reell funksjonalitet. | Endre | Det er mer enn nok funksjonalitet å vise, men for mye til at alt blir ferdig og stabilt. Kutt MVP-en til kjerneflyten «What should I play?». |
| **3. Kvalitetssikring og testing** (15 %) | Suksesskriterier og funksjoner som er konkrete nok til å bli testtilfeller. | Juster | Bibliotek, statuser og vurderinger kan bli gode testtilfeller. Anbefalingsreglene må skrives ned, og ekstern data må erstattes med mock-data i testene. |
| **4. Design og brukeropplevelse** (10 %) | Tydelige brukere og brukssituasjoner som designet kan bygges rundt, gjerne med de viktigste skjermbildene eller flytene skissert. | OK | Tydelige personas og et uttalt designmål: mørkt, bildedrevet grensesnitt som «must not feel like a school CRUD project». Skisser forsiden, detaljsiden og biblioteket med `bmad-ux`. |
| **5. Kodekvalitet og arkitektur** (10 %) | Teknologivalg som er begrunnet og ikke mer komplekse enn appen trenger. | Juster | Teknologistakken er ikke bestemt. Abstraksjonslag, hurtigbuffer og to API-leverandører er mer kompleksitet enn v1 trenger. Velg en vanlig stakk og start med lokale data. |
| **6. README og kjørbarhet** (10 %) | Løsning som andre kan kjøre lokalt uten betalte kontoer, og uten tilgang til gruppens egne tjenester og nøkler. | Endre | Uten IGDB-nøkler virker ikke appen slik briefen beskriver den. Det finnes heller ingen `README.md` i repoet nå. Planlegg et lokalt datasett, slik at sensor kan kjøre appen etter README. |
| **7. Ryddighet i repoet** (5 %) | En plan for hvor hemmeligheter, testdata og dokumentasjon skal ligge. | Endre | Briefen ligger i en skjult verktøymappe sammen med en sporingslogg (`traces/session-harness.jsonl`), og `.gitignore` er slettet. API-nøkler krever en `.env` som holdes utenfor Git. Legg tilbake `.gitignore`, og samle planleggingsdokumentene i én tydelig mappe. |

## 3. Neste steg for gruppen

1. Bestem om prosjektet skal være LearningHub eller GameHub. Fjern eller merk den andre briefen som forkastet, og skriv kort hvorfor. Legg også tilbake `README.md` og `.gitignore`.
2. Velger dere GameHub: skriv briefen som Markdown med `bmad-product-brief`, kutt MVP-en til kjerneflyten «What should I play?» på et lokalt datasett, og skriv funksjonelle, testbare suksesskriterier og anbefalingsregler.
3. Gå videre til PRD med `bmad-prd` når én gjeldende brief ligger i repoet.

Oppdater product brief i repoet når dere har gjort endringene, slik at historikken viser hvordan planen utviklet seg. Det er en del av prosessen sensor ser etter.
