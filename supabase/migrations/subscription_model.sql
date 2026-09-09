-- GymWiki-refactor: bijdrage-freemium-model. Vervangt het losse plan_type-
-- systeem (pro/organization/admin) volledig door drie statussen:
--   - free_contributor: gratis, mits minstens 4 goedgekeurde bijdragen/mnd
--   - free_blocked:      gratis account dat de 4-eis vorige maand niet haalde
--   - paid_subscriber:   betaalt EUR 3,-/mnd, geen bijdrage-eis, altijd volledige toegang
-- Alle statements zijn idempotent, dus veilig opnieuw te draaien.

-- ============================================================================
-- 1. users.subscription_status
-- ============================================================================
alter table public.users
  add column if not exists subscription_status text not null default 'free_contributor';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_subscription_status_check'
  ) then
    alter table public.users
      add constraint users_subscription_status_check
        check (subscription_status in ('free_contributor', 'free_blocked', 'paid_subscriber'));
  end if;
end;
$$;

-- Bestaande Pro/organization/admin-accounts blijven volledige toegang
-- houden onder de nieuwe naam; overige accounts starten als contributor.
update public.users
set subscription_status = 'paid_subscriber'
where plan_type in ('pro', 'organization', 'admin');

alter table public.users drop column if exists plan_type;

-- ============================================================================
-- 2. subscriptions — Stripe-koppeling per gebruiker (audit/history van het
-- betaalde abonnement; de daadwerkelijke rechten staan op
-- users.subscription_status en worden door de Stripe-webhook bijgewerkt).
-- ============================================================================
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status text not null default 'inactive',
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_status_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_status_check
        check (status in ('inactive', 'active', 'canceled', 'past_due'));
  end if;
end;
$$;

create unique index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function private.set_updated_at();

alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;

-- Alleen leesbaar voor de eigenaar. Schrijven gebeurt uitsluitend door de
-- Stripe-webhook via de service-role client (die RLS omzeilt) — een
-- gebruiker kan zijn eigen abonnementsstatus dus nooit zelf manipuleren.
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own" on public.subscriptions
  for select
  using ((select auth.uid()) = user_id);

-- ============================================================================
-- 3. activiteiten — bijdragen van gebruikers + kwaliteitscontrole-status.
-- Bestaande (geïmporteerde) rijen krijgen author_id = null en status =
-- 'approved': het zijn bibliotheek-basisdata, geen gebruikersbijdragen.
-- ============================================================================
alter table public.activiteiten
  add column if not exists author_id uuid references public.users(id) on delete cascade,
  add column if not exists rejection_reason text,
  add column if not exists submitted_at timestamptz not null default now();

alter table public.activiteiten
  add column if not exists status text not null default 'approved';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'activiteiten_status_check'
  ) then
    alter table public.activiteiten
      add constraint activiteiten_status_check
        check (status in ('pending', 'approved', 'rejected'));
  end if;
end;
$$;

-- Nieuwe (door gebruikers ingediende) activiteiten krijgen voortaan een
-- gegenereerd id — de tekst-PK bestond alleen om de oorspronkelijke
-- Firestore-import idempotent te kunnen upserten.
alter table public.activiteiten alter column id set default gen_random_uuid()::text;

create index if not exists idx_activiteiten_author_id on public.activiteiten (author_id);
create index if not exists idx_activiteiten_status on public.activiteiten (status);

-- Tekstuele similarity voor duplicaatdetectie (lib/ai/activityQualityCheck.ts).
create extension if not exists pg_trgm;

create index if not exists idx_activiteiten_beschrijving_trgm
  on public.activiteiten using gin (beschrijving gin_trgm_ops);

-- Zichtbaarheid: goedgekeurde activiteiten voor iedereen, eigen inzendingen
-- (ongeacht status) altijd voor de indiener zelf — nodig zodat
-- activityQualityCheck's duplicaatcheck eigen eerdere inzendingen kan lezen,
-- en zodat een gebruiker ziet waarom zijn inzending is afgekeurd.
drop policy if exists "Iedereen leest activiteiten" on public.activiteiten;
drop policy if exists "Activiteiten: goedgekeurd of eigen" on public.activiteiten;
create policy "Activiteiten: goedgekeurd of eigen" on public.activiteiten
  for select
  to authenticated
  using (status = 'approved' or author_id = (select auth.uid()));

-- Alleen eigen bijdragen aanmaken. De status zelf wordt niet door de
-- gebruiker gekozen — de server action (actions/activity-submission.ts)
-- berekent 'm via de kwaliteitscheck vóórdat de insert wordt uitgevoerd,
-- dus de client kan hier nooit direct 'approved' forceren.
drop policy if exists "Activiteiten: eigen bijdragen aanmaken" on public.activiteiten;
create policy "Activiteiten: eigen bijdragen aanmaken" on public.activiteiten
  for insert
  to authenticated
  with check (author_id = (select auth.uid()));

