# Plaatsen, slepen en botsing (3D-editor)

## Oorzaak van het verspringen bij loslaten (met bewijs)

`Floorplan3dEditor.tsx` rekende bij **loslaten** (`handleFloorPointerUp`) de plaatsing opnieuw uit met
`resolvePlacement({ ..., final: true })`, terwijl de preview tijdens het slepen `final` niet zette. Met `final: true` verving
`resolvePlacement` een "geblokkeerde" plek door `findNearestFreeSpot`: de dichtstbijzijnde vrije plek op ringen van 20 cm. De preview
liet de overlap gewoon zien, het loslaten verplaatste het item daarna stil. Bij een breed, dun object (volleybalopstelling
10,85 × 0,16 m) is "vrij" pas een stuk verderop: dat is de meter naar links of rechts.

Reproductie (puur, `resolvePlacement` met de echte afmetingen, opstelling 10,85 × 0,16 m, kegel op (1, 1), pointer (0, 1), raster 0):

| stap | positie (x, z) | modus |
| --- | --- | --- |
| preview vlak vóór loslaten | (0, 0,93) | rand-snap, `blocked = true` |
| commit (oude code, `final: true`) | (−0,141, 0,789) | `relocated` (Δ = 0,20 m bij een kegel van 30 cm; meer bij grotere obstakels) |

Daarnaast herberekende het commit-pad vanuit de al gesnapte pivot (`{ x: dragged.x, z: dragged.z }`) nog een keer: raster en
rand-snap werden twee keer toegepast.

Andere verdachten, gecontroleerd en **niet** de oorzaak: de snapdrempel (`SNAP_EDGE_M` = 8 cm, ruim onder de 25 cm), de zaalgrens-klem
(werkt op de oriented box met offset), pivot/grab-offset (de cursor houdt het midden van de voetafdruk vast, preview en commit gebruiken
dezelfde omrekening), touch-pointerup (commit leest de state, niet de pointerup-coördinaten), autosave/undo (normaliseren niet).

## Wat er nu gebeurt

* **Eén berekening.** `resolvePlacement` draait bij elke pointermove; de laatste uitkomst wordt bewaard (`lastPlacementRef`) en bij
  loslaten **exact** vastgelegd. Geen tweede berekening, geen `findNearestFreeSpot` meer in het sleeppad. In dev/test logt de editor een
  `console.error` als de gecommitte positie meer dan 1 mm van de laatste preview afwijkt.
* **Eén drag = één undo-stap** (ongewijzigd).
* **Botsing = waarschuwing, nooit een verplaatsing.** Zie hieronder.
* Plaatsen vanuit de bibliotheek zoekt nog steeds een vrije startplek rond het midden van het beeld (`handleAddModel`). Dat is geen
  correctie bij loslaten, maar de startplek van een nieuw item; open punt of dat ook "over alles heen" moet.

## Botsingslagen (`lib/constants/collisionRules.ts`)

| laag | voorbeelden |
| --- | --- |
| vloer | matten, vloerlijnen, tape |
| toestel | banken, kasten, bokken, karren (standaard voor onbekende assets) |
| staand | palen, doelen, netpalen, standaards, baskets |
| overspannend | netten, touwen, linten, complete netopstellingen |
| klein | pionnen, ballen, hoepels, hesjes |
| persoon | leerling, leerkracht |
| decor | vaste wandrekken |

Overlap die een **waarschuwing** geeft (alles anders mag zonder melding):

| | vloer | toestel | staand | overspannend | klein | persoon | decor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **toestel** | – | ⚠ | ⚠ | – | – | ⚠ | ⚠ |
| **staand** | – | ⚠ | ⚠ | – | – | – | ⚠ |
| **overspannend** | – | – | – | – | – | – | – |
| **persoon** | – | ⚠ | – | – | – | ⚠ | – |
| **decor** | – | ⚠ | ⚠ | – | – | – | ⚠ |

* Een overspannend item (net, touw) houdt zijn **eigen hoogte**: het wordt niet op een bank getild en snapt niet aan banken (wel aan muren).
* Klein materiaal ligt op bijna alles (bal op een niet-stapelbare bank krijgt de bovenkant van de bank als hoogte).
* Een item dat **breder is dan de zaal** wordt niet naar binnen geduwd; het midden blijft in de zaal en er komt een melding.
* Per asset overschrijven: `COLLISION_OVERRIDES` (met verplichte `reason`).
* **Schakelaar "Botsing"** (zijbalk op desktop, instellingenpaneel op telefoon): waarschuwen of negeren. **Alt** tijdens het slepen zet
  botsing én snappen tijdelijk uit.
* Waarschuwing = rode outline op de betrokken items + melding "Overlapt met …". De plaatsing blijft zoals de docent hem neerzet.
* Harde blokkade bestaat niet meer voor items onderling.

## Standaardcamera van de viewer

Oud: azimut 45°, kanteling 50° — maar `computeFraming` koos voor langgerekte opstellingen (volleybalveld, circuit) de kandidaten 20° of
0° zodra die het kader >8% beter vulden; daardoor was de beginstand vaak "bijna recht van voren". Bovenaanzicht gebruikte azimut 0°.

Nieuw (`components/plattegrond/viewer-camera.ts` → `DEFAULT_VIEW_ANGLES = { azimuth: 40, polar: 50 }`, `viewer-framing.ts`):

* Altijd ±40°, nooit 20°/0°. `chooseDefaultAzimuth(items, room, fields)`: de kant waar de meeste inhoud staat (zwaartepunt links van het midden → −40°);
  symmetrisch, leeg of twijfel → +40° (rechts). `room.view_azimuth_deg` (instelbaar in de editor onder "Weergave bij de activiteit → Kijkrichting")
  gaat altijd voor.
* Kanteling per inhoud (`chooseDefaultPolar`): vlak (hoogste punt ≤ 0,6 m) 38°, hoog (≥ 2 m, netten/toestellen) 57°, anders 50°.
* Bovenaanzicht (polar ≈ 0) houdt dezelfde azimut; "3D", Reset en dubbelklik komen op dezelfde basis (`azimuthBase`/`polarBase`) uit; thumbnails en
  volledig scherm gebruiken `initialViewFor`/`computeFraming` en dus dezelfde stand.
* Opslag: `view_azimuth_deg` zit in de bestaande JSON van de plattegrond (`floorplans_3d.data`, optioneel veld) — **geen databasemigratie nodig**.
* Thumbnails verversen vanzelf zodra een plattegrond opnieuw wordt opgeslagen (er bestaat geen batch-script; zie open punten).

## Baskets weghalen

Gymzaal "1 zaal": in het omgevingspaneel onder "Extra's" staat de schakelaar **Basketbalbaskets** (nodes `Basketbal_Installatie_Links/Rechts`). Zelfde
opslag als muren (`environment.hidden`), standaard aan. De complexen (2×2, 4×1) hebben geen aparte basket-nodes in de GLB.

## Open punten

* Bovenaanzicht met een diagonale azimut vult het kader minder (de omhullende van de gedraaide inhoud is groter); `projectedSpan` rekent met de
  AABB-hoeken. Een nauwkeuriger omhullende (echte voetafdrukken) zou dit verbeteren.
* Nog niet gebouwd uit de opdrachten: auditscripts `audit-placement` / `audit-collision-rules` met contactsheets, "Toon plaatsing"-debugschakelaar,
  automatisch hoogte snappen met uitzetoptie, doorklikken tussen overlappende objecten (Alt+klik), per-onderdeel-lagen van composiet-objecten,
  Playwright-opnames (video) en voor/na-screenshots van de drie activiteiten.
