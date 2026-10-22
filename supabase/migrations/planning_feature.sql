-- Planning-functie: klassenbeheer + tweeledige planning (jaarplanning per
-- leerlijn, weekplanning per concrete les). Zie de "Planning"-sectie op het
-- Profiel.
--
-- `leerlijn` is hier, net als bij `activiteiten.leerlijn` en
-- `leerlijn_leeruitkomsten.leerlijn`, een vrije tekstwaarde (geen foreign
-- key) — dezelfde tekstwaarden uit `lib/constants/learningLines.ts`'s
-- LEARNING_LINE_CATEGORIES worden hergebruikt als sleutel.
--
-- `geplande_lessen.activity_id` verwijst naar `activiteiten.id`, dat `text`
-- is (legacy Firestore-ids), niet `uuid`.
--
-- `lesson_slots` op `klassen` is een jsonb-array van vaste weekmomenten
-- ({weekday, startTime, durationMinutes}); diepe validatie gebeurt in de
-- zod-schema-laag (types/planning.ts), niet in de database — zelfde patroon
-- als `activiteiten.didactic_items jsonb`.
--
-- Overlappende jaarplanning-blokken binnen dezelfde klas worden door de
-- database zelf geweigerd via een exclude-constraint (btree_gist), zodat
-- data-integriteit ook onder race conditions gegarandeerd is — niet alleen
-- applicatie-side gecheckt.

create extension if not exists btree_gist;

create table public.klassen (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  name text not null,
  doelgroep integer not null check (doelgroep between 1 and 6),
  lesson_slots jsonb not null default '[]'
    check (jsonb_typeof(lesson_slots) = 'array'),
  created_at timestamptz not null default now()
);

create index klassen_user_id_idx on public.klassen (user_id);

create table public.jaarplanning_blokken (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.klassen (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  leerlijn text not null,
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  created_at timestamptz not null default now(),
  exclude using gist (
    class_id with =,
    daterange(start_date, end_date, '[]') with &&
  )
);

create index jaarplanning_blokken_class_id_idx on public.jaarplanning_blokken (class_id);
create index jaarplanning_blokken_user_id_idx on public.jaarplanning_blokken (user_id);

create table public.geplande_lessen (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.klassen (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  lesson_date date not null,
  start_time time not null,
  duration_minutes integer not null check (duration_minutes > 0),
  activity_id text references public.activiteiten (id) on delete set null,
  status text not null default 'nog_te_bepalen'
    check (status in ('nog_te_bepalen', 'gepland', 'gegeven')),
  notes text,
  created_at timestamptz not null default now(),
  unique (class_id, lesson_date, start_time)
);

create index geplande_lessen_class_id_lesson_date_idx
  on public.geplande_lessen (class_id, lesson_date);
create index geplande_lessen_user_id_idx on public.geplande_lessen (user_id);
create index geplande_lessen_activity_id_idx on public.geplande_lessen (activity_id)
  where activity_id is not null;

-- ============================================================================
-- RLS: alle drie tabellen zijn puur eigenaar-gescoped (geen gedeelde/
-- publieke planning), zelfde 4-policy-vorm als activity_import_jobs.sql.
-- `user_id` staat gedenormaliseerd op alle drie tabellen (i.p.v. alleen op
-- `klassen` met een join/exists in de policy) zodat elke policy een directe
-- kolomvergelijking blijft.
-- ============================================================================

alter table public.klassen enable row level security;
alter table public.klassen force row level security;

create policy "klassen_owner_select" on public.klassen
  for select to authenticated using (user_id = (select auth.uid()));
create policy "klassen_owner_insert" on public.klassen
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "klassen_owner_update" on public.klassen
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "klassen_owner_delete" on public.klassen
  for delete to authenticated using (user_id = (select auth.uid()));

alter table public.jaarplanning_blokken enable row level security;
alter table public.jaarplanning_blokken force row level security;

create policy "jaarplanning_blokken_owner_select" on public.jaarplanning_blokken
  for select to authenticated using (user_id = (select auth.uid()));
create policy "jaarplanning_blokken_owner_insert" on public.jaarplanning_blokken
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "jaarplanning_blokken_owner_update" on public.jaarplanning_blokken
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "jaarplanning_blokken_owner_delete" on public.jaarplanning_blokken
  for delete to authenticated using (user_id = (select auth.uid()));

alter table public.geplande_lessen enable row level security;
alter table public.geplande_lessen force row level security;

create policy "geplande_lessen_owner_select" on public.geplande_lessen
  for select to authenticated using (user_id = (select auth.uid()));
create policy "geplande_lessen_owner_insert" on public.geplande_lessen
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "geplande_lessen_owner_update" on public.geplande_lessen
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "geplande_lessen_owner_delete" on public.geplande_lessen
  for delete to authenticated using (user_id = (select auth.uid()));
