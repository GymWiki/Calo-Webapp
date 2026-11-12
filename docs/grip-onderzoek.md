# Tillen en materiaal in de hand: onderzoek (stap 1)

## Rechtermuisknop (conflicten)
- **Camera:** `OrbitControls` (`components/canvas-3d/CameraRig.tsx`) gebruikt de standaardmapping: links draaien, rechts pannen, wiel zoomen. Het browsermenu wordt door `OrbitControls` zelf onderdrukt, maar alleen als de controls aan staan. Er is geen eigen contextmenu.
- **Items:** `ItemMesh` krijgt `onPointerDown` van react-three-fiber; de bestaande sleepcode (`handleItemPointerDown`) keek niet naar de knop, dus een rechter klik schoof het object al over de vloer. Slepen gebeurt op de onzichtbare vloer (`handleFloorPointerMove`), er is geen `setPointerCapture` op het canvas (alleen bij touwen en de mobiele sheet).
- **Conflicten opgelost:** (1) rechts op een object start nu tillen i.p.v. verschuiven; (2) de camera mag dan niet pannen: de bestaande `isDragging`-vlag schakelt `OrbitControls` uit (ook voor tillen); (3) tijdens het tillen volgen we de muis met `pointermove`/`pointerup` op `window` (het object zelf krijgt geen events meer onder de cursor); (4) het browsermenu wordt op het canvas altijd onderdrukt (`contextmenu` op `HTMLCanvasElement`), invoervelden en panelen houden hun menu; (5) rechts op een leeg stuk blijft de camera pannen (getest).

## Hoogte
- `lift_m` ("Vrij in hoogte", max 10 m) = hoogte van het laagste punt; `y` wordt altijd opnieuw berekend door `recomputeStackedYs` (stapelen op de ondergrond, `lift_m` wint). Geen `lift_m` = op vloer of ondergrond. Tillen gebruikt precies dit veld: de hoogtevoer in het itempaneel, Q/E en het tillen delen dezelfde functie. "Terug naar vloer of ondergrond" verwijdert `lift_m`, waarna de stapelregels gelden.
- Kopiëren, plakken, undo/redo, opslaan, export en import nemen `lift_m` al mee.

## Leerlingen en handpunten
Zie `docs/grip-audit.md`: de modellen hebben geen skelet en geen nodes; handpunten zijn afgeleid. Objecten hadden geen greeppunt; `lib/constants/gripPoints.ts` levert die.

## Wat is gebouwd
Zie de PR-beschrijving en `docs/grip-audit.md`. Open: opname/screenshots, "Geef object" vanuit de bibliotheek, kopiëren van een leerling met object, uitlezen van `anchor_hand_*`/`anchor_grip` uit het GLB, eerste-gebruik-hint.
