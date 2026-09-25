-- Planning v3: meerdere activiteiten per lesmoment + vereenvoudigde status.
--
-- geplande_lessen.activity_id (max 1 activiteit per lesmoment) wordt
-- vervangen door een junction-tabel les_activiteiten (meerdere, met
-- volgorde). duration_minutes verhuist naar afleiding uit
-- klassen.lesson_slots bij weergave (nergens elders in de app gebruikt).
-- status gaat van 3-way (nog_te_bepalen/gepland/gegeven) naar 2-way
-- (gepland/vervallen) — een lesmoment is voortaan impliciet "gepland"
-- zolang er geen rij is of de rij niet expliciet "vervallen" is gezet.

create table public.les_activiteiten (
  id uuid primary key default gen_random_uuid(),
  lesson_id uuid not null references public.geplande_lessen (id) on delete cascade,
  activity_id text not null references public.activiteiten (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (lesson_id, activity_id)
);
create index les_activiteiten_lesson_id_idx on public.les_activiteiten (lesson_id, position);

alter table public.les_activiteiten enable row level security;
alter table public.les_activiteiten force row level security;

create policy "les_activiteiten_select" on public.les_activiteiten
  for select to authenticated using (user_id = (select auth.uid()));
create policy "les_activiteiten_insert" on public.les_activiteiten
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "les_activiteiten_update" on public.les_activiteiten
  for update to authenticated using (user_id = (select auth.uid()));
create policy "les_activiteiten_delete" on public.les_activiteiten
  for delete to authenticated using (user_id = (select auth.uid()));

-- Bestaande gekoppelde activiteiten overzetten (position 0 — er was tot nu
-- toe hooguit 1 activiteit per lesmoment, dus geen volgorde te bewaren).
insert into public.les_activiteiten (lesson_id, activity_id, user_id, position)
  select id, activity_id, user_id, 0
  from public.geplande_lessen
  where activity_id is not null;

-- Kale, "nooit iets aan gekoppeld"-placeholderrijen horen onder het nieuwe
-- model niet meer te bestaan (lesmomenten worden nu puur virtueel berekend
-- uit klassen.lesson_slots totdat er iets aan gekoppeld wordt).
delete from public.geplande_lessen
  where activity_id is null and notes is null and status = 'nog_te_bepalen';

-- Status vereenvoudigen: 'nog_te_bepalen' en 'gegeven' hadden geen
-- betekenis meer zodra er geen vooraf-gegenereerde rijen meer zijn.
update public.geplande_lessen set status = 'gepland' where status in ('nog_te_bepalen', 'gegeven');
alter table public.geplande_lessen drop constraint geplande_lessen_status_check;
alter table public.geplande_lessen add constraint geplande_lessen_status_check
  check (status in ('gepland', 'vervallen'));
alter table public.geplande_lessen alter column status set default 'gepland';

alter table public.geplande_lessen drop column activity_id;
alter table public.geplande_lessen drop column duration_minutes;
