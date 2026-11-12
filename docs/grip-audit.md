# Audit handpunten en greeppunten

Gegenereerd door `npm run audit:grip -- --plots --write` (`scripts/audit-grip.mts`); schrijft `lib/students/handpoints.generated.ts` en de afbeeldingen in `docs/grip-audit/`.

## Hoe de handpunten zijn afgeleid
De leerlingmodellen zijn statische meshes zonder skelet en zonder benoemde nodes (`anchor_hand_*` bestaat in **geen enkel** GLB). Daarom is er een terugval uit de geometrie (`scripts/lib/pose-hands.mts`): de huidkleurige delen van de mesh (via de kleurtexture) vormen losse stukken (hoofd, armen, benen); de twee armstukken zijn de armen, en het handpunt is het punt van zo'n arm dat het verst van de borst ligt. Links/rechts is uit het perspectief van de leerling (voorkant +Z, linkerhand aan +X).

**Dit is een benadering.** Ze is goed voor poses met losse, zichtbare armen (staan, bal schieten, balanceren), maar kan fout zijn bij rennen of als de handen tegen het lichaam liggen. Bekijk de afbeelding per pose (`docs/grip-audit/<pose>.png`: voor- en zijaanzicht, oranje = huid, groen/blauw = linker/rechter handpunt) voordat je erop vertrouwt. Het vastklikken werkt met een straal van 14 cm; een handpunt dat 30 cm ernaast ligt voelt dus fout.

## Resultaat per pose (44 poses)
| Pose | Zekerheid | Linkerhand (x, y, z) m | Rechterhand (x, y, z) m | Opmerking |
| --- | --- | --- | --- | --- |
| standaard | hoog | 0.168, 0.403, -0.035 | -0.123, 0.404, -0.118 | — |
| hardlopen | hoog | 0.295, 0.968, -0.039 | -0.326, 1.025, 0.135 | — |
| juichen | hoog | -0.088, 1.61, -0.002 | -0.224, 2.11, -0.054 | — |
| zittend | hoog | 0.082, 0.308, 0.215 | -0.26, 0.325, 0.021 | — |
| basketbal_dribbelen | hoog | 0.346, 0.518, 0.258 | -0.496, 0.871, 0.055 | — |
| volleybal_onderhands | laag | -0.158, 0.742, 0.352 | — | maar één armstuk gevonden: de andere hand ligt waarschijnlijk achter het lichaam of tegen het lichaam aan |
| volleybal_bovenhands | hoog | 0.232, 1.671, 0.073 | 0.074, 1.472, 0.016 | — |
| badminton_slaan | geen | — | — | geen armstuk gevonden (0 huidstukken) |
| pickleball_klaar | laag | -0.083, 0.677, 0.235 | — | maar één armstuk gevonden: de andere hand ligt waarschijnlijk achter het lichaam of tegen het lichaam aan |
| pickleball_slaan | hoog | 0.564, 1, -0.501 | -0.148, 0.774, 0.409 | — |
| hockey | hoog | 0.103, 0.431, 0.14 | -0.246, 0.277, 0.43 | — |
| hockey_sprint | hoog | 0.343, 1.183, 0.04 | -0.255, 0.602, 0.357 | — |
| floorball | hoog | 0.302, 1.044, -0.096 | 0.12, 0.358, 0.028 | — |
| floorball_sprint | hoog | 0.102, 0.392, 0.147 | -0.261, 1.035, 0.039 | — |
| honkbal_slaan | laag | -0.333, 1.197, -0.085 | — | maar één armstuk gevonden: de andere hand ligt waarschijnlijk achter het lichaam of tegen het lichaam aan |
| honkbal_vangen | hoog | 0.029, 1.43, 0.067 | -0.252, 1.006, 0.423 | 3 armachtige huidstukken; de 2 grootste gebruikt |
| trefbal_gooien | hoog | 0.27, 1.164, 0.716 | -0.446, 1.152, -0.389 | 3 armachtige huidstukken; de 2 grootste gebruikt |
| verdedigen | geen | — | — | geen armstuk gevonden (0 huidstukken) |
| handbal | hoog | 0.69, 1.084, 0.374 | 0.143, 1.585, 0.105 | — |
| korfbal | hoog | 0.123, 1.059, 0.228 | -0.279, 1.037, -0.108 | — |
| basketbal_schot | hoog | -0.072, 1.464, -0.058 | -0.209, 1.61, 0.081 | — |
| tafeltennis | hoog | 0.256, 0.89, 0.13 | -0.412, 0.919, 0.073 | — |
| football_rennen | hoog | 0.335, 0.923, -0.383 | -0.17, 1.151, 0.311 | — |
| football_passen | hoog | 0.77, 1.439, 0.052 | 0.135, 1.499, 0.012 | — |
| rugby_tackle | laag | 0.162, 1.174, 0.187 | 0.118, 0.59, 0.168 | handen liggen op dezelfde zijwaartse positie: links/rechts is een gok; 4 armachtige huidstukken; de 2 grootste gebruikt |
| tikspel | hoog | 0.575, 0.808, 0.2 | -0.635, 0.273, -0.064 | 3 armachtige huidstukken; de 2 grootste gebruikt |
| frisbee | hoog | 0.735, 0.878, 0.363 | -0.649, 1.029, -0.203 | — |
| honkbal_pitchen | hoog | 0.452, 1.239, -0.118 | 0.019, 1.408, -0.011 | — |
| startblokken | hoog | 0.368, 0.008, 0.5 | -0.388, 0.01, 0.489 | 4 armachtige huidstukken; de 2 grootste gebruikt |
| hoogspringen | hoog | -0.015, 0.819, 0.836 | -0.434, 0.746, -0.731 | 4 armachtige huidstukken; de 2 grootste gebruikt |
| discuswerpen | hoog | 0.598, 1.151, 0.526 | -0.562, 0.899, -0.362 | — |
| kogelstoten | hoog | 0.73, 1.473, 0.354 | -0.418, 1.129, 0.141 | — |
| speerwerpen | hoog | -0.131, 1.456, -0.03 | -0.621, 1.256, -0.224 | — |
| speer_klaarstand | hoog | 0.129, 0.919, 0.182 | -0.385, 1.109, 0.015 | — |
| fietsband | hoog | 0.007, 1.473, 0.058 | -0.429, 0.953, -0.07 | — |
| balanceren | hoog | 0.771, 1.287, -0.008 | -0.871, 1.288, 0 | — |
| handstand | laag | 0.167, 1.498, -0.046 | — | maar één armstuk gevonden: de andere hand ligt waarschijnlijk achter het lichaam of tegen het lichaam aan |
| salto | hoog | -0.098, 0.536, -0.223 | -0.291, 0.178, -0.069 | — |
| landen | hoog | 0.748, 1.349, 0.156 | -0.749, 1.353, 0.162 | — |
| judo | hoog | 0.059, 0.992, 0.397 | -0.201, 1.051, 0.228 | — |
| judo_worp | hoog | 0.47, 1.281, 0.38 | -0.255, 1.075, 0.233 | — |
| judo_partij | laag | -0.203, 0.934, 0.36 | -0.284, 1.351, 0.056 | handen liggen op dezelfde zijwaartse positie: links/rechts is een gok; 3 armachtige huidstukken; de 2 grootste gebruikt |
| judo_zittend | geen | — | — | geen armstuk gevonden (5 huidstukken) |
| bal_schieten | hoog | 0.41, 0.87, 0.397 | -0.743, 1.008, -0.277 | — |