-- Duplicaatdetectie: tekstuele similarity tegen eerdere inzendingen van
-- dezelfde auteur (activityQualityCheck.ts). security invoker (standaard) —
-- leunt op dezelfde "Activiteiten: goedgekeurd of eigen"-RLS-policy als een
-- gewone select, dus kan nooit iemand anders' inzendingen doorzoeken. Geen
-- "set search_path = ''" hier (in tegenstelling tot de definer-functies
-- hieronder) — pg_trgm's similarity() is een unqualified extensiefunctie,
-- net als vector's <=>-operator in match_knowledge_chunks
-- (schema_kennisbank.sql), en moet dus via het normale search_path
-- gevonden worden.
create or replace function public.find_similar_own_activities(
  p_author_id uuid,
  p_text text,
  p_threshold real default 0.6
)
returns table (id text, titel text, similarity real)
language sql
stable
as $$
  select a.id, a.titel, similarity(a.beschrijving, p_text) as similarity
  from public.activiteiten a
  where a.author_id = p_author_id
    and a.beschrijving is not null
    and similarity(a.beschrijving, p_text) > p_threshold
  order by similarity desc
  limit 5;
$$;

-- ============================================================================
-- 4. monthly_contribution_tracking — telling per gebruiker per kalendermaand
-- van het aantal goedgekeurde bijdragen, tegen de 4-eis. Bewust een losse,
-- expliciet bijgewerkte tabel (i.p.v. live afgeleid, zoals eerder bij XP) —
-- de maandevaluatie (hieronder) moet een vaste, niet-meer-wijzigende
-- momentopname van "heeft deze maand gehaald?" kunnen vastleggen.
-- ============================================================================
create table if not exists public.monthly_contribution_tracking (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  period_start date not null,
  required_count integer not null default 4,
  approved_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, period_start)
);

create index if not exists idx_mct_user_period on public.monthly_contribution_tracking (user_id, period_start desc);

alter table public.monthly_contribution_tracking enable row level security;
alter table public.monthly_contribution_tracking force row level security;

drop policy if exists "mct_select_own" on public.monthly_contribution_tracking;
create policy "mct_select_own" on public.monthly_contribution_tracking
  for select
  using ((select auth.uid()) = user_id);

-- Werkt de telling voor één gebruiker/periode bij (upsert). security
-- definer: draait als de functie-eigenaar (de migratie-uitvoerende rol,
-- die RLS omzeilt), zodat dit ook voor andere gebruikers dan de aanroeper
-- kan worden aangeroepen vanuit de approval-trigger hieronder.
create or replace function public.sync_monthly_contribution_tracking(
  p_user_id uuid,
  p_period_start date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.activiteiten
  where author_id = p_user_id
    and status = 'approved'
    and submitted_at >= p_period_start
    and submitted_at < p_period_start + interval '1 month';

  insert into public.monthly_contribution_tracking (user_id, period_start, approved_count)
  values (p_user_id, p_period_start, v_count)
  on conflict (user_id, period_start)
    do update set approved_count = excluded.approved_count, updated_at = now();
end;
$$;

revoke all on function public.sync_monthly_contribution_tracking(uuid, date) from public;

-- Bij elke goedkeuring van een bijdrage de telling van die kalendermaand
-- verversen, zodat het dashboard-quotumwidget altijd een actuele stand
-- toont zonder live te hoeven aggregeren.
create or replace function public.trg_sync_contribution_on_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'approved' and new.author_id is not null
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    perform public.sync_monthly_contribution_tracking(
      new.author_id,
      date_trunc('month', new.submitted_at)::date
    );
  end if;
  return new;
end;
$$;

drop trigger if exists activiteiten_sync_contribution on public.activiteiten;
create trigger activiteiten_sync_contribution
  after insert or update of status on public.activiteiten
  for each row execute function public.trg_sync_contribution_on_approval();

-- Maandevaluatie: draait op de 1e van de maand en beoordeelt de zojuist
-- afgesloten maand voor elke free_contributor/free_blocked-gebruiker die
-- de volledige maand lid was. Betaalde abonnees slaan dit altijd over.
create or replace function public.evaluate_monthly_contributions()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_start date := date_trunc('month', now() - interval '1 month')::date;
begin
  insert into public.monthly_contribution_tracking (user_id, period_start, approved_count)
  select
    u.id,
    v_period_start,
    coalesce(count(a.id), 0)
  from public.users u
  left join public.activiteiten a
    on a.author_id = u.id
   and a.status = 'approved'
   and a.submitted_at >= v_period_start
   and a.submitted_at < v_period_start + interval '1 month'
  where u.subscription_status in ('free_contributor', 'free_blocked')
    and u.created_at < v_period_start + interval '1 month'
  group by u.id
  on conflict (user_id, period_start)
    do update set approved_count = excluded.approved_count, updated_at = now();

  update public.users u
  set subscription_status = case
    when mct.approved_count >= mct.required_count then 'free_contributor'
    else 'free_blocked'
  end
  from public.monthly_contribution_tracking mct
  where mct.user_id = u.id
    and mct.period_start = v_period_start
    and u.subscription_status in ('free_contributor', 'free_blocked');
end;
$$;

revoke all on function public.evaluate_monthly_contributions() from public;

-- pg_cron: elke 1e van de maand om 00:05 UTC. Vereist dat de pg_cron-
-- extensie in dit project staat ingeschakeld (Database > Extensions in de
-- Supabase-dashboard) — als "create extension" hieronder faalt door
-- ontbrekende rechten, schakel de extensie eerst handmatig in en draai
-- deze migratie opnieuw.
create extension if not exists pg_cron;

do $$
begin
  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'evaluate-monthly-contributions';
exception
  when undefined_table then
    null;
end;
$$;

select cron.schedule(
  'evaluate-monthly-contributions',
  '5 0 1 * *',
  $$select public.evaluate_monthly_contributions();$$
);
