-- Laat zelf samengestelde (niet-AI) publieke lessen meetellen voor de
-- maandelijkse bijdrage-eis, naast de bestaande activiteiten-inzendingen
-- (zie subscription_model.sql). AI-gegenereerde lessen tellen bewust nooit
-- mee — dat onderscheid is de hele reden voor deze migratie.

-- ============================================================================
-- 1. lessons: herkomst + moment van openbaarmaking
-- ============================================================================

-- true wanneer deze les is gestart vanuit de AI Activiteiten Generator
-- (/les-maken se AI-wizard) — gezet door createLesson (actions/lesson.ts)
-- op basis van of er een AI-gegenereerd concept aan het formulier is
-- meegegeven, ongeacht latere handmatige aanpassingen daarop.
alter table public.lessons
  add column if not exists is_ai_generated boolean not null default false;

-- Moment waarop de les voor het laatst openbaar is gezet — het lesvoorbe-
-- reiding-equivalent van activiteiten.submitted_at: de daadwerkelijke
-- "bijdrage aan de bibliotheek"-gebeurtenis, los van created_at (een les
-- kan eerst privé bestaan en pas later gedeeld worden). Gezet door
-- setLessonPublic (actions/lesson.ts) telkens wanneer is_public naar true
-- gaat.
alter table public.lessons
  add column if not exists public_since timestamptz;

-- ============================================================================
-- 2. sync_monthly_contribution_tracking: nu ook lessen meetellen
-- ============================================================================
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
  select
    (
      select count(*)
      from public.activiteiten
      where author_id = p_user_id
        and status = 'approved'
        and submitted_at >= p_period_start
        and submitted_at < p_period_start + interval '1 month'
    )
    +
    (
      select count(*)
      from public.lessons
      where author_id = p_user_id
        and is_public = true
        and is_ai_generated = false
        and public_since is not null
        and public_since >= p_period_start
        and public_since < p_period_start + interval '1 month'
    )
  into v_count;

  insert into public.monthly_contribution_tracking (user_id, period_start, approved_count)
  values (p_user_id, p_period_start, v_count)
  on conflict (user_id, period_start)
    do update set approved_count = excluded.approved_count, updated_at = now();
end;
$$;

revoke execute on function public.sync_monthly_contribution_tracking(uuid, date)
  from public, anon, authenticated;

-- ============================================================================
-- 3. Trigger: bij het openbaar maken van een zelfgemaakte les de telling
-- van díe periode verversen (mirroring activiteiten_sync_contribution).
-- ============================================================================
create or replace function public.trg_sync_lesson_contribution_on_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_public and not new.is_ai_generated and new.author_id is not null
     and new.public_since is not null
     and (tg_op = 'INSERT' or old.is_public is distinct from true or old.public_since is distinct from new.public_since) then
    perform public.sync_monthly_contribution_tracking(
      new.author_id,
      date_trunc('month', new.public_since)::date
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.trg_sync_lesson_contribution_on_public()
  from public, anon, authenticated;

drop trigger if exists lessons_sync_contribution on public.lessons;
create trigger lessons_sync_contribution
  after insert or update of is_public, public_since on public.lessons
  for each row execute function public.trg_sync_lesson_contribution_on_public();

-- ============================================================================
-- 4. evaluate_monthly_contributions: dezelfde uitbreiding in de maandelijkse
-- cron-batchevaluatie, anders zou die de lesson-bijdragen weer wegschrijven
-- bij de eerstvolgende maandwissel.
-- ============================================================================
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
    coalesce(
      (
        select count(*)
        from public.activiteiten a
        where a.author_id = u.id
          and a.status = 'approved'
          and a.submitted_at >= v_period_start
          and a.submitted_at < v_period_start + interval '1 month'
      )
      +
      (
        select count(*)
        from public.lessons l
        where l.author_id = u.id
          and l.is_public = true
          and l.is_ai_generated = false
          and l.public_since is not null
          and l.public_since >= v_period_start
          and l.public_since < v_period_start + interval '1 month'
      ),
      0
    )
  from public.users u
  where u.subscription_status in ('free_contributor', 'free_blocked')
    and u.created_at < v_period_start + interval '1 month'
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

revoke execute on function public.evaluate_monthly_contributions()
  from public, anon, authenticated;
