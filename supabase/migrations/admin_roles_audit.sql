-- Eigenaar-/adminmodus: rollen, beheerders-RLS, auditlog en plattegrond-versies.
--
-- DRAAIEN: in de Supabase SQL-editor (of `supabase db push`), als geheel, NA een back-up (zie docs/beheer.md). Idempotent.
-- Vooraf niets nodig; de app werkt ook vóór deze migratie (rol wordt dan als 'user' gelezen), maar de beheerfuncties pas erna.
--
-- 1. users.role ('user' | 'admin' | 'owner') + trigger die rolwijziging door gebruikers blokkeert + helpers is_admin()/is_owner().
-- 2. Eigenaar: het account met het geverifieerde e-mailadres hieronder krijgt role 'owner' (het e-mailadres staat ALLEEN hier).
-- 3. is_library_admin() volgt voortaan de rol (was een vaste e-mail-allowlist); de bestaande kennisbank-/taalcheck-RLS werkt zo mee.
-- 4. RLS voor beheerders op activiteiten, floorplans_3d, users en de storage-buckets floorplan-previews/activiteit-afbeeldingen.
-- 5. audit_log (wie/wanneer/veld/oud/nieuw) via triggers op activiteiten en floorplans_3d, en alleen-lezen voor beheerders.
-- 6. floorplan_versions (laatste 10 versies) + restore_floorplan_version() (alleen beheerders).

-- ============================================================================
-- 1. Rol op users
-- ============================================================================
alter table public.users add column if not exists role text not null default 'user';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_role_check') then
    alter table public.users add constraint users_role_check check (role in ('user', 'admin', 'owner'));
  end if;
end $$;

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.users where id = (select auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role in ('admin', 'owner') from public.users where id = (select auth.uid())), false);
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select role = 'owner' from public.users where id = (select auth.uid())), false);
$$;

revoke all on function public.current_app_role() from public;
revoke all on function public.is_admin() from public;
revoke all on function public.is_owner() from public;
grant execute on function public.current_app_role() to anon, authenticated, service_role;
grant execute on function public.is_admin() to anon, authenticated, service_role;
grant execute on function public.is_owner() to anon, authenticated, service_role;

-- Een gebruiker mag zijn eigen rol NOOIT wijzigen (users_update_own staat elke kolom toe). Alleen de eigenaar mag rollen
-- zetten; verbindingen zonder gebruikerssessie (SQL-editor, migraties, service-role) hebben geen auth.uid() en mogen dat ook.
create or replace function public.guard_users_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new; -- geen eindgebruiker: beheerverbinding
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'user' and not public.is_owner() then
      raise exception 'Rollen kunnen alleen door de eigenaar worden gezet.' using errcode = '42501';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role then
    if not public.is_owner() then
      raise exception 'Rollen kunnen alleen door de eigenaar worden gewijzigd.' using errcode = '42501';
    end if;
    if old.role = 'owner' and new.role <> 'owner'
       and (select count(*) from public.users where role = 'owner') <= 1 then
      raise exception 'De laatste eigenaar kan niet worden verlaagd.' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.guard_users_role() from public, anon, authenticated;

drop trigger if exists users_guard_role on public.users;
create trigger users_guard_role
  before insert or update on public.users
  for each row execute function public.guard_users_role();

-- ============================================================================
-- 2. Eigenaar (alleen als het account bestaat en het e-mailadres geverifieerd is)
-- ============================================================================
do $$
declare
  v_count integer;
begin
  update public.users u
     set role = 'owner'
    from auth.users a
   where a.id = u.id
     and lower(a.email) = lower('pieter.kluvers06@gmail.com')
     and a.email_confirmed_at is not null
     and u.role is distinct from 'owner';
  get diagnostics v_count = row_count;
  raise notice 'Eigenaar gezet voor % account(s) (0 = al eigenaar, of account/verificatie ontbreekt).', v_count;
end $$;

-- ============================================================================
-- 3. is_library_admin() volgt de rol (voorheen een vaste e-mail-allowlist)
-- ============================================================================
create or replace function public.is_library_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select public.is_admin();
$$;

-- ============================================================================
-- 4. Beheerders-RLS (permissive: komt náást de bestaande policies; gewone gebruikers houden hun rechten)
-- ============================================================================
drop policy if exists "Activiteiten: beheerders lezen alles" on public.activiteiten;
create policy "Activiteiten: beheerders lezen alles" on public.activiteiten
  for select to authenticated using (public.is_admin());

