-- Community-waardering ("Dit werkte goed 👍") op activiteiten. Simpele like
-- i.p.v. een 1-5-sterrenbeoordeling (zie de brief): laagdrempeliger voor
-- drukbezette docenten, en minder gevoelig voor een enkele scheve lage
-- beoordeling. Zelfde datamodel-vorm als opgeslagen_activiteiten (own-row-
-- only RLS, unique(activity_id, user_id)) — een sterbeoordeling kan later op
-- dit datamodel uitgebreid worden door een `rating smallint`-kolom aan deze
-- tabel toe te voegen (check tussen 1 en 5) i.p.v. een nieuwe tabel.
create table public.activity_likes (
  id uuid primary key default gen_random_uuid(),
  activity_id text not null references public.activiteiten (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (activity_id, user_id)
);

create index activity_likes_activity_id_idx on public.activity_likes (activity_id);
create index activity_likes_user_id_idx on public.activity_likes (user_id);

alter table public.activity_likes enable row level security;
alter table public.activity_likes force row level security;

-- Own-row-only — precies zoals opgeslagen_activiteiten: de tabel zelf hoeft
-- niet breed leesbaar te zijn, want het geaggregeerde aantal wordt
-- gedenormaliseerd naar activiteiten.like_count (hieronder), dat via de
-- bestaande activiteiten/activiteiten_publiek-SELECT-policies al voor
-- iedereen leesbaar is. Deze policies dienen alleen om "heeft DEZE
-- gebruiker dit al geliket" te kunnen opvragen.
create policy "activity_likes_select" on public.activity_likes
  for select to authenticated using (user_id = (select auth.uid()));

-- Self-like-preventie hier óók server-side afgedwongen (niet alleen in de
-- server action): een insert-poging voor een activiteit waarvan
-- author_id = de inloggende gebruiker faalt op RLS-niveau, dus zelfs een
-- bug in de server action kan geen zelf-like laten doorkomen.
create policy "activity_likes_insert" on public.activity_likes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select author_id from public.activiteiten where id = activity_id) is distinct from (select auth.uid())
  );

create policy "activity_likes_delete" on public.activity_likes
  for delete to authenticated using (user_id = (select auth.uid()));

-- Gedenormaliseerd like_count-veld i.p.v. een live COUNT() bij elke
-- lijst-/kaartweergave: de bibliotheek-lijst (getAllActivities) en de
-- publieke SEO-pagina's laden nu al alle rijen in één keer (zie
-- lib/services/activities.ts/publicActivities.ts) — een COUNT-subquery of
-- JOIN+GROUP BY per rij zou die ene simpele SELECT laten ontsporen naarmate
-- de bibliotheek en het aantal likes groeien, en de nieuwe "Meest
-- gewaardeerd"-sortering (ORDER BY like_count) heeft sowieso een indexeerbare
-- kolom nodig om niet telkens de hele activity_likes-tabel te moeten
-- aggregeren. Een AFTER INSERT/DELETE-trigger houdt 'm in sync — correctheid
-- ligt zo in de database, niet in de aanroepende server action.
alter table public.activiteiten add column like_count integer not null default 0;

create index activiteiten_like_count_idx on public.activiteiten (like_count desc);

create or replace function public.activity_likes_sync_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    update public.activiteiten set like_count = like_count + 1 where id = new.activity_id;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.activiteiten set like_count = greatest(like_count - 1, 0) where id = old.activity_id;
    return old;
  end if;
  return null;
end;
$$;

create trigger activity_likes_after_insert
  after insert on public.activity_likes
  for each row execute function public.activity_likes_sync_count();

create trigger activity_likes_after_delete
  after delete on public.activity_likes
  for each row execute function public.activity_likes_sync_count();

-- activiteiten_publiek (zie activiteiten_public_seo.sql) is een harde
-- kolom-allowlist voor de anonieme/SEO-pagina's — like_count moet daar
-- expliciet aan toegevoegd worden, anders blijft het aantal likes op de
-- publieke /activiteiten/[slug]-pagina onzichtbaar voor niet-ingelogde
-- bezoekers.
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
  and is_public = true
  and is_ai_generated = false
  and slug is not null
  and seo_summary is not null
  and length(seo_summary) >= 100;
