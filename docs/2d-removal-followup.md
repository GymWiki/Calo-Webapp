# 2D-editor verwijderd — uitrol, test en opruimvoorstellen

## Wat is er veranderd
- De 3D-editor (`/plattegrond-3d`) is de enige plattegrondeditor. `components/canvas/*` (Konva), de diagram-logica in
  `lesson-form`/`actions/lesson.ts`, `lib/services/materials.ts`, `types/material.ts` en de dependencies `konva`, `react-konva`
  en `use-image` zijn weg.
- Eén weergaveregel: `lib/activities/visual.ts` (`getActivityVisual`): geldige 3D-plattegrond met inhoud wint altijd van de
  afbeelding; anders de afbeelding; anders niets (eigenaar: "Plattegrond maken"). Ongeldige of lege 3D-data valt terug op de
  afbeelding (met `console.warn`).
- Overal toegepast: detailpagina (wizard- en eenvoudige variant), deelpagina `/les/share/[id]`, bibliotheekkaarten, "Mijn
  activiteiten", opgeslagen, teambibliotheek, landingspagina, publieke SEO-pagina's (kaarten, OG/Twitter), PDF-export, print.
- Lijsten en PDF krijgen de 3D-thumbnail IN HET GEHEUGEN in plaats van de afbeelding (`withFloorplanThumbnail`); er wordt niets
  naar de database geschreven en de afbeelding blijft ongemoeid in database en storage.
- Wizard: de Plattegrond-kaart toont "Plattegrond maken" / "Vervang door 3D-plattegrond" / "Plattegrond bewerken" en bewaart het
  concept eerst. Een afbeelding uit een geïmporteerd document wordt "Gebruik als plattegrond-afbeelding".
- Oude deeplink `/les-maken?tab=voorbereiding[&vanuit=ID]` → permanente redirect (308) naar `/plattegrond-3d[?activiteit=ID]`
  (`next.config.ts`). Andere 2D-routes bestonden niet (de editor was een dialoog).

## Uitrol (productie)
**Geen databasemigratie en geen commando's die de productiedatabase wijzigen.** Het is alleen een deploy van `main`.
De publieke pagina's en de landingspagina gebruiken de service-client voor twee smalle opzoekingen (auteur van de activiteit +
plattegrond van die auteur, alleen een thumbnail-URL komt eruit); `SUPABASE_SERVICE_ROLE_KEY` staat al in Vercel (landing +
Stripe gebruiken hem). Ontbreekt hij, dan valt de weergave terug op de afbeelding.

Backup-advies (voor de zekerheid, er wordt niets gewijzigd): maak vóór je later oude 2D-data opruimt een export van
`activiteiten` (kolommen `id, diagram_data, diagram_image_url, afbeelding`), bijv. via
`\copy (select id, diagram_data, diagram_image_url, afbeelding from activiteiten) to 'activiteiten-2d-backup.csv' csv header`.

## Rollback
Revert de PR (merge-commit) en deploy opnieuw. Alle data, afbeeldingen en 3D-plattegronden staan ongewijzigd; er is geen
datamigratie. (De dependencies komen terug via het teruggezette `package.json`/lockfile.)

## Handmatige controle na de deploy (DB-gebonden, niet in Playwright te dekken)
1. Activiteit met alleen afbeelding → detailpagina toont de afbeelding + "Vervang door 3D-plattegrond".
2. Klik de knop → editor opent met `?activiteit=<id>`; maak een plattegrond, sla op, ga terug → alleen de 3D-viewer, de
   afbeelding is nergens meer zichtbaar (kaart in bibliotheek = 3D-thumbnail, PDF-export = 3D-thumbnail, print = thumbnail).
3. Eigen activiteit zonder beide → "Plattegrond maken"; andermans activiteit zonder beide → niets.
4. Wizard (Activiteit maken): kaart "Plattegrond" — "Plattegrond maken" bewaart het concept en opent de editor; import van een document:
   "Gebruik als plattegrond-afbeelding" zet de afbeelding en toont hem op de kaart.
5. `/les-maken?tab=voorbereiding` → redirect naar `/plattegrond-3d`.

## Bewuste keuzes en beperkingen
- Anonieme pagina's (publieke SEO-pagina's, deelpagina) tonen de 3D-**thumbnail** (publiek in de bucket), niet de interactieve
  viewer: `floorplans_3d` en `material_models` zijn alleen leesbaar voor ingelogden. Een interactieve publieke viewer vraagt
  een nieuwe RLS-policy (alleen voorstel, niet gedaan).
- De 3D-thumbnail wordt bij elk opslaan in de editor gemaakt (best-effort). Ontbreekt hij, dan toont een kaart een kapot beeld;
  de detailpagina valt dan terug op de viewer zelf.
- Teamleden die niet de auteur zijn kunnen geen 3D-plattegrond maken/bewerken (de plattegrond is van de auteur, RLS); de knop
  verschijnt alleen voor de auteur.
- Kennisbank-/hulpteksten die in de database staan (niet in code) kunnen nog naar de 2D-tekenaar verwijzen; controleer ze in het beheer.

## Voorstellen voor opruimen van oude 2D-data (NIET uitgevoerd)
1. `activiteiten.diagram_data` (jsonb; 2 rijen gevuld) — na export naar `null` zetten of de kolom droppen.
2. `activiteiten.diagram_image_url` (205 rijen; meestal dezelfde afbeelding als `afbeelding`): pas droppen als alle activiteiten
   een 3D-plattegrond hebben of de afbeelding is overgezet naar `afbeelding`. Eén rij heeft een base64-afbeelding.
3. Per activiteit waarvan de afbeelding vervangen is door een 3D-plattegrond: `afbeelding` en het storage-object in bucket
   `activiteit-afbeeldingen` handmatig opruimen (pas als je zeker weet dat je niet terug wilt).
4. Tabel `materials`, RPC `increment_material_usage` en bucket `materialen-afbeeldingen`: alleen nog gebruikt door `material_models.material_id`
   (informatieve koppeling). Droppen kan pas na het weghalen van die kolom; eerst een export maken.
5. Reeds voor deze taak ongebruikte bestanden (knip-rapport): `app/(protected)/les-maken/dynamic-text-list.tsx`,
   `components/profile/ActivityDraftsList.tsx`.

## Bundelgrootte (client-JS, `npm run check:bundle-size`)
| | chunks | totaal |
| --- | ---: | ---: |
| vóór | 132 | 4,71 MB |
| na | 133 | 4,39 MB (−0,32 MB, −6,8%) |

Gemeten na een lokale `next build --webpack`; de compile slaagt, het verzamelen van pagina-data stopt lokaal zonder echte
Supabase-sleutels (zowel vóór als na deze wijziging identiek) — de volledige build draait in CI.
