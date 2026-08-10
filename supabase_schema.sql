-- ============================================================================
-- GymBase / GymWiki 2.0 — Database schema
-- ============================================================================
-- Run against a Supabase project's SQL editor (or via `supabase db push` /
-- a migration). Idempotent: safe to re-run on a fresh database.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Extensions & private schema
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- Helper functions live outside the public/exposed API schema.
create schema if not exists private;

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('student', 'docent');

create type public.lesson_block_type as enum (
  'Inleiding',
  'Kern 1',
  'Kern 2',
  'Afsluiting'
);

create type public.tag_category as enum (
  'Motorische Leerlijn',
  'Theorie'
);

create type public.listing_status as enum (
  'Beschikbaar',
  'Verkocht'
);

-- ============================================================================
-- Tables
-- ============================================================================

-- ----------------------------------------------------------------------------
-- users — extends auth.users with app-specific profile data
-- ----------------------------------------------------------------------------
create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'student',
  first_name text not null,
  last_name text not null,
  avatar_url text,
  available_for_internship boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.users is 'App profile for an auth.users account: role, name, avatar.';

-- ----------------------------------------------------------------------------
-- lessons — activiteiten authored by a user
-- ----------------------------------------------------------------------------
create table public.lessons (
  id bigint generated always as identity primary key,
  author_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create index lessons_author_id_idx on public.lessons (author_id);
create index lessons_is_public_idx on public.lessons (is_public) where is_public = true;

-- ----------------------------------------------------------------------------
-- lesson_blocks — building blocks (onderdelen) of a lesson
-- ----------------------------------------------------------------------------
create table public.lesson_blocks (
  id bigint generated always as identity primary key,
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  type public.lesson_block_type not null,
  content text,
  easier_variant text,
  harder_variant text,
  materials_needed text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index lesson_blocks_lesson_id_idx on public.lesson_blocks (lesson_id);

-- ----------------------------------------------------------------------------
-- tags — reference data for academische verantwoording
-- ----------------------------------------------------------------------------
create table public.tags (
  id bigint generated always as identity primary key,
  name text not null,
  category public.tag_category not null,
  unique (name, category)
);

-- ----------------------------------------------------------------------------
-- lesson_tags — many-to-many join between lessons and tags
-- ----------------------------------------------------------------------------
create table public.lesson_tags (
  lesson_id bigint not null references public.lessons (id) on delete cascade,
  tag_id bigint not null references public.tags (id) on delete cascade,
  primary key (lesson_id, tag_id)
);

create index lesson_tags_tag_id_idx on public.lesson_tags (tag_id);

-- ----------------------------------------------------------------------------
-- marketplace_listings — theorieboeken-marktplaats
-- ----------------------------------------------------------------------------
create table public.marketplace_listings (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.users (id) on delete cascade,
  isbn text,
  title text not null,
  condition text,
  price numeric(10, 2) not null check (price >= 0),
  status public.listing_status not null default 'Beschikbaar',
  created_at timestamptz not null default now()
);

create index marketplace_listings_seller_id_idx on public.marketplace_listings (seller_id);
create index marketplace_listings_status_idx on public.marketplace_listings (status);

-- ----------------------------------------------------------------------------
-- stage_logs — stage-uren logboek per student
-- ----------------------------------------------------------------------------
create table public.stage_logs (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  hours numeric(5, 2) not null check (hours > 0),
  school_type text,
  notes text,
  created_at timestamptz not null default now()
);

create index stage_logs_student_id_idx on public.stage_logs (student_id);

-- ============================================================================
-- auth.users -> public.users provisioning trigger
-- ============================================================================
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, first_name, last_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.users enable row level security;
alter table public.lessons enable row level security;
alter table public.lesson_blocks enable row level security;
alter table public.tags enable row level security;
alter table public.lesson_tags enable row level security;
alter table public.marketplace_listings enable row level security;
alter table public.stage_logs enable row level security;

alter table public.users force row level security;
alter table public.lessons force row level security;
alter table public.lesson_blocks force row level security;
alter table public.tags force row level security;
alter table public.lesson_tags force row level security;
alter table public.marketplace_listings force row level security;
alter table public.stage_logs force row level security;

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
-- Every signed-in user can see basic profiles (needed to show lesson authors,
-- marketplace sellers, etc.), but can only ever modify their own row.
create policy users_select_authenticated on public.users
  for select
  to authenticated
  using (true);

create policy users_update_own on public.users
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ----------------------------------------------------------------------------
-- lessons
-- ----------------------------------------------------------------------------
create policy lessons_select on public.lessons
  for select
  to authenticated
  using (is_public = true or author_id = (select auth.uid()));

create policy lessons_insert_own on public.lessons
  for insert
  to authenticated
  with check (author_id = (select auth.uid()));

create policy lessons_update_own on public.lessons
  for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy lessons_delete_own on public.lessons
  for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- lesson_blocks — visibility/ownership follows the parent lesson
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- tags — shared reference data, readable by anyone signed in
-- ----------------------------------------------------------------------------
create policy tags_select_authenticated on public.tags
  for select
  to authenticated
  using (true);

-- ----------------------------------------------------------------------------
-- lesson_tags — visibility/ownership follows the parent lesson
-- ----------------------------------------------------------------------------
create policy lesson_tags_select on public.lesson_tags
  for select
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_tags.lesson_id
        and (l.is_public = true or l.author_id = (select auth.uid()))
    )
  );

create policy lesson_tags_write on public.lesson_tags
  for all
  to authenticated
  using (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_tags.lesson_id
        and l.author_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.lessons l
      where l.id = lesson_tags.lesson_id
        and l.author_id = (select auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- marketplace_listings — browsable by everyone signed in, editable by seller
-- ----------------------------------------------------------------------------
create policy marketplace_listings_select_authenticated on public.marketplace_listings
  for select
  to authenticated
  using (true);

create policy marketplace_listings_insert_own on public.marketplace_listings
  for insert
  to authenticated
  with check (seller_id = (select auth.uid()));

create policy marketplace_listings_update_own on public.marketplace_listings
  for update
  to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy marketplace_listings_delete_own on public.marketplace_listings
  for delete
  to authenticated
  using (seller_id = (select auth.uid()));

-- ----------------------------------------------------------------------------
-- stage_logs — strictly private to the student who owns the log
-- ----------------------------------------------------------------------------
create policy stage_logs_owner_all on public.stage_logs
  for all
  to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));
