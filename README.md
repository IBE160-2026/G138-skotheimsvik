# G138 — Claudes Copilot

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder gruppens applikasjon og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Medlemmer

- Daniel Skotheimsvik

## Prosjekt: LearningHub

**LearningHub** er en nettside der du trener konkrete ferdigheter i korte, tidsbegrensede runder — hoderegning, hukommelse og geografi i første versjon. Alle trenerne bruker den samme løkken:

> prompt → svar → umiddelbar tilbakemelding → poeng/streak → neste

Etter hver runde ser du antall riktige, nøyaktighet, hastighet og streak, og du kan følge utviklingen din over tid i progresjonsgrafer og se hvilke områder du er svakest på.

Full beskrivelse av konsept, omfang og suksesskriterier ligger i [product-brief.md](product-brief.md).

### Hvorfor vi byttet idé

Prosjektet startet som **GameHub**, en tjeneste for å oppdage spill og velge hva man skulle spille. Vi gikk bort fra den idéen 5. oktober 2026 fordi alt innhold måtte hentes fra et eksternt spill-API (IGDB/RAWG). Det bryter med prinsippet om «no strings attached» og ville gjort at sensor ikke kunne kjøre applikasjonen uten våre egne API-nøkler.

LearningHub gir like mye egen logikk å utvikle og teste — spørsmålsgeneratorer, tidtaking, poengberegning og progresjonsanalyse — med innhold vi eier selv. Den forkastede GameHub-briefen er fjernet fra repoet. Begrunnelsen er dokumentert i §14 i produktbriefen.

## Status

| Fase | Status |
|---|---|
| Product brief | Ferdig (v2, revidert etter tilbakemelding 2026-10-06) |
| PRD | Ikke startet |
| Arkitektur | Ikke startet |
| Epics og stories | Ikke startet |
| Implementasjon | Ikke startet |

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
| `docs/feedback/` | Tilbakemeldinger fra faglærer |
| `docs/` | Øvrige planleggingsdokumenter: PRD, arkitektur, epics og stories (kommer) |
| `README.md` | Denne filen |

## KI i utviklingsprosessen

Prosjektet planlegges med BMAD-metodikken (product brief → PRD → arkitektur → epics og stories) og implementeres med KI-assistanse. Planleggingsdokumentene i `docs/` viser sporbarheten fra idé til kode.
