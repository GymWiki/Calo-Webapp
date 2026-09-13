-- Consolideert "lessen" en "activiteiten" tot één concept: alles wat de
-- lessen-wizard (/les-maken) bouwde — plattegrond, vaste lesblokken, 3 L'en-
-- didactiek, spelgebaseerde-pedagogiek-velden, deelnemersaantallen en
-- planningsvelden — verhuist naar `public.activiteiten` als extra, nullable
-- kolommen. Nadien schrijft createLesson (actions/lesson.ts) rechtstreeks
-- naar `activiteiten`; er is geen aparte `lessons`-tabel meer.
--
-- `lessons` en zijn kindtabellen (`lesson_blocks`, `lesson_didactics`,
-- `lesson_tags`) waren op het moment van deze migratie leeg (live geverifi-
-- eerd, niet via de gecachete rijtellingen van list_tables) — er is dus 0
-- rijen gemigreerd. De bestaande 203 `activiteiten`-rijen (allemaal
-- status='approved', author_id null — de officiële GymWiki-bibliotheek)
-- blijven ongewijzigd zichtbaar dankzij de backfill in stap 2.

-- ============================================================================
-- 1. Nieuwe kolommen op activiteiten
-- ============================================================================
alter table public.activiteiten
  add column if not exists group_name text,
  add column if not exists activity_date date,
  add column if not exists movement_problem text,
  add column if not exists min_participants integer default 1,
  add column if not exists participants_bench integer,
  add column if not exists base_materials text[] not null default '{}',
  add column if not exists rule_materials text[] not null default '{}',
  add column if not exists diagram_data jsonb,
  add column if not exists diagram_image_url text,
  add column if not exists game_category text,
  add column if not exists game_dimensions jsonb,
  add column if not exists tactical_questions text[] not null default '{}',
  add column if not exists didactic_items jsonb not null default '[]',
  add column if not exists arrangement text,
  add column if not exists deelnemers_regels text,
  add column if not exists plaatje_praatje text,
  add column if not exists aandachtspunten text,
  add column if not exists is_ai_generated boolean not null default false,
  add column if not exists is_public boolean not null default false,
  add column if not exists public_since timestamptz;

-- ============================================================================
-- 2. Backfill: bestaande goedgekeurde activiteiten blijven exact zo publiek
-- zichtbaar als vóór deze migratie (voorheen was "status='approved'" de
-- enige zichtbaarheidsregel; die wordt nu is_public).
-- ============================================================================
update public.activiteiten
set
  is_public = true,
  public_since = coalesce(submitted_at, created_at)
where status = 'approved';

-- ============================================================================
-- 3. Indexen
-- ============================================================================
create index if not exists activiteiten_is_public_idx on public.activiteiten (is_public);
create index if not exists activiteiten_author_id_idx on public.activiteiten (author_id);

-- ============================================================================
-- 4. RLS: twee gevaarlijk brede, legacy policies opruimen. Beide gaven de
-- `public`-rol (dus óók niet-ingelogde bezoekers) onbeperkte SELECT/INSERT
-- op activiteiten — een pre-existing bug, ontdekt tijdens deze migratie,
-- losstaand van maar wel direct relevant voor het werk aan deze tabel.
-- ============================================================================
drop policy if exists "Allow public insert access on activiteiten" on public.activiteiten;
drop policy if exists "Allow public read access on activiteiten" on public.activiteiten;

drop policy if exists "Activiteiten: goedgekeurd of eigen" on public.activiteiten;
create policy "Activiteiten: openbaar of eigen"
  on public.activiteiten
  for select
  to authenticated
  using (is_public = true or author_id = (select auth.uid()));

create policy "Anonieme bezoekers lezen openbare activiteiten"
  on public.activiteiten
  for select
  to anon
  using (is_public = true);

-- Er bestond nog geen owner-scoped UPDATE/DELETE policy op activiteiten —
-- submitActivityDraft/deleteActivityDraft waren daardoor stilzwijgend
-- non-functioneel via RLS. Toegevoegd zodat eigenaren hun eigen rijen
-- kunnen bijwerken/verwijderen (o.a. voor setLessonPublic hieronder).
create policy "Activiteiten: eigenaren werken eigen bij"
  on public.activiteiten
  for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "Activiteiten: eigenaren verwijderen eigen"
  on public.activiteiten
  for delete
  to authenticated
  using (author_id = (select auth.uid()));

-- ============================================================================
-- 5. Maandelijkse bijdrage-tracking: terug naar één tabel. Voorheen (zie
-- lesson_contribution_tracking.sql) telde dit zowel activiteiten
-- (status='approved' + submitted_at) als lessons (is_public + niet-AI +
-- public_since) apart op. Nu beide onder dezelfde is_public/public_since-
-- velden op activiteiten vallen, telt één simpele voorwaarde alles.
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
  select count(*)
  into v_count
  from public.activiteiten
  where author_id = p_user_id
    and is_public = true
    and is_ai_generated = false
    and public_since is not null
    and public_since >= p_period_start
    and public_since < p_period_start + interval '1 month';

  insert into public.monthly_contribution_tracking (user_id, period_start, approved_count)
  values (p_user_id, p_period_start, v_count)
  on conflict (user_id, period_start)
    do update set approved_count = excluded.approved_count, updated_at = now();
end;
$$;

revoke execute on function public.sync_monthly_contribution_tracking(uuid, date)
  from public, anon, authenticated;

create or replace function public.trg_sync_contribution_on_public()
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

revoke execute on function public.trg_sync_contribution_on_public()
  from public, anon, authenticated;

drop trigger if exists activiteiten_sync_contribution on public.activiteiten;
create trigger activiteiten_sync_contribution
  after insert or update of is_public, public_since on public.activiteiten
  for each row execute function public.trg_sync_contribution_on_public();

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
          and a.is_public = true
          and a.is_ai_generated = false
          and a.public_since is not null
          and a.public_since >= v_period_start
          and a.public_since < v_period_start + interval '1 month'
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

-- ============================================================================
-- 6. Opruimen: lessons en zijn kindtabellen droppen (leeg geverifieerd
-- vlak vóór deze stap), samen met hun nu overbodige trigger/functie.
-- ============================================================================
drop trigger if exists lessons_sync_contribution on public.lessons;
drop function if exists public.trg_sync_lesson_contribution_on_public();

drop table if exists public.lesson_tags;
drop table if exists public.lesson_didactics;
drop table if exists public.lesson_blocks;
drop table if exists public.lessons;
