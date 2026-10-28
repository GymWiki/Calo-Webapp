-- Minimale nabootsing van de Supabase-omgeving en de relevante bestaande tabellen/policies, ALLEEN voor de lokale RLS-test
-- (scripts/test-admin-rls.sh). Geen productiecode. De kolommen/policies spiegelen de echte migraties voor zover de test ze nodig heeft.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;

create schema storage;
create table storage.buckets (id text primary key);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets (id), name text, owner uuid);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
insert into storage.buckets values ('floorplan-previews'), ('activiteit-afbeeldingen');
create policy "floorplan_previews_owner_rw" on storage.objects for all to authenticated
  using (bucket_id = 'floorplan-previews' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'floorplan-previews' and (storage.foldername(name))[1] = (select auth.uid())::text);

create schema private;

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text not null default '',
  subscription_status text not null default 'free'
);
alter table public.users enable row level security;
create policy users_select_own on public.users for select to authenticated using (id = (select auth.uid()));
create policy users_update_own on public.users for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy users_insert_own on public.users for insert to authenticated with check (id = (select auth.uid()));

create function public.is_active_team_member(p_team_id uuid) returns boolean language sql stable as $$ select false $$;

create table public.activiteiten (
  id text primary key default gen_random_uuid()::text,
  titel text not null,
  doel text,
  categorie text,
  leerlijn text,
  afbeelding text,
  status text not null default 'draft' check (status in ('draft', 'pending', 'approved', 'rejected')),
  visibility text not null default 'private' check (visibility in ('private', 'team', 'public')),
  author_id uuid references public.users (id),
  team_id uuid,
  deleted_at timestamptz,
  deleted_by uuid,
  is_ai_generated boolean not null default false,
  like_count integer not null default 0,
  version integer not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.activiteiten enable row level security;
alter table public.activiteiten force row level security;
create policy "Activiteiten: openbaar, team of eigen" on public.activiteiten for select to authenticated
  using (visibility = 'public' or author_id = (select auth.uid()));
create policy "Anonieme bezoekers lezen openbare activiteiten" on public.activiteiten for select to anon using (visibility = 'public');
create policy "Activiteiten: eigen bijdragen aanmaken" on public.activiteiten for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Activiteiten: eigenaren of teamleden werken bij" on public.activiteiten for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Activiteiten: eigenaren verwijderen eigen" on public.activiteiten for delete to authenticated using (author_id = (select auth.uid()));

create table public.floorplans_3d (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  naam text not null default 'Nieuwe plattegrond',
  activiteit_id text references public.activiteiten (id) on delete set null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.floorplans_3d enable row level security;
create policy floorplans_3d_owner_select on public.floorplans_3d for select to authenticated using (user_id = (select auth.uid()));
create policy floorplans_3d_owner_insert on public.floorplans_3d for insert to authenticated with check (user_id = (select auth.uid()));
create policy floorplans_3d_owner_update on public.floorplans_3d for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy floorplans_3d_owner_delete on public.floorplans_3d for delete to authenticated using (user_id = (select auth.uid()));

-- Zoals in productie (floorplans_3d_activity_view.sql): bekijkers lezen de plattegrond van de AUTEUR van een zichtbare activiteit.
create policy "floorplans_3d_activity_select" on public.floorplans_3d for select to authenticated
  using (activiteit_id is not null and exists (select 1 from public.activiteiten a where a.id = floorplans_3d.activiteit_id and a.author_id = floorplans_3d.user_id));

-- Oude, e-mailgebaseerde variant (zoals in productie vóór de migratie).
create function public.is_library_admin() returns boolean language sql stable security invoker set search_path = ''
  as $$ select lower(coalesce((select auth.jwt() ->> 'email'), '')) in ('pieter.kluvers06@gmail.com') $$;

-- Supabase-standaard: anon/authenticated krijgen alle rechten op public-tabellen (RLS regelt de rest).
grant usage on schema public, storage, auth to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant execute on all functions in schema storage to anon, authenticated, service_role;

-- Testgebruikers (de eigenaar bestaat al vóór de migratie, zoals in productie; de tweede is NIET geverifieerd).
insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-0000-0000-00000000000a', 'pieter.kluvers06@gmail.com', now()),
  ('00000000-0000-0000-0000-00000000000b', 'admin@example.test', now()),
  ('00000000-0000-0000-0000-00000000000c', 'gebruiker@example.test', now()),
  ('00000000-0000-0000-0000-00000000000d', 'ander@example.test', now()),
  ('00000000-0000-0000-0000-00000000000e', 'Pieter.Kluvers06@gmail.com.nep', null);
insert into public.users (id, first_name) select id, split_part(email, '@', 1) from auth.users;
