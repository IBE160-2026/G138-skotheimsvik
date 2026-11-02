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
- Manuell testmatrise (US-11.1) er ikke kjørt for alle seks trenere på alle varianter; bare et utvalg er spilt gjennom i nettleser.
- Tilgjengelighetsrevisjon (Lighthouse, NFR-19) er ikke kjørt på det nye UI-et.

## 2026-11-02 kl. 20:05 — S3lDan1PS

### Oppgave
Rette opp dokumentasjonen som lå etter implementasjonen, og gjøre UI/UX vesentlig bedre.

### Plan
- Skrive om stilarket som én sammenhengende designsystem i stedet for lag på lag.
- Oppdatere markup der designet krevde det (målere, nivåstriper, tidslinje).
- Skrive om README for gjeldende design og tette de to PRD-hullene.

### Resultat

**Årsaken til at UI-et så flatt ut var en reell feil**: v2-tilleggene i stilarket refererte `--line` og `--muted`, som aldri har vært definert. Halvparten av den nye markupen hadde dermed ingen styling i det hele tatt.

Stilarket er skrevet helt om: fullt token-sett for begge temaer, typeskala, elevasjon, klebrig gjennomsiktig header, kort som løfter seg med aksenthairline, gradient-knapper, fremdriftsmålere på kategori- og trenerkort, nivåstriper på variantkort, tidslinje som tømmes under tidsrunder, animerte tilbakemeldingspiller, vendeanimasjon på parkort og glow på tænte ruter. All bevegelse slås av under `prefers-reduced-motion`.

**Tre feil funnet ved å teste i nettleser:**
1. Toppnavigasjonen lot deg gå ut av en pågående runde og beholde forsøket — det satte hele forbruksregelen ut av spill. Går nå gjennom samme bekreftelse og samme tap som Leave-knappen (FR-10e).
2. Parkortene gjenbrukte `.card` og arvet styling for innholdskort.
3. Et bom i Figure Pairs meldte «Wrong. undefined», fordi en partur ikke har ett fasitsvar.

Også rettet: en `stat-headline`-selektor som aldri traff, og toppnavigasjon som fløt over ved 390 px. Verifisert ingen horisontal overflyt ved 360, 390, 768 og 1280 px.

**Dokumentasjon.** README skrevet om for gjeldende design. PRD v4.2: FR-148 omskrevet til å dokumentere tre gjett per omriss, FR-10e lagt til for navigasjon, FR-44a lagt til for at en sideoppdatering midt i en runde unnslipper forbruksregelen.

**Commit.** `fa9214f`, pushet og verifisert live.

### Åpne punkter
- Pattern Memory på 3×3 gir bare 2 nivåer før mønsteret når takgrensen på 55 % fyll. Det er teknisk riktig, men tynt som spill — bør enten droppes som brettstørrelse eller starte på færre ruter. Produktbeslutning, ikke avklart.

## 2026-11-02 kl. 20:40 — S3lDan1PS

### Oppgave
Kjøre de to gjenstående verifiseringspunktene — manuell testmatrise og tilgjengelighetsrevisjon — og fjerne de dupliserte Arkiv/Progresjon-knappene fra hjemskjermen.

### Plan
- Automatisere testmatrisen i stedet for å klikke gjennom 24 kombinasjoner én gang.
- Skrive en tilgjengelighetsrevisjon i nettleseren, siden Lighthouse ikke er tilgjengelig her.
- Verifisere hvert funn før det «rettes».

### Resultat

**Navigasjon.** De dupliserte Arkiv- og Progresjon-knappene midt på hjemskjermen er fjernet; headeren har dem allerede.

**Testmatrise (US-11.1) er nå automatisert** i `tests/matrix.test.js`: alle 24 kombinasjoner av trener og variant spilles til en naturlig slutt og kontrolleres for gyldig sluttgrunn og gradert resultat. Å skrive den avdekket at hver rundemodus trenger sin egen strategi — completion-runder slutter bare ved å tømme brettet, lives-runder trenger bevisste feil, og tidsrunder trenger klokka dyttet forbi varigheten. Alle 24 passerer.

**Tilgjengelighet (NFR-19)**, revidert over 14 kombinasjoner av skjerm og tema. Reelle funn:
- Rundeskjermene hadde ingen `h1` i det hele tatt.
- Kortoverskrifter hoppet fra h1 til h3, og arkivets trenernavn fra h1 til h4.
- Sekundærtekst i lyst tema lå under AA (4,21 og 3,51 mot kravet 4,5).

**Tre funn var målefeil, ikke defekter**, og ble verifisert i stedet for blindt rettet: gradientknapper rapporterer gjennomsiktig `background-color` (reell kontrast 6,2:1), `color-mix` returnerer `color(srgb ...)` med 0–1-kanaler som leses som nær svart hvis de tolkes som 0–255, og emoji maler sine egne farger. Etter rettingene står det igjen null reelle funn; `--text-muted` i lyst tema måler 7,1:1 mot bakgrunnen, regnet for hånd.

**Commit.** `df4635b`, pushet og deployet.

### Åpne punkter
- Tilgjengelighetsrevisjonen er skrevet selv, ikke kjørt med Lighthouse. Den dækker kontrast, tilgjengelige navn, overskriftshierarki og landemerker, men ikke alt Lighthouse måler.

