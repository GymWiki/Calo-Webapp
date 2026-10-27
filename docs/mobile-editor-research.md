# Onderzoek: 3D-plattegrondeditor op mobiel (vóór de aanpassingen)

Gemeten met Chromium device-emulatie (iPhone SE 375×667, iPhone 14 390×844, Pixel 7 412×915, iPad 820×1180 portrait, iPhone 14 landscape 844×390, iPad landscape 1180×820). Screenshots: `docs/mobile-screenshots/voor/`, ruwe meetdata: `docs/mobile-screenshots/audit-voor.json`. Emulatie dekt niet alles (zie de checklist voor echte toestellen in `docs/mobile-editor-testen.md`).

## Wat breekt nu

**Layout**
- De bovenbalk past niet op een telefoon: Terug, naamveld, Veld afzetten, Undo, Redo en Opslaan staan op één rij. Op 375 px valt "Opslaan" half buiten beeld en het naamveld is 24 px breed (onbruikbaar). Het document scrollt niet horizontaal (de balk wordt afgekapt), dus dit valt niet op in een overflow-check maar de knop is niet bereikbaar.
- Onder de breakpoint `lg` (1024 px) staan drie losse knoppen (Materiaal / Item / Omgeving) over het canvas heen, zonder safe-area. De drawers zijn een vaste Radix-sheet van 70 vh: geen halve/volle stand, niet te slepen.
- Tussen 640 en 1024 px (tablet, telefoon landscape) is er niets tablet-specifieks: dezelfde telefoonindeling.
- Vanaf 1024 px (iPad landscape 1180) staan beide zijpanelen (288 + 320 px) vast naast het canvas: het canvas krijgt maar 45% van het scherm.
- `100dvh` wordt al gebruikt (goed). Er is geen `viewport-fit=cover`, dus `env(safe-area-inset-*)` werkt niet op iOS.

**Touch-targets en tekst**
- 4–5 knoppen in beeld zijn kleiner dan 44 px (alle 36 px hoog), op iPad landscape 36. In de bibliotheek zijn 31–36 elementen kleiner dan 44 px (sportchips 26 px, weergave-knoppen 32 px, accordeonkoppen).
- Het naamveld in de bovenbalk is 14 px (`text-sm` overschrijft `text-base`): iOS Safari zoomt de pagina in bij focus.

**Bediening van het canvas**
- Elk item reageert direct op `pointerdown` met selecteren én slepen. Op touch betekent dat: een vinger op een niet-geselecteerd item verschuift het item in plaats van de camera te draaien. Dat is de belangrijkste reden dat de editor "onbetrouwbaar" aanvoelt op telefoon.
- Camera: standaard "Vrij draaien" (één vinger = draaien, twee vingers = zoomen en pannen via OrbitControls). In "Standaard" en "Bovenaanzicht" doet één vinger niets (rotatie staat uit en pannen alleen met twee vingers). Geen dubbeltik-reset en geen cameraknoppen op het canvas; de modus wisselen zit in het Omgeving-paneel.
- Bibliotheek: een tik plaatst het item al in het midden van de kamer (`findNearestFreeSpot` vanaf 0,0). Sleepen vanuit de bibliotheek bestaat niet. Het midden van de kamer is niet het midden van wat je ziet als je hebt gepand of ingezoomd.
- Selectie: geen contextbalk bij het item; roteren/dupliceren/verwijderen staan alleen in het Item-paneel (drawer of rechterpaneel). Er is geen rotatiehandvat op het canvas, geen vergrendelen, geen undo-toast bij verwijderen.
- Veld afzetten: slepen of tik-tik werkt al; handles om te vergroten bestaan. Er is geen zwevend label met afmetingen en aantal pionnen tijdens het tekenen en geen "Klaar"-knop (stoppen kan met de knop bovenin of Esc).
- Hover-afhankelijke UI: de favorietster op kaarten is onzichtbaar tot hover op desktop (op touch altijd zichtbaar gemaakt); tooltips (`title`) zijn onbruikbaar op touch.

**Prestaties** (iPhone 14-emulatie, 4× CPU-throttling, software-WebGL; zie `docs/mobile-performance.md`)
- Standaardzaal met 30 items: laden ±7 s (tot het scherm stabiel is), 3 renderframes/s tijdens het draaien, 480 draw calls per frame, JS-heap ±190 MB.
- `dpr` is vast `[1, 2]`; geen kwaliteitsinstelling, geen automatische terugschakeling.
- `frameloop="demand"` staat al aan (goed); er is geen schaduw- of postprocessing (goed).
- GLB's: geen Meshopt/Draco, textures als PNG/JPEG van 1024 px (ballen ±2 MB per model); geen opruimen van GPU-geheugen als het laatste exemplaar van een model verwijderd wordt (drei's `useGLTF`-cache houdt alles vast).

**Opslaan en herstel**
- Autosave gaat 2 s na een wijziging naar de server; er is geen lokale kladversie, geen waarschuwing bij verlaten met onopgeslagen wijzigingen en geen offline-melding met opnieuw proberen.

**iOS Safari-eigenaardigheden**
- `overscroll-none` staat op de root (pull-to-refresh uit); het canvas krijgt `touch-action: none` van OrbitControls.
- Alleen-lezen viewer op de activiteitpagina: eigen DOM-besturing, apart onderzocht in stap 5.
