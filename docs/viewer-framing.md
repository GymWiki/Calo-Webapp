# Detailweergave: zoom op de inhoud

De alleen-lezen viewer op de activiteitpagina (`PlattegrondViewer`) kadert niet meer op de hele zaal maar op wat er echt staat, zodat een docent in één oogopslag ziet wat de bedoeling is. Voor/na: `docs/viewer-framing/vergelijk-*.png` (links voor, rechts na; desktop en iPhone 14, drie opstellingen).

## Hoe het werkt
- **`computeFraming({ items, fields, room, aspect, mode })`** (`components/plattegrond/viewer-framing.ts`, puur, unit-getest): bounding box van alle items (voetafdruk uit de collision-vorm, met hoogte), leerlingen en afgezette velden + 20% marge (de inhoud vult ±83% van breedte of hoogte). Kleinste kader 6 × 4 m, zodat één pion niet absurd wordt uitvergroot. Lege zaal → de hele zaal. De camera kijkt naar het midden van de inhoud en blijft binnen de zaal als hij recht op een wand kijkt.
- **Orthografisch**: "zoom" = viewportbreedte / zichtbare breedte; de verhouding van het kader (breed op desktop, hoger op mobiel) bepaalt of breedte of hoogte leidend is. Knoppen voor in- en uitzoomen werken rond die stand (×0,6 – ×2,5); **Reset** keert terug naar de automatische kadrering; camerawissels animeren in 400 ms (`prefers-reduced-motion` wordt door de bestaande rig gerespecteerd).
- **3D = camera 40° boven de horizon** (polar 50°); de kijkrichting is 45° tenzij een rechtere hoek de inhoud merkbaar (≥ 8%) beter laat passen.
- **Weergave per plattegrond** (`room.view`: `auto` | `3d` | `top`, in de editor onder *Omgeving → Weergave bij de activiteit*; geen databasewijziging, het zit in de plattegrond-JSON). **Auto**: een vlakke indeling (alleen afgezette velden, of alle items ≤ 0,9 m hoog: matten, lage toestellen) staat van boven; opstellingen met netten, doelen, kasten of leerlingen staan schuin.
- **Muren**: de wanden die tussen camera en inhoud staan worden weggelaten (`wallsToHide`), de achterwanden blijven. Geen plafond.
- **Helderheid**: zachte, ronde contactschaduw onder items en leerlingen (`ContactShadows`, één gedeelde geometrie, geen extra render-pass); leerlingen in teamkleuren via de shirtkleur.
- **Container**: vaste hoogte, 320 px (mobiel) en 480 px (desktop), tegen layout shift. Veel items? Alles wordt ingekaderd.
- **Thumbnails** (bibliotheekkaarten, OG-image) gebruiken dezelfde kadrering (`FloorplanThumbnailCapture`).

## Bewust niet gebouwd
- **Labels/nummers** ("Team A", "Station 1"): er bestaat geen metadata voor in de plattegrond-data; bouwen zou die moeten uitvinden.
- **Dikkere veldlijnen en een neutralere vloer**: de lijnen en de vloer zitten in de omgeving-GLB (Blender); in de viewer is daar niets aan te veranderen zonder de GLB's aan te passen. In de scenario's zijn de lijnen goed zichtbaar, maar bij heel kleine formaten blijven ze dun.
- **Per-activiteit instellen op de activiteitpagina zelf**: de keuze staat in de plattegrond (editor), niet in een aparte kolom, om geen migratie nodig te hebben.

## Tests
`components/plattegrond/viewer-framing.test.ts` (lege zaal, één item, hoek, zeer brede en zeer hoge opstellingen, mobiel/desktop, auto-keuze, muren) en `e2e/viewer-framing.spec.ts` (drie opstellingen op desktop, iPhone 14 en Pixel 7: vulling 70–90%, vaste hoogte, Reset, `room.view`, lege zaal). Testpagina: `/e2e/viewer-framing` (`?echt=1` met echte modellen).
