-- ============================================================================
-- 3D-plattegrondeditor (NAAST de bestaande 2D-canvas-editor, zie
-- components/canvas/GymCanvas.tsx — die blijft ongewijzigd). Twee nieuwe
-- tabellen:
--
-- material_models: 3D-tegenhanger van public.materials (de 2D-materialen-
-- bibliotheek, zie materials_library.sql) — EEN los GLB-model + PNG-preview
-- per rij. Bewust GEEN automatische import vanuit `materials`: deze tabel
-- begint LEEG en wordt uitsluitend gevuld door `npm run import:materials`
-- (scripts/import-materials.ts, service-role) op basis van bestanden die de
-- eigenaar zelf in materiaal-import/ zet — zie dat script voor de uitleg
-- waarom hier bewust geen seed-data staat.
--
-- floorplans_3d: eigen, losse tabel (GEEN kolom op activiteiten — die
-- blijft voor de 2D-tekening ongewijzigd). Een 3D-plattegrond kan optioneel
-- aan een activiteit gekoppeld worden via activiteit_id, puur als
-- spiegeling van "waar hoort dit bij" — activiteiten.id is `text` (niet
-- uuid, legacy Firebase-import, zie consolidate_lessons_into_activiteiten.sql
-- e.v.), dus deze FK-kolom is ook text.
-- ============================================================================

create table if not exists public.material_models (
  id uuid primary key default gen_random_uuid(),
  -- Ook de bestandsnaam (zonder extensie) in materiaal-import/ — kleine
  -- letters/cijfers/underscores, zie scripts/import-materials.ts.
  slug text not null unique,
  -- Optionele koppeling aan het bestaande 2D-materiaal (public.materials,
  -- uuid) — alleen gezet als de JSON naast het GLB/PNG-bestand een
  -- material_id meegeeft. on delete set null: een later verwijderd
  -- 2D-materiaal mag een 3D-model nooit laten verdwijnen.
  material_id uuid references public.materials (id) on delete set null,
  naam text not null,
  categorie text not null default 'overig',
  model_path text not null,
  preview_path text not null,
  length_m numeric(6, 3) not null check (length_m > 0),
  width_m numeric(6, 3) not null check (width_m > 0),
  height_m numeric(6, 3) not null check (height_m > 0),
  stackable boolean not null default true,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists material_models_categorie_idx
  on public.material_models (categorie);
create index if not exists material_models_active_idx
  on public.material_models (active);

create or replace function public.trg_touch_material_model()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists material_models_touch on public.material_models;
create trigger material_models_touch
  before update on public.material_models
  for each row execute function public.trg_touch_material_model();

alter table public.material_models enable row level security;

-- Alleen select, en alleen voor ingelogde gebruikers — de 2D-materialen
-- (public.materials) zijn ook alleen `to authenticated` leesbaar (zie
-- materials_library.sql), dus geen anon-policy nodig voor consistentie.
-- Geen insert/update/delete-policy: schrijven kan uitsluitend via de
-- service-role (het importscript), nooit vanuit de app zelf.
drop policy if exists "material_models_select" on public.material_models;
create policy "material_models_select"
  on public.material_models
  for select
  to authenticated
  using (true);

-- ============================================================================
-- floorplans_3d — eigen, losse opslag voor de 3D-editor (los van
-- activiteiten.diagram_data, dat de 2D-tekening blijft bevatten).
-- ============================================================================

create table if not exists public.floorplans_3d (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  naam text not null default 'Nieuwe plattegrond',
  -- Optionele spiegeling van "bij welke activiteit hoort dit" — puur
  -- informatief, geen enkele 2D-kolom wijzigt hierdoor. activiteiten.id is
  -- text (zie hierboven), dus geen uuid-FK.
  activiteit_id text references public.activiteiten (id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists floorplans_3d_user_id_idx
  on public.floorplans_3d (user_id);
create index if not exists floorplans_3d_activiteit_id_idx
  on public.floorplans_3d (activiteit_id);

create or replace function public.trg_touch_floorplan_3d()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists floorplans_3d_touch on public.floorplans_3d;
create trigger floorplans_3d_touch
  before update on public.floorplans_3d
  for each row execute function public.trg_touch_floorplan_3d();

alter table public.floorplans_3d enable row level security;

drop policy if exists "floorplans_3d_owner_select" on public.floorplans_3d;
create policy "floorplans_3d_owner_select"
  on public.floorplans_3d
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "floorplans_3d_owner_insert" on public.floorplans_3d;
create policy "floorplans_3d_owner_insert"
  on public.floorplans_3d
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "floorplans_3d_owner_update" on public.floorplans_3d;
create policy "floorplans_3d_owner_update"
  on public.floorplans_3d
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "floorplans_3d_owner_delete" on public.floorplans_3d;
create policy "floorplans_3d_owner_delete"
  on public.floorplans_3d
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================================
-- Storage bucket voor de 3D-modellen/previews. Public (net als
-- materialen-afbeeldingen): modellen/previews zijn geen gevoelige data en
-- moeten rechtstreeks via next/image en useGLTF (browser-fetch) laadbaar
-- zijn zonder signed URLs. GEEN storage.objects-policy nodig voor schrijven
-- — zonder insert-policy kan alleen de service-role (import-script)
-- schrijven, exact zoals materialen-afbeeldingen dat al doet.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials-3d',
  'materials-3d',
  true,
  20971520, -- 20MB — ruim boven de 5MB-waarschuwingsgrens van het importscript
  array['model/gltf-binary', 'image/png']
)
on conflict (id) do nothing;