drop policy if exists "Activiteiten: beheerders werken alles bij" on public.activiteiten;
create policy "Activiteiten: beheerders werken alles bij" on public.activiteiten
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Activiteiten: beheerders verwijderen alles" on public.activiteiten;
create policy "Activiteiten: beheerders verwijderen alles" on public.activiteiten
  for delete to authenticated using (public.is_admin());

drop policy if exists "floorplans_3d_admin_select" on public.floorplans_3d;
create policy "floorplans_3d_admin_select" on public.floorplans_3d
  for select to authenticated using (public.is_admin());

drop policy if exists "floorplans_3d_admin_update" on public.floorplans_3d;
create policy "floorplans_3d_admin_update" on public.floorplans_3d
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "floorplans_3d_admin_delete" on public.floorplans_3d;
create policy "floorplans_3d_admin_delete" on public.floorplans_3d
  for delete to authenticated using (public.is_admin());

-- Beheerders zien de naam van auteurs/eigenaren in de lijsten.
drop policy if exists "users_select_admin" on public.users;
create policy "users_select_admin" on public.users
  for select to authenticated using (public.is_admin());

-- Alleen de eigenaar mag andermans profiel (en dus rol) wijzigen; de trigger guard_users_role bewaakt daarnaast elke rolwijziging.
drop policy if exists "users_update_owner" on public.users;
create policy "users_update_owner" on public.users
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- Previews en afbeeldingen van andermans plattegronden/activiteiten mogen beheerders ook schrijven (map = eigenaar).
drop policy if exists "floorplan_previews_admin_rw" on storage.objects;
create policy "floorplan_previews_admin_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'floorplan-previews' and public.is_admin())
  with check (bucket_id = 'floorplan-previews' and public.is_admin());

drop policy if exists "activiteit_afbeeldingen_admin_rw" on storage.objects;
create policy "activiteit_afbeeldingen_admin_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'activiteit-afbeeldingen' and public.is_admin())
  with check (bucket_id = 'activiteit-afbeeldingen' and public.is_admin());

-- ============================================================================
-- 5. Auditlog
-- ============================================================================
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid references public.users (id) on delete set null,
  actor_role text,
  entity_type text not null check (entity_type in ('activiteit', 'plattegrond')),
  entity_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  -- { "veld": { "old": …, "new": … } }
  changes jsonb not null default '{}'::jsonb
);

