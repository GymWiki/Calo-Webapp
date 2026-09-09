-- ============================================================================
-- materials — uitgebreide, dynamische materialenbibliotheek voor de
-- canvas/plattegrond-editor (components/canvas/GymCanvas.tsx). Vervangt de
-- eerder hardgecodeerde materiaal-elementtypes (kast, mat, bal, ...) in
-- gym-canvas-types.ts — spelers, lijnen en pijlen blijven wél vaste,
-- hand-getekende elementtypes (die zijn geen "materiaal").
--
-- Foto's worden niet hier aangemaakt: de eigenaar uploadt ze zelf naar de
-- 'materialen-afbeeldingen'-storage-bucket hieronder en zet de publieke URL
-- in `image_url` (bijv. via de Supabase Table Editor). Nieuwe materialen
-- toevoegen is dus puur een nieuwe rij + eventueel een foto — geen
-- codewijziging nodig, precies zoals de canvas-editor ze dynamisch ophaalt.
-- ============================================================================

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  image_url text,
  usage_count integer not null default 0,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now()
);

-- Nodig voor idempotente seed-inserts hieronder (on conflict do nothing) —
-- voorkomt ook per ongeluk twee keer exact dezelfde rij.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'materials_name_category_key'
  ) then
    alter table public.materials
      add constraint materials_name_category_key unique (name, category);
  end if;
end;
$$;

create index if not exists idx_materials_category on public.materials (category);
create index if not exists idx_materials_usage_count on public.materials (usage_count desc);

alter table public.materials enable row level security;
alter table public.materials force row level security;

