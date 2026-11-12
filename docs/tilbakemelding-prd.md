# Tilbakemelding på PRD

| | |
|---|---|
| **Gruppe** | G138 – G138-skotheimsvik |
| **PRD vurdert** | `docs/PRD.md` (status i frontmatter: «Draft v4», dokumentet har ingen YAML-frontmatter; sist endret 2026-11-02, commit 4484abf) |
| **Dato** | 2026-11-12 |
| **Type** | Formativ tilbakemelding, ikke karakter |

## 1. Samlet inntrykk

Dette er en uvanlig sterk PRD: ca. 190 nummererte FR-er, 23 NFR-er og 112 historier med Given/When/Then, alt sporet mot suksesskriteriene S1–S23. Beslutninger og avveininger er synlige (§9, endringsloggen i §10). Risikoen ligger ikke i substansen, men i vedlikeholdet: dokumentet har fulgt koden gjennom flere runder, og det har satt spor i form av duplikate ID-er, manglende historier og tall som ikke lenger stemmer. Det svekker sporbarheten, som ellers er PRD-ens største styrke.

## 2. Dette fungerer godt

- **FR-ene er skrevet som testtilfeller.** FR-75 («strictly beats the stored one in the direction declared by the trainer») og US-6.11 (best 9 feil, 7 blir ny rekord, 11 blir det ikke) viser hvordan et krav og en test peker på samme sak. Tallene i US-5.1 og US-7.9 («within 1 %», «1000 prompts per band») er målbare.
- **Beslutninger er begrunnet, ikke bare listet.** §9.1 og §10 forklarer hvorfor «starting a daily round commits the attempt» (v4.1: ellers kunne variantbytte omgås) og hvorfor poengretning ble en egen modellparameter. §9.2 skiller antakelser fra vedtak og angir kostnaden ved å snu dem.
- **Tydelig tese og ærlig om begrensninger.** Én gjenbrukbar Drill Engine, og «Build order rationale» i §6 sier hvorfor E-5 og E-6 bygges først (stresse abstraksjonen). FR-44/44a innrømmer at daglig grense lagret i nettleseren kan omgås, i stedet for å late som.

## 3. Oversikt per dimensjon

| Dimensjon | Vurdering | Kort begrunnelse |
|---|---|---|
| Beslutningsklarhet | sterk | §9.1 og §10 viser vedtak, begrunnelse og hva som ble reversert (v4.1). |
| Substans | sterk | Domenespesifikke krav (Corsi-grunnlag, haversine, Natural Earth), ingen pynte-personas eller boilerplate-NFR-er. |
| Strategisk sammenheng | god | Tesen ligger i Drill Engine-ideen og byggerekkefølgen, men PRD-en har ingen egen visjon og henviser til briefen. |
| Testbarhet | sterk | Nesten alle FR-er har verifiserbare utfall; noen få er vage (se 4.3). |
| Scope og avgrensning | god | Out-of-scope i §1 er kun en henvisning til briefen. Omfanget har vokst fra tre til sju trenere og 1134 personer. |
| Brukbarhet for neste fase | svak | Duplikate FR-ID-er, manglende E-12/US-12 og avhengighet av briefen for S-kriteriene. |
| Formtilpasning | god | Capability-spec med historier passer en enkeltbrukerapp, men er lang (ca. 11 500 ord) og blander krav med endringslogg. |

## 4. Viktigste forbedringer

### 4.1 Duplikate FR-ID-er og brutt sporbarhet for People
- **Alvorlighet:** høy
- **Hvor:** §4.18b og §4.19: «FR-156 … FR-174» (Famous People) og «FR-156 … FR-163» (tema/tilgjengelighet). §8: «S22 … US-12.1», «S23 … US-12.2»
- **Problem og hvorfor det betyr noe:** Åtte ID-er brukes to ganger. «FR-157» betyr både «exactly 15 people» og «Every screen is usable with the keyboard alone». US-10.3, US-10.4 og S10-raden i §8 peker dermed uklart. Samtidig finnes verken E-12 i §6 eller US-12.1/12.2 i §7, selv om §8 hevder at «every success criterion is covered by at least one requirement and one story». Epics og stories hentes direkte fra disse ID-ene, så feilen forplanter seg.
- **Forslag:** Gi tema/tilgjengelighet nye ID-er (FR-175–182) og oppdater US-10.3–10.8 og S10-raden. Legg til `E-12 Famous People` i §6 og skriv US-12.1 («Given en pool med 20 personer, when jeg starter en runde, then får jeg nøyaktig 15 forskjellige personer») og US-12.2 («Given et bundlet portrett, then har kredittfila fotograf, lisens og kildefil»). Kjør et script som sjekker at hver FR-ID er unik og at hver ID i §8 finnes.

### 4.2 PRD-en kan ikke leses uten briefen
- **Alvorlighet:** høy
- **Hvor:** §1 «everything listed as v1 in brief §7», FR-52 «each topic in brief §6.1», kolonnen «Traces to» (S1–S23), §8
- **Problem og hvorfor det betyr noe:** Suksesskriteriene S1–S23, topplisten i brief §6.1 og avgrensningene ligger bare i briefen. Den som lager UX, arkitektur eller tester ut fra PRD-en, må lese to dokumenter, og hvis briefen endres, brytes sporingen uten at noen merker det. Her er mange rader i §8 bare etiketter som «S9 — offline, no third-party requests».
- **Forslag:** Ta inn en kort §Success Criteria med S1–S23 (én linje hver, målbart), en tabell over de syv Mental Math-temaene per bånd (FR-104/105), og en egen §Non-Goals med punktene fra briefen («accounts, server storage, leaderboards, spaced repetition, AI features inside the app»).

