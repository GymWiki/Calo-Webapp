# Pionnen en afzetmateriaal kantelen

## Onderzoek (kort)
* Per asset beslist `orientationFor` (`components/canvas-3d/asset-orientation.ts`) of kantelen mag (`allowTilt`, `maxTiltDeg`, `defaultRotation`). Daarvoor stond
  de hele subgroep "afzetten" plat (en slugs `pion|dopje|vloermarkering|slalompalen|hoekvlag|...`).
* Het itempaneel (`RotationPanel`), de mobiele drawer en de gizmo (`rotation-controls.ts`) kennen de standen Plat, Rechtop (90°), Schuin 15/30/45°, Op kop (180°) en Reset;
  ze worden automatisch actief zodra `allowTilt` aan staat.
* Rust op de vloer na kantelen: `floorY(shape, rot, lift)` (`floorplan3d-geometry.ts`) neemt het laagste punt van de **georiënteerde collision-box**.
* Afgezette velden (`ConeFieldMesh.tsx`, `cone-field.ts`) zijn één groep met instanced pionnen (`CONE_MARKER_DIMS`: pion 0,30 m, hoog 0,50, laag 0,15, dopje 0,03 m);
  een afzonderlijke pion is nu niet selecteerbaar.

## Wat nu werkt
* Kantelen staat aan voor pionnen (alle soorten), dopjes, hoepels, estafettestokken, springtouwen, hesjes, pittenzakjes, bekers, speedladders, hordes, slalompalen en
  vlaggen: volledig draaibaar om elke as (±180°), met de bestaande snelle standen (Plat/Rechtop/Schuin/Op kop/Reset) in paneel en mobiele drawer.
* Blijft plat: vlakke markeringen (`vloermarkering`, lijnen, tape, vakjes, pijlen, belijning) en personen.
* Bestaande plattegronden veranderen niet: een rotatie die er al stond blijft, `normalizeItemRotation` laat 0° weg.
* Tests: `rotation-controls.test.ts`, `orientation.test.ts`.

## Nog niet gebouwd
* **Rustpositie uit de echte vorm.** Een gekanteld item rust nu op de hoek van zijn collision-box (zoals alle gekantelde items), niet op de convexe omhullende van een
  kegel. Een omgevallen pion ligt daardoor een paar centimeter anders dan fysiek (kegel op zijn zij met opgeheven punt). Voorstel: `lowestOffset` voor `cylinder`/kegelvormen met de
  convexe omhullende berekenen en een optionele `restPoses`-override in `asset-orientation.ts` (met reden) toevoegen.
* Stabiliteitswaarschuwing "Op de kop".
* Veldniveau-oriëntatie (`orientation` op `coneField`), per-pion-overrides (`overrides: [{ index, rotatie, verwijderd }]`), instance-selectie met raycast-`instanceId`,
  per-pion kleur, kopiëren/plakken van overrides, schema/validator/AI-briefing en de Playwright-tests en screenshots.