## 2026-11-02 kl. 21:15 — S3lDan1PS

### Oppgave
Undersøke 3×3-problemet i Pattern Memory og velge løsning, og legge til en ny trener: gjett den berømte personen, med emnevalg, 3 liv og 15 personer per dag.

### Plan
- Finne ut hva etablerte hukommelsestester faktisk gjør, i stedet for å gjette på tall.
- Legge til en tredje variantakse for emnevalg.
- Skrive innhold og tester, og oppdatere dokumentasjonen.

### Resultat

**Research avgjorde 3×3-spørsmålet.** Corsi block-tapping-testen — standardtesten for visuospatial hukommelse siden 1972 — bruker **nøyaktig ni ruter**, starter på **to**, og rapporterer et snittspenn på **fem til seks**. Et 3×3-brett er altså ikke for lite; taket på 55 % stoppet det på fire ruter, *under* der et gjennomsnittsmenneske i det hele tatt ville feile. Taket var feil, ikke brettet. Startruter 3 → 2 og tak 55 % → 67 % gir nå 3×3 fem nivåer opp til seks ruter, 4×4 ni, 5×5 femten og 6×6 tjuetre.

**Ny kategori People med treneren Famous People.** Emnet velges før start — alt, musikk, film, sport, vitenskap eller historie — og hvert emne er sin egen dagsoppgave med egen rekord. Dette krevde en tredje variantakse, `pool`. Motoren behandlet allerede en variant som en ugjennomsiktig liste nøkler, så bånd, brettstørrelser og emner fungerer likt; bare den nye typen måtte registreres. Ingen endringer i runde-, poeng- eller progresjonslogikk.

Svar skrives inn i stedet for å velges blant fire: et så spesifikt hint ville røpt seg selv, og poenget med å få se navnet etter et feil gjett er at du ikke allerede hadde det foran deg. Etternavn alene godtas, bortsett fra der navnet har et lite partikkel — «Great» er ikke et navn noen oppgir for Alexander the Great. Innholdet er 90 personer fordelt på fem emner, og et hint som inneholder sitt eget svar avvises ved innlasting.

**Sidefunn:** tekstsammenligning var aldri aksent-ufølsom, noe FR-64 har krevd hele tiden. Nå implementert, så *Pele* godtas for *Pelé*.

**Commit.** `86d1f24`, pushet og deployet. 84 tester passerer.

## 2026-11-02 kl. 21:55 — S3lDan1PS

### Oppgave
Legge til bilder i Famous People, og utvide personlista internasjonalt med blant andre Willie Nelson, Putin, Mick Jagger, Keith Richards og Slash.

### Plan
- Sjekke om det i det hele tatt er mulig å skaffe lovlig gjenbrukbare bilder før jeg lover noe.
- Utvide lista først, siden bildene følger av den.
- Bygge et forfatterverktøy etter samme mønster som kartdataene.

### Resultat

**Lista utvidet fra 90 til 134 personer**, bevisst internasjonal: Fela Kuti og Ravi Shankar ved siden av Mick Jagger, Keith Richards, Slash og Willie Nelson; Mansa Musa og Toussaint Louverture ved siden av Churchill og Lincoln; Tu Youyou og Ibn al-Haytham ved siden av Newton og Curie. Putin, Merkel og Atatürk lagt til under historie.

**133 av 134 har portrett.** `tools/build-people-images.js` henter fra Wikimedia og laster **bare ned det som lovlig kan videredistribueres**: public domain, CC0, CC BY, CC BY-SA, OGL. Ett GFDL-bilde ble utelatt, fordi den lisensen krever at hele lisensteksten følger med; den personen er hintebasert i stedet, noe treneren støtter fra design. Fotograf, lisens og kildefil lagres per bilde og vises ved siden av portrettet.

**Fire feil måtte løses, alle funnet ved å lese det faktiske svaret i stedet for å gjette:**
1. Summary-API-et legger på utm-parametere som ødelegger filnavnet.
2. `thumb.wikimedia.org` avviser forespørslene; `upload.wikimedia.org` serverer dem.
3. Bare et fast sett bredder er tillatt — 400px gir 400-feil, 250px virker.
4. For store originaler er «originalimage» selv en miniatyr, så siste ledd i stien er `3840px-Foo.jpg` og ikke filnavnet.

Verktøyet ber nå API-et generere miniatyren, noe som også håndterer TIFF→JPEG. Det venter ved rate-limiting og kan kjøres på nytt uten å laste ned det samme igjen.

**En test sikrer lisensene**: hvert portrett må være fritt lisensiert, kreditert, hentet fra Wikimedia og finnes på disk. Lisens er den delen med reelle konsekvenser i et offentlig repo.

**Commit.** `2123a7d`, pushet og deployet. 86 tester passerer.

### Åpne punkter
- Bildene er 3,9 MB og lastes per oppgave. Et portrett du ikke har sett før er ikke tilgjengelig offline; runden faller tilbake til bare hint. Dokumentert som NFR-8a.
- Tilgjengelighetsrevisjonen er egenskrevet, ikke Lighthouse, og Famous People er ikke med i den.
- Portrettene er ikke beskåret rundt ansiktet. De vises med `object-position: center top`, som stort sett treffer, men noen bilder kan bli uheldig beskåret.