### 4.3 Noen FR-er mangler tall eller definisjon
- **Alvorlighet:** medium
- **Hvor:** FR-42 «a defined earliest puzzle date», FR-119 «approaches the board's capacity», FR-137 «widely known», FR-150 «falling with distance», FR-21/NFR-1
- **Problem og hvorfor det betyr noe:** Dette er de få stedene en tester ikke vet når kravet er oppfylt. Verdiene finnes i koden eller endringsloggen (v4.3: «fill ceiling 55 % → 67 %») men ikke i kravet.
- **Forslag:** FR-119: «Pattern Memory ender når neste nivå ville kreve mer enn 67 % av cellene; på 3×3 er maks nivå derfor 6.» FR-42: «Arkivet går tilbake til 2026-10-10.» FR-150: «proximity = round(100 × (1 − d / 20 000 km)), minst 0.» FR-137: henvis til `tier`-feltet i innholdsfila med terskelverdier.

### 4.4 Utdaterte tall og begreper etter at People ble lagt til
- **Alvorlighet:** medium
- **Hvor:** §2 «Category … v1 ships Math, Memory and Geography», «Trainer … v1 ships six»; §1 «six trainers across three categories»; FR-1 «three categories»; FR-98; US-10.4/US-11.1 «six trainers»; toppen «Draft v4» mot §10 «v4.5»
- **Problem og hvorfor det betyr noe:** §3.2 viser fire kategorier og sju trenere. Glossaret skal være sannhetskilden for UX og stories, så avvik her gir motstridende tester (US-10.4 dekker ikke Famous People).
- **Forslag:** Søk og erstatt «six/three» med riktige tall, legg *Pool* inn i glossaret, la FR-98 nevne Famous People, og sett versjon og dato til samme verdi som siste linje i §10.

### 4.5 Lisens og kvalitetssikring for generert innhold
- **Alvorlighet:** medium
- **Hvor:** FR-169 «Only images that are public domain …», FR-173 «still reads as a whole sentence», v4.5 «1134 people»
- **Problem og hvorfor det betyr noe:** Clue-ene er generert fra Wikipedia-introer, og den teksten er CC BY-SA, som krever kreditering. PRD-en regulerer bare bilder. FR-173 sier ikke hvordan «reads as a whole sentence» kontrolleres, og over tusen klues kan ikke gjennomgås manuelt. Funn som «lightning-bolt pose» (Bolt) viser at kontrollen har vært manuell og tilfeldig.
- **Forslag:** Nytt krav: «Hver generert clue har en kildelenke til artikkelen, og kreditering vises på en Credits-side.» Gjør FR-173 testbar: «En automatisk test feiler hvis en clue inneholder navnet, delnavn eller fornavn i noen form, og 30 tilfeldige klues sjekkes manuelt per generering, med resultatet loggført.»

## 5. Mekaniske funn

- **ID-brudd:** FR-156–163 er brukt to ganger (se 4.1). E-12, US-12.1 og US-12.2 refereres, men finnes ikke. FR-ene med suffikser (FR-10a–e, FR-44a, FR-135a/b, FR-148a) er greie, men de bryter «contiguous».
- **Tabellfeil:** NFR-10 og NFR-11 står på samme linje (`|| NFR-11`), og v4.3 er limt på v4.2-raden i §10. Begge gir feil rendering i Markdown.
- **Glossar-avvik:** «category» fra tidligere versjoner er erstattet med «topic» (godt), men «six trainers/three categories» er utdatert. «Variant» er definert og nevner pool, men «pool» mangler som eget oppslagsord.
- **Motstrid:** NFR-8 «works fully offline» og US-11.2 «every feature works» vs. NFR-8a (portretter hentes per prompt). Gjør NFR-8 til «unntatt portretter, se NFR-8a».
- **Antakelser:** §9.2 fungerer som antakelsesliste, men er ikke merket inline og har ikke en egen åpne-spørsmål-liste. Akseptabelt for et implementert prosjekt.
- **Sensitivt:** Ingen hemmeligheter funnet. PRD-en navngir forfatter i toppen; det er greit så lenge repoet er ment å være åpent.

## 6. Før dere går videre

**Må avklares nå:**
1. Rett ID-ene (4.1) før noen lager nye epics eller stories.
2. Gjør PRD-en selvbærende (4.2) eller skriv eksplisitt at briefen er normativ for S1–S23.
3. Avklar lisens for Wikipedia-baserte klues (4.5).

**Kan vente:** definerte verdier i 4.3, rydding av tabeller og versjonslinje, en kortere endringslogg (flytt detaljene til `docs/changelog.md`).

**Oppfølging av tilbakemeldingen på briefen:** delvis. Funksjonelle, testbare suksesskriterier (S1–S23) og progresjonsgrafer med svake områder er på plass (FR-86–98), og én primærbruker er valgt. Skisser av skjermbilder og en README-plan er ikke dekket av PRD-en. Briefen ble bedt om en «What Makes This Different»-del; den finnes ikke i PRD-en.

## 7. Refleksjonsspørsmål

- Dokumentet er «reconciled with the built application» (v4.2, v3.1), og Famous People-trenerne ble lagt til etter at koden fantes. Hva ble styrt av PRD-en, og hva ble PRD-en justert etter? Hvordan sikrer dere at PRD-en forblir en spesifikasjon og ikke bare en beskrivelse av det som ble bygget?
- v4.5 sier at tusen klues er generert fra Wikidata/Wikipedia. Hvordan kontrollerte dere at KI-en og skriptet ikke lot svake eller feil klues passere, og hva ville dere endret i FR-173 for at neste person skulle kunne gjenta kontrollen?

_Vurdert mot kvalitetsrubrikken i bmad-prd. Dette er veiledning, ikke sensur._
