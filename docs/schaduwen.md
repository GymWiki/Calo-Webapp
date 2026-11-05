# Schaduwen in de 3D-weergave

**Besluit:** geen enkele schaduw onder objecten in de editor, de alleen-lezen viewer en de gastmodus.

## Bronnen (onderzoek)
| Soort | Bron | Status |
| --- | --- | --- |
| Echte schaduwen | `renderer.shadowMap`, `castShadow`/`receiveShadow`, schaduwcamera's | **Nooit aanwezig.** Geen `shadows`-prop op een `<Canvas>`, geen `castShadow` op lichten of meshes (`RoomFloor.tsx` had alleen `receiveShadow={false}`, nu verwijderd). |
| Nep-schaduw | `components/canvas-3d/ContactShadows.tsx`, aangeroepen via `contactShadows` in `FloorplanContent.tsx:158` | Was actief in de **viewer** (`ViewerCanvas.tsx`) en in de **thumbnail-renderer** (`FloorplanThumbnailCapture.tsx:110`). Uit in de viewer; **in de thumbnails ongewijzigd** (zie hieronder). De editor had hem nooit. |
| Gebakken in textures | GLB-textures | Steekproef: de leerlingen hebben één UV-atlas (shirt, huid, haar), de ballen een basecolor + normal map (geen donkere vlek). Van de 187 materiaal-GLB's hebben er 34 een texture (alle ballen); de andere gebruiken alleen kleurmaterialen. Geen asset met een gebakken contactschaduw gevonden; een visuele controle per bal blijft aan te raden bij nieuwe assets. |
| Omgeving | SSAO, ambient occlusion, post-processing | Niet aanwezig (geen `EffectComposer`). |
| Kwaliteitsschakelaar | Auto/Hoog/Laag | Stuurt alleen pixelratio en antialiasing aan, **geen** schaduwinstelling. Niets te verwijderen. |

## Belichting
Ongewijzigd: `ambientLight 0.75` + `directionalLight 0.9` (zachte richting). Zonder schaduwen houden objecten hun vorm door de shading op het object zelf; de kleuren branden niet door.

## Controle (Playwright, `e2e/schaduwen.spec.ts`)
`window.__sceneAudit()` (alleen op `/e2e`-routes, `components/canvas-3d/SceneAudit.tsx`) telt in de echte scène: schaduwmap uit, 0 × `castShadow`, 0 × `receiveShadow`, 0 schaduwlichten, 0 meshes met `schaduw`/`shadow`/`blob` in de naam. Groen op desktop, iPhone 14 en Pixel 7 (editor met 5 verschillende items, en de viewer).

## Prestaties (viewer, 90 renders, headless; circuitopstelling met 8 items)
| | Draw calls | ms/frame (CPU 1×) | ms/frame (CPU 4×) |
| --- | ---: | ---: | ---: |
| Voor (met contactschaduw) | 45 | 0,231 | 0,659 |
| Na | 37 | 0,218 | 0,541 |

Eén draw call minder per item; −18 % rendertijd bij 4× CPU-throttling. In de editor is er niets te winnen (hij had geen schaduwen). Meting in software-rendering (swiftshader): relatieve verschillen zijn bruikbaar, absolute fps niet.

## Thumbnails
De thumbnail-renderer (bibliotheek, OG-afbeelding en de plattegrondafbeelding) gebruikt nog steeds de zachte contactschaduw: **onaangeroerd, niets geregenereerd**. Zonder schaduw zouden lichte items (witte ballen, mat op vloer) minder loskomen van de achtergrond. Besluit aan jou.

## Zweven
Screenshots `docs/schaduwen/klein-*.png` (pion, bal, kettlebell, drie camerahoeken): geen enkel item lijkt te zweven, de ondergrens is op alle hoeken scherp. Let op: de testroute gebruikt gekleurde dozen, geen echte GLB's. Mocht een echt item (bijv. een witte bal) toch zweven, dan stel ik voor: (a) een heel subtiele donkere outline onderaan, of (b) een iets donkerder vloerrand rond kleine items. Niets teruggezet zonder jouw akkoord.
