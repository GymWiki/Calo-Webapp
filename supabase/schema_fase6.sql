-- ============================================================================
-- Fase 6 — Activiteiten-bibliotheek: bookmarks
-- ============================================================================
-- Lightweight "opgeslagen in mijn lessen" bookmark for the activiteiten-
-- bibliotheek search page. Deliberately NOT a full lessons row (see
-- docs/superpowers/specs/2026-08-11-activiteiten-bibliotheek-design.md) —
-- just a user <-> activiteit pointer so a user can toggle-save an activity
-- and find it again later.
-- ============================================================================

create table if not exists public.opgeslagen_activiteiten (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  activiteit_id text not null references public.activiteiten (id) on delete cascade,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, activiteit_id)
);

create index if not exists opgeslagen_activiteiten_user_id_idx
  on public.opgeslagen_activiteiten (user_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.opgeslagen_activiteiten enable row level security;
alter table public.opgeslagen_activiteiten force row level security;

create policy opgeslagen_activiteiten_select on public.opgeslagen_activiteiten
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy opgeslagen_activiteiten_insert on public.opgeslagen_activiteiten
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy opgeslagen_activiteiten_delete on public.opgeslagen_activiteiten
  for delete
  to authenticated
  using (user_id = (select auth.uid()));
