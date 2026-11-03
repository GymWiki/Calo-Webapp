# Blender → editor: pivot, transforms en namen

Regels voor 3D-assets (GLB's in `materials-3d`) zodat de collision-vorm in de
3D-editor klopt. De editor leidt de vorm af uit de **zichtbare geometrie**
(`components/canvas-3d/collision-shape.ts`); onderstaande regels voorkomen
dat er iets gecorrigeerd moet worden. Welke assets nu nog afwijken staat in
[`collision-audit.md`](collision-audit.md) (sectie "Assets die een
Blender-aanpassing nodig hebben").

## Pivot (origin)

- Zet de origin op het **midden van de voetafdruk, op de onderkant** (Object →
  Set Origin → Origin to Geometry, daarna in Z op het laagste punt).
- Afwijkende pivots werken wel (de editor bewaart `offset_x/offset_z` per
  asset), maar maken draaien en snappen minder voorspelbaar.
- Hangende of wandgemonteerde assets (ringen, touwen, borden, netten) houden hun
  origin op de **vloer onder het ophangpunt**. Hun onderkant staat dan op
  `base_m` > 0; de editor behandelt ze als "verhoogd": ze blokkeren de vloer
  niet en worden niet gestapeld.

## Transforms

- **Apply Rotation en Apply Scale (Ctrl+A) op elk object** vóór het exporteren.
  Een schuin gemodelleerd object (rotatie op de root of een node) levert een
  oriented box op; niet-uniforme schaal geeft een vervormde mesh.
- Geen niet-uniforme schaal op een parent van een gedraaid kind (dat geeft shear).
- Eenheden: meters. Assen bij export: Y omhoog (de standaard glTF-conversie van
  Blender's Z-up), lengte langs X, breedte langs Z.

## Wat meetelt voor de collision-vorm

- Alleen **zichtbare meshes**: verborgen objecten, lege nodes, camera's, lights
  en helpers tellen niet mee. Verwijder losse hulpobjecten liever helemaal.
- Skinned en instanced meshes worden ondersteund, maar houd ze liever uit
  statische assets.
- Dunne of open objecten (net, lint, doel met open voorkant): laat de
  automatische box staan of zet een override in
  `components/canvas-3d/collision-overrides.ts` (`none`, `capsule`,
  `cylinder` of `compound`), altijd met een reden.

## Namen van omgevingen

Omgevingen (gymzaal, sportveld, atletiekbaan, zwembad) zijn één GLB met losse
nodes met vaste namen (`Muur_Voor`, `Banenlijn_1_Seg_00`, `Belijning_Voetbal_…`).
Na elke wijziging: `npm run sync:environments -- --upload` (genereert `environment-nodes.ts`, zie
`docs/3d-bijwerken.md`). Is er een nieuwe of hernoemde lijn, dan moet je die ook in `environments.ts` /
`environment-kinds.ts` zetten; een test meldt het als dat ontbreekt. Three.js verwijdert de tekens `[ ] . : /`
uit nodenamen; gebruik die dus niet.

## Controleren

```
npm run audit:collision                       # rapport voor de lokale bestanden in materiaal-import/
npm run audit:collision -- --source=db        # de GLB's en maten zoals ze nu in Supabase staan
npm run audit:collision -- --write --sheet    # ook profielen, docs/collision-audit.md en de contactsheet
npm run audit:collision -- --check            # faalt als een asset geen passende vorm of override heeft
```

Na elke import of wijziging van een GLB: `npm run audit:collision -- --write`
en de gewijzigde `collision-profiles.generated.ts` committen. In de editor toont
`/plattegrond-3d?debug=collision` de vorm (blauw) naast de mesh-bounds (groen);
met `?debug=collision-legacy` zie je de oude gecentreerde box ter vergelijking.

## Bevestigingspunten (anchors) voor touwen, linten en netten

Een touw, lint of net hecht aan een **bevestigingspunt** van het object (de top van een paal, een haak, het oog van een ring), niet aan de
rand van het model of de box. De editor leest die punten in deze volgorde (zie `components/canvas-3d/anchors.ts`):

1. **Lege nodes in het GLB** met de naam `anchor_<type>_<naam>` (voorkeur, hier regel je het in Blender),
2. een override in `components/canvas-3d/anchor-overrides.ts` (alleen met een reden, tot het GLB zelf een node heeft),
3. punten afgeleid uit de echte geometrie (`anchors.generated.ts`, gemaakt door `npm run audit:anchors -- --write`: palen, pionnen, netten),
4. als er niets is: het hoogste punt in het midden van de zichtbare geometrie, met een waarschuwing in de console.

### Naamconventie

`anchor_<type>_<naam>` met type `touw`, `lint`, `net` of `haak`, en een naam uit kleine letters, cijfers en `_`.
Voorbeelden: `anchor_lint_top`, `anchor_net_links`, `anchor_haak_boven`, `anchor_touw_paal_2`. Een extra volgnummer (`_1`, `_2`) mag.
Het type bepaalt waar het punt voor te gebruiken is: een `touw`- of `haak`-punt is ook voor een lint bruikbaar; een net hecht alleen aan `net`-punten.
Three.js verwijdert de tekens `[ ] . : /` uit nodenamen; gebruik die dus niet. Verander de naam van een bestaande anchor niet: de naam wordt in
plattegronden opgeslagen.

### Hoe zet je het in Blender

- Voeg een **Empty** toe (Add → Empty → Plain Axes), geef hem de naam hierboven en zet hem **precies op het punt** waar het touw aan vast hoort te zitten:
  op het oppervlak of in het materiaal (maximaal 2 cm ernaast), niet in de lucht en niet op de rand van de omhullende box.
  Een paal: op de paal zelf (de as), vlak onder wat er bovenop zit (korf, bord). Een haak of oog: op de haak.
- Draai de Empty zo dat zijn **groene Y-as** wijst in de richting waarin het touw het object verlaat (optioneel).
- De Empty hoort bij het object (kind van de root), met Apply Rotation/Scale zoals voor elk onderdeel (zie boven). Exporteer de lege nodes mee.
- Na de export: `npm run audit:anchors -- --write` en de gewijzigde `anchors.generated.ts` en `docs/anchor-audit.md` committen.

### Hoogteverstelbaar

Een paal waar je een net of lint op verschillende hoogtes aan kunt hangen is een **verstelbare** anchor (verticale lijn). Dat stel je in via
`anchor-overrides.ts` (`adjustable: { min, max }`, in meters vanaf de pivot); het touw bewaart de gekozen hoogte en klemt die tussen min en max.

### Controleren

```
npm run audit:anchors                    # rapport in de console
npm run audit:anchors -- --write --sheet # profielen, docs/anchor-audit.md en de contactsheet bijwerken
npm run audit:anchors -- --check         # faalt als een anchor de controle niet haalt of het profiel verouderd is
```

Controles per anchor: ligt op of in de echte geometrie (≤ 2 cm van het oppervlak), is niet de rand of hoek van de bounding box, heeft een logische
hoogte, blijft op zijn plek na draaien (90°, 45°, 30°) en een verstelbaar bereik klopt. In de editor toont `?debug=collision` met de schakelaar
**Toon anchors** alle bevestigingspunten met label, naast de collision-box (blauw) en de mesh-bounds (groen).
