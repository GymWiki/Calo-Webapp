# Anchors: onderzoek (stap 1)

## Hoe verbindingen werkten (vóór de anchors)
- Een touw is geen item: `Rope = { id, a, b }`, met per uiteinde `{ item, local }` (`types/floorplan3d.ts`). Het touw is een tube met een lichte parabolische doorhang (`components/canvas-3d/rope.ts`, `RopeMesh.tsx`); lint en net bestonden niet als verbinding.
- Het eindpunt kwam **uit het geraakte punt**: de editor nam `event.point` van de raycast op het ZICHTBARE model (`Floorplan3dEditor.tsx`: `beginRope`/`finishRope`) en rekende dat met `worldToLocal` om naar de lokale ruimte van de collision-vorm (`anchorAt`). Er was geen benoemd bevestigingspunt, geen snapping en geen hoogte. Het eindpunt was dus waar de muis het model raakte: bij de korfbalpaal de rand van de gele korf.
- Opslag: lokale coördinaten per uiteinde (meters, item-ruimte); verplaatsen, draaien en kantelen volgen via `localToWorld` (`orientation.ts`).

## Wat er in de GLB's zit
- 211 GLB's in `materiaal-import/`: **0** hebben een `anchor_…`-node. Alle bevestigingspunten komen dus uit config of uit de geometrie.
- Het probleemobject is de **korfbalpaal** (`korfbalpaal_compleet_250/350`): een paal op x=0,z=0 (straal 3 cm, tot 2,40 m) met een gele korf (`Korf_IKF_Kunststof`) op 2,22–2,50 m die 55 cm zijwaarts uitsteekt. De collision-vorm is de hele omhullende box (voetplaat 80 × 80 cm, korf), dus de rand van de korf lag buiten de paal.

## Bevestigingspunten per soort asset (nu, afgeleid uit de geometrie)
| Soort | Hoeveel | Waar het punt zit |
|---|---|---|
| Paal (volleybal, badminton, korfbal, doel, slalom, mobiele sets) | 47 | boven op de paal; onder een breder deel dat bovenop de paal zit (korf, dwarslat); hoogteverstelbaar langs de paal |
| Hangend (ringen, touwen) | in "paal" | het ophangpunt bovenaan |
| Net (los) | 6 | linker- en rechterbovenhoek van het net, op het net zelf |
| Pion/dopje | 6 | top van elke kegel |
| Overig (mat, bal, kast, rek, …) | 152 | het hoogste punt in het midden van de zichtbare geometrie (noodoplossing); voor 11 relevante assets is een Blender-node gewenst (zie `anchor-audit.md`) |

Details per asset, de controles en de contactsheet staan in [`anchor-audit.md`](anchor-audit.md). Het probleemobject, voor en na: [`anchor-screenshots/`](anchor-screenshots).
