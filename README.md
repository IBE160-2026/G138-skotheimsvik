# G138 — Claudes Copilot

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Medlemmer

- Daniel Skotheimsvik

## Prosjekt: LearningHub

**LearningHub** er en nettside der du trener hverdagsferdigheter i korte, tidsbegrensede runder — hoderegning, hukommelse og geografi i første versjon. Alle trenerne bruker den samme løkken:

> prompt → svar → umiddelbar tilbakemelding → poeng/streak → neste

Etter hver runde ser du antall riktige, nøyaktighet, hastighet og streak, og du kan følge utviklingen din over tid i progresjonsgrafer og se hvilke områder du er svakest på.

Målet er ikke høy score i appen, men at ferdighetene sitter i hverdagen: hoderegning i butikken, huske navn og koder, og vite hvor steder ligger. Noen få minutter om dagen, for hvem som helst — ikke bare for elever og studenter.

Full beskrivelse av konsept, omfang og suksesskriterier ligger i [product-brief.md](product-brief.md).

### Hvorfor vi byttet idé

Prosjektet startet som **GameHub**, en tjeneste for å oppdage spill og velge hva man skulle spille. Vi gikk bort fra den idéen 5. oktober 2026 av to grunner.

**Avhengighet av eksterne tjenester.** Alt innhold måtte hentes fra et eksternt spill-API, og flere av de planlagte funksjonene krevde ytterligere betalte eller nøkkelbeskyttede tjenester. Det bryter med prinsippet om «no strings attached» og ville gjort at sensor ikke kunne kjøre applikasjonen uten våre egne API-nøkler.

**Kjernefunksjonen lot seg ikke bygge.** GameHub skulle anbefale hva du burde spille ut fra hvor mye du hadde spilt noe og når du sist spilte det. De dataene ligger inne hos hver enkelt plattform. Å hente spilletid ut av Steam, Epic, Xbox og PlayStation ville krevd en egen integrasjon mot hver av dem — og for et spill som Minecraft, som kjører gjennom flere ulike launchere uten én autoritativ kilde for spilletid, var det i praksis umulig. Uten pålitelig spilletid ville anbefalingene blitt gjetning.

LearningHub gir like mye egen logikk å utvikle og teste — spørsmålsgeneratorer, tidtaking, poengberegning og progresjonsanalyse — med innhold vi eier selv og data applikasjonen produserer selv. Den forkastede GameHub-briefen er fjernet fra repoet. Begrunnelsen er dokumentert i §14 i produktbriefen.

## Status

| Fase | Status |
|---|---|
| Product brief | Ferdig (v2, revidert etter tilbakemelding 2026-10-06) |
| PRD | Ferdig (v1) — [docs/PRD.md](docs/PRD.md) |
| Arkitektur | Ikke startet |
| Epics og stories | Definert i PRD, klare for implementasjon |
| Implementasjon | Ikke startet |

PRD-en inneholder 80 funksjonelle krav, 15 ikke-funksjonelle krav, 9 epics og 53 brukerhistorier med akseptansekriterier, samt en sporbarhetsmatrise mot suksesskriteriene i briefen.

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
