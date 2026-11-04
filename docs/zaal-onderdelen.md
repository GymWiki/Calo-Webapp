# Vaste zaalonderdelen weghalen

## Hoe het weghalen van de basketbalborden werkt (en wat hergebruikt is)
Er is één systeem: `room.environment.hidden` (lijst GLB-nodenamen die uit staan, `types/floorplan3d.ts`). Muren, gordijnen, wandrekken en
sportlijnen werkten al zo (`environments.ts` → `EnvironmentPart { id, label, nodes }`, paneel `GymEnvironmentPanel.tsx`, `EnvironmentModel.tsx`
verbergt de nodes). De baskets en bankjes zijn daar gewoon twee onderdelen bij; er is geen tweede systeem en geen schemawijziging: een oude
plattegrond zonder deze nodes in `hidden` toont alles (= standaardzaal).

## Onderdelen (gymzaal "1 zaal", GLB `gymzaal_standaard`)
| onderdeel | node(s) | los te halen | opmerking |
| --- | --- | --- | --- |
| Wandrekken (ribbenbanken) | `Wandrek_1`, `Wandrek_2` | ja, ook per positie | zaal 2×2: `Wandrek_Zaal_1_A/B`, `_2_A/B`; zaal 4×1: `Wandrek_Zaal_4_A/B` |
| Basketbalbaskets | `Basketbal_Installatie_Links/Rechts` | ja | alleen losse zaal |
| Vaste bankjes | `Turnbank_1`, `Turnbank_2` | ja (nieuw) | alleen losse zaal |
| Muren / gordijnen | `Muur_*`, `Scheidingswand_*` | ja (bestond) | |
| Sportlijnen | `Lijnen_*` | ja (bestond) | |
| Plafondspanten, ringen/klimtouwen | `Plafond_Constructie_Spanten`, `Turnringen_Klimtouwen` | altijd verborgen | |
| Ramen, deuren, spiegels, scoreboard/klok, tribune, ballenvanger, vaste doelen, lichtbakken | – | **niet in het zaalmodel** | bestaan niet als node; zouden in Blender als `opt_<groep>__<variant>` moeten worden toegevoegd |

In het Kamer-paneel staan onder "Vaste onderdelen" alleen een uitlegregel en de switches per onderdeel (één undo-stap per wijziging). De eerdere knoppen "Alles weghalen", "Standaardzaal herstellen" en "Lege zaal" zijn verwijderd.

## Open punten (niet gedaan)
* **Achterwand achter een weggehaald wandrek:** niet visueel gecontroleerd (de GLB's komen uit Supabase Storage; de testomgeving heeft ze niet). Controleer in
  Blender of `Muur_*` achter `Wandrek_*` gesloten is; zo niet, moet het wandvlak achter het rek in `Muur_*` worden meegemodelleerd.
* Waarschuwing "er hangt iets aan dit onderdeel" en klikken op een vast onderdeel in de 3D-weergave (contextmenu) zijn niet gebouwd.
* Playwright-screenshots met/zonder onderdelen, AI-briefing en Playwright-tests voor deze groep ontbreken nog; unit tests staan in `environment-kinds.test.ts`.