**Lage zekerheid of geen hand (9):** volleybal_onderhands, badminton_slaan, pickleball_klaar, honkbal_slaan, verdedigen, rugby_tackle, handstand, judo_partij, judo_zittend.

## Blender-nodes die ik nodig heb (exact en per pose)
Voeg in elk pose-GLB twee lege nodes toe op de plek van de handpalm (de kracht van de greep: tussen duim en wijsvinger), met de lokale Z-as in de richting van de vingers:
- `anchor_hand_links` en `anchor_hand_rechts`, als kind van de scene (niet van een bot), in dezelfde ruimte als het model (pivot onderkant-midden, 1,8 m, voorkant +Z).
- **Eerst nodig** (afleiding mislukt of onzeker): volleybal_onderhands, badminton_slaan, pickleball_klaar, honkbal_slaan, verdedigen, rugby_tackle, handstand, judo_partij, judo_zittend.
- **Aanbevolen voor alle poses** zodra je ze hebt: de afgeleide punten zijn bruikbaar maar niet exact.
- Zodra een GLB een `anchor_hand_*` node heeft, wint die van de afleiding (de uitlezing daarvan is nog niet gebouwd; het script leest nu alleen de geometrie, dus na het toevoegen graag laten weten, dan haak ik de uitlezing in).

## Greeppunten van objecten
Er is **geen** `anchor_grip` in een GLB. Greep komt uit `lib/constants/gripPoints.ts` (regels op categorie en afmetingen, overrides met reden):
- **Ballen** (categorie ballen, ≤ 45 cm): pakbaar, greep in het midden (32 ballen in de catalogus; de reuzenbal `kin_ball_reuzenbal` is bewust niet pakbaar).
- **Sticks en rackets**: pakbaar; bij een staand model het handvat onderaan (15 cm), bij een liggend model aan het uiteinde van de lengteas. 15 items (rackets, sticks, knuppels).
- **Alles anders** (toestellen, matten, kasten, netten, pionnen, hoepels, hesjes): `pakbaar: false`. Hoepels, hesjes en estafettestokken staan nog niet in de catalogus als aparte items; zodra ze er zijn moet er een override met greep bij.
- **Blender (aanbevolen) per object**: een lege node `anchor_grip` op de plek van het handvat (racket, stick) of het midden (bal), met de Z-as langs de lengteas; voor een hoepel op de rand, voor een hesje aan de bovenkant.