-- Iedereen (ingelogd) leest de volledige bibliotheek — dezelfde
-- "iedereen leest openbare content"-vorm als activiteiten/lessen. Beheer
-- (nieuwe materialen, foto's koppelen) gebeurt door een beheerder via de
-- Supabase Table Editor/Storage, niet via de app zelf, dus geen
-- insert/update/delete-policy voor gewone gebruikers nodig.
drop policy if exists "Iedereen leest materialen" on public.materials;
create policy "Iedereen leest materialen" on public.materials
  for select
  to authenticated
  using (true);

-- Enige schrijfactie die gewone gebruikers wél mogen: de gebruiksteller
-- ophogen zodra een materiaal op het canvas wordt gesleept (voor de
-- "meest gebruikt"-sectie). security definer zodat dit los staat van een
-- (hier afwezige) update-RLS-policy — de functie doet zelf niets anders
-- dan +1 op één kolom van één rij.
create or replace function public.increment_material_usage(p_material_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.materials
  set usage_count = usage_count + 1
  where id = p_material_id;
end;
$$;

-- "revoke ... from public" alleen is niet genoeg: Supabase geeft nieuwe
-- functies in het public-schema standaard óók expliciet EXECUTE aan de
-- anon-rol (los van de public-rol) — die moet hier ook weg, alleen
-- ingelogde gebruikers mogen de teller ophogen.
revoke execute on function public.increment_material_usage(uuid) from public, anon;
grant execute on function public.increment_material_usage(uuid) to authenticated;

-- ============================================================================
-- Storage bucket voor materiaal-foto's
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materialen-afbeeldingen',
  'materialen-afbeeldingen',
  true,
  10485760, -- 10 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- ============================================================================
-- Seed: volledige materialenlijst, image_url voorlopig leeg (placeholder-
-- icoon in de UI totdat een foto is geüpload). Idempotent via de unieke
-- (name, category)-constraint hierboven.
-- ============================================================================
insert into public.materials (name, category) values
  -- Ballen
  ('Basketbal', 'ballen'), ('Voetbal', 'ballen'), ('Volleybal', 'ballen'),
  ('Handbal', 'ballen'), ('Softbal', 'ballen'), ('Honkbal', 'ballen'),
  ('Tennisbal', 'ballen'), ('Hockeybal', 'ballen'), ('Medicinebal', 'ballen'),
  ('Gymnastiekbal (fitball)', 'ballen'), ('Skippybal', 'ballen'), ('Waterbal', 'ballen'),
  ('Rugbybal', 'ballen'), ('American football', 'ballen'), ('Cricketbal', 'ballen'),
  ('Korfbal', 'ballen'), ('Beachvolleybal', 'ballen'), ('Schuimbal (foambal)', 'ballen'),
  ('Stuiterbal', 'ballen'), ('Ballenbak-ballen', 'ballen'), ('Jongleerballen', 'ballen'),
  ('Slagbal', 'ballen'), ('Trefbal', 'ballen'), ('Bal met bel (aangepast sporten)', 'ballen'),

  -- Kleine handmaterialen
  ('Pionnen klein', 'kleine_handmaterialen'), ('Pionnen groot', 'kleine_handmaterialen'),
  ('Kegels', 'kleine_handmaterialen'), ('Ringen (werpring)', 'kleine_handmaterialen'),
  ('Hoepels klein', 'kleine_handmaterialen'), ('Hoepels groot', 'kleine_handmaterialen'),
  ('Frisbees', 'kleine_handmaterialen'), ('Pittenzakken', 'kleine_handmaterialen'),
  ('Jongleersjaals', 'kleine_handmaterialen'), ('Lint/wimpel/vaandel', 'kleine_handmaterialen'),
  ('Springtouw kort', 'kleine_handmaterialen'), ('Springtouw lang', 'kleine_handmaterialen'),
  ('Draaitouw voor groep', 'kleine_handmaterialen'), ('Elastieken/weerstandsbanden', 'kleine_handmaterialen'),
  ('Gymnastieklinten', 'kleine_handmaterialen'), ('Gymnastiekstokken', 'kleine_handmaterialen'),
  ('Ringen aan koord', 'kleine_handmaterialen'), ('Plastic knots', 'kleine_handmaterialen'),
  ('Diabolo', 'kleine_handmaterialen'), ('Poi', 'kleine_handmaterialen'),
  ('Sjaals voor jongleren', 'kleine_handmaterialen'), ('Dweilen/theedoeken (voor spellen)', 'kleine_handmaterialen'),
  ('Ballonnen', 'kleine_handmaterialen'),

  -- Rackets & slagmateriaal
  ('Badmintonracket', 'rackets_slagmateriaal'), ('Shuttle', 'rackets_slagmateriaal'),
  ('Tennisracket', 'rackets_slagmateriaal'), ('Tafeltennisbatje', 'rackets_slagmateriaal'),
  ('Tafeltennisballetje', 'rackets_slagmateriaal'), ('Squashracket', 'rackets_slagmateriaal'),
  ('Hockeystick', 'rackets_slagmateriaal'), ('Honkbalknuppel', 'rackets_slagmateriaal'),
  ('Softbalknuppel', 'rackets_slagmateriaal'), ('Cricketbat', 'rackets_slagmateriaal'),
  ('Floorball-stick (unihockey)', 'rackets_slagmateriaal'), ('Lacrossestick', 'rackets_slagmateriaal'),
  ('Peddel', 'rackets_slagmateriaal'), ('Foamstick/pool noodle', 'rackets_slagmateriaal'),

  -- Grote toestellen & turnmateriaal
  ('Turnmat dun', 'grote_toestellen_turnmateriaal'), ('Turnmat dik', 'grote_toestellen_turnmateriaal'),
  ('Valmat', 'grote_toestellen_turnmateriaal'), ('Airtrack', 'grote_toestellen_turnmateriaal'),
  ('Zweedse bank', 'grote_toestellen_turnmateriaal'), ('Kast (bok)', 'grote_toestellen_turnmateriaal'),
  ('Kast (pluche)', 'grote_toestellen_turnmateriaal'), ('Trampoline klein', 'grote_toestellen_turnmateriaal'),
  ('Trampoline groot', 'grote_toestellen_turnmateriaal'), ('Gym-trampoline', 'grote_toestellen_turnmateriaal'),
  ('Turnringen', 'grote_toestellen_turnmateriaal'), ('Rekstok', 'grote_toestellen_turnmateriaal'),
  ('Evenwichtsbalk laag', 'grote_toestellen_turnmateriaal'), ('Evenwichtsbalk hoog', 'grote_toestellen_turnmateriaal'),
  ('Ongelijke brug', 'grote_toestellen_turnmateriaal'), ('Klimtouw', 'grote_toestellen_turnmateriaal'),
  ('Klimrek/wandrek', 'grote_toestellen_turnmateriaal'), ('Klimwand', 'grote_toestellen_turnmateriaal'),
  ('Loopladder/behendigheidsladder', 'grote_toestellen_turnmateriaal'), ('Duikelrol', 'grote_toestellen_turnmateriaal'),
  ('Beweegbare brug/plank', 'grote_toestellen_turnmateriaal'), ('Balansboard', 'grote_toestellen_turnmateriaal'),
  ('Trapeze', 'grote_toestellen_turnmateriaal'), ('Losse gymnastiekring', 'grote_toestellen_turnmateriaal'),
  ('Bosu-bal', 'grote_toestellen_turnmateriaal'), ('Stelten', 'grote_toestellen_turnmateriaal'),
  ('Losse evenwichtsbalken', 'grote_toestellen_turnmateriaal'),

  -- Doelen, netten & mikpunten
  ('Voetbaldoel klein', 'doelen_netten_mikpunten'), ('Voetbaldoel middel', 'doelen_netten_mikpunten'),
  ('Voetbaldoel groot', 'doelen_netten_mikpunten'), ('Handbaldoel', 'doelen_netten_mikpunten'),
  ('Hockeydoel', 'doelen_netten_mikpunten'), ('Waterpolodoel', 'doelen_netten_mikpunten'),
  ('Volleybalnet', 'doelen_netten_mikpunten'), ('Badmintonnet', 'doelen_netten_mikpunten'),
  ('Tennisnet', 'doelen_netten_mikpunten'), ('Basketbalring + bord', 'doelen_netten_mikpunten'),
  ('Korfbalpaal + korf', 'doelen_netten_mikpunten'), ('Trefbal-doel', 'doelen_netten_mikpunten'),
  ('Gooi-/mikdoel', 'doelen_netten_mikpunten'), ('Cornhole-bord', 'doelen_netten_mikpunten'),
  ('Ring-werpdoel', 'doelen_netten_mikpunten'), ('Boccia-/curling-doelen', 'doelen_netten_mikpunten'),

  -- Markering, organisatie & signalering
  ('Startlijn/finishlijn', 'markering_organisatie_signalering'), ('Markeerlijnen/tape', 'markering_organisatie_signalering'),
  ('Zone-vlakken', 'markering_organisatie_signalering'), ('Hoepels als plattegrondmarkering', 'markering_organisatie_signalering'),
  ('Nummerborden', 'markering_organisatie_signalering'), ('Hesjes (diverse kleuren)', 'markering_organisatie_signalering'),
  ('Scoreborden', 'markering_organisatie_signalering'), ('Fluitje', 'markering_organisatie_signalering'),
  ('Stopwatch', 'markering_organisatie_signalering'), ('Interval-timer', 'markering_organisatie_signalering'),
  ('Seinvlaggen', 'markering_organisatie_signalering'), ('Markeerpionnen met cijfers/letters', 'markering_organisatie_signalering'),

  -- Rijtuigen & bewegingshulpmiddelen
  ('Skateboard/rolbord', 'rijtuigen_bewegingshulpmiddelen'), ('Loopfiets', 'rijtuigen_bewegingshulpmiddelen'),
  ('Step (autoped)', 'rijtuigen_bewegingshulpmiddelen'), ('Eenwieler', 'rijtuigen_bewegingshulpmiddelen'),
  ('Rolstoel', 'rijtuigen_bewegingshulpmiddelen'), ('Skelter', 'rijtuigen_bewegingshulpmiddelen'),
  ('Glijplank', 'rijtuigen_bewegingshulpmiddelen'), ('Rolbank/plankwagen', 'rijtuigen_bewegingshulpmiddelen'),

  -- Parachute & groepsspelmateriaal
  ('Bewegingsparachute', 'parachute_groepsspelmateriaal'), ('Groot doek voor groepsspellen', 'parachute_groepsspelmateriaal'),
  ('Reuzendobbelsteen', 'parachute_groepsspelmateriaal'), ('Ganzenbord-materiaal', 'parachute_groepsspelmateriaal'),
  ('Twister-mat', 'parachute_groepsspelmateriaal'), ('Kruiptunnel', 'parachute_groepsspelmateriaal'),
  ('Kangoeroebal/hüpfball', 'parachute_groepsspelmateriaal'),

  -- Fitness & kracht
  ('Step/aerobicstep', 'fitness_kracht'), ('Lichte dumbbells', 'fitness_kracht'),
  ('Enkelgewichten', 'fitness_kracht'), ('Fitnessmat', 'fitness_kracht'),
  ('Lichte kettlebell', 'fitness_kracht'), ('Weerstandsband met handvatten', 'fitness_kracht'),
  ('Battle rope', 'fitness_kracht'), ('Plyobox', 'fitness_kracht'),
  ('Balanskussen', 'fitness_kracht'), ('TRX/suspensionband', 'fitness_kracht'),

  -- Water- en zwemgerelateerd
  ('Zwemplank', 'water_zwemgerelateerd'), ('Pull-buoy', 'water_zwemgerelateerd'),
  ('Duikring', 'water_zwemgerelateerd'), ('Waterpolobal', 'water_zwemgerelateerd'),
  ('Zwemvliezen', 'water_zwemgerelateerd'), ('Drijfgordel', 'water_zwemgerelateerd'),

  -- Aangepast/inclusief sporten
  ('Zitvolleybal-net', 'aangepast_inclusief_sporten'), ('Boccia-set', 'aangepast_inclusief_sporten'),
  ('Showdown-set', 'aangepast_inclusief_sporten'), ('Geluidsbal', 'aangepast_inclusief_sporten'),
  ('Rolstoelbasketbal-materiaal', 'aangepast_inclusief_sporten'), ('Aangepaste grip-hulpmiddelen', 'aangepast_inclusief_sporten'),

  -- Veiligheid & EHBO
  ('EHBO-koffer', 'veiligheid_ehbo'), ('Pleisters/verband', 'veiligheid_ehbo'),
  ('IJszak/coldpack', 'veiligheid_ehbo'), ('Vluchtroute-/nooduitgangicoon', 'veiligheid_ehbo'),
  ('AED-icoon', 'veiligheid_ehbo')
on conflict (name, category) do nothing;
