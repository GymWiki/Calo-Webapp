-- Uitbreiding van het gamification-systeem: 10 levels (config/levels.ts),
-- login-streaks, lidmaatschapsjubileum, een XP-historie (xp_log) en
-- diminishing returns op les-aanmaken. Level blijft puur uit xp afgeleid
-- (geen aparte level-kolom) — zie de toelichting in de oorspronkelijke
-- gamification.sql-migratie.

-- 1. Nieuwe users-kolommen — alle "add column if not exists", dus veilig
-- opnieuw te draaien en niet-destructief voor bestaande data.
alter table public.users
  add column if not exists login_streak_current integer not null default 0,
  add column if not exists login_streak_longest integer not null default 0,
  add column if not exists last_active_at timestamptz,
  add column if not exists member_since timestamptz not null default now(),
  add column if not exists last_anniversary_bonus_year integer;

-- Postgres heeft geen "ADD CONSTRAINT IF NOT EXISTS" voor CHECK-constraints,
-- vandaar de handmatige existence-check.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_login_streak_non_negative'
  ) then
    alter table public.users
      add constraint users_login_streak_non_negative
        check (login_streak_current >= 0 and login_streak_longest >= 0);
  end if;
end;
$$;

-- 2. XP-historie — elke awardXp-toekenning (incl. de nieuwe streak-/
-- jubileumbonussen) landt hier, zodat diminishing returns (tel deze week
-- se lesson_created-rijen) en eventuele toekomstige "recente activiteit"-UI
-- op iets tastbaars kunnen leunen in plaats van een los mutable teller.
create table if not exists public.xp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount integer not null,
  reason text not null,
  related_lesson_id uuid references public.lessons(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists xp_log_user_created_at_idx
  on public.xp_log (user_id, created_at desc);
create index if not exists xp_log_user_reason_created_at_idx
  on public.xp_log (user_id, reason, created_at desc);

alter table public.xp_log enable row level security;

drop policy if exists "xp_log_select_own" on public.xp_log;
create policy "xp_log_select_own" on public.xp_log
  for select
  using ((select auth.uid()) = user_id);

-- Nodig omdat award_xp/record_login_activity hieronder SECURITY INVOKER
-- zijn (net als het bestaande award_xp) — de insert loopt dus als de
-- aanroepende gebruiker en moet zelf door RLS heen.
drop policy if exists "xp_log_insert_own" on public.xp_log;
create policy "xp_log_insert_own" on public.xp_log
  for insert
  with check ((select auth.uid()) = user_id);

-- 3. award_xp: nu met reason + optionele related_lesson_id (voor xp_log),
-- en diminishing returns voor "lesson_created" — vanaf de 4e les die
-- kalenderweek (dus de 4e xp_log-rij met reason='lesson_created' sinds
-- het begin van de ISO-week) wordt het bedrag gehalveerd. Signature
-- gewijzigd t.o.v. de vorige versie, dus eerst de oude droppen.
drop function if exists public.award_xp(uuid, integer);

create or replace function public.award_xp(
  p_user_id uuid,
  p_amount integer,
  p_reason text,
  p_related_lesson_id uuid default null
)
returns table (old_xp integer, new_xp integer, is_pro boolean, awarded_amount integer)
language plpgsql
set search_path = ''
as $$
declare
  v_awarded integer := p_amount;
  v_week_count integer;
begin
  if p_reason = 'lesson_created' then
    select count(*) into v_week_count
    from public.xp_log
    where user_id = p_user_id
      and reason = 'lesson_created'
      and created_at >= date_trunc('week', now());

    if v_week_count >= 3 then
      v_awarded := round(p_amount / 2.0);
    end if;
  end if;

  insert into public.xp_log (user_id, amount, reason, related_lesson_id)
  values (p_user_id, v_awarded, p_reason, p_related_lesson_id);

  return query
  update public.users
  set xp = xp + v_awarded
  where id = p_user_id
  returning
    xp - v_awarded,
    xp,
    public.users.plan_type in ('pro', 'organization', 'admin'),
    v_awarded;
end;
$$;

-- 4. record_login_activity: bij te werken login-streak + eventuele
-- streak-/jubileumbonus, atomair. SECURITY INVOKER (standaard) — leunt op
-- dezelfde "users_update_own" RLS-policy (auth.uid() = id) als award_xp,
-- dus kan nooit andermans streak bijwerken.
create or replace function public.record_login_activity(p_user_id uuid)
returns table (
  login_streak_current integer,
  streak_bonus_awarded integer,
  anniversary_bonus_awarded boolean
)
language plpgsql
set search_path = ''
as $$
declare
  v_last_active timestamptz;
  v_member_since timestamptz;
  v_streak integer;
  v_longest integer;
  v_last_anniversary_year integer;
  v_years_since integer;
  v_streak_bonus integer := 0;
  v_anniversary_awarded boolean := false;
  v_today date := (now() at time zone 'utc')::date;
  v_last_active_date date;
begin
  select last_active_at, member_since, login_streak_current, login_streak_longest,
         last_anniversary_bonus_year
  into v_last_active, v_member_since, v_streak, v_longest, v_last_anniversary_year
  from public.users
  where id = p_user_id;

  v_last_active_date := (v_last_active at time zone 'utc')::date;

  if v_last_active is null then
    v_streak := 1;
  elsif v_last_active_date = v_today then
    -- Al vandaag ingelogd — streak niet nog een keer ophogen.
    null;
  elsif v_last_active_date = v_today - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  v_longest := greatest(v_longest, v_streak);

  if v_streak = 7 then
    v_streak_bonus := 10;
  elsif v_streak = 30 then
    v_streak_bonus := 40;
  end if;

  v_years_since := floor(extract(epoch from (now() - v_member_since)) / (365.25 * 86400));
  if v_years_since >= 1 and (v_last_anniversary_year is null or v_years_since > v_last_anniversary_year) then
    v_anniversary_awarded := true;
    v_last_anniversary_year := v_years_since;
  end if;

  update public.users
  set login_streak_current = v_streak,
      login_streak_longest = v_longest,
      last_active_at = now(),
      last_anniversary_bonus_year = v_last_anniversary_year
  where id = p_user_id;

  if v_streak_bonus > 0 then
    insert into public.xp_log (user_id, amount, reason)
    values (p_user_id, v_streak_bonus, case when v_streak = 7 then 'login_streak_7' else 'login_streak_30' end);

    update public.users set xp = xp + v_streak_bonus where id = p_user_id;
  end if;

  if v_anniversary_awarded then
    insert into public.xp_log (user_id, amount, reason)
    values (p_user_id, 150, 'membership_anniversary');

    update public.users set xp = xp + 150 where id = p_user_id;
  end if;

  return query select v_streak, v_streak_bonus, v_anniversary_awarded;
end;
$$;
