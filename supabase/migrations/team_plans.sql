-- Teamabonnement voor scholen/vaksecties: één eigenaar betaalt een jaarlijks
-- pakket op factuur, nodigt collega's uit, die daarmee dezelfde toegang
-- krijgen als een individuele paid_subscriber — zonder zelf te betalen of
-- aan de bijdrage-eis te hoeven voldoen. Alle statements zijn idempotent.

-- ============================================================================
-- 1. teams
-- ============================================================================
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.users (id) on delete cascade,
  plan text not null,
  seat_limit integer not null,
  status text not null default 'active',
  stripe_customer_id text,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  -- Optioneel domein-slot (bijv. "schoolnaam.nl") — nieuwe uitnodigingen/
  -- acceptaties naar een ander domein worden geweigerd zodra dit gezet is.
  -- Standaard null (uit), zie actions/team.ts.
  allowed_email_domain text,
  -- Factuurgegevens die de koper bij aanschaf opgeeft (STAP "BTW EN
  -- FACTURERING") — puur weergave/archief hier; de daadwerkelijke factuur
  -- wordt door Stripe gegenereerd met deze velden als custom_fields.
  invoice_name text,
  invoice_vat_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'teams_plan_check') then
    alter table public.teams
      add constraint teams_plan_check check (plan in ('team_s', 'team_m', 'team_l'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teams_status_check') then
    alter table public.teams
      add constraint teams_status_check check (status in ('active', 'past_due', 'canceled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teams_seat_limit_check') then
    alter table public.teams
      add constraint teams_seat_limit_check check (seat_limit > 0);
  end if;
end;
$$;

create index if not exists teams_owner_user_id_idx on public.teams (owner_user_id);

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function private.set_updated_at();

-- ============================================================================
-- 2. team_members
-- ============================================================================
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (team_id, user_id),
  -- Een gebruiker mag maximaal in één team zitten.
  unique (user_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'team_members_role_check') then
    alter table public.team_members
      add constraint team_members_role_check check (role in ('owner', 'member'));
  end if;
end;
$$;

create index if not exists team_members_team_id_idx on public.team_members (team_id);

-- ============================================================================
-- 3. team_invites
-- ============================================================================
create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null,
  -- gen_random_uuid() heeft al 122 bits entropie — voldoende "niet raadbaar"
  -- zonder een apart, handgerold tokenformaat nodig te hebben.
  token uuid not null unique default gen_random_uuid(),
  status text not null default 'pending',
  invited_by uuid not null references public.users (id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now(),
  accepted_by uuid references public.users (id) on delete set null
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'team_invites_status_check') then
    alter table public.team_invites
      add constraint team_invites_status_check
        check (status in ('pending', 'accepted', 'revoked', 'expired'));
  end if;
end;
$$;

create index if not exists team_invites_team_id_idx on public.team_invites (team_id);

-- Voorkomt dubbele openstaande uitnodigingen naar hetzelfde e-mailadres
-- binnen hetzelfde team — anders zou dezelfde persoon twee seats reserveren.
create unique index if not exists team_invites_pending_email_idx
  on public.team_invites (team_id, lower(email))
  where status = 'pending';

-- ============================================================================
-- 4. ai_usage: team_id erbij — gepoolde AI-limiet + per-team kostenanalyse
-- (zie supabase/migrations/ai_usage_tracking.sql voor de basistabel).
-- ============================================================================
alter table public.ai_usage
  add column if not exists team_id uuid references public.teams (id) on delete set null;

create index if not exists ai_usage_team_id_idx on public.ai_usage (team_id, feature, created_at);

-- ============================================================================
-- 5. Seat-limiet server-side afdwingen — een BEFORE INSERT-trigger op zowel
-- team_members (geaccepteerd lid) als team_invites (openstaande, niet-
-- verlopen uitnodiging telt als reservering) i.p.v. alleen een check in de
-- server action: de `for update`-lock op de teams-rij hieronder serialiseert
-- gelijktijdige inserts tegen hetzelfde team, dus twee uitnodigingen die
-- tegelijk geaccepteerd worden kunnen het seat-limiet niet allebei net
-- overschrijden (de klassieke race die een kale "tel-dan-schrijf"-check in
-- JS niet dichttimmert).
-- ============================================================================
create or replace function public.check_team_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seat_limit integer;
  v_used integer;
begin
  select seat_limit into v_seat_limit from public.teams where id = new.team_id for update;

  if v_seat_limit is null then
    raise exception 'Team bestaat niet.';
  end if;

  select
    (select count(*) from public.team_members where team_id = new.team_id)
    + (select count(*) from public.team_invites
         where team_id = new.team_id and status = 'pending' and expires_at > now())
    -- De NEW-rij zelf staat nog niet in de tabel (BEFORE INSERT), dus +1
    -- voor de seat die deze insert zelf claimt.
    + 1
  into v_used;

  if v_used > v_seat_limit then
    raise exception 'Seat-limiet bereikt (max % seats voor dit team).', v_seat_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.check_team_seat_limit() from public, anon, authenticated;

drop trigger if exists team_members_seat_limit on public.team_members;
create trigger team_members_seat_limit
  before insert on public.team_members
  for each row execute function public.check_team_seat_limit();

drop trigger if exists team_invites_seat_limit on public.team_invites;
create trigger team_invites_seat_limit
  before insert on public.team_invites
  for each row execute function public.check_team_seat_limit();

-- ============================================================================
-- 6. Een team kan nooit zonder eigenaar achterblijven: het lidmaatschap van
-- de eigenaar kan niet direct verwijderd worden (leave/remove/uitschrijven
-- moet eerst het eigenaarschap overdragen of het hele team opzeggen), en
-- eigenaarschap-overdracht is een enkele UPDATE op teams.owner_user_id —
-- deze trigger houdt team_members.role daarmee automatisch synchroon, zodat
-- er nooit twee plekken zijn die uit de pas kunnen lopen.
-- ============================================================================
create or replace function public.prevent_owner_removal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' then
    raise exception 'De eigenaar kan niet als lid verwijderd worden — draag eigenaarschap over of zeg het team op.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

revoke all on function public.prevent_owner_removal() from public, anon, authenticated;

drop trigger if exists team_members_prevent_owner_delete on public.team_members;
create trigger team_members_prevent_owner_delete
  before delete on public.team_members
  for each row execute function public.prevent_owner_removal();

create or replace function public.sync_team_owner_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    update public.team_members set role = 'member'
      where team_id = new.id and user_id = old.owner_user_id;
    update public.team_members set role = 'owner'
      where team_id = new.id and user_id = new.owner_user_id;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_team_owner_role() from public, anon, authenticated;

drop trigger if exists teams_sync_owner_role on public.teams;
create trigger teams_sync_owner_role
  after update of owner_user_id on public.teams
  for each row execute function public.sync_team_owner_role();

-- ============================================================================
-- 7. RLS
-- ============================================================================
alter table public.teams enable row level security;
alter table public.teams force row level security;
alter table public.team_members enable row level security;
alter table public.team_members force row level security;
alter table public.team_invites enable row level security;
alter table public.team_invites force row level security;

-- teams: eigenaar en leden mogen het teamrecord lezen (naam + status +
-- seats/facturatiemetadata — bewust niet kolombeperkt tot alleen de naam
-- zoals de brief noemt: geen van deze velden is een geheim/credential, en
-- een aparte kolom-grant-laag alleen hiervoor woog niet op tegen de
-- complexiteit). Schrijven: alleen de eigenaar, en alleen op naam/domein —
-- seat_limit/plan/status/stripe_*/owner_user_id zijn kolombeperkt (zie de
-- REVOKE/GRANT hieronder) zodat die uitsluitend via de webhook (service-
-- role, zie app/api/stripe/webhook/route.ts) of expliciete server actions
-- (eigenaarschap-overdracht, opzeggen) wijzigen, nooit via een rechtstreeks
-- UPDATE-verzoek van de eigenaar's eigen client.
drop policy if exists "teams_select" on public.teams;
create policy "teams_select" on public.teams
  for select
  using (
    owner_user_id = (select auth.uid())
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = teams.id and tm.user_id = (select auth.uid())
    )
  );

drop policy if exists "teams_update_owner" on public.teams;
create policy "teams_update_owner" on public.teams
  for update
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

revoke update on public.teams from authenticated;
grant update (name, allowed_email_domain) on public.teams to authenticated;

-- team_members: een lid ziet alleen de eigen rij; de eigenaar ziet alle
-- leden van het eigen team. Leden worden UITSLUITEND via service-role
-- ingevoegd (webhook voor de eigenaar zelf, actions/team.ts's acceptInvite
-- voor nieuwe leden — beide na server-side validatie) — vandaar geen
-- INSERT-policy hier: "geen policy + force RLS" betekent al "geweigerd"
-- voor de authenticated-rol, hetzelfde patroon als public.subscriptions
-- (zie supabase/migrations/subscription_model.sql).
drop policy if exists "team_members_select" on public.team_members;
create policy "team_members_select" on public.team_members
  for select
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_user_id = (select auth.uid())
    )
  );

