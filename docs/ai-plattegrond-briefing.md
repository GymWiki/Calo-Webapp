# Briefing: 3D-plattegronden voor GymWiki genereren

Zelfstandig leesbaar naslagdocument. Alles hieronder is afgeleid uit de code van de GymWiki-app (bestandsnamen tussen haakjes zodat het na te lopen is). Waar iets niet uit de code te halen is staat **ONBEKEND**. Er is niets aangenomen zonder dat expliciet te zeggen.

## 0. Wat de editor werkelijk kent (belangrijk)

De 3D-plattegrondeditor is veel eenvoudiger dan je misschien verwacht. Het opgeslagen formaat bevat **alleen**: een versienummer, een rechthoekige zaal (breedte × lengte) en een lijst losse items met positie en één rotatie (om de verticale as). Er bestaat **niet**: schaal, kanteling (x/z-rotatie), varianten/kleuren, vergrendeling, pionkleur, metadata, veld-afzetgroepen (`coneField`), vaste obstakels, deuren, ramen, vloermarkeringen of een Blender-zaalmodel. Een veld met pionnen is dus gewoon een rij losse items (één per pion). Velden die hier niet staan worden door de validator als fout gemeld.

## 1. Het JSON-formaat

Opgeslagen in `public.floorplans_3d.data` (jsonb). Bron: `types/floorplan3d.ts`, letterlijk:

```ts
export const floorplan3dItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  rot_y_deg: z.number(),
});
export const floorplan3dRoomSchema = z.object({
  width_m: z.number().positive(),
  length_m: z.number().positive(),
});
export const floorplan3dDataSchema = z.object({
  version: z.literal(1),
  room: floorplan3dRoomSchema,
  items: z.array(floorplan3dItemSchema),
});
export const DEFAULT_ROOM = { width_m: 15, length_m: 27 };
```

| Veld | Type | Verplicht | Default | Toegestaan | Betekenis |
|---|---|---|---|---|---|
| `version` | getal | ja | – | exact `1` | formaatversie |
| `room.width_m` | getal | ja | 15 (nieuwe plattegrond) | > 0 (editor-invoer: min 1, stap 0,5; geen maximum) | zaalbreedte langs **X** |
| `room.length_m` | getal | ja | 27 | > 0 (idem) | zaallengte langs **Z** |
| `items[].id` | string | ja | editor: `crypto.randomUUID()` | niet leeg, uniek | id van deze plaatsing |
| `items[].slug` | string | ja | – | item-id uit de catalogus | welk model |
| `items[].x` | getal | ja | – | binnen de zaal | midden voetafdruk, meter |
| `items[].y` | getal | ja | 0 | ≥ 0 | onderkant item boven de vloer |
| `items[].z` | getal | ja | – | binnen de zaal | midden voetafdruk, meter |
| `items[].rot_y_deg` | getal | ja | 0 | editor: 0 ≤ r < 360 in stappen van 15° | draaiing om verticale as, graden |

Onbekende extra velden worden door zod stilzwijgend weggegooid. Er zijn geen verplichte `metadata`-velden. De plattegrond hoort optioneel bij een activiteit via de kolom `floorplans_3d.activiteit_id` (niet in de JSON). Machineleesbaar: `plattegrond.schema.json` (JSON Schema, alleen vorm).

**Generatie-envelop.** De validator accepteert ook `{ "aannames": [...], "plattegrond": { version, room, items } }`; dan wordt alleen `plattegrond` gecontroleerd.

**Laden (normalisatie).** Bij openen doet de editor `recomputeStackedYs(items, lookup)` (`components/canvas-3d/floorplan3d-geometry.ts`): opgeslagen `y` wordt genegeerd en opnieuw berekend; onbekende slugs worden grijze 0,5×0,5×0,5 m-blokjes (`ItemMesh.tsx`).

**Voorbeeld (eenvoudig; gebouwd met de builders, niet uit de database — zie §7):**
```json
{ "version": 1, "room": { "width_m": 15, "length_m": 27 },
  "items": [
    { "id": "mat-midden", "slug": "__dev_mat", "x": 0, "y": 0, "z": 0, "rot_y_deg": 0 },
    { "id": "bank-achterwand-1", "slug": "__dev_bank", "x": -2.3, "y": 0, "z": -13.365, "rot_y_deg": 0 },
    { "id": "bank-achterwand-2", "slug": "__dev_bank", "x": 2.3, "y": 0, "z": -13.365, "rot_y_deg": 0 } ] }
```
Het complexe voorbeeld (rijen langs twee wanden, kastenraster, cirkel van kasten, 45°-mat) staat in `docs/voorbeelden/voorbeeld-complex.json` en is te gebruiken als few-shot.