create index if not exists audit_log_entity_idx on public.audit_log (entity_type, entity_id, at desc);
create index if not exists audit_log_at_idx on public.audit_log (at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;

drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin" on public.audit_log
  for select to authenticated using (public.is_admin());
-- Geen insert/update/delete-policy: schrijven kan alleen via de security-definer triggers hieronder.

create or replace function public.audit_activity_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_skip text[] := array['updated_at', 'like_count', 'version'];
begin
  if tg_op = 'INSERT' then
    v_changes := jsonb_build_object('titel', jsonb_build_object('old', null, 'new', new.titel));
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    for v_key in select jsonb_object_keys(v_new) loop
      continue when v_key = any (v_skip);
      if v_new -> v_key is distinct from v_old -> v_key then
        v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  else
    v_changes := jsonb_build_object('_rij', jsonb_build_object('old', to_jsonb(old), 'new', null));
  end if;

  insert into public.audit_log (actor_id, actor_role, entity_type, entity_id, action, changes)
  values (
    (select auth.uid()),
    public.current_app_role(),
    'activiteit',
    case when tg_op = 'DELETE' then old.id else new.id end,
    lower(tg_op),
    v_changes
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.audit_activity_change() from public, anon, authenticated;

drop trigger if exists activiteiten_audit on public.activiteiten;
create trigger activiteiten_audit
  after insert or update or delete on public.activiteiten
  for each row execute function public.audit_activity_change();

create or replace function public.audit_floorplan_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    v_changes := jsonb_build_object('naam', jsonb_build_object('old', null, 'new', new.naam));
  elsif tg_op = 'UPDATE' then
    if new.naam is distinct from old.naam then
      v_changes := v_changes || jsonb_build_object('naam', jsonb_build_object('old', old.naam, 'new', new.naam));
    end if;
    if new.activiteit_id is distinct from old.activiteit_id then
      v_changes := v_changes || jsonb_build_object('activiteit_id', jsonb_build_object('old', old.activiteit_id, 'new', new.activiteit_id));
    end if;
    if new.user_id is distinct from old.user_id then
      v_changes := v_changes || jsonb_build_object('user_id', jsonb_build_object('old', old.user_id, 'new', new.user_id));
    end if;
    if new.data is distinct from old.data then
      -- Geen volledige scene in het log (die staat in floorplan_versions): alleen een samenvatting.
      v_changes := v_changes || jsonb_build_object('data', jsonb_build_object(
        'old', jsonb_build_object('items', jsonb_array_length(coalesce(old.data -> 'items', '[]'::jsonb)), 'coneFields', jsonb_array_length(coalesce(old.data -> 'coneFields', '[]'::jsonb))),
        'new', jsonb_build_object('items', jsonb_array_length(coalesce(new.data -> 'items', '[]'::jsonb)), 'coneFields', jsonb_array_length(coalesce(new.data -> 'coneFields', '[]'::jsonb)))
      ));
    end if;
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  else
    v_changes := jsonb_build_object('_rij', jsonb_build_object('old', jsonb_build_object('naam', old.naam, 'user_id', old.user_id, 'activiteit_id', old.activiteit_id), 'new', null));
  end if;

  insert into public.audit_log (actor_id, actor_role, entity_type, entity_id, action, changes)
  values (
    (select auth.uid()),
    public.current_app_role(),
    'plattegrond',
    (case when tg_op = 'DELETE' then old.id else new.id end)::text,
    lower(tg_op),
    v_changes
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function public.audit_floorplan_change() from public, anon, authenticated;

drop trigger if exists floorplans_3d_audit on public.floorplans_3d;
create trigger floorplans_3d_audit
  after insert or update or delete on public.floorplans_3d
  for each row execute function public.audit_floorplan_change();

-- ============================================================================
-- 6. Plattegrond-versies (laatste 10) en terugzetten
-- ============================================================================
create table if not exists public.floorplan_versions (
  id uuid primary key default gen_random_uuid(),
  floorplan_id uuid not null references public.floorplans_3d (id) on delete cascade,
  version integer not null,
  naam text not null,
  data jsonb not null,
  -- wie de plattegrond na deze versie heeft overschreven
  replaced_by uuid references public.users (id) on delete set null,
  saved_at timestamptz not null default now(),
  unique (floorplan_id, version)
);

create index if not exists floorplan_versions_idx on public.floorplan_versions (floorplan_id, version desc);

alter table public.floorplan_versions enable row level security;
revoke all on public.floorplan_versions from anon, authenticated;
grant select on public.floorplan_versions to authenticated;

drop policy if exists "floorplan_versions_select" on public.floorplan_versions;
create policy "floorplan_versions_select" on public.floorplan_versions
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.floorplans_3d f where f.id = floorplan_id and f.user_id = (select auth.uid()))
  );

-- Bewaart de OUDE staat vóór een wijziging. Gedund: de editor slaat automatisch op, dus er komt hooguit één versie per
-- 10 minuten per persoon bij (of altijd bij een terugzetactie). De laatste 10 blijven bewaard.
create or replace function public.snapshot_floorplan_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_force boolean := coalesce(current_setting('gymwiki.force_version', true), '') = '1';
  v_next integer;
begin
  if not v_force and exists (
    select 1 from public.floorplan_versions v
    where v.floorplan_id = old.id
      and v.replaced_by is not distinct from v_actor
      and v.saved_at > now() - interval '10 minutes'
  ) then
    return new;
  end if;

  select coalesce(max(version), 0) + 1 into v_next from public.floorplan_versions where floorplan_id = old.id;
  insert into public.floorplan_versions (floorplan_id, version, naam, data, replaced_by)
  values (old.id, v_next, old.naam, old.data, v_actor);
  delete from public.floorplan_versions where floorplan_id = old.id and version <= v_next - 10;
  return new;
end;
$$;

revoke all on function public.snapshot_floorplan_version() from public, anon, authenticated;

drop trigger if exists floorplans_3d_versions on public.floorplans_3d;
create trigger floorplans_3d_versions
  before update on public.floorplans_3d
  for each row
  when (old.data is distinct from new.data or old.naam is distinct from new.naam)
  execute function public.snapshot_floorplan_version();

create or replace function public.restore_floorplan_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v record;
begin
  if not public.is_admin() then
    raise exception 'Alleen beheerders mogen een versie terugzetten.' using errcode = '42501';
  end if;
  select * into v from public.floorplan_versions where id = p_version_id;
  if not found then
    raise exception 'Versie niet gevonden.' using errcode = 'P0002';
  end if;
  perform set_config('gymwiki.force_version', '1', true);
  update public.floorplans_3d set data = v.data, naam = v.naam where id = v.floorplan_id;
end;
$$;

revoke all on function public.restore_floorplan_version(uuid) from public, anon;
grant execute on function public.restore_floorplan_version(uuid) to authenticated;
