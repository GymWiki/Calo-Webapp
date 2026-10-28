# Plattegrond als JSON: downloaden, importeren en naar Supabase

## Waar de scene in Supabase hoort
Tabel **`public.floorplans_3d`**, kolom **`data`** (`jsonb`). Overige kolommen: `naam`, `activiteit_id` (text, optioneel), `user_id` (uuid, verplicht), `id`, tijdstempels. De `scene` in het exportbestand is **dezelfde JSON** als `data` (alleen afgerond op 3 decimalen en met een vaste sleutelvolgorde), dus je kunt hem zonder omzetting plakken.

## Formaat (`gymwiki-plattegrond`, versie 1)
```json
{ "format": "gymwiki-plattegrond", "version": 1, "exportedAt": "ISO-datum", "title": "…", "scene": { "version": 1, "room": {…}, "items": […], "coneFields": […] } }
```
Volledig voorbeeld: `docs/voorbeeld-plattegrond.json`. Geen `user_id`, `activiteit_id`, tokens of persoonsgegevens in het bestand. Bestandsnaam: `plattegrond-<slug-van-titel>-<datum>.json`. De versie staat in `lib/plattegrond/format.ts` (`FORMAT_VERSION`); een oudere versie wordt via `MIGRATIONS` in `lib/plattegrond/validate.ts` omgezet, een nieuwere wordt geweigerd met uitleg. Een kaal scene-object (de kolom `data` zelf) wordt ook geaccepteerd.

## In de editor
- Desktop: knop **JSON** in de bovenbalk (downloaden, kopiëren, openen). Mobiel: ⋯-menu. Werkt ook voor niet-opgeslagen plattegronden en in de gastmodus.
- **Openen**: bestand kiezen of op de editor slepen. Valideert eerst (formaat, versie, schema met pad + reden in het Nederlands). Onbekende items worden weggelaten met een lijst in de waarschuwing; items buiten de zaal worden teruggeschoven. Vervangen vraagt bevestiging als er werk staat, en is met één Ctrl+Z (undo) terug te draaien.
- Eén implementatie: `lib/plattegrond/` (serialiseren, valideren, migreren), ook gebruikt door de deellink (`lib/guest/share-codec.ts`) en het CLI-script.

## CLI (schrijft nooit zelf naar een database)
```bash
# alleen controleren
npm run validate:plattegrond -- bestand.json
# SQL maken (dry-run: toont alleen; --out schrijft een .sql-bestand)
npm run import:plattegrond -- bestand.json --user <user-uuid> [--activiteit <activiteit-id>] [--naam "Titel"] [--out plattegrond.sql]
# bestaande plattegrond bijwerken
npm run import:plattegrond -- bestand.json --id <floorplan-uuid> [--activiteit <activiteit-id>]
```
Met `NEXT_PUBLIC_SUPABASE_URL` en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (bijv. in `.env.local`) worden de slugs ook tegen `material_models` gecontroleerd (alleen lezen).

### Zelf naar productie, in deze volgorde
1. **Back-up**: Supabase → Database → Backups (of `pg_dump -t public.floorplans_3d`).
2. `npm run import:plattegrond -- bestand.json --user <uuid> --out plattegrond.sql` en lees de SQL na.
3. Draai de SQL eerst op een branch/staging; controleer de rij: `select id, naam, user_id, jsonb_array_length(data->'items') from public.floorplans_3d order by created_at desc limit 3;`
4. Daarna in de SQL-editor van productie. Terugdraaien kan met `delete from public.floorplans_3d where id = '<nieuwe id>';` (bij een update: de back-up terugzetten).
