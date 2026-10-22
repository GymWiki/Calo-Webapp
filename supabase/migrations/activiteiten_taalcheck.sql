-- Taalcheck/optimalisatie voor activiteiten-tekstvelden: een AI-voorstel
-- wordt ALTIJD eerst hier neergezet, nooit direct in `activiteiten`
-- geschreven — pas na een expliciete review-goedkeuring (zie
-- app/(protected)/beheer/taalcheck) wordt een veld daadwerkelijk
-- bijgewerkt. Dit voorkomt dat een AI-fout (bijv. een "correctie" die
-- per ongeluk toch de inhoud verandert) direct doorwerkt in de gedeelde
-- bibliotheek.
--
-- Voor array-velden (loopt/lukt/leeft/regels/materiaal) bevatten
-- originele_tekst/voorgestelde_tekst het hele array als platte tekst, één
-- item per regel (zie arrayFieldToText/textToArrayField in
-- lib/ai/languageCheckPrompt.ts) i.p.v. één rij per item — dat houdt de
-- tabel uniform (één rij per veld per activiteit) en laat de toepasfunctie
-- het hele veld in één keer vervangen.
create table public.activiteiten_taalcheck_voorstellen (
  id uuid primary key default gen_random_uuid(),
  activiteit_id text not null references public.activiteiten(id) on delete cascade,
  veldnaam text not null,
  originele_tekst text not null,
  voorgestelde_tekst text not null,
  reden_van_wijziging text not null,
  status text not null default 'pending'
    check (status = any (array['pending', 'approved', 'rejected', 'applied'])),
  gegenereerd_op timestamptz not null default now(),
  beoordeeld_op timestamptz,
  beoordeeld_door uuid references public.users(id),
  toegepast_op timestamptz
);

create index activiteiten_taalcheck_voorstellen_activiteit_id_idx
  on public.activiteiten_taalcheck_voorstellen (activiteit_id);
create index activiteiten_taalcheck_voorstellen_status_idx
  on public.activiteiten_taalcheck_voorstellen (status);

-- Admin-only, net als de Standaardbibliotheek-beheertabellen
-- (knowledge_packages.sql) — dit project heeft geen rollensysteem, dus
-- `is_library_admin()` (dezelfde e-mail-allowlist als lib/adminAccess.ts)
-- is de RLS-handhaving; de review-pagina is er de UI/actie-laag voor.
alter table public.activiteiten_taalcheck_voorstellen enable row level security;

create policy "taalcheck_voorstellen_admin_all"
  on public.activiteiten_taalcheck_voorstellen
  for all
  to authenticated
  using (public.is_library_admin())
  with check (public.is_library_admin());

-- Zichtbaar wanneer een activiteit voor het laatst is meegenomen in een
-- (batch- of losse) taalcheck — backt zowel het admin-overzicht ("welke
-- activiteiten zijn al gecontroleerd") als de toekomstige achtergrondtaak
-- ("controleer alleen activiteiten zonder deze timestamp").
alter table public.activiteiten
  add column last_language_check_at timestamptz;

-- Verbreedt het bestaande ai_usage.feature-domein met de nieuwe taalcheck-
-- functie — non-destructief (alleen een extra toegestane waarde toevoegen
-- aan de HUIDIGE live constraint, geen bestaande rijen worden geraakt).
-- Let op: 'activity_import_extraction' staat wel in de applicatiecode
-- (lib/ai/usageTracking.ts) en in een eerdere migratiebestand
-- (ai_usage_activity_import_extraction.sql), maar die migratie is nooit
-- op deze database toegepast — de live constraint bevatte 'm nog niet vóór
-- deze migratie. Bewust hier niet stilzwijgend meegenomen (dat is een
-- apart, al bestaand euvel); alleen 'taalcheck' wordt toegevoegd.
alter table public.ai_usage drop constraint ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature = any (array[
    'activity_checker', 'lesson_generator', 'ai_lescoach',
    'knowledge_base_embedding', 'taalcheck'
  ]));
