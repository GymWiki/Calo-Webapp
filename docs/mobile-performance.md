# Prestaties van de 3D-editor op mobiel

Meetscript: `e2e/perf-mobile.mjs` (`npm run perf:mobile -- --url=… --label=…`). Ruwe cijfers: `docs/mobile-perf-*.json`.

**Meetopstelling.** Chromium-device-emulatie iPhone 14 (390×844, devicePixelRatio 3), 4× CPU-throttling, standaard gymzaal met 30 items (ballen, bank, matten, kettlebell, pionnen, aerobic step), camera 3 s (of 10 s bij Auto) rondslepen. Frames en draw calls worden geteld door de WebGL-aanroepen te tellen (`clear` = één frame). Mediaan van 2 runs.

> **Let op:** headless Chromium rendert met software-WebGL (SwiftShader). De absolute fps zijn dus véél lager dan op een echte telefoon en vooral bruikbaar om *voor/na te vergelijken*. De richtwaarde "30+ fps op een middenklasse telefoon" is hiermee **niet** aangetoond; dat moet op een echt toestel worden gecheckt (zie `docs/mobile-editor-testen.md`).

| Configuratie | Frames/s | Laden tot stabiel beeld | Draw calls/frame | JS-heap na laden |
| --- | ---: | ---: | ---: | ---: |
| **Voor** (oude editor, dpr vast 2) | 3,0 | 7,4 s | 480 | 192 MB |
| Na — kwaliteit **Hoog** (dpr 2, antialias aan; gelijk aan voor) | 3,1 | 7,8 s | 480 | 193 MB |
| Na — kwaliteit **Auto** (schakelt zelf terug tijdens het draaien) | 11,4 | 7,0 s | 480 | 216 MB |
| Na — kwaliteit **Laag** (dpr 1, antialias uit) | 13,1 | 6,3 s | 480 | 215 MB |
| Na — **Laag + geoptimaliseerde GLB's** (Meshopt + WebP) | **15,2** | **6,1 s** | 480 | 202 MB |

Zonder CPU-throttling (oude editor) haalde dezelfde meting 3,9 fps: de emulatie wordt dus beperkt door het software-renderen van pixels (fillrate), niet door de CPU. Daarom helpt een lagere pixel ratio hier zo sterk (×4 minder pixels) — op echte GPU's is het effect kleiner.

## Wat er is gedaan

- **Kwaliteit Auto / Hoog / Laag** (⋯-menu). Hoog = min(devicePixelRatio, 2), antialias aan. Laag = 1×, antialias uit. Auto = begint als Hoog en schakelt stapsgewijs terug met drei's `PerformanceMonitor` (streef 28–50 fps); op zwakke toestellen (≤ 4 cores of ≤ 4 GB geheugen) is de bovengrens 1,5× zonder antialias.
- **`frameloop="demand"`** stond al aan (alleen renderen bij verandering) en blijft; er zijn geen schaduwen of post-processing. De editor pauzeert dus vanzelf als er niets gebeurt of de tab op de achtergrond staat.
- **GPU-geheugen**: een model dat niet meer op de plattegrond staat, wordt 30 s later opgeruimd (geometrie, materialen en textures `dispose()` + `useGLTF.clear`), en alles bij het sluiten van de editor (`components/canvas-3d/model-cache.ts`). Het wachten van 30 s houdt "ongedaan maken" snel.
- **Modellen lui laden**: een GLB wordt pas opgehaald als het item wordt geplaatst (was al zo) en daarna gecachet door `useGLTF`; herhaalde exemplaren delen geometrie en materialen (`clone(true)`), pionnen/dopjes zijn al `InstancedMesh`.
- **GLB-optimalisatie** (`scripts/optimize-glbs.mts`): Meshopt-compressie + WebP-textures van max. 1024 px + opruimen. **184 modellen: 101 MB → 19,4 MB (−81%)**; de grootste ballen/netten gaan van 2–3,3 MB naar ±0,5 MB. De app decodeert dit zonder aanpassing (drei's `useGLTF` ondersteunt Meshopt; three ondersteunt `EXT_texture_webp`). Visueel gecontroleerd in de echte app-stack voor 5 modellen: gemiddeld pixelverschil ≤ 0,5 / 255. **De geoptimaliseerde bestanden zijn nog NIET naar Supabase geüpload** (dat is een productiewijziging; zie "Openstaand").
- **Bibliotheek**: categorieën zijn standaard dicht (er staan dus nooit honderden kaarten in de DOM) en `next/image` laadt thumbnails lui; een aparte virtuele lijst is daarom niet nodig gebleken.

## Openstaand

- **Draw calls (480/frame)** zijn niet lager geworden. Het grootste deel zit in de gymzaal-GLB (veel losse lijnmeshes); die samenvoegen vraagt aanpassing van de omgevings-GLB's (benoemde nodes voor muren/gordijnen moeten los blijven) — niet gedaan.
- **KTX2/Basis-textures** zijn niet gebruikt: dat vraagt de `toktx`-tool, die hier niet beschikbaar is. WebP op 1024 px geeft al ±80% besparing; KTX2 zou vooral GPU-geheugen schelen.
- **Echte toestellen**: fps, laadtijd op 4G en geheugengedrag op iOS Safari zijn alleen in emulatie gemeten.
- Een aparte, lichtere gymzaal-GLB voor mobiel bestaat niet (de huidige is maar 234 KB; het zwaartepunt zit in het aantal draw calls, niet in bestandsgrootte).
