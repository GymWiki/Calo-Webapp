-- Herbouw van de Planning-functie: het jaarplanning-concept
-- (jaarplanning_blokken, leerlijn-per-periode) vervalt volledig, vervangen
-- door een maandkalender die alle klassen van een gebruiker samen toont.
-- klassen/geplande_lessen (zie planning_feature.sql) blijven ongewijzigd —
-- hun schema past al op de nieuwe opzet.

drop table if exists public.jaarplanning_blokken;

-- ============================================================================
-- school_holidays: centraal beheerde, jaarlijks bij te werken vakantiedata
-- (Rijksoverheid, per regio Noord/Midden/Zuid). "Eenvoudig bij te werken"
-- betekent hier: gewone INSERT/UPDATE-rijen, geen codewijziging — zelfde
-- opzet als leerlijn_leeruitkomsten.sql (iedereen leest, alleen de
-- bibliotheek-beheerder schrijft via de al bestaande is_library_admin()).
-- ============================================================================

create table public.school_holidays (
  id uuid primary key default gen_random_uuid(),
  region text not null check (region in ('noord', 'midden', 'zuid')),
  name text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  school_year text not null,
  created_at timestamptz not null default now()
);

create index school_holidays_region_dates_idx
  on public.school_holidays (region, start_date, end_date);

alter table public.school_holidays enable row level security;
alter table public.school_holidays force row level security;

create policy "school_holidays_select" on public.school_holidays
  for select to authenticated using (true);

create policy "school_holidays_write_admin" on public.school_holidays
  for all to authenticated
  using (public.is_library_admin())
  with check (public.is_library_admin());

-- Schooljaar 2026-2027 en 2027-2028. Kerst- en zomervakantie zijn landelijk
-- wettelijk vastgesteld; herfst-, voorjaars- en meivakantie zijn adviesdata
-- (scholen mogen afwijken) — hier ingevuld met de landelijke adviesdata per
-- regio. Bron: rijksoverheid.nl-overzichten (via secundaire samenvattingen
-- verzameld, niet rechtstreeks bij de bron geverifieerd — zie de
-- toelichting die hierover naar de gebruiker gaat). De zomervakantie-
-- einddata voor 2028 zijn berekend als startdatum + 6 weken (de wettelijk
-- vaste lengte), omdat de exacte einddatum niet in de gevonden bron stond.
insert into public.school_holidays (region, name, start_date, end_date, school_year) values
  ('noord', 'Herfstvakantie', '2026-10-10', '2026-10-18', '2026-2027'),
  ('midden', 'Herfstvakantie', '2026-10-17', '2026-10-25', '2026-2027'),
  ('zuid', 'Herfstvakantie', '2026-10-17', '2026-10-25', '2026-2027'),
  ('noord', 'Kerstvakantie', '2026-12-19', '2027-01-03', '2026-2027'),
  ('midden', 'Kerstvakantie', '2026-12-19', '2027-01-03', '2026-2027'),
  ('zuid', 'Kerstvakantie', '2026-12-19', '2027-01-03', '2026-2027'),
  ('noord', 'Voorjaarsvakantie', '2027-02-20', '2027-02-28', '2026-2027'),
  ('midden', 'Voorjaarsvakantie', '2027-02-20', '2027-02-28', '2026-2027'),
  ('zuid', 'Voorjaarsvakantie', '2027-02-13', '2027-02-21', '2026-2027'),
  ('noord', 'Meivakantie', '2027-04-24', '2027-05-02', '2026-2027'),
  ('midden', 'Meivakantie', '2027-04-24', '2027-05-02', '2026-2027'),
  ('zuid', 'Meivakantie', '2027-04-24', '2027-05-02', '2026-2027'),
  ('noord', 'Zomervakantie', '2027-07-10', '2027-08-22', '2026-2027'),
  ('midden', 'Zomervakantie', '2027-07-17', '2027-08-29', '2026-2027'),
  ('zuid', 'Zomervakantie', '2027-07-24', '2027-09-05', '2026-2027'),
  ('noord', 'Herfstvakantie', '2027-10-16', '2027-10-24', '2027-2028'),
  ('midden', 'Herfstvakantie', '2027-10-16', '2027-10-24', '2027-2028'),
  ('zuid', 'Herfstvakantie', '2027-10-23', '2027-10-31', '2027-2028'),
  ('noord', 'Kerstvakantie', '2027-12-25', '2028-01-09', '2027-2028'),
  ('midden', 'Kerstvakantie', '2027-12-25', '2028-01-09', '2027-2028'),
  ('zuid', 'Kerstvakantie', '2027-12-25', '2028-01-09', '2027-2028'),
  ('noord', 'Voorjaarsvakantie', '2028-02-19', '2028-02-27', '2027-2028'),
  ('midden', 'Voorjaarsvakantie', '2028-02-26', '2028-03-05', '2027-2028'),
  ('zuid', 'Voorjaarsvakantie', '2028-02-26', '2028-03-05', '2027-2028'),
  ('noord', 'Meivakantie', '2028-04-29', '2028-05-07', '2027-2028'),
  ('midden', 'Meivakantie', '2028-04-29', '2028-05-07', '2027-2028'),
  ('zuid', 'Meivakantie', '2028-04-29', '2028-05-07', '2027-2028'),
  ('noord', 'Zomervakantie', '2028-07-15', '2028-08-25', '2027-2028'),
  ('midden', 'Zomervakantie', '2028-07-08', '2028-08-18', '2027-2028'),
  ('zuid', 'Zomervakantie', '2028-07-22', '2028-09-01', '2027-2028');

-- ============================================================================
-- users.holiday_region: door de gebruiker ingestelde regio, bepaalt welke
-- school_holidays-rijen in de kalender getoond worden. Nullable — geen
-- vakantie-info tonen zolang dit niet is ingesteld (zie
-- components/planning/HolidayRegionHint.tsx).
-- ============================================================================

alter table public.users
  add column holiday_region text check (holiday_region in ('noord', 'midden', 'zuid'));
