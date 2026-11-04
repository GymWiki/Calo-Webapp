# Editor-UI opschonen (ronde 2)

Screenshots ("na"): `docs/editor-ui-opschonen2/`. Als "voor" gelden de schermen van de opdracht.

## Dubbele functies en waar ze nu staan (desktop)
| functie | plekken vóór | plek nu |
| --- | --- | --- |
| Veld afzetten | linkerpaneel, bovenbalk, werkbalk | **werkbalk** (telefoon/tablet-portret: onderwerkbalk) |
| Touw spannen | linkerpaneel, werkbalk | **werkbalk** |
| Botsing | linkerpaneel, werkbalk, Kamer-paneel | **werkbalk** (alleen op telefoon/tablet-portret in het Kamer-paneel, daar is geen werkbalk) |
| Raster | werkbalk, Kamer-paneel | **werkbalk** (mobiel: Kamer-sheet) |
| Undo/redo | bovenbalk (+ sneltoets) | bovenbalk (+ sneltoets) |
| JSON, Mijn plattegronden, Opslaan | bovenbalk | bovenbalk (Opslaan primair; de rest secundair) |
| Camera herstellen | werkbalk (+ dubbelklik) | werkbalk (+ dubbelklik) |
| Selecteren | werkbalk (+ Esc) | werkbalk (+ Esc) |
Alle werkbalkknoppen roepen dezelfde handlers aan als de verwijderde knoppen (`startDrawing`/`stopDrawing`, `startRopeMode`/`stopRopeMode`, `setCollisionOn`, `setSnapGrid`); er is geen aparte logica verdwenen. De Botsing-uitleg (Alt tijdens slepen) staat in de tooltip van het schildicoon.

## Werkbalk
Vast onderaan het canvasgebied over de volle breedte (56 px, `border-t`, lichte schaduw), **onder** het canvas (het canvas eindigt erboven, de zaal verdwijnt er nooit achter); boven of verborgen blijft instelbaar. Drie groepen: links Selecteren, Veld, Touw; midden Raster (met stapmenu) en Botsing; rechts Verbergen, Boven/onder, Herstellen en Camera herstellen. Labels bij ≥ 1100 px werkbalkbreedte (CSS container query), anders alleen icoon met tooltip; onder 640 px gaan de drie werkbalkinstellingen naar een "Meer"-menu. Oranje alleen voor het actieve gereedschap; Raster/Botsing "aan" = lichte oranje rand en stip, "uit" = gedimd.

## Rastermenu
Segmentknoppen "Uit | 0,1 m | 0,5 m" op één regel (`white-space: nowrap`, niet-brekende spatie), actieve stap gemarkeerd, pijltjes kiezen, Esc, klik buiten of kiezen sluit. De stappen die bestaan zijn 0, 0,1 en 0,5 m; "1 m" bestaat niet in `SnapGridSize` en is niet toegevoegd.

## Overige verbeteringen (1–10)
1. **Kleur en status:** gedaan (zie Werkbalk), tooltips "Raster: aan (0,1 m)", "Botsing: waarschuwen/negeren".
2. **Filterchips:** gedaan (`SportFilter`): geen scrollbalk, zachte fade alleen aan de kant waar meer chips zijn, wiel scrolt horizontaal, touch scrolt gewoon. Slepen met de muis: niet gebouwd. Let op: dit component wordt ook op de bibliotheekpagina gebruikt.
3. **Accordeons rechterpaneel:** gedaan (`PanelSection`): Weergave bij de activiteit, Kijkrichting, Omgeving (open), Indeling (open), Muren, Vaste onderdelen, Afmetingen (lege ruimte, open); staat onthouden (`gymwiki.editor.ui`); tabs blijven vast, alleen de inhoud scrolt; muren-diagram kleiner (max 11 rem); uitleg in een info-tooltip. Andere omgevingen (sportveld, zwembad, …) houden hun bestaande paneel zonder accordeons.
4. **Tabgedrag:** gedaan: zonder zelf gekozen tab volgt het paneel de selectie (Item bij selectie, anders Omgeving). Naam en afmetingen in de kop van Item: **niet gedaan**.
5. **Bovenbalk:** deels: Opslaan is de enige primaire knop, JSON en Mijn plattegronden zijn secundair (ghost), undo/redo 44 px met tooltip en sneltoets; het statuslabel stond er al. JSON naar een "Meer"-menu: niet gedaan.
6. **Site-zijbalk:** gedaan voor de editorroute: smalle iconenbalk (56 px, tooltips) vanaf `md`; andere pagina's ongewijzigd. Inklappen/uitklappen met onthouden keuze: niet gebouwd (in de editor altijd compact).
7. **Panelen:** links en rechts inklapbaar (knoppen in de bovenbalk, `[` en `]`) en **Focusmodus** (`F`, Esc of de knop linksboven het canvas verlaat); keuze onthouden. In breedte verslepen: **niet gebouwd**.
8. **Typografie/contrast:** **niet gedaan** (geen audit uitgevoerd).
9. **Hint-regel onderin het canvas:** **niet gedaan**; de bestaande hints/chips bij Veld en Touw blijven.
10. **Lege staat bibliotheek:** bestond al in `ModelLibrary` ("Geen materiaal gevonden, wis filters" met "Filters wissen"); aantallen per filter niet aangepast.

## Open punten
Naam/afmetingen in de Item-kop, JSON in een Meer-menu, versleepbare paneelbreedte, inklapbare site-zijbalk met onthouden keuze, contrastaudit, hint-regel, mouse-drag op de chips, en accordeons voor de andere omgevingstypes.
