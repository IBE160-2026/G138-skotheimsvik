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

## Status

| Fase | Status |
|---|---|
| Product brief | Ferdig (v4) — [product-brief.md](product-brief.md) |
| PRD | Ferdig (v3) — [docs/PRD.md](docs/PRD.md) |
| Arkitektur | Ikke startet |
| Epics og stories | Definert i PRD, klare for implementasjon |
| Implementasjon | Ikke startet |

PRD-en inneholder 125 funksjonelle krav, 19 ikke-funksjonelle krav, 10 epics og 75 brukerhistorier med akseptansekriterier, samt en sporbarhetsmatrise mot de 17 suksesskriteriene i briefen.

## Kjøre prosjektet lokalt

Applikasjonen er ikke implementert ennå. Når koden er på plass vil den være en statisk nettside uten API-nøkler, uten betalte tjenester og uten byggesteg:

```bash
git clone https://github.com/IBE160-2026/G138-skotheimsvik.git
cd G138-skotheimsvik
```

Deretter åpner du `index.html` i nettleseren, eller starter en lokal server:

```bash
python -m http.server 8000
```

og går til <http://localhost:8000>.

Denne seksjonen oppdateres med nøyaktige instruksjoner når første versjon av applikasjonen er på plass.

## Struktur i repoet

| Sti | Innhold |
|---|---|
| `product-brief.md` | Produktbrief for LearningHub |
| `docs/PRD.md` | Kravspesifikasjon: funksjonelle og ikke-funksjonelle krav, epics og stories |
| `docs/feedback/` | Tilbakemeldinger fra faglærer |
| `docs/` | Øvrige planleggingsdokumenter: arkitektur (kommer) |
| `README.md` | Denne filen |

## KI i utviklingsprosessen

Prosjektet planlegges med BMAD-metodikken (product brief → PRD → arkitektur → epics og stories) og implementeres med KI-assistanse. Planleggingsdokumentene i `docs/` viser sporbarheten fra idé til kode.
