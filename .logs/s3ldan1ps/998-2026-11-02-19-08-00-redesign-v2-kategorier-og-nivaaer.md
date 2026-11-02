# Redesign v2 — kategorier, egne vanskelighetsgrader og practice mode

## 2026-11-02 kl. 19:08 — S3lDan1PS

### Oppgave
Bygge om hele v1 etter fem produktbeslutninger: spilleren velger selv vanskelighetsgrad (hvert nivå er sin egen dagsoppgave), trenerne grupperes i kategorier, filtre flyttes til en egen practice mode, Hukommelse bytter vanskelighetsgrad mot brettstørrelse, og Geografi splittes i flagg, omriss og hovedsteder med Worldle-aktige hint. Underveis ble det også bestemt at det å starte en runde forbruker forsøket, at alle 195 land skal med, og at Figure Pairs skal bruke emoji.

### Plan
- Brief v5 og PRD v4 først, siden PRD-en har frist torsdag 5. november.
- Hente og konvertere offentlig kartdata til SVG-omriss før resten, fordi det var den eneste eksterne avhengigheten.
- Utvide landlista til 195.
- Bygge om motoren, så de seks trenerne, så UI-et — i den rekkefølgen, siden alt avhenger av motoren.
- Ikke pushe før testene er grønne, fordi push utløser automatisk deploy til Vercel.

### Resultat

**Dokumenter.** Brief v5 og PRD v4.1: 163 funksjonelle krav, 22 ikke-funksjonelle, 11 epics, 93 brukerhistorier, 21 suksesskriterier. Den gamle «category» for svake områder er døpt om til **topic**, slik at ordet kunne brukes om Math/Memory/Geography.

**Kartdata.** `tools/build-outlines.js` konverterer Natural Earth-avledet TopoJSON til rene SVG-baner. Kjøres for hånd, sendes aldri til nettleseren. To reelle feil måtte løses: Natural Earth legger oversjøiske territorier under moderlandet (Frankrike kom med Fransk Guyana og ble et miniatyrbilde av Atlanterhavet), løst ved å gruppere ringer i landmasser og beholde den største; og sentroidene snittet hjørnepunkter i stedet for areal, noe som la USAs midtpunkt åtte grader for langt øst. 166 av 195 land har omriss — de 29 uten er mikrostater og småøystater som ikke finnes i 110m-datasettet. 92,6 kB.

**Innhold.** Alle 195 suverene stater (193 FN-medlemmer pluss Vatikanstaten og Palestina). Flagg utledes fra ISO-koden i stedet for å lagres, noe som fjernet 195 sjanser til å lime inn feil emoji.

**Motor.** `src/core/variants.js` er den nye kjernen: en trener erklærer hvilken akse den deler dagsoppgavene sine langs. De fleste bruker bånd, Hukommelse bruker brettstørrelse, og motoren behandler begge som en liste nøkler med ett forsøk og én rekord hver. Ny rundemodus `completion`, ny `scoreDirection` slik at Figure Pairs kan score feil der lavest vinner, og rekorder flyttet fra treneren til varianten.

**Trenere.** Seks stykker, alle registrert **uten å endre en eneste fil i `src/core/`** (S21). To tillegg i motoren var likevel nødvendige og er begrunnet av Figure Pairs: generatorer får nå vite hva som sist ble sendt inn, og svarsjekken fikk en `pairs`-variant der hvilke som helst to like figurer er riktig.

**UI.** Navigasjon kategori → trener → variant → briefing, fem promptrenderere, practice mode med filterpanel.

**Tre feil funnet ved å kjøre appen, ikke ved å lese koden:**
1. `chart.js` fargekodet fortsatt punkter etter vanskelighetsgrad og importerte en slettet modul.
2. `stat()` strenget verdien sin, så livhjertene ble `[object HTMLSpanElement]`.
3. Omriss-hintene dukket aldri opp — og årsaken var en designfeil: et galt svar gikk rett videre til neste land, så «du var 400 km nordøst» hjalp med ingenting. Omriss-treneren gir nå tre gjett per form, der mellomliggende gjett vurderes i visningen og aldri når motoren.

**Commits.** `cb37e18` motor, `cbec61e` trenere, `ae2820b` UI. Pushet; Vercel har deployet og den nye versjonen er verifisert live.

### Åpne punkter
- PRD §4.17 beskriver ikke at omriss-treneren gir tre gjett per form. Kravet (FR-148) bør oppdateres til å si det eksplisitt, ellers spriker dokument og kode.
- En sideoppdatering midt i en runde omgår regelen om at start forbruker forsøket. Samme klasse som den dokumenterte myke dagsgrensen, men det er ikke skrevet ned noe sted.
- README beskriver fortsatt v3.2-designet: tre trenere, datostyrt vanskelighetsgrad, ingen practice mode. Må skrives om.
- Manuell testmatrise (US-11.1) er ikke kjørt for alle seks trenere på alle varianter; bare et utvalg er spilt gjennom i nettleser.
- Tilgjengelighetsrevisjon (Lighthouse, NFR-19) er ikke kjørt på det nye UI-et.
