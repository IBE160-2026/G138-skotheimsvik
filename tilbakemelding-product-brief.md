# Tilbakemelding på product brief

| | |
|---|---|
| **Gruppe** | G138 – G138-skotheimsvik |
| **Product brief** | `product-brief.md` (commit 9e2e4f2) |
| **Tilbakemelding fra** | Faglærer i IBE160 (utarbeidet med KI-støtte) |
| **Dato** | 2026-10-06 |

Repoet har flere briefer, og hver av dem har fått egen tilbakemelding: GameHub-briefen er vurdert i `.agileagentcanvas-context/discovery/tilbakemelding-product-brief.md`.

## Samlet vurdering

- **Godt utgangspunkt med justeringer.** Gruppen kan gå videre og innarbeide punktene under.

Vi har vurdert `product-brief.md` (LearningHub), som er den lesbare briefen i roten og ble oppdatert 27.09. Repoet inneholder også `.agileagentcanvas-context/discovery/product-brief.json`, som beskriver et annet prosjekt (GameHub). Se første punkt under «De viktigste endringene».

**Det som er bra:**

1. Konseptet er tydelig og godt avgrenset: én gjenbrukbar Drill Engine med samme løkke for alle trenere (prompt → svar → umiddelbar tilbakemelding → poeng/streak → neste), der hver trener bare er en spørsmålsgenerator og en liten visning. Det er en ryddig arkitekturidé som passer godt for trinnvis utvikling.
2. Teknologivalget er bevisst enkelt og kjørbart: ingen tredjeparts-API-er, ingen betalte tjenester, innhold i JSON-filer og fremgang i `localStorage` i fase 1. Faseinndelingen med tre trenere i MVP-en (Mental Math, Memory Recall, Geography) og risikotabellen om «scope creep» viser god kontroll på omfanget.

**De viktigste endringene:**

1. Rydd opp i hvilken brief som gjelder. Repoet har én brief for LearningHub (Markdown) og én for GameHub (JSON), og commit-historikken viser at filer, README og `.gitignore` er slettet og lagt til igjen samme dag. Bestem hvilket prosjekt dere går for, fjern eller marker den andre briefen som forkastet, og legg tilbake `README.md` og `.gitignore`. Skriv gjerne kort i briefen hvorfor dere byttet idé. Det er nyttig prosessdokumentasjon.
2. Suksesskriteriene bør kunne sjekkes i emnet. «Median session ≥ 3 rounds», «7-day return rate ≥ 25 %» og forbedring per bruker over to uker krever ekte brukere over tid. Legg til funksjonelle kriterier, for eksempel «en 60-sekunders runde i Mental Math viser riktig antall korrekte svar, nøyaktighet og beste resultat, og resultatet er lagret etter at siden lastes på nytt».
3. Vurder omfanget i MVP-en. Briefen anslår selv 3–5 helger for fase 1. Det kan bli for lite til å vise nok funksjonalitet og testing. Ta inn noe mer i v1, for eksempel progresjonsgrafer og sporing av svake områder («you miss fractions most»), som allerede står under Key Features.

## Vanskelighetsgrad og gjennomførbarhet

### Vurdert vanskelighetsgrad

- **Enkel**

**Sammenlignbart med:** 6) To-do-liste med smarte etiketter (enkel) når det gjelder datamodell og lagring. LearningHub har mer egen logikk (spørsmålsgeneratorer, tidtaking, poeng og vanskelighetsnivåer), men ingen KI-funksjon, innlogging eller integrasjoner i v1.

**Begrunnelse:**

| Faktor | Nivå (lav / middels / høy) | Kommentar |
|---|---|---|
| Domenelogikk – hvor mange og hvor kompliserte regler og beregninger må stemme? | Middels | Spørsmålsgeneratorer per trener og vanskelighetsnivå, tidtaking, poeng, nøyaktighet, streak og personlige rekorder. Reglene er tydelige og lette å kontrollere. |
| Datamodell – antall entiteter og relasjoner mellom dem | Lav | Trener, runde, resultat og innholdsfiler i JSON. |
| Brukere, roller og innlogging | Lav | Ingen innlogging i fase 1. Kontoer er utsatt til fase 2. |
| KI-funksjonalitet i appen, f.eks. kall til språkmodell, prompts i koden og håndtering av usikre svar | Lav | Ingen KI i appen. Det er greit. KI-bruken ligger i utviklingsprosessen. |
| Integrasjoner og eksterne tjenester, f.eks. API-er, betaling og e-post | Lav | Ingen. GitHub Pages for publisering er valgfritt. |
| Sanntid, samtidighet eller flere brukere som påvirker hverandre | Lav | Tidtaking i nettleseren, ingen flerbrukerfunksjoner. |
| Filhåndtering, f.eks. opplasting, PDF-lesing og eksport | Lav | Bare statiske JSON-filer med innhold. |
| Sikkerhet og personvern | Lav | Ingen personopplysninger i fase 1. |

