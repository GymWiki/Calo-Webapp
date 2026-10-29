# Leerlingen in de 3D-editor

Eén bibliotheekitem **Leerling** (sectie *Personen*). Na plaatsen kies je in het itempaneel (tab *Item*, op mobiel de onderste drawer) de **pose**, de **shirtkleur** en de **grootte**. Wijzigen werkt direct op het geplaatste figuur.

## Hoe het werkt
- **Item**: een gewoon plattegrond-item met `slug = leerling_pose_<poseId>` plus optioneel `color` (`#rrggbb`) en `size` (`klein`/`middel`/`groot`). Van pose wisselen = slug vervangen, dus afmetingen, collision, rotatie (alleen draaien, nooit kantelen), export/import en viewer werken ongewijzigd. Zie `lib/students/catalog.ts` en `docs/plattegrond-json.md`.
- **Catalogus**: `lib/students/poses.json` (id, label, sporten, bron-GLB — met de hand) en `lib/students/poses.generated.json` (maten van het lichaam — door het script). Alleen poses met gegenereerde maten verschijnen in de editor. De poses staan niet in de database maar in de bucket `materials-3d/students/<id>.glb|png`.
- **Kleur**: de modellen hebben één kleurtexture waarin het shirt marineblauw is (dezelfde regel als de Blender-kleurvarianten: tint 0,52–0,72, verzadiging > 0,2). Een shader (`components/students/student-shader.ts`) vervangt precies die pixels door de gekozen kleur, met behoud van schaduw en vouwen; huid, haar, broek en schoenen blijven gelijk. Eén shaderprogramma voor alle leerlingen, één gedeeld materiaal per (pose, kleur): geen extra laadtijd of GLB's per kleur.
- **Grootte**: de GLB's zijn 1,8 m; `klein` = 1,2 m, `middel` (standaard) = 1,4 m, `groot` = 1,6 m. De collision-vorm schaalt mee (`dimsOf` in `floorplan3d-geometry.ts`).
- **Collision**: de voetafdruk van het lichaam (10e–90e percentiel van de vertices), dus een hockeystick of racket maakt de leerling niet breder.
- **Materiaaloverzicht**: leerlingen horen bij *Personen* en tellen niet mee als materiaal; de legenda toont "Aantal leerlingen" apart.

## Nieuwe pose toevoegen (geen codewijziging)
1. Exporteer de pose uit Blender **met de pose toegepast** als GLB (zonder skin: zie `scripts/blender/bake-pose.py`), 1,8 m hoog, voorkant +Z, shirt in dezelfde marineblauwe tint.
2. Zet het GLB in de bronmap (standaard `materiaal-import/leerlingen-bron/`, of je Drive-map met `--src`).
3. Voeg een regel toe aan `lib/students/poses.json`: `{ "id": "zwemmen", "label": "Zwemmen", "sporten": ["algemeen"], "file": "leerling_zwemmen.glb", "sort": 30 }` (sporten uit `lib/constants/libraryTaxonomy.ts`).
4. `npm run process:students -- --src=<map> --thumbs` (zie hieronder), commit `poses.json` + `poses.generated.json`, upload de bestanden.

## Verwerken (lokaal, schrijft niets naar Supabase)
```bash
npm run process:students -- --src="<pad naar Drive>/3D_Models/Leerlingen" --thumbs
```
Per pose: pivot = onderkant-midden van het lichaam, geometrie versimpeld tot ±6000 driehoeken (UV-naden blijven dicht), alleen de kleurtexture (WebP, 512 px), Meshopt-gecomprimeerd (hetzelfde als alle andere modellen; Draco zou een extra decoder uit een CDN vergen die de CSP blokkeert), plus een transparante thumbnail (480×360) uit dezelfde belichting. Resultaat: ±105 KB per pose (was 1,5 MB), 19 poses samen 2 MB. Uitvoer in `materiaal-import/leerlingen/` (niet in git).

## Naar productie (jij draait dit; er is niets door Claude naar productie geschreven)
Volgorde: **eerst uploaden, dan pas deployen** (anders staan er kaartjes zonder model; de editor valt dan terug op een grijs vakje, maar je wilt dat niet).
1. **Back-up (advies)**: er worden geen bestaande bestanden overschreven (nieuwe map `students/` in de bucket `materials-3d`), dus terugdraaien = die map verwijderen. Wil je toch een kopie: Supabase → Storage → `materials-3d` → map downloaden, of `supabase storage cp`.
2. Controle: `npm run upload:students -- --dry-run`
3. Uploaden (met `NEXT_PUBLIC_SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`): `npm run upload:students`
4. Controleer in een private browservenster dat `https://<project>.supabase.co/storage/v1/object/public/materials-3d/students/staand.glb` laadt.
5. Daarna de deploy. Er zijn **geen database-migraties** nodig.

Terugdraaien: de code via een Vercel-rollback; de bestanden blijven onschuldig staan.

## Bronmodellen uit de Drive (map Leerlingen)
24 unieke GLB's (alle statisch, geen rig of animatie; Tripo-meshes van ±38.000 driehoeken met 3 textures van 1024 px, gemaakt in Blender). Verwerkt tot 19 poses:

| Sport | Poses |
| --- | --- |
| Algemeen / atletiek | staand, hardlopen, juichen, startblokken, hoogspringen |
| Basketbal | dribbelen |
| Volleybal | onderhands, bovenhands |
| Badminton / racketsport | badminton slaan, pickleball klaarstaan, pickleball slaan |
| Hockey | hockey, hockey sprinten |
| Floorball | floorball, floorball sprinten |
| Slagspelen | honkbal slaan, honkbal vangen |
| Trefspelen | trefbal gooien, verdedigen |

Dubbel in de Drive (byte-identiek): `leerling_ringstel` = `juichen`, `leerling_sprintstart` = `startblokken`, `leerling_fosbury_flop` = `hoogspringen`, `leerling_unihockey` = `floorball`, `leerling_unihockey_sprint` = `floorball_sprint`. Niet gebruikt: `leerling_referentie_3d` (referentie), `leerling_sprint_temp` (tijdelijk). Kleurvarianten (`_blauw`, `_geel`, …) zijn niet nodig: de kleur wordt in de editor gekozen.

## Wat in Blender nog moet
- **Poses ontbreken**: zittend (op bank/grond), wandelen, balanceren, klimmen, hurken, springen, bal vasthouden zonder sport. De eerder geleverde `leerling_zittend_turnbank` en `leerling_wandelen` hebben een andere (laagpoly) stijl en zijn niet meegenomen.
- **Broek en schoenen kleuren** kan niet los: ze zitten in dezelfde texture als huid/haar zonder aparte materialen (`mat_shirt`/`mat_broek` bestaan niet). Wil je dat, lever dan per zone een eigen materiaal of een kleurzone-map; nu is alleen het shirt/hesje instelbaar.
- Uitrusting (bal, racket, stick, knuppel, handschoen) zit in het mesh van de pose en is niet los te zetten of te verbergen.
- `leerling.glb` (staand) en `leerling_hardlopen.glb` zijn van een oudere generatie (19k driehoeken, texture 512 px): minder gedetailleerd dan de rest.
