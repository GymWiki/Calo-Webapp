-- ============================================================================
-- Volledige Activiteiten- & Lessendatabase
-- ============================================================================
-- Rebuilds lessons/lesson_didactics/lesson_blocks/lesson_tags on `lessons.id
-- uuid` (previously `bigint` since Fase 1/3). Safe to run: at the time this
-- migration was written every one of these tables had 0 rows.
--
-- Deviations from the literal spec, and why:
--   * `lessons.id` is migrated to `uuid` as given — this is the third time
--     the spec assumes a uuid `lessons.id` (Fase 3's lesson_id FKs did too),
--     so this migration finally converges the schema on that, rather than
--     continuing to adapt every new request back to the Fase 1 `bigint` PK.
--     `lesson_didactics`, `lesson_blocks`, and the untouched-by-this-request
--     `lesson_tags` are rebuilt to match (their `lesson_id` FKs must move to
--     `uuid` too — Postgres has no implicit bigint->uuid cast).
--   * `lesson_blocks.block_type` stays the `lesson_block_type` enum added in
--     Fase 3 (same 4 values the spec's comment lists) instead of downgrading
--     to unconstrained `text` — strictly safer, no behavior change for the
--     app, and matches this task's own "robuust" framing.
--   * Fase 3 columns not mentioned in this spec (`lesson_date`,
--     `participants_bench`, `description`) are kept — nothing here asked to
--     remove them, and the lesson-builder UI already writes to them.
--   * `updated_at` gets an `on update` trigger — a column that's never
--     touched after insert isn't worth having.
--   * RLS policies keep the spec's two-policy-per-table shape and Dutch
--     names (with an "Eigenaaren" -> "Eigenaren" spelling fix), but add
--     `to authenticated` and wrap `auth.uid()` in `(select ...)` for
--     performance, consistent with the rest of this schema.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Drop & rebuild, child-to-parent order (lessons.id is changing type)
-- ----------------------------------------------------------------------------
drop table if exists public.lesson_blocks;
drop table if exists public.lesson_didactics;
drop table if exists public.lesson_tags;
drop table if exists public.lessons;

-- ----------------------------------------------------------------------------
-- lessons
-- ----------------------------------------------------------------------------
create table public.lessons (
  id uuid default gen_random_uuid() primary key,
  author_id uuid references auth.users (id) on delete cascade not null,
  title text not null,
  description text,
  group_name text,
  learning_line text,
  movement_problem text,
  movement_theme text,
  goals text,
  points_of_attention text,
  rules text[],
  min_participants int default 1,
  participants_bench int,
  base_materials text[],
  rule_materials text[],
  lesson_date date,
  is_public boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index idx_lessons_author on public.lessons (author_id);
create index idx_lessons_learning_line on public.lessons (learning_line);
create index idx_lessons_public on public.lessons (is_public);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

create trigger lessons_set_updated_at
  before update on public.lessons
  for each row execute function private.set_updated_at();

-- ----------------------------------------------------------------------------
-- lesson_didactics — Plaatje/Praatje-instructies + de 4 L'en
-- ----------------------------------------------------------------------------
create table public.lesson_didactics (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid references public.lessons (id) on delete cascade not null unique,
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

create index idx_lesson_didactics_lesson_id on public.lesson_didactics (lesson_id);

-- ----------------------------------------------------------------------------
-- lesson_blocks — Activiteitsvoorbereiding kernelementen
-- ----------------------------------------------------------------------------
create table public.lesson_blocks (
  id uuid default gen_random_uuid() primary key,
  lesson_id uuid references public.lessons (id) on delete cascade not null,
  block_type public.lesson_block_type not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (lesson_id, block_type)
);

create index idx_lesson_blocks_lesson_id on public.lesson_blocks (lesson_id);

-- ----------------------------------------------------------------------------
-- lesson_tags — untouched by this spec, but its FK must follow lessons.id
-- ----------------------------------------------------------------------------
create table public.lesson_tags (
  lesson_id uuid references public.lessons (id) on delete cascade not null,
  tag_id bigint references public.tags (id) on delete cascade not null,
  primary key (lesson_id, tag_id)
);

create index idx_lesson_tags_tag_id on public.lesson_tags (tag_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.lessons enable row level security;
alter table public.lessons force row level security;
alter table public.lesson_didactics enable row level security;
alter table public.lesson_didactics force row level security;
alter table public.lesson_blocks enable row level security;
alter table public.lesson_blocks force row level security;
alter table public.lesson_tags enable row level security;
alter table public.lesson_tags force row level security;

create policy "Eigenaren kunnen eigen lessen beheren" on public.lessons
  for all
  to authenticated
  using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);

create policy "Iedereen kan openbare lessen lezen" on public.lessons
  for select
  to authenticated
  using (is_public = true);

create policy "Eigenaren beheren didactiek" on public.lesson_didactics
  for all
  to authenticated
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_didactics.lesson_id and author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.lessons
      where id = lesson_didactics.lesson_id and author_id = (select auth.uid())
    )
  );

create policy "Iedereen leest didactiek van openbare les" on public.lesson_didactics
  for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_didactics.lesson_id and is_public = true
    )
  );

create policy "Eigenaren beheren blokken" on public.lesson_blocks
  for all
  to authenticated
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_blocks.lesson_id and author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.lessons
      where id = lesson_blocks.lesson_id and author_id = (select auth.uid())
    )
  );

create policy "Iedereen leest blokken van openbare les" on public.lesson_blocks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_blocks.lesson_id and is_public = true
    )
  );

create policy "Eigenaren beheren tags" on public.lesson_tags
  for all
  to authenticated
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_tags.lesson_id and author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.lessons
      where id = lesson_tags.lesson_id and author_id = (select auth.uid())
    )
  );

create policy "Iedereen leest tags van openbare les" on public.lesson_tags
  for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons
      where id = lesson_tags.lesson_id and is_public = true
    )
  );
