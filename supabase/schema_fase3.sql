-- ============================================================================
-- Fase 3 — Modulaire & Didactische Lesvoorbereiding (CALO/ALO / LVF-stijl)
-- ============================================================================
-- Builds on supabase_schema.sql (Fase 1). Idempotent where practical.
--
-- Deviations from the literal Fase 3 spec, and why:
--   * `lessons.id` is `bigint` (Fase 1), not `uuid` — every new `lesson_id`
--     foreign key below uses `bigint` to match, instead of `uuid`.
--   * `lesson_didactics`/`lesson_blocks` use `bigint generated always as
--     identity` primary keys instead of random `uuid` v4, consistent with
--     the rest of the schema (see supabase-postgres-best-practices:
--     avoid random UUIDs as PKs — they fragment the index).
--   * Fase 1 already created a `lesson_blocks` table, but for a different,
--     never-built concept (Inleiding/Kern 1/Kern 2/Afsluiting). It has 0
--     rows and no application code references it, so it's safe to drop and
--     replace with the LVF-kernelementen model Fase 3 actually needs.
--   * `lesson_blocks.block_type` is a real Postgres enum (matching the
--     "Enum:" comment in the spec) instead of unconstrained `text`.
--   * Two columns the Tab 2/Tab 1 UI needs but the literal ALTER TABLE list
--     omitted: `lessons.participants_bench` (aantal op de bank — the spec
--     only listed `min_participants`, i.e. aantal in het veld) and
--     `lessons.lesson_date` (Datum, Tab 1).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- lessons — Fase 3 context/didactische/organisatorische velden
-- ----------------------------------------------------------------------------
alter table public.lessons
  add column if not exists lesson_date date,
  add column if not exists group_name text,
  add column if not exists movement_problem text,
  add column if not exists movement_theme text,
  add column if not exists learning_line text,
  add column if not exists goals text,
  add column if not exists points_of_attention text,
  add column if not exists rules text[],
  add column if not exists min_participants int,
  add column if not exists participants_bench int,
  add column if not exists base_materials text[],
  add column if not exists rule_materials text[];

-- ----------------------------------------------------------------------------
-- lesson_didactics — Plaatje/Praatje-instructies + de 4 L'en
-- One row per lesson (didactische analyse is 1:1 met de les).
-- ----------------------------------------------------------------------------
create table if not exists public.lesson_didactics (
  id bigint generated always as identity primary key,
  lesson_id bigint not null unique references public.lessons (id) on delete cascade,
  instructions_text text,
  lukt_het_zwak_see text,
  lukt_het_zwak_do text,
  loopt_het_see text,
  loopt_het_do text,
  leeft_het_see text,
  leeft_het_do text,
  lukt_het_goed_see text,
  lukt_het_goed_do text
);

create index if not exists lesson_didactics_lesson_id_idx on public.lesson_didactics (lesson_id);

-- ----------------------------------------------------------------------------
-- lesson_blocks — Activiteitsvoorbereiding kernelementen
-- Replaces the unused Fase 1 `lesson_blocks` (see note above).
-- ----------------------------------------------------------------------------
drop table if exists public.lesson_blocks;
drop type if exists public.lesson_block_type;

create type public.lesson_block_type as enum (
  'arrangement',
  'deelnemers_regels',
  'plaatje_praatje',
  'aandachtspunten'
);

create table public.lesson_blocks (
  id bigint generated always as identity primary key,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  block_type public.lesson_block_type not null,
  content text not null,
  created_at timestamptz not null default now(),
  unique (lesson_id, block_type)
);

create index lesson_blocks_lesson_id_idx on public.lesson_blocks (lesson_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.lesson_didactics enable row level security;
alter table public.lesson_didactics force row level security;
alter table public.lesson_blocks enable row level security;
alter table public.lesson_blocks force row level security;

-- Visibility/ownership follows the parent lesson (same pattern as Fase 1's
-- lesson_blocks/lesson_tags policies).
create policy lesson_didactics_select on public.lesson_didactics
  for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_didactics.lesson_id
        and (l.is_public = true or l.author_id = (select auth.uid()))
    )
  );

create policy lesson_didactics_write on public.lesson_didactics
  for all
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_didactics.lesson_id
        and l.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_didactics.lesson_id
        and l.author_id = (select auth.uid())
    )
  );

create policy lesson_blocks_select on public.lesson_blocks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_blocks.lesson_id
        and (l.is_public = true or l.author_id = (select auth.uid()))
    )
  );

create policy lesson_blocks_write on public.lesson_blocks
  for all
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_blocks.lesson_id
        and l.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_blocks.lesson_id
        and l.author_id = (select auth.uid())
    )
  );
