# Rotatie over alle assen (3D-plattegrond)

Items in `/plattegrond-3d` kunnen niet alleen horizontaal draaien maar ook kantelen en rechtop staan:
een bank schuin tegen een klimrek, een mat rechtop tegen de muur, een balk of ladder schuin, een
springplank onder een hoek.

## Datamodel (achterwaarts compatibel)

Een item heeft altijd `rot_y_deg` (draaien, zoals voorheen) en optioneel:

| veld | betekenis |
| --- | --- |
| `rot_x_deg` | kantelen voor/achter, −180…180 (de bediening houdt X binnen ±90°) |
| `rot_z_deg` | kantelen zijwaarts, −180…180 (180° = op kop) |
| `lift_m` | "Vrij in hoogte": hoogte van het laagste punt boven de vloer (m) |

- Euler-volgorde **YXZ** (zoals three.js): `R = Ry · Rx · Rz`, opgeslagen in graden. Intern wordt met
  3×3-rotatiematrices gerekend (gimbal-vrij, equivalent met quaternions) en daarna weer naar Euler gezet.
- Ontbrekende velden = 0. Oude plattegronden blijven byte-voor-byte gelijk; 0-waarden worden niet opgeslagen.
- Kantelen gebeurt om het **onderste midden van de voetafdruk** (de pivot); de heading draait om de itempositie.
- Code: `components/canvas-3d/orientation.ts` (wiskunde), `asset-orientation.ts` (regels per asset),
  `rotation-controls.ts` (bediening), `RotationPanel.tsx`, `RotationGizmo.tsx`.

## Bediening

**Desktop** – tab *Item* → sectie *Rotatie*: per as een schuifregelaar, invoerveld en stapknoppen
(−90°/−15°/+15°/+90°); snelle standen (Plat, Rechtop, Schuin 15/30/45°, Op kop, Reset rotatie); snapping
(5/15/45/90°/uit); *Lokale assen*; *Op vloer houden* of *Vrij in hoogte* met hoogte-invoer.
3D-ringen op het geselecteerde item: **groen = draaien**, **rood = voor/achter**, **blauw = zijwaarts**
(hover = dikker; Shift = vrij draaien zonder snapping). Sneltoetsen: **R** (+stap om Y), **Shift+R** (terug),
**T** (voor/achter), **G** (zijwaarts), Shift keert om; de stap volgt de snapping (standaard 15°).

**Telefoon/tablet** – selecteer een item → knop **Rotatie** in de contextbalk opent een compacte drawer
(geen donkere achtergrond, het item blijft zichtbaar) met dezelfde assen, grote stapknoppen en snelle standen
(alle doelen ≥ 44 × 44 px). Geen ringen op touch; de camera beweegt niet mee.

"Schuin"/"Rechtop" kiest zelf de as: langwerpige items (lengte ≥ 2× breedte: banken, balken, ladders,
planken) rijzen met één uiteinde (Z); brede items zoals matten staan rechtop op hun lange rand (X).

## Vloer, botsing, selectie

- Een gekanteld item rust met zijn **laagste punt op de vloer** (of op `lift_m`); nooit erdoor, nooit zwevend.
- Gekantelde items **stapelen niet** en zijn geen ondergrond; onderliggende items vallen terug naar de vloer.
- Botsing met een gekanteld item is exact in 3D (oriented boxes, SAT); de voetafdruk is de convexe omhullende.
  Cilinders/capsules worden bij kanteling als doos benaderd.
- Selectiekader en `?debug=collision` draaien mee. Valt (een deel van) een gekanteld item buiten de zaal, dan
  krijgt het een rode outline (geen blokkade).
- Dupliceren, undo/redo (schuifregelaar/ringen: één stap per beweging), opslaan, laden en de alleen-lezen
  viewer gebruiken de volledige rotatie. Bibliotheek-thumbnails blijven onveranderd (rotatie 0). "Materiaal nodig" telt
  gekantelde items gewoon mee.

## Welke assets mogen niet kantelen (en waarom)

Geregeld in `asset-orientation.ts` (`allowTilt`, `maxTiltDeg`, `defaultRotation`; uitzonderingen per slug in
`ORIENTATION_OVERRIDES`, met verplichte reden):

- **Personen** – staan altijd rechtop op de vloer.
- **Pionnen, dopjes, slalompalen, vloermarkeringen, hoekvlaggen, grensrechters, partijhesjes** – staan plat op de vloer.
- **Hangend materiaal** (touwen, ringen, netten, borden) – hangt recht omlaag.

In het paneel staat bij zulke items de reden; alleen draaien blijft mogelijk.

## Tests

- `npm test` – o.a. `orientation.test.ts`, `tilt-placement.test.ts`, `rotation-controls.test.ts`
  (migratie oude data, Euler↔matrix, 90/45/30° over meerdere assen, laagste punt op de vloer, oriented boxes, save/load).
- `npm run test:e2e -- e2e/rotation.spec.ts` – desktop, iPhone 14, Pixel 7, iPad: kantelen met knoppen, rechtop, herstel na
  herladen, undo, dupliceren, pion zonder kantelen, sneltoetsen, ring slepen, touch-doelen ≥ 44 px, geen horizontale scroll.
- Screenshots: `E2E_SCREENSHOTS=1 npx playwright test e2e/rotation-screens.spec.ts` → `docs/screenshots/rotatie/`.

## Open punten

- Geen multi-select in de editor: roteren om een gezamenlijk midden bestaat dus nog niet.
- Geen "plaats tegen wand/object" (automatisch richten op een vlak); wel `lift_m` en handmatig kantelen.
- `defaultRotation` per asset is ondersteund maar nog leeg (bijv. matten die standaard rechtop staan).
- Gekantelde items stapelen niet en worden niet op andere items gezet.
