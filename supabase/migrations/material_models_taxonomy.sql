-- ============================================================================
-- Herindeling 3D-itembibliotheek: één hoofdcategorie + subgroep + sporten +
-- tags per item, en favorieten per gebruiker. Zie
-- lib/constants/libraryTaxonomy.ts (de indeling zelf) en
-- scripts/migrate-categories.mts (vult de nieuwe kolommen).
--
-- BACKWARDS COMPATIBLE: er verdwijnt niets. `categorie` blijft bestaan (krijgt
-- na `npm run migrate:categories -- --apply` de nieuwe hoofdcategorie-id); de
-- oude waarde blijft bewaard in `categorie_oud` tot de eigenaar akkoord geeft.
-- Item-id's en slugs veranderen NIET, dus opgeslagen plattegronden en
-- activiteiten (die via slug verwijzen) blijven werken. Zolang deze migratie
-- niet is gedraaid, valt de app terug op de automatische indeling in code.
--
-- Uitvoeren: Supabase Dashboard → SQL Editor → plak dit bestand → Run.
-- Idempotent: veilig om opnieuw te draaien.
-- ============================================================================

alter table public.material_models
  add column if not exists categorie_oud text,
  add column if not exists subgroep text,
  add column if not exists sporten text[] not null default '{}',
  add column if not exists tags text[] not null default '{}';

-- Bewaar de huidige (oude) categorie eenmalig vóór het migratiescript
-- `categorie` overschrijft.
update public.material_models
  set categorie_oud = categorie
  where categorie_oud is null;

create index if not exists material_models_sporten_idx
  on public.material_models using gin (sporten);
create index if not exists material_models_tags_idx
  on public.material_models using gin (tags);
create index if not exists material_models_subgroep_idx
  on public.material_models (subgroep);

comment on column public.material_models.categorie is
  'Hoofdcategorie-id uit lib/constants/libraryTaxonomy.ts (toestellen, doelen_netten, ballen, matten, klein_materiaal, fitness, opslag_karren) of personen.';
comment on column public.material_models.categorie_oud is
  'Oorspronkelijke vrije-tekst categorie vóór de herindeling; verwijderen na akkoord.';
comment on column public.material_models.sporten is
  'Sport-id''s voor het sportfilter; minstens één (algemeen als terugval).';

-- ---------------------------------------------------------------------------
-- Favorieten per gebruiker (ster-icoon in de bibliotheek). De app bewaart
-- favorieten ook in localStorage als terugval, dus deze tabel is optioneel.
-- ---------------------------------------------------------------------------
create table if not exists public.material_model_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, slug)
);

alter table public.material_model_favorites enable row level security;

drop policy if exists "material_model_favorites_select" on public.material_model_favorites;
create policy "material_model_favorites_select"
  on public.material_model_favorites
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "material_model_favorites_insert" on public.material_model_favorites;
create policy "material_model_favorites_insert"
  on public.material_model_favorites
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "material_model_favorites_delete" on public.material_model_favorites;
create policy "material_model_favorites_delete"
  on public.material_model_favorites
  for delete to authenticated
  using ((select auth.uid()) = user_id);
