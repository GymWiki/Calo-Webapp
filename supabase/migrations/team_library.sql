-- Teambibliotheek: een gedeelde werkruimte per team — eigen teamactiviteiten
-- (samen bewerkt, met versiegeschiedenis), referenties naar/kopieën van
-- GymWiki-activiteiten, en team-tags. Vervangt de losse `is_public`-vlag op
-- `activiteiten` door één `visibility`-veld ('private'|'team'|'public'), zodat
-- er nu drie in plaats van twee zichtbaarheidsniveaus zijn.

-- ============================================================================
-- 1. activiteiten: visibility vervangt is_public
-- ============================================================================
alter table public.activiteiten
  add column if not exists visibility text,
  add column if not exists team_id uuid references public.teams (id),
  add column if not exists source_activity_id text references public.activiteiten (id) on delete set null,
  add column if not exists updated_by uuid references public.users (id) on delete set null,
  add column if not exists updated_at timestamptz,
  add column if not exists version integer not null default 1,
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.users (id) on delete set null;

-- Backfill: 1-op-1 dezelfde zichtbaarheid als vóór deze migratie.
update public.activiteiten
set visibility = case when is_public then 'public' else 'private' end
where visibility is null;

update public.activiteiten set updated_at = created_at where updated_at is null;

alter table public.activiteiten alter column visibility set not null;
alter table public.activiteiten alter column visibility set default 'private';
alter table public.activiteiten alter column updated_at set not null;
alter table public.activiteiten alter column updated_at set default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'activiteiten_visibility_check') then
    alter table public.activiteiten
      add constraint activiteiten_visibility_check check (visibility in ('private', 'team', 'public'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'activiteiten_team_id_check') then
    alter table public.activiteiten
      add constraint activiteiten_team_id_check check ((visibility = 'team') = (team_id is not null));
  end if;
end;
$$;

create index if not exists activiteiten_visibility_idx on public.activiteiten (visibility);
create index if not exists activiteiten_team_id_idx on public.activiteiten (team_id) where team_id is not null;

-- ============================================================================
-- 2. Alle bestaande plekken die op is_public filterden, herzien naar
-- visibility — VOOR de kolom zelf verwijderd wordt (de view/policies/
-- functies hieronder hebben anders een harde afhankelijkheid die DROP COLUMN
-- zou blokkeren).
-- ============================================================================

-- 2a. is_active_team_member() — herbruikt dezelfde coulance-/statuslogica als
-- public.get_effective_access (team_plans.sql), maar dan voor een SPECIFIEK
-- team_id i.p.v. "het team van de huidige gebruiker" — nodig in RLS-policies
-- die willen weten "is auth.uid() een actief lid van DIT team". Bewuste
-- duplicatie van de statusvoorwaarde (zelfde patroon als
-- MONTHLY_CONTRIBUTION_REQUIRED_COUNT): 14 dagen coulance moet in sync
-- blijven met TEAM_PAST_DUE_GRACE_DAYS (lib/constants/subscriptionPlans.ts).
create or replace function public.is_active_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.team_members tm
    join public.teams t on t.id = tm.team_id
    where tm.team_id = p_team_id
      and tm.user_id = auth.uid()
      and (
        t.status = 'active'
        or (t.status = 'past_due' and t.current_period_end + interval '14 days' > now())
        or (t.status = 'canceled' and t.current_period_end > now())
      )
  );
$$;

revoke all on function public.is_active_team_member(uuid) from public, anon;
grant execute on function public.is_active_team_member(uuid) to authenticated;

-- 2b. activiteiten RLS — team-leden mogen teamactiviteiten van hun eigen,
-- actieve team lezen/bewerken, naast de bestaande "openbaar of eigen"-regel.
drop policy if exists "Activiteiten: openbaar of eigen" on public.activiteiten;
create policy "Activiteiten: openbaar, team of eigen" on public.activiteiten
  for select
  to authenticated
  using (
    visibility = 'public'
    or author_id = (select auth.uid())
    or (visibility = 'team' and public.is_active_team_member(team_id))
  );

