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