-- Verlaten (eigen rij) of een lid verwijderen (eigenaar) — de eigenaar's
-- eigen rij is hiervan uitgezonderd door de prevent_owner_removal-trigger
-- hierboven, niet door deze policy (die zou hier niet tussen "ik verlaat
-- mezelf" en "ik ben toevallig ook eigenaar" kunnen onderscheiden).
drop policy if exists "team_members_delete" on public.team_members;
create policy "team_members_delete" on public.team_members
  for delete
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_user_id = (select auth.uid())
    )
  );

-- team_invites: alleen de eigenaar beheert uitnodigingen van het eigen team
-- via de normale (RLS-gerespecteerde) client. Accepteren gebeurt via
-- actions/team.ts met de service-role client (zie de toelichting daar) —
-- geen aparte INSERT/UPDATE-policy voor de uitgenodigde nodig.
drop policy if exists "team_invites_select_owner" on public.team_invites;
create policy "team_invites_select_owner" on public.team_invites
  for select
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_invites.team_id and t.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "team_invites_insert_owner" on public.team_invites;
create policy "team_invites_insert_owner" on public.team_invites
  for insert
  with check (
    invited_by = (select auth.uid())
    and exists (
      select 1 from public.teams t
      where t.id = team_invites.team_id and t.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists "team_invites_update_owner" on public.team_invites;
create policy "team_invites_update_owner" on public.team_invites
  for update
  using (
    exists (
      select 1 from public.teams t
      where t.id = team_invites.team_id and t.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.teams t
      where t.id = team_invites.team_id and t.owner_user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 8. Server-side toegangsbepaling: effectieve status = eigen paid_subscriber
-- OF actief teamlidmaatschap (coulanceperiode bij past_due, doorlopend tot
-- current_period_end bij canceled) — eigen betaalde status heeft voorrang.
-- Werkt uitsluitend op auth.uid() (geen p_user_id-parameter): voorkomt dat
-- een gebruiker via een gemanipuleerde aanroep andermans effectieve status
-- zou kunnen opvragen, en is precies wat elke aanroeper (get-current-
-- profile.ts, actions/planning.ts, analyze-lesson/route.ts) nodig heeft —
-- allemaal vragen ze naar "de huidige, ingelogde gebruiker".
--
-- 14 dagen coulance: moet in sync blijven met TEAM_PAST_DUE_GRACE_DAYS in
-- lib/constants/subscriptionPlans.ts (JS-kant is puur weergave, dit hier is
-- de daadwerkelijke afdwinging — zelfde bewuste duplicatie-patroon als
-- MONTHLY_CONTRIBUTION_REQUIRED_COUNT).
-- ============================================================================
create or replace function public.get_effective_access()
returns table (
  effective_status text,
  team_id uuid,
  team_role text,
  team_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select coalesce(u.subscription_status, 'free_contributor') as own_status
    from public.users u
    where u.id = auth.uid()
  ),
  membership as (
    select tm.team_id, tm.role, t.name, t.status as team_status, t.current_period_end
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.user_id = auth.uid()
    limit 1
  )
  select
    case
      when me.own_status = 'paid_subscriber' then 'paid_subscriber'
      when membership.team_status = 'active' then 'paid_subscriber'
      when membership.team_status = 'past_due'
        and membership.current_period_end + interval '14 days' > now() then 'paid_subscriber'
      when membership.team_status = 'canceled'
        and membership.current_period_end > now() then 'paid_subscriber'
      else me.own_status
    end as effective_status,
    membership.team_id,
    membership.role,
    membership.name
  from me
  left join membership on true;
$$;

revoke all on function public.get_effective_access() from public, anon;
grant execute on function public.get_effective_access() to authenticated;

-- Seat-gebruik voor de teamdashboard-weergave ("4 van 5") — eigenaar én
-- leden mogen dit van het eigen team opvragen.
create or replace function public.get_team_seat_usage(p_team_id uuid)
returns table (seats_used integer, seat_limit integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      (select count(*) from public.team_members where team_id = p_team_id)
      + (select count(*) from public.team_invites
           where team_id = p_team_id and status = 'pending' and expires_at > now())
    )::integer as seats_used,
    t.seat_limit
  from public.teams t
  where t.id = p_team_id
    and (
      t.owner_user_id = auth.uid()
      or exists (
        select 1 from public.team_members tm
        where tm.team_id = t.id and tm.user_id = auth.uid()
      )
    );
$$;

revoke all on function public.get_team_seat_usage(uuid) from public, anon;
grant execute on function public.get_team_seat_usage(uuid) to authenticated;

-- Gepoolde AI-teller ("resterend teamtegoed") — de exists()-check laat een
-- niet-lid stilzwijgend 0 rijen zien i.p.v. een foutmelding (geen datalek,
-- gewoon geen zinvol resultaat).
create or replace function public.get_team_ai_usage_count(p_team_id uuid, p_feature text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.ai_usage
  where team_id = p_team_id
    and feature = p_feature
    and created_at >= date_trunc('month', now())
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = p_team_id and tm.user_id = auth.uid()
    );
$$;

revoke all on function public.get_team_ai_usage_count(uuid, text) from public, anon;
grant execute on function public.get_team_ai_usage_count(uuid, text) to authenticated;

-- Token-gebaseerde uitnodiging-lookup — moet ook voor uitgelogde bezoekers
-- werken (anon), dus bewust GEEN RLS-policy op team_invites zelf voor deze
-- flow (dat zou de hele tabel voor iedereen doorzoekbaar/enumerable maken).
-- security definer omzeilt RLS intern, maar het token zelf (een
-- onraadbare UUID) is de enige sleutel — exact hetzelfde principe als een
-- wachtwoord-reset-link.
create or replace function public.get_team_invite_by_token(p_token uuid)
returns table (
  team_id uuid,
  team_name text,
  email text,
  status text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.team_id, t.name, i.email, i.status, i.expires_at
  from public.team_invites i
  join public.teams t on t.id = i.team_id
  where i.token = p_token;
$$;

revoke all on function public.get_team_invite_by_token(uuid) from public;
grant execute on function public.get_team_invite_by_token(uuid) to anon, authenticated;
