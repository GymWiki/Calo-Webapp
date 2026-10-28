# Plattegrond als JSON: onderzoek

## Hoe een plattegrond nu wordt opgeslagen
- Tabel **`public.floorplans_3d`**: `id uuid`, `user_id uuid` (eigenaar, RLS), `naam text`, `activiteit_id text` (optioneel, FK naar `activiteiten`), **`data jsonb`**, `created_at`, `updated_at`.
- **`data`** is `Floorplan3dData` (`types/floorplan3d.ts`, zod-schema `floorplan3dDataSchema`):
  `{ version: 1, room: { width_m, length_m, environment?: { type, layout, hidden[] } }, items: [{ id, slug, x, y, z, rot_y_deg, rot_x_deg?, rot_z_deg?, lift_m?, locked? }], coneFields: [{ id, type: "coneField", x, z, rot_y_deg, width_m, length_m, interval_m, distribution, marker, color, corner_color }] }`.
  Meters, Y omhoog, oorsprong in het midden van de zaal. "Varianten" = `room.environment` (zaaltype/indeling + verborgen muren/onderdelen).
- Opslaan: `saveFloorplan3d` (`actions/floorplans3d.ts`) valideert met `saveFloorplan3dInputSchema` (naam + `data`) en schrijft `naam`, `activiteit_id`, `data`. `user_id` komt uit de sessie, nooit uit de client.

## Laden, normalisatie en lokale opslag
- Laden: `getFloorplan3d` → `initialFloorplan`. De editor normaliseert items bij het laden (`normalizeItemRotation`; `y` wordt opnieuw uit stapeling berekend, zie `recomputeStackedYs`). `coneFields` is optioneel bij lezen (default `[]`).
- Er is **één** formaatversie (`version: 1`) en nog geen migratiecode: er bestaat geen oudere vorm dan "zonder `coneFields`/rotatievelden", en die leest het schema al.
- Lokale kladversie (`draftStorageKey`, localStorage) bevat `{ naam, room, items, coneFields }`; gastmodus bewaart alleen daar (geen server).
- Undo: `useFloorplan3dHistory` (snapshot-stack); elke mutatie roept eerst `history.push(vorige staat)` aan.
- De deellink van de gratis tool (`lib/guest/share-codec.ts`) heeft al een afrondingsfunctie (`compactFloorplan`) en schema-validatie; die logica wordt hergebruikt.
- Een bestaand validatiescript (`validate:plattegrond`) of `docs/plattegrond.schema.json` bestaat nog niet.

## Wat mee moet in de export
| Veld | Mee? | Waarom |
|---|---|---|
| `scene` = `data` (room, items, coneFields, version) | ja, exact dezelfde JSON als de kolom `floorplans_3d.data` (alleen afgerond op 3 decimalen, vaste sleutelvolgorde) | direct plakbaar/importeerbaar |
| `naam` | ja, als `title` | handig; staat in de kolom `naam` |
| `activiteit_id`, `user_id`, `id`, tijdstempels | **nee** | persoonsgebonden/omgevingsspecifiek; het CLI-script krijgt ze als argument |

## Beslissingen
- Envelope `{ format: "gymwiki-plattegrond", version: 1, exportedAt, title, scene }`; `version` = formaatversie (`FORMAT_VERSION`, gelijk aan `scene.version`).
- Eén gedeelde module `lib/plattegrond/` (serialiseren + valideren + migreren), gebruikt door editor, deellink en CLI.
- Import: bestand → valideren → onbekende items (slug niet in de catalogus) weglaten met waarschuwing, items buiten de zaal terugschuiven (bestaande `clampItemsToRoom`), bevestigen vóór vervangen, één undo-stap.
- Ook een kaal scene-object (zonder envelope, bijvoorbeeld rechtstreeks uit Supabase geplakt) wordt geaccepteerd.