drop policy if exists "Activiteiten: eigen bijdragen aanmaken" on public.activiteiten;
create policy "Activiteiten: eigen bijdragen aanmaken" on public.activiteiten
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and (
      visibility <> 'team'
      or (team_id is not null and public.is_active_team_member(team_id))
    )
  );

-- Teamleden mogen ALLE teamactiviteiten van hun team bewerken (niet alleen
-- hun eigen) — "samen bewerken", zie de brief. De WITH CHECK is identiek aan
-- USING: een teamlid kan zo geen activiteit "wegtrekken" naar buiten het
-- team (het resultaat moet ofwel nog steeds van hemzelf zijn, ofwel nog
-- steeds een teamactiviteit van hetzelfde team).
drop policy if exists "Activiteiten: eigenaren werken eigen bij" on public.activiteiten;
create policy "Activiteiten: eigenaren of teamleden werken bij" on public.activiteiten
  for update
  to authenticated
  using (
    author_id = (select auth.uid())
    or (visibility = 'team' and public.is_active_team_member(team_id))
  )
  with check (
    author_id = (select auth.uid())
    or (visibility = 'team' and public.is_active_team_member(team_id))
  );
-- DELETE-policy ("Activiteiten: eigenaren verwijderen eigen") blijft
-- ongewijzigd — teamactiviteiten worden nooit hard verwijderd, alleen zacht
-- (deleted_at, zie sectie 5), en dat gaat via de UPDATE-policy hierboven.

-- Bewaakt dat visibility/team_id van een TEAMACTIVITEIT niet zomaar via een
-- gewone UPDATE (de policy hierboven staat élk teamlid toe alle kolommen te
-- wijzigen) omgezet kan worden. Eén overgang blijft wél toegestaan:
-- 'private' -> 'team', want dat is precies hoe de "Activiteit maken"-flow
-- werkt (actions/lesson.ts's createLesson): een concept/eigen activiteit
-- wordt on-demand pas 'team' zodra de gebruiker bij het opslaan "Team-
-- bibliotheek" als bestemming kiest — dat is dezelfde rij, geen nieuwe
-- insert. Elke ANDERE overgang (team -> private/public, public -> team, of
-- team_id wijzigen terwijl visibility 'team' blijft) hoort via een bewuste,
-- losse server-actie te lopen (bijv. "Delen met GymWiki" = een NIEUWE rij,
-- nooit een UPDATE op het origineel). Simpeler en robuuster dan dit met
-- OLD/NEW-vergelijkingen in de RLS-policy zelf proberen te vangen (WITH
-- CHECK ziet alleen de NIEUWE rij, geen OLD-vergelijking).
create or replace function public.guard_activiteiten_visibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.visibility is distinct from old.visibility or new.team_id is distinct from old.team_id)
     and (old.visibility = 'team' or new.visibility = 'team')
     and not (old.visibility = 'private' and new.visibility = 'team') then
    raise exception 'De zichtbaarheid van een teamactiviteit kan niet via een gewone bewerking gewijzigd worden.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.guard_activiteiten_visibility() from public, anon, authenticated;

drop trigger if exists activiteiten_guard_visibility on public.activiteiten;
create trigger activiteiten_guard_visibility
  before update on public.activiteiten
  for each row execute function public.guard_activiteiten_visibility();

-- 2c. activity_knowledge_usage RLS — dezelfde is_public->visibility-swap,
-- plus een team-branch voor de ingelogde variant (de anon-variant blijft
-- uitsluitend publiek, zoals hij al was).
drop policy if exists "aku_select_visible_activity" on public.activity_knowledge_usage;
create policy "aku_select_visible_activity" on public.activity_knowledge_usage
  for select
  to authenticated
  using (
    exists (
      select 1 from public.activiteiten a
      where a.id = activity_id
        and (
          a.visibility = 'public'
          or a.author_id = (select auth.uid())
          or (a.visibility = 'team' and public.is_active_team_member(a.team_id))
        )
    )
  );

