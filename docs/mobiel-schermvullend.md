# Mobiele editor: schermvullend, werkbalken altijd zichtbaar

## Oorzaken (met bewijs)
Gereproduceerd op een testpagina waarin de editor binnen de app-shell staat (`/e2e/shell-plattegrond-3d`, `app/e2e/shell-plattegrond-3d/page.tsx`; de gewone testroute heeft geen shell en toont het probleem niet). Metingen vóór de fix: `docs/mobiel-schermvullend/voor-*.json`.

1. **Twee vaste balken onderin op dezelfde plek.** De globale navigatie (`components/app-layout.tsx`, `<nav className="fixed inset-x-0 bottom-0 z-50 …">`) ligt op exact dezelfde rij als de editorwerkbalk: op 390×844 beide `top 779 / bottom 844`. De site-navigatie (z-50) valt over de editorwerkbalk, daarom is die bovenin gescrold verborgen.
2. **Paginascroll door `pb-[calc(4rem+env(safe-area-inset-bottom))]`** op de content-wrapper van `AppLayout` (voor die onderbalk) bovenop de editor `h-[100dvh]` (`Floorplan3dEditor.tsx`): de pagina is steeds 64 px hoger dan het scherm (`scrollHeight` − viewport = 64 px op 390/375/412; 46 px op de 360×640-emulatie waar de viewport 658 px was). Daardoor scrolt de bovenbalk weg als je onderin bent.
3. **Werkbalk krap:** 8 knoppen (incl. Ongedaan en Opnieuw met lange labels) in één rij van 360–412 px.
4. **Camera:** de editor start in "Vrij draaien" (perspectief) met een vaste positie `[0.95, 0.75, 1.2] × zaalspan`, onafhankelijk van de schermverhouding. In portret (smal canvas) loopt de zaal daardoor links en rechts uit beeld (gemeten: 100% van de canvasbreedte, afgesneden); een zaal "klein in het midden" kon ik in de emulatie niet reproduceren.

## Wat er veranderd is
* **Eén plek voor schermvullende routes:** `lib/editor-ui/immersive.ts` (`isImmersiveRoute`); `AppLayout` verbergt daar de onderste navigatiebalk en de padding, en zet `data-immersive` op `<html>` (`app/globals.css`: `overflow: hidden; overscroll-behavior: none`). Nieuwe editorpagina's voegen hun pad toe aan `IMMERSIVE_ROUTE_PREFIXES`.
* **Editorcontainer (telefoon):** `fixed inset-x-0 top-0` met klasse `.editor-shell` (hoogte `100vh` → `100svh` → `100dvh`); tablet/desktop houden hun indeling (`relative`, zijmenu).
* **Bovenbalk:** Terug, titel met statusregel ("Opgeslagen", "Opslaan…", "Niet opgeslagen"), **Ongedaan en Opnieuw (verhuisd van de onderbalk)**, Opslaan, menu.
* **Onderwerkbalk:** zes knoppen (Materiaal, Item, Kamer, Veld, Touw, Camera), ≥ 44 px, gelijke verdeling, `padding-bottom: max(0.25rem, env(safe-area-inset-bottom))`.
* **Sheets** staan nu binnen het canvasgebied (tussen bovenbalk en werkbalk), hoogtes als percentage van dat gebied: de werkbalk blijft zichtbaar en niets schuift.
* **Camera** (`components/canvas-3d/camera-fit.ts`, `CameraRig.tsx`): zoom/afstand volgen de canvasmaten, zodat de zaal het canvas vult (marge 1,05 in portret); in portret steiler (polar 38°), vrije camera diagonaal (azimut 40°). Zoomgrenzen rond de ingekaderde stand. Als een sheet open is schuift het beeld omhoog (geanimeerd, niet bij `prefers-reduced-motion`).

## Metingen (Playwright-emulatie, dsf 2)
| viewport | paginascroll voor | canvashoogte voor | canvashoogte na | zaalbreedte voor | zaalbreedte na |
| --- | --- | --- | --- | --- | --- |
| 412x915 | 0 px | 805 px | 805 px | 100% (afgesneden) | 98% |
| 390x844 | 0 px | 734 px | 734 px | 100% (afgesneden) | 98% |
| 375x667 | 0 px | 557 px | 557 px | 100% (afgesneden) | 98% |
| 360x640 | 0 px | 530 px | 530 px | 100% (afgesneden) | 98% |

Na: paginascroll 0 px op alle viewports (ook 820×1180), bovenbalk `top 0`, werkbalk sluit aan op de onderrand, geen globale navigatie op telefoon. Voor/na-screenshots: `docs/mobiel-schermvullend/voor-*.png`/`na-*.png` (alleen de "na"-screenshots zijn gemaakt op de nieuwe code; de "voor"-meting is als JSON vastgelegd).
Tests: `e2e/mobiel-schermvullend.spec.ts` (Pixel 7-, iPhone 14-, SE- en 360×640-maten + tablet 820×1180; zaal ≥ 85% van de breedte; zes werkbalkknoppen zonder overlap; sheet openen/sluiten verschuift niets), `lib/editor-ui/immersive.test.ts`, `components/canvas-3d/camera-fit.test.ts`.

## Checklist voor een echt toestel
**Android Chrome (portret):** (1) /plattegrond-3d openen; pagina scrolt niet en de adresbalk blijft zichtbaar of klapt weg zonder dat de onderwerkbalk loskomt; (2) adresbalk in- en uitscrollen via de pagina boven de editor kan niet meer: controleer dat de werkbalk altijd onderaan blijft; (3) Materiaal openen, sheet half/vol slepen, tik op het canvas sluit; (4) rotatie naar landschap en terug; (5) gebarenbalk onderin: werkbalk staat er volledig boven; (6) pull-to-refresh trekt niet aan het canvas.
**iOS Safari en de app-versie:** zelfde punten; let op de notch (bovenbalk onder de statusbalk), de home-indicator, het uitklappen van de toetsenbordbalk bij de titel, en dat de Capacitor-WebView `100dvh` ondersteunt.
**Wat emulatie niet dekt:** het werkelijk in- en uitklappen van de adresbalk (visualViewport wijzigt tijdens scrollen), iOS Safari's eigen `dvh`/toolbar-gedrag, echte gebarenbalk/notch-waarden, touch-latency en prestaties op middenklasse-toestellen. `100dvh` + `position: fixed` is zo gekozen dat de browser dit zelf afhandelt; een `visualViewport`-listener is niet nodig gebleken in de emulatie en niet toegevoegd.

## Open punten
* In portret staat de zaal (24×14 m) diagonaal en is breedte-beperkt; de zaal draaien zodat de lange zijde verticaal loopt zou het canvas nog beter vullen (niet gedaan, azimut blijft 40°).
* De pixelratio/schaduw-beperking op mobiel is niet aangeraakt (bestond al).
* Gratis editorpagina/beheer-concepten: `isImmersiveRoute` kent alleen `/plattegrond-3d`; de gast-tool gebruikt een eigen shell zonder globale navigatie.
