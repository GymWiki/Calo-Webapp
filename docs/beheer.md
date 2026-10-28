# Eigenaar-/adminmodus: werking, productiestappen en controle

Onderzoek en afwegingen: `docs/beheer-onderzoek.md`.

## Wat er is
- **Rol** in `public.users.role`: `user` (standaard), `admin`, `owner`. Afgedwongen in de database: een trigger blokkeert elke rolwijziging door gebruikers (ook de eigen), alleen de eigenaar mag rollen zetten (policy `users_update_owner`), de laatste eigenaar kan niet verlaagd worden. Er staat geen e-mailadres in de app; het e-mailadres van de eigenaar staat alleen in de migratie (en wordt daar alleen gebruikt als het account bestaat en het e-mailadres geverifieerd is).
- **Beheerders-RLS** (admin én owner): alle `activiteiten` en `floorplans_3d` lezen, aanpassen, verwijderen; `users` lezen; schrijven in de buckets `floorplan-previews` en `activiteit-afbeeldingen`. Gewone gebruikers houden hun rechten; anoniem alleen publiek. `public.is_library_admin()` volgt nu de rol (voorheen een vaste e-mail-allowlist), dus kennisbank-beheer, taalcheck en AI-import werken mee.
- **Auditlog** `public.audit_log` (wie, wanneer, rol, veld, oud, nieuw) via triggers op `activiteiten` en `floorplans_3d`, dus ook wijzigingen via de wizard of editor. Alleen lezen voor beheerders; schrijven alleen via de triggers.
- **Plattegrond-versies** `public.floorplan_versions`: de oude staat vóór elke wijziging (gedund: hooguit één per 10 minuten per persoon), laatste 10 bewaard. Terugzetten via `restore_floorplan_version()` (alleen beheerders; bewaart eerst de huidige staat).

## Routes en acties die alleen voor beheerders zijn
| Wat | Waar | Afdwinging |
|---|---|---|
| `/beheer`, `/beheer/activiteiten/[id]`, `/beheer/ai-import`, `/beheer/taalcheck` | pagina's | anoniem: redirect naar `/login` (`proxy.ts`); ingelogd zonder rol: 404 (`app/(protected)/beheer/layout.tsx` + elke pagina via `requireAdminPage`) |
| Server-acties in `actions/admin.ts` (bewerken, status, bulk, zacht/definitief verwijderen, terugzetten, afbeelding verwijderen, plattegrond koppelen/versies) | server-acties | `getAdminContext`: rol uit de database (`is_admin()` op de sessie), zod-validatie, rate limit (60 schrijfacties per minuut per gebruiker); RLS is de echte grens |
| Andermans plattegrond openen/opslaan, preview schrijven | `/plattegrond-3d?open=<id>`, `saveFloorplan3d`, `saveFloorplanPreview` | RLS-policies; een niet-beheerder krijgt 0 rijen |
| Knoppen "Bewerken", "Plattegrond bewerken", dashboard-link, Beheer-badge | UI | alleen weergave; zonder rol doet de server niets |
Er zijn geen aparte API-routes voor beheer.

## Productie: volgorde en commando's (ik heb niets op productie uitgevoerd)
1. **Back-up** (Supabase Dashboard → Database → Backups → nu een back-up, of een Point-in-Time-moment noteren). Optioneel extra: `pg_dump --data-only -t public.users -t public.activiteiten -t public.floorplans_3d "<connection-string>" > back-up-vooraf.sql`.
2. **Migratie draaien** (SQL-editor, het hele bestand in één keer): `supabase/migrations/admin_roles_audit.sql`. Het is idempotent. In de uitvoer staat een melding `Eigenaar gezet voor 1 account(s)`.
3. **Controleer de eigenaar**:
   ```sql
   select u.id, a.email, a.email_confirmed_at is not null as geverifieerd, u.role
   from public.users u join auth.users a on a.id = u.id
   where u.role in ('admin', 'owner');
   ```
   Je account moet hier staan met `role = owner` en `geverifieerd = true`. Staat er niets (melding `0 account(s)`)? Dan bestaat het account niet onder dat e-mailadres of is het niet geverifieerd; los dat op en draai alleen het blok `-- 2. Eigenaar` opnieuw.
