# Prestaties van leerlingen in de 3D-editor

Meetscript: `e2e/perf-students.mjs`. Ruwe cijfers: `docs/students-perf-*.json`.

**Opstelling.** Productiebuild (`next build --webpack` + `next start`), gratis tool (`/gratis-gymzaal-plattegrond-maken`) met een geseede kladversie: N leerlingen in de standaard gymzaal, verdeeld over 19 poses, 8 shirtkleuren en 3 groottes. Camera 4 s rondslepen; frames en draw calls worden geteld via de WebGL-aanroepen (`clear` = één frame). Mediaan van 2 runs. Poses = de echte, verwerkte GLB's (±105 KB, 6000 driehoeken).

> **Let op:** headless Chromium rendert met software-WebGL (SwiftShader). De absolute fps zijn daarom veel lager dan op een echte telefoon en alleen bruikbaar om te vergelijken. "30+ fps op een middenklasse telefoon" is hiermee **niet** aangetoond; dat moet op een echt toestel worden nagelopen (zie `docs/mobile-editor-testen.md`). In deze meting viel de omgeving-GLB (de zaal) buiten de draw calls; de cijfers gaan dus over de leerlingen zelf.

| Configuratie | Frames/s | Laden tot stabiel beeld | Draw calls/frame | Driehoeken/frame | JS-heap |
| --- | ---: | ---: | ---: | ---: | ---: |
| iPhone 14-emulatie, 4× CPU-throttling, **1 leerling** | 42,7 | 2,2 s | 16 | 11.446 | 14 MB |
| iPhone 14-emulatie, 4× CPU-throttling, **30 leerlingen** | 14,8 | 2,9 s | 45 | 185.409 | 27 MB |
| Desktop 1440×900, geen throttling, **30 leerlingen** | 21,3 | 1,6 s | 45 | 185.409 | 29 MB |

## Wat dit zegt
- **Draw calls**: ±1 per leerling (+29 voor 29 extra figuren). Alle leerlingen delen één shaderprogramma en per (pose, kleur) één materiaal; geometrie en texture worden per pose gedeeld (`clone(true)`).
- **Laden**: 30 leerlingen in 19 poses laden samen ±2 MB (19 × ±105 KB); een pose wordt pas opgehaald zodra hij gebruikt wordt. Laadtijd stijgt met ±0,7 s.
- **Geheugen**: +13 MB JS-heap voor 29 extra leerlingen.
- **Driehoeken**: 185k per frame is veel voor software-rendering, maar gewoon voor een echte mobiele GPU (de gemeten daling van 42 → 15 fps komt van het software-renderen van de vertices en pixels).
- **Gedaan om dit licht te houden**: versimpeld van ±38.000 naar 6000 driehoeken, één 512 px-kleurtexture i.p.v. drie 1024 px-textures, Meshopt-compressie, kwaliteitsinstelling Auto/Laag van de editor (lagere pixel ratio) blijft gelden en `frameloop="demand"` (alleen renderen bij verandering).

## Als het op een echt toestel te traag blijkt
Aan de knoppen in volgorde van effect: (1) `--tris=4000` in `npm run process:students` (zichtbaar verschil is klein), (2) ver weg gelegen leerlingen met een lagere detailgraad tonen (LOD), (3) gelijke pose + kleur als `InstancedMesh` tekenen (gedeelde geometrie en materiaal maken dat een kleine aanpassing, maar dan werkt selecteren per instantie via een eigen raycast).
