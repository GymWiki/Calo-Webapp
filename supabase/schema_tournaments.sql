create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  settings jsonb not null,
  schedule jsonb not null,
  scores jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists tournaments_author_id_idx on public.tournaments (author_id);

alter table public.tournaments enable row level security;
alter table public.tournaments force row level security;

create policy tournaments_select on public.tournaments
  for select to authenticated
  using (author_id = (select auth.uid()));

create policy tournaments_insert on public.tournaments
  for insert to authenticated
  with check (author_id = (select auth.uid()));

create policy tournaments_update on public.tournaments
  for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy tournaments_delete on public.tournaments
  for delete to authenticated
  using (author_id = (select auth.uid()));