## 2. Coördinatenstelsel en eenheden (met bron)

| Punt | Waarde | Gevonden in |
|---|---|---|
| Eenheid | **meter** | `types/floorplan3d.ts` (commentaar), kolommen `length_m` e.d. in `supabase/migrations/material_models_3d.sql` |
| Omhoog | **Y** (three.js, rechtshandig) | `types/floorplan3d.ts`; `ItemMesh.tsx` (`position={[x, y, z]}`), `RoomFloor.tsx` (vloer = vlak met rotatie -π/2 om X) |
| Vloer | het **XZ**-vlak; `width_m` langs X, `length_m` langs Z | `RoomFloor.tsx` (commentaar + geometrie) |
| Oorsprong zaal | **midden van de zaal** (0,0,0) | `RoomFloor.tsx`; `applySnapping` gebruikt ±width/2, ±length/2 |
| Geldig bereik | `x ∈ [-B/2, B/2]`, `z ∈ [-L/2, L/2]` voor de hele voetafdruk (niet alleen het midden) | `floorplan3d-geometry.ts` (`applySnapping`, `findNearestFreeSpot`) |
| Pivot item | **onderkant-midden**: x/z = midden van de voetafdruk, y = onderkant | `ItemMesh.tsx` (selectiekader middelpunt op `(0, h/2, 0)`); `scripts/import-materials.mts` ("oorsprong op de vloer, gecentreerd") |
| Model-assen | lokale X = `length_m`, lokale Z = `width_m`, Y = `height_m` | `scripts/import-materials.mts` (bounding box: X→length, Z→width, Y→height) |
| Uitzonderingen pivot | geen gevonden in de code; echte GLB-bestanden zitten niet in de repo → **ONBEKEND of alle modellen zich eraan houden** | – |
| Rotatie | alleen om Y, **graden** (`rot_y_deg`), omgerekend met `THREE.MathUtils.degToRad`; geen Euler-volgorde nodig (één as) | `ItemMesh.tsx` (`rotation={[0, degToRad(rot_y_deg), 0]}`) |
| Richting rotatie | three.js: positief = tegen de klok in gezien van boven. Lokale +X wijst na rotatie θ naar `(cos θ, −sin θ)` in (x, z); lokale +Z naar `(sin θ, cos θ)` | afgeleid uit three.js-conventie (`rotation.y`), niet apart in de code vastgelegd |
| Rotatie 0 | lokale X (lengte) langs wereld-X. **Waar de "voorkant" naartoe kijkt: ONBEKEND** (geen front-concept in de code, GLB's niet beschikbaar) | – |
| Kantelen | **bestaat niet** (geen x/z-rotatie) | `types/floorplan3d.ts` |
| Schaal | **niet gebruikt**; modellen 1:1 | `ItemMesh.tsx` (geen `scale`) |
| Snapping | rasterkeuze in de editor: 0 (uit), **0,1** (default) of 0,5 m; rand/muur-snap binnen 0,1 m; rotatiestap **15°** (knop/toets R); dit is editor-state, **niet opgeslagen en niet vereist om te laden** | `floorplan3d-geometry.ts` (`SnapGridSize`, `EDGE_SNAP_TOLERANCE_M`, `ROTATION_STEP_SMALL_DEG = 15`), `Floorplan3dEditor.tsx` |
| Camera | standaard orthografisch schuin vanuit (+x, +y, +z) naar de oorsprong; er is geen "voor/achter/links/rechts"-wand in de code | `CameraRig.tsx` |

Daarom gebruiken deze documenten wandnamen op basis van de as: `minX` (x = −B/2), `maxX`, `minZ` (z = −L/2), `maxZ`.

**Drie gecontroleerde plaatsingen** (bank 3,6 × 0,27 × 0,32 m, zaal 15 × 27; `docs/voorbeelden/voorbeeld-plaatsingen.json`, slaagt in de validator). Een bank met `rot_y_deg 0` ligt met de lange zijde langs X:

| Plaatsing | x | z | rot_y_deg | Berekening |
|---|---|---|---|---|
| hoek (minX, minZ) | -5.7 | -13.365 | 0 | x = −7,5 + 3,6/2; z = −13,5 + 0,27/2 |
| midden | 0 | 0 | 0 | – |
| hoek (maxX, maxZ) | 5.7 | 13.365 | 0 | x = 7,5 − 1,8; z = 13,5 − 0,135 |

## 3. Zaal en regels

- **Standaardzaal:** 15 × 27 m (`DEFAULT_ROOM`). Dit is een constante, geen Blender-afmeting: er is **geen** Blender- of zaalmodel in de repo. De zaal wordt procedureel getekend: vlak met raster (cel 0,5 m, sectie 5 m) en een lage rand (0,3 m hoog, 0,08 m dik) buiten de zaal, geen plafond (`RoomFloor.tsx`).
- **Min/max zaalmaat:** niet afgedwongen; validator geeft een waarschuwing onder 1 m.
- **Vaste obstakels, deuren, ramen, klimrekken, ribbenbanken, spiegels, vloermarkeringen, varianten/kleuren:** bestaan niet in code of data. Wil je die later, dan moet het formaat uitgebreid worden.
- **Wat de app zelf afdwingt:** (a) bij slepen: item blijft binnen de zaal (clamp in `applySnapping`); (b) bij plaatsen: SAT-overlaptest op de voetafdruk, een item dat een *niet-stapelbaar* item overlapt zoekt de dichtstbijzijnde vrije plek (`findNearestFreeSpot`, `computeStackY`); (c) overlap met een *stapelbaar* item = stapelen: `y` wordt de bovenkant van het hoogste item eronder. Bij laden wordt niets geweigerd.
- **Voetafdruk:** rechthoek `length_m × width_m` gedraaid om (x, z) met `rot_y_deg`; overlap = SAT (`footprintsOverlap`).
- **Strengere regels dan de app (door `npm run validate:plattegrond` afgedwongen):**
  1. alleen velden `version/room/items` en `id/slug/x/y/z/rot_y_deg` (onbekende velden = fout);
  2. unieke `id`; `slug` moet in de catalogus staan;
  3. hele voetafdruk binnen de zaal (tolerantie 2 mm);
  4. geen overlap van voetafdrukken op dezelfde hoogte (items die elkaar exact raken zijn ok; tolerantie 2 mm);
  5. `rot_y_deg` een veelvoud van 15 (fout); buiten 0–360 (waarschuwing);
  6. `y` ≥ 0; `y` > 0 alleen als er een stapelbaar item direct onder staat met bovenkant op die hoogte (anders "zweeft");
  7. eindige getallen; > 3 decimalen = waarschuwing.
  Er is **geen** veiligheidsafstand in de code of de validator.
- **Stapelen vermijden.** Gebruik `y = 0` voor alles. De laadroutine `recomputeStackedYs` berekent bij het openen verkeerde hoogtes voor stapels (zie §6), dus een gestapelde plattegrond verandert in de editor. De validator waarschuwt hiervoor.

## 4. Veld afzetten met pionnen

De app heeft hier **geen** eigen object, parameters of verdelingsmodi (`coneField` bestaat niet). Een afgezet veld is gewoon N items met de slug van de pion. Gebruik de bouwsteen `veldAfzetten` (hieronder), die de posities uitrekent. Er moet wel een pion/pylon in de catalogus staan; **in de catalogus die nu in de repo staat zit geen pion** (zie §5).

## 5. Itemcatalogus

`docs/ai-item-catalog.json` (volledig) en `docs/ai-item-catalog.compact.json` (id, naam, l, b, h, categorie, stapelbaar). Bron van waarheid is de tabel `public.material_models` (gevuld door `npm run import:materials` vanuit GLB+PNG-bestanden die niet in de repo staan). De tabel was bij het schrijven **niet uitleesbaar** (Supabase-connector niet geautoriseerd; in de repo geen GLB's). De huidige catalogusbestanden bevatten daarom alleen de **3 dev-placeholders** (`__dev_kast` 1,42×0,83×1,35; `__dev_mat` 3×2×0,3; `__dev_bank` 3,6×0,27×0,32; alle stapelbaar) en zijn expliciet als zodanig gemarkeerd. **Genereer de echte catalogus met `npm run export:item-catalog`** (leest alleen `material_models`, actieve rijen; vereist `NEXT_PUBLIC_SUPABASE_URL` en `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`) — dat script is nog niet tegen de echte database getest. Velden per item: `id` (= slug), `naam`, `categorie`, `afmetingen {length_m, width_m, height_m}`, `pivot`, `front` (ONBEKEND), `allowTilt` (false), `defaultRotatie`, `collision`, `stapelbaar`. Subgroep, sporten, tags en varianten bestaan niet in de bron. Omvang (grove schatting, tekens/4): volledig ≈ 220 tokens `_meta` + ≈ 115 per item (≈ 23 000 voor 200 items); compact ≈ 29 per item (≈ 5 800 voor 200 items).

## 6. Bekende afwijkingen in de app (gevonden tijdens het afleiden)

1. **`recomputeStackedYs` breekt stapels.** Elk item kijkt naar alle overlappende items, ook naar items die er bovenop staan, waardoor beide omhoog schuiven. Getest: mat (0,3 m) met bank erop → na laden `y` = 1,56 en 1,54 m (zweven). Gevolg: nooit stapelen in gegenereerde plattegronden. Niet aangepast in deze taak.
2. **Rotatiehoek voetafdruk spiegelt de weergave.** `footprintCorners` roteert met `x·cos − z·sin`, terwijl three.js `x·cos + z·sin` gebruikt. Bij veelvouden van 90° is de voetafdruk gelijk, bij 15°/45°-rotaties verschilt de botsingsrechthoek van wat getekend wordt. Houd bij schuine items extra ruimte.
3. **`applySnapping` clampt met ongedraaide afmetingen** (`length/2`, `width/2`), niet met de gedraaide AABB; een 90° gedraaid item kan door snapping iets buiten de zaal komen. De validator controleert de echte AABB.
4. Items buiten de zaal of die elkaar overlappen worden bij laden niet gecorrigeerd.

## 7. Bouwstenen (`lib/plattegrond/builders.ts`) en gereedschap

Pure functies in meters (zelfde stelsel als de JSON), `y` altijd 0, rotaties op 15° afgerond, afmetingen uit de catalogus, onbekende slug = foutmelding:

- `rij({slug, aantal, van:{x,z}, richting:"+x"|"-x"|"+z"|"-z", tussenruimte?, rot_y_deg?})` — `van` = midden van het eerste item; tussenruimte = vrije ruimte tussen randen.
- `raster({slug, rijen, kolommen, van, stapX?, stapZ?, rot_y_deg?})` — stap = afstand tussen middelpunten; `van` = item met kleinste x en z.
- `cirkel({slug, aantal, midden, straal, beginhoek_deg?, oriëntatie?:"tangent"|"radiaal"|graden})` — hoek 0° = +X, loopt richting +Z.
- `tegenWand({slug, room, wand:"minX"|"maxX"|"minZ"|"maxZ", aantal?, langs?, tussenruimte?, afstandTotWand?, rot_y_deg?})` — vlak tegen de wand, lange zijde langs de wand, gecentreerd op `langs` (x bij minZ/maxZ, z bij minX/maxX).
- `naastElkaar({basis, slug, kant, tussenruimte?, rot_y_deg?, id})` — één item tegen een bestaand item aan.
- `veldAfzetten({slug, midden, breedte, lengte, modus:"hoeken"|"omtrek"|"raster", maxAfstand?, rijen?, kolommen?})` — markeringen met hun middelpunt op hoek/rand; breedte langs X, lengte langs Z. `omtrek`: maximaal `maxAfstand` m tussen markeringen, gelijk verdeeld; `raster`: rijen×kolommen over het hele veld inclusief rand.

Zonder code te schrijven: maak een spec-bestand `{ "room": {...}, "onderdelen": [ {"type":"rij", ...}, {"type":"item","id":"..","slug":"..","x":0,"z":0,"rot_y_deg":0}, {"type":"naastElkaar","basisId":"..",...} ] }` (voorbeelden: `docs/voorbeelden/*.spec.json`) en draai `npm run build:plattegrond -- spec.json > uit.json`. Daarna `npm run validate:plattegrond -- uit.json` (accepteert meerdere bestanden, optioneel `--catalog=pad.json`; exitcode 1 bij fouten; meldingen met pad en reden, bijv. `items[0].rot_y_deg: Rotatie 10° is geen veelvoud van 15°`).

**Over de "echte" voorbeelden.** In de database en repo bestaan geen opgeslagen 3D-plattegronden en de catalogus is leeg buiten de dev-placeholders. De twee basisvoorbeelden (`voorbeeld-eenvoudig.json`, `voorbeeld-complex.json`) zijn daarom met de builders gemaakt en door de validator en de echte laadroutine (schema-parse + `recomputeStackedYs`, ongewijzigd) gehaald — niet uit productie gekopieerd. Het "complexe" voorbeeld bevat geen veld met pionnen, gekantelde items of varianten, omdat het formaat die niet kent.