**Hva vanskelighetsgraden betyr for dere:**

- _Enkel:_ Et enkelt prosjekt gir stor sjanse for å bli ferdig. Vanskelighetsgraden inngår likevel i vurderingen, så for å nå helt opp må dere vise mer i gjennomføringen. Det betyr særlig et gjennomarbeidet design, grundig testing, en tydelig dokumentert prosess og en README som virker. For LearningHub er tastaturstyrt brukergrensesnitt, mørk og lys modus og god tilgjengelighet naturlige steder å vise kvalitet.

### Gjennomførbarhet med BMAD og Claude Code

Dere skal planlegge med BMAD (product brief → PRD → arkitektur → epics og stories) og implementere med Claude Code. Vurderingen under tar hensyn til at det må være tid til hele denne flyten, og til testing, retting og README til slutt.

| Spørsmål | Vurdering (OK / risiko / stor risiko) | Kommentar |
|---|---|---|
| **Tid og omfang** – kan v1 realistisk bli ferdig og stabil i løpet av semesteret, med tid til flere iterasjoner? | OK | Fase 1 er realistisk for én person, med god tid til iterasjoner. Risikoen er heller at v1 blir for liten. |
| **BMAD-flyten** – er briefen konkret nok til at PRD, arkitektur og stories kan lages uten store hull, og blir det overkommelig mange stories? | Risiko | Innholdet er konkret, men briefen følger ikke BMAD-malen fullt ut (mangler blant annet en egen «What Makes This Different»), og det er uklart hvilken av de to briefene som gjelder. |
| **Egnet for Claude Code** – bruker løsningen en vanlig, godt dokumentert teknologistakk som Claude Code håndterer godt, eller krever den nisjeteknologi, spesialmaskinvare eller mye manuell konfigurasjon? | OK | HTML, CSS og JavaScript med `localStorage` er svært godt dokumentert. |
| **Kontroll på KI-ens arbeid** – kan gruppen selv avgjøre om koden gjør det riktige? Krever domenet kunnskap gruppen ikke har, f.eks. avanserte beregninger eller fagregler, så er det vanskelig å kvalitetssikre. | OK | Regnestykker, hukommelsessekvenser og hovedsteder er lette å kontrollere. |
| **Testbarhet** – finnes det tydelige regler og forventede resultater som tester kan skrives mot? | OK | Generatorer, poengberegning og streak egner seg godt for enhetstester. Planlegg et testrammeverk for JavaScript fra starten. |
| **Kjørbar for sensor** – kan appen kjøres lokalt etter README, uten gruppens nøkler, betalte kontoer eller egen infrastruktur? | OK | En statisk nettside uten nøkler er enkel å kjøre. Beskriv i README hvordan den startes lokalt, ikke bare lenken til GitHub Pages. |
| **Avhengigheter og kostnader** – krever løsningen betalte API-er, f.eks. språkmodeller, og finnes det en plan for kostnad, testmodus eller mock-data? | OK | Ingen betalte tjenester, i tråd med prinsippet «no strings attached». |

**Konklusjon om gjennomførbarhet:**

- **Gjennomførbart som beskrevet.**

**Forslag til justering av omfang eller vanskelighetsgrad:**

1. Utvid v1 med progresjonsgrafer over tid og sporing av svake områder for minst én trener. Det gir mer funksjonalitet å vise og interessant logikk å teste.
2. Hvis tiden tillater det, kan én trener fra fase 2 (for eksempel Spelling) tas med som et tydelig trinn 2. Det viser at Drill Engine faktisk er gjenbrukbar. Vent med kontoer og server til v1 er ferdig og testet.

## Hvorfor product brief er viktig for mappen

Product brief er utgangspunktet for PRD, arkitektur, stories og til slutt koden. Del 1 av mappen vurderes blant annet på om sensor kan følge en sporbar vei fra plan til ferdig app. Den vurderes også på om appen gjør det dere har beskrevet, om den er testet, om den er godt designet, og om den kan kjøres etter README. Et uklart, for stort eller for lite brief gjør alt dette vanskeligere senere. Det er mye enklere å rette nå enn sent i semesteret.

## 1. Gjennomgang av briefens deler