drop policy if exists "aku_select_visible_activity_anon" on public.activity_knowledge_usage;
create policy "aku_select_visible_activity_anon" on public.activity_knowledge_usage
  for select
  to anon
  using (
    exists (
      select 1 from public.activiteiten a
      where a.id = activity_id and a.visibility = 'public'
    )
  );

-- 2d. activiteiten_publiek (de publieke SEO-view, gelezen door sitemap.ts,
-- /activiteiten/[slug], /leerlijn/*, /groep/* en de landingspagina) — de
-- enige regel die telt is `visibility = 'public'`, NOOIT 'team'. Volledige
-- kolomlijst 1-op-1 overgenomen van de laatste definitie (activity_likes.sql).
create or replace view public.activiteiten_publiek as
select
  id,
  slug,
  titel,
  seo_summary,
  doel,
  doelgroep,
  leerlijn,
  categorie,
  materiaal,
  base_materials,
  rule_materials,
  afbeelding,
  public_since,
  created_at,
  like_count
from public.activiteiten a
where status = 'approved'
  and visibility = 'public'
  and is_ai_generated = false
  and slug is not null
  and seo_summary is not null
  and length(seo_summary) >= 100;

revoke all on public.activiteiten_publiek from public;
grant select on public.activiteiten_publiek to anon, authenticated;

-- 2e. Maandelijkse bijdrage-quotum — telt uitsluitend `visibility = 'public'`
-- (zoals voorheen `is_public = true`). Teamactiviteiten ('team') tellen
-- bewust NIET mee: delen met het team is geen bijdrage aan de gedeelde
-- GymWiki-bibliotheek (zie de brief — dat is een aparte, expliciete
-- "Delen met GymWiki"-actie die WEL door de normale createLesson-flow loopt).
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
  v_required integer;
begin
  select count(*)
  into v_count
  from public.activiteiten
  where author_id = p_user_id
    and visibility = 'public'
    and is_ai_generated = false
    and public_since is not null
    and public_since >= p_period_start
    and public_since < p_period_start + interval '1 month';

  insert into public.monthly_contribution_tracking (user_id, period_start, approved_count)
  values (p_user_id, p_period_start, v_count)
  on conflict (user_id, period_start)
    do update set approved_count = excluded.approved_count, updated_at = now()
  returning required_count into v_required;

  if v_count >= v_required and p_period_start = date_trunc('month', now())::date then
    update public.users
    set subscription_status = 'free_contributor'
    where id = p_user_id
      and subscription_status = 'free_blocked';
  end if;
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
  if new.visibility = 'public' and not new.is_ai_generated and new.author_id is not null
     and new.public_since is not null
     and (tg_op = 'INSERT' or old.visibility is distinct from 'public' or old.public_since is distinct from new.public_since) then
    perform public.sync_monthly_contribution_tracking(
      new.author_id,
      date_trunc('month', new.public_since)::date
    );
  end if;
  return new;
end;
$$;

drop trigger if exists activiteiten_sync_contribution on public.activiteiten;
create trigger activiteiten_sync_contribution
  after insert or update of visibility, public_since on public.activiteiten
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
          and a.visibility = 'public'
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

-- 2f. Twee ongebruikte legacy-views (gymwiki_activiteiten, publieke_activiteiten
-- — aangemaakt door create_gymwiki_en_publieke_activiteiten_views, inmiddels
-- vervangen door activiteiten_publiek/lib/services/activities.ts en nergens
-- meer in de app-code gequeryed) selecteren nog steeds `is_public` en zouden
-- de DROP COLUMN hieronder blokkeren (Postgres staat geen kolomdrop toe
-- terwijl een view 'm nog gebruikt). Opruimen i.p.v. ombouwen: dode views
-- ombouwen naar visibility zou ze alleen maar langer laten hangen.
drop view if exists public.gymwiki_activiteiten;
drop view if exists public.publieke_activiteiten;

-- 2g. is_public zelf kan nu weg — alle bovenstaande objecten zijn al
-- omgezet naar visibility.
drop index if exists public.activiteiten_is_public_idx;
alter table public.activiteiten drop column if exists is_public;

-- ============================================================================
-- 3. team_library_items — de eenheid waaraan tags hangen. 'own' verwijst
-- naar een teamactiviteit (visibility='team', dit team); 'reference' naar
-- een bestaande publieke GymWiki-activiteit (verandert nooit mee, zie de
-- brief: "geen inhoud gedupliceerd").
-- ============================================================================
create table if not exists public.team_library_items (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  activity_id text not null references public.activiteiten (id) on delete cascade,
  kind text not null,
  added_by uuid references public.users (id) on delete set null,
  added_at timestamptz not null default now(),
  unique (team_id, activity_id)
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'team_library_items_kind_check') then
    alter table public.team_library_items
      add constraint team_library_items_kind_check check (kind in ('own', 'reference'));
  end if;
end;
$$;

create index if not exists team_library_items_team_id_idx on public.team_library_items (team_id);
create index if not exists team_library_items_activity_id_idx on public.team_library_items (activity_id);

-- Bewaakt de kind/visibility-samenhang ('own' -> een teamactiviteit van dit
-- team, 'reference' -> een publieke GymWiki-activiteit) + het item-limiet
-- (max 500/team) — for-update-lock op de teams-rij serialiseert gelijktijdige
-- toevoegingen tegen hetzelfde team, zelfde patroon als check_team_seat_limit
-- (team_plans.sql).
create or replace function public.validate_team_library_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform 1 from public.teams where id = new.team_id for update;

  if new.kind = 'own' then
    if not exists (
      select 1 from public.activiteiten a
      where a.id = new.activity_id and a.visibility = 'team' and a.team_id = new.team_id
    ) then
      raise exception 'Deze activiteit hoort niet bij dit team.' using errcode = 'P0001';
    end if;
  elsif new.kind = 'reference' then
    if not exists (
      select 1 from public.activiteiten a
      where a.id = new.activity_id and a.visibility = 'public'
    ) then
      raise exception 'Alleen publieke GymWiki-activiteiten kunnen als referentie toegevoegd worden.'
        using errcode = 'P0001';
    end if;
  end if;

  select count(*) into v_count from public.team_library_items where team_id = new.team_id;
  if v_count >= 500 then
    raise exception 'Teambibliotheek-limiet bereikt (max 500 activiteiten per team).' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_team_library_item() from public, anon, authenticated;

drop trigger if exists team_library_items_validate on public.team_library_items;
create trigger team_library_items_validate
  before insert on public.team_library_items
  for each row execute function public.validate_team_library_item();

alter table public.team_library_items enable row level security;
alter table public.team_library_items force row level security;

drop policy if exists "team_library_items_select" on public.team_library_items;
create policy "team_library_items_select" on public.team_library_items
  for select
  using (public.is_active_team_member(team_id));

drop policy if exists "team_library_items_insert" on public.team_library_items;
create policy "team_library_items_insert" on public.team_library_items
  for insert
  with check (added_by = (select auth.uid()) and public.is_active_team_member(team_id));

-- Iedereen (elk actief teamlid) mag een item uit de teambibliotheek
-- verwijderen — voor 'reference'-items is dat precies wat de brief vraagt;
-- voor 'own'-items is dit bewust GEEN vervanging voor de "verwijderen mag
-- de maker of de teameigenaar"-regel op de teamactiviteit zelf (die regelt
-- deleteTeamActivity server-side via zachte verwijdering, zie
-- actions/teamLibrary.ts) — een teamlid kan hier hooguit de koppeling
-- verwijderen, niet de activiteit zelf.
drop policy if exists "team_library_items_delete" on public.team_library_items;
create policy "team_library_items_delete" on public.team_library_items
  for delete
  using (public.is_active_team_member(team_id));

-- ============================================================================
-- 4. team_tags + team_library_item_tags — tags hangen aan het item, niet aan
-- de activiteit zelf (zo kan een team ook een gerefereerde GymWiki-
-- activiteit taggen zonder het origineel te wijzigen).
-- ============================================================================
create table if not exists public.team_tags (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  name text not null,
  color text,
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'team_tags_name_length_check') then
    alter table public.team_tags
      add constraint team_tags_name_length_check check (char_length(name) between 1 and 30);
  end if;
end;
$$;

-- Hoofdletterongevoelig uniek per team — de aanroepende server-actie trimt
-- `name` altijd vóór het schrijven (zie actions/teamLibrary.ts), dus deze
-- index hoeft zelf niet ook nog te trimmen.
create unique index if not exists team_tags_team_name_idx on public.team_tags (team_id, lower(name));

create or replace function public.check_team_tag_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  perform 1 from public.teams where id = new.team_id for update;
  select count(*) into v_count from public.team_tags where team_id = new.team_id;
  if v_count >= 100 then
    raise exception 'Tag-limiet bereikt (max 100 tags per team).' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.check_team_tag_limit() from public, anon, authenticated;

drop trigger if exists team_tags_limit on public.team_tags;
create trigger team_tags_limit
  before insert on public.team_tags
  for each row execute function public.check_team_tag_limit();

alter table public.team_tags enable row level security;
alter table public.team_tags force row level security;

drop policy if exists "team_tags_select" on public.team_tags;
create policy "team_tags_select" on public.team_tags
  for select
  using (public.is_active_team_member(team_id));

drop policy if exists "team_tags_insert" on public.team_tags;
create policy "team_tags_insert" on public.team_tags
  for insert
  with check (created_by = (select auth.uid()) and public.is_active_team_member(team_id));

-- Hernoemen/verwijderen (incl. "samenvoegen", dat client-side een reeks
-- item-tag-koppelingen verplaatst en daarna de bron-tag verwijdert, zie
-- actions/teamLibrary.ts) is bewust eigenaar-only — de brief noemt dit
-- expliciet als eigenaarstaak, in tegenstelling tot aanmaken/toewijzen dat
-- voor elk lid openstaat.
drop policy if exists "team_tags_update_owner" on public.team_tags;
create policy "team_tags_update_owner" on public.team_tags
  for update
  using (
    exists (select 1 from public.teams t where t.id = team_tags.team_id and t.owner_user_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.teams t where t.id = team_tags.team_id and t.owner_user_id = (select auth.uid()))
  );

drop policy if exists "team_tags_delete_owner" on public.team_tags;
create policy "team_tags_delete_owner" on public.team_tags
  for delete
  using (
    exists (select 1 from public.teams t where t.id = team_tags.team_id and t.owner_user_id = (select auth.uid()))
  );

create table if not exists public.team_library_item_tags (
  item_id uuid not null references public.team_library_items (id) on delete cascade,
  tag_id uuid not null references public.team_tags (id) on delete cascade,
  added_by uuid references public.users (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (item_id, tag_id)
);

create index if not exists team_library_item_tags_tag_id_idx on public.team_library_item_tags (tag_id);

-- Bewaakt dat een tag alleen aan een item van hetzelfde team gekoppeld kan
-- worden + het tags-per-item-limiet (max 10).
create or replace function public.check_team_library_item_tag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_item_team uuid;
  v_tag_team uuid;
begin
  perform 1 from public.team_library_items where id = new.item_id for update;

  select team_id into v_item_team from public.team_library_items where id = new.item_id;
  select team_id into v_tag_team from public.team_tags where id = new.tag_id;
  if v_item_team is null or v_tag_team is null or v_item_team <> v_tag_team then
    raise exception 'Deze tag hoort niet bij hetzelfde team als dit item.' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.team_library_item_tags where item_id = new.item_id;
  if v_count >= 10 then
    raise exception 'Tag-limiet per activiteit bereikt (max 10 tags).' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.check_team_library_item_tag() from public, anon, authenticated;

drop trigger if exists team_library_item_tags_validate on public.team_library_item_tags;
create trigger team_library_item_tags_validate
  before insert on public.team_library_item_tags
  for each row execute function public.check_team_library_item_tag();

alter table public.team_library_item_tags enable row level security;
alter table public.team_library_item_tags force row level security;

drop policy if exists "team_library_item_tags_select" on public.team_library_item_tags;
create policy "team_library_item_tags_select" on public.team_library_item_tags
  for select
  using (
    exists (
      select 1 from public.team_library_items i
      where i.id = item_id and public.is_active_team_member(i.team_id)
    )
  );

-- Alle leden mogen tags toewijzen/verwijderen op elk item van hun team (zie
-- de brief) — geen apart eigenaarsvoorbehoud hier, in tegenstelling tot
-- team_tags hierboven.
drop policy if exists "team_library_item_tags_insert" on public.team_library_item_tags;
create policy "team_library_item_tags_insert" on public.team_library_item_tags
  for insert
  with check (
    exists (
      select 1 from public.team_library_items i
      where i.id = item_id and public.is_active_team_member(i.team_id)
    )
  );

drop policy if exists "team_library_item_tags_delete" on public.team_library_item_tags;
create policy "team_library_item_tags_delete" on public.team_library_item_tags
  for delete
  using (
    exists (
      select 1 from public.team_library_items i
      where i.id = item_id and public.is_active_team_member(i.team_id)
    )
  );

-- ============================================================================
-- 5. activity_versions — versiegeschiedenis voor samen bewerken. De laatste
-- 20 versies per activiteit blijven bewaard (oudere worden na elke insert
-- automatisch opgeruimd). Schrijven gebeurt door actions/teamLibrary.ts's
-- updateTeamActivity vóór de daadwerkelijke UPDATE, met de versie die
-- daarmee wordt overschreven als CAS-mechanisme: de unique(activity_id,
-- version)-constraint hieronder laat een gelijktijdige, tegenstrijdige
-- opslag met dezelfde verwachte versie botsen op een unique-violation
-- (23505) — precies het optimistic-locking-conflict-signaal dat de UI moet
-- tonen als "[naam] heeft dit net gewijzigd".
-- ============================================================================
create table if not exists public.activity_versions (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null references public.activiteiten (id) on delete cascade,
  version integer not null,
  data jsonb not null,
  changed_by uuid references public.users (id) on delete set null,
  changed_at timestamptz not null default now(),
  unique (activity_id, version)
);

create index if not exists activity_versions_activity_id_idx on public.activity_versions (activity_id, version desc);

create or replace function public.prune_activity_versions()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.activity_versions
  where activity_id = new.activity_id
    and version <= (
      select max(version) - 19 from public.activity_versions where activity_id = new.activity_id
    );
  return new;
end;
$$;

revoke all on function public.prune_activity_versions() from public, anon, authenticated;

drop trigger if exists activity_versions_prune on public.activity_versions;
create trigger activity_versions_prune
  after insert on public.activity_versions
  for each row execute function public.prune_activity_versions();

alter table public.activity_versions enable row level security;
alter table public.activity_versions force row level security;

drop policy if exists "activity_versions_select" on public.activity_versions;
create policy "activity_versions_select" on public.activity_versions
  for select
  using (
    exists (
      select 1 from public.activiteiten a
      where a.id = activity_id and a.visibility = 'team' and public.is_active_team_member(a.team_id)
    )
  );

drop policy if exists "activity_versions_insert" on public.activity_versions;
create policy "activity_versions_insert" on public.activity_versions
  for insert
  with check (
    exists (
      select 1 from public.activiteiten a
      where a.id = activity_id and a.visibility = 'team' and public.is_active_team_member(a.team_id)
    )
  );
-- Geen UPDATE/DELETE-policy: een versie-archief is write-once vanuit de app;
-- opruimen gebeurt uitsluitend via de security-definer prune-trigger hierboven.

-- ============================================================================
-- 6. ai_usage.team_id (team_plans.sql) dekt de gepoolde AI-teller al — geen
-- extra kolom hier nodig voor de teambibliotheek zelf.
-- ============================================================================