4. **Deploy** de code daarna (migratie eerst: kennisbank-beheer, taalcheck en AI-import controleren de rol nu in de database). De app werkt ook zonder migratie (de rol wordt dan als `user` gelezen), maar dan zijn de beheerfuncties uit.
5. **Controle in de app**: inloggen als eigenaar → op het dashboard staat de link "Beheer"; `/beheer` toont de lijst; in een activiteit staan "Bewerken" en (met plattegrond) "Plattegrond bewerken".
6. Een tweede beheerder aanwijzen (alleen de eigenaar, of de SQL-editor): `update public.users set role = 'admin' where id = '<uuid>';`

**Terugdraaien** (alleen als het echt moet): `drop trigger users_guard_role on public.users; drop policy users_update_owner on public.users; drop policy users_select_admin on public.users;` en de `… admin …`-policies op `activiteiten`, `floorplans_3d` en `storage.objects` (zie de namen in het migratiebestand), `drop table public.floorplan_versions, public.audit_log;`, en herstel `is_library_admin()` naar de e-mailvariant uit `supabase/migrations/knowledge_packages.sql`. De kolom `users.role` mag blijven staan.

## Tests
- `npm run test:rls`: start een tijdelijke lokale Postgres (nooit productie) met een nagebouwde Supabase-omgeving, past de migratie twee keer toe en draait 60 controles: owner/admin kunnen lezen, schrijven, publiceren en verwijderen; een gewone gebruiker alleen eigen data; anoniem alleen publiek; niemand behalve de eigenaar kan een rol wijzigen (ook niet de eigen); auditlog, versies, terugzetten en storage-policies. De stub spiegelt de echte tabellen en policies maar is geen kopie van productie.
- `npm test` (unit: rollen, status, schema's, filters, rate limit) en `e2e/beheer.spec.ts` (anoniem naar `/login`, beheerbadge in de editor; desktop, iPhone 14, Pixel 7).

## Tweestapsverificatie (aanbevolen, niet afgedwongen)
Een eigenaarsaccount kan alles beheren; zet daarom MFA (TOTP) aan op dat account via Supabase Auth (`supabase.auth.mfa.enroll`) en laat sessies verlopen. Dit is nog niet in de app gebouwd; het is een logische vervolgstap voor de login van beheerders.

## Open punten
- **Playwright als owner**: er is lokaal geen Supabase-stack, dus de volledige flow (inloggen als owner, bewerken, status, bulk, plattegrond opslaan, auditlog, terugzetten) is niet in de browser doorlopen. Rechten en databasegedrag zijn getest met de RLS-tests; de acties zijn alleen met typecontrole en unit-tests gedekt. Doorloop dat na de migratie eenmalig handmatig (of met een testaccount op een Supabase-branch).
- **Velden uit de opdracht die niet bestaan**: sporten, tags, duur en groepsgrootte zijn geen kolommen; wel categorie, leerlijn, niveau, doelgroep, materialen, minimum deelnemers en bank. Bulkacties gaan daarom over categorie, leerlijn en status.
- **Gearchiveerd** is afgeleid (goedgekeurd, niet openbaar), geen aparte kolom. Teamactiviteiten wisselen niet van status via het beheer (bestaande database-guard).
- **Afbeelding vervangen**: alleen via een https-adres of verwijderen; een upload vanuit het beheer is niet gebouwd.
- **Rolbeheer in de UI** ontbreekt bewust; rollen zet je met SQL (stap 6).
- **Concepten nakijken** (AI-gegenereerde plattegronden): er is geen reviewwachtrij voor plattegronden; de bestaande AI-import- en taalcheck-pagina's staan wel in het beheermenu.
- De wizard (`/les-maken`) is niet hergebruikt voor beheer: zie de afweging in het onderzoek.