| Del av brief | Status | Kommentar |
|---|---|---|
| Executive Summary – er det klart hva appen er, og hvilket problem den løser? | Juster | Briefen har ingen egen Executive Summary, men problem og visjon gjør det klart hva appen er. Legg inn et kort sammendrag øverst. |
| The Problem – er problemet konkret, med reelle situasjoner og brukere? | OK | Tydelig: fulle kurs er for trege, og enkeltapper er fragmenterte. Sammenligningen med Monkeytype gjør idéen lett å forstå. |
| The Solution – beskriver løsningen brukeropplevelsen, ikke bare teknologi? | OK | Løkken prompt → svar → tilbakemelding → poeng → neste og «60-second round» beskriver opplevelsen godt. |
| What Makes This Different – er vurderingen ærlig og realistisk? | Endre | Mangler som egen del. Nevn konkrete eksisterende verktøy (for eksempel Monkeytype, Seterra, Lichess-oppgaver) og hva LearningHub gjør annerledes. |
| Who This Serves – er primærbrukerne tydelige, og vet vi hva de trenger? | Juster | Fem segmenter er listet. Velg én primærbruker for v1, for eksempel studenter som vil trene hoderegning og geografi, siden det er de tre første trenerne. |
| Success Criteria – kan kriteriene faktisk sjekkes eller testes? | Juster | «MVP live with 3 trainers» kan sjekkes. De øvrige krever ekte brukere over tid. Legg til funksjonelle, testbare kriterier. |
| Scope – er det klart hva som er med i første versjon, og hva som ikke er det? | OK | Faseinndelingen gjør det tydelig hva som er med i MVP-en. Vurder å ta med noe mer, som foreslått over. |
| Vision – henger visjonen sammen med resten uten å blåse opp omfanget? | OK | Ti trenere, kontoer og leaderboards er tydelig lagt i senere faser. |

## 2. Utgangspunkt for del 1 av mappen

Punktene følger kriteriene i sensorveiledningen for del 1. Vektene i parentes viser hvor mye hvert kriterium teller i del 1.

| Kriterium i del 1 | Hva briefen bør legge til rette for | Status | Kommentar |
|---|---|---|---|
| **1. Prosess og KI-styring** (30 %) | Brief som er presis nok til at PRD og stories kan bygges direkte på den, slik at krav kan spores fra brief til kode. | Endre | To konkurrerende briefer og slettede filer gjør prosessen vanskelig å følge. Bestem prosjekt, rydd, og dokumenter skiftet fra GameHub til LearningHub. |
| **2. Funksjonalitet og omfang** (20 %) | Realistisk omfang for gruppen og semesteret: en tydelig kjerneflyt som kan bli ferdig og stabil, og nok innhold til å vise reell funksjonalitet. | Juster | Realistisk og tydelig kjerneflyt, men MVP-en kan bli for liten. Utvid som foreslått over. |
| **3. Kvalitetssikring og testing** (15 %) | Suksesskriterier og funksjoner som er konkrete nok til å bli testtilfeller. | Juster | Logikken er svært testbar, men suksesskriteriene må skrives om slik at de kan bli testtilfeller. |
| **4. Design og brukeropplevelse** (10 %) | Tydelige brukere og brukssituasjoner som designet kan bygges rundt, gjerne med de viktigste skjermbildene eller flytene skissert. | OK | Tastaturstyrt, mørk/lys modus og mobilvennlig er tydelige designmål. Skisser trenervalg, rundevisning og resultatskjerm. |
| **5. Kodekvalitet og arkitektur** (10 %) | Teknologivalg som er begrunnet og ikke mer komplekse enn appen trenger. | OK | Godt begrunnet, enkelt teknologivalg, og Drill Engine gir en naturlig modulstruktur. Teknologidetaljene bør flyttes til arkitekturdokumentet. |
| **6. README og kjørbarhet** (10 %) | Løsning som andre kan kjøre lokalt uten betalte kontoer, og uten tilgang til gruppens egne tjenester og nøkler. | Juster | Appen er lett å kjøre, men `README.md` er slettet fra repoet. Legg den tilbake med beskrivelse og oppstartsinstruksjoner. |
| **7. Ryddighet i repoet** (5 %) | En plan for hvor hemmeligheter, testdata og dokumentasjon skal ligge. | Endre | `.gitignore` og README er slettet, og en forkastet brief ligger i en skjult verktøymappe. Legg tilbake `.gitignore`, og samle planleggingsdokumentene i én tydelig mappe. |

## 3. Neste steg for gruppen

1. Bestem at LearningHub (eller GameHub) er prosjektet, fjern eller merk den andre briefen som forkastet, og legg tilbake `README.md` og `.gitignore`.
2. Legg til Executive Summary og «What Makes This Different», velg én primærbruker, og skriv funksjonelle, testbare suksesskriterier.
3. Utvid MVP-en med progresjonsgrafer og sporing av svake områder, og gå videre til PRD med `bmad-prd`.

Oppdater product brief i repoet når dere har gjort endringene, slik at historikken viser hvordan planen utviklet seg. Det er en del av prosessen sensor ser etter.
