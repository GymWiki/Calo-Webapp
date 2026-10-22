-- Traceert per activiteit welke specifieke Kennisbank/Standaardbibliotheek-
-- fragmenten daadwerkelijk zijn meegestuurd naar de AI bij het genereren
-- (AI Activiteiten Generator), controleren (createLesson's AI-kwaliteitscheck)
-- of raadplegen (AI Lescoach) van díe activiteit — backt de "Gebruikte
-- bronnen"-sectie op de activiteit-detailpagina en de "Gebruikt in N
-- activiteiten"-indicatie op /kennisbank.
--
-- Bewust een content-SNAPSHOT (niet enkel chunk_id + een latere join): het
-- fragment moet blijven kloppen met wat er destijds daadwerkelijk aan de AI
-- is gegeven, ook als het brondocument later wordt aangepast/verwijderd, en
-- knowledge_package_chunks is sowieso admin-only leesbaar (zie
-- knowledge_packages.sql) — een gewone gebruiker kan dat fragment dus toch
-- niet zelf terugvinden via een join.
--
-- Logging gebeurt uitsluitend server-side, met de sessie van de eigenaar
-- van de betrokken activiteit (zie lib/ai/knowledgeUsageLogging.ts) — nooit
-- vanuit een aanroep van een andere gebruiker (bijv. iemand die AI Lescoach
-- gebruikt op een gedeelde activiteit van iemand anders, /les/share/[id]).
-- Zonder die restrictie zou een fragment uit de "eigen kennisbank"-selectie
-- van een WILLEKEURIGE viewer aan andermans publieke activiteit gekoppeld
-- kunnen raken — de insert-policy hieronder dwingt dat af.

create table public.activity_knowledge_usage (
  id uuid primary key default gen_random_uuid(),
  -- activiteiten.id is text (niet uuid) — zie consolidate_lessons_into_
  -- activiteiten.sql, dat de kolom nooit heeft gemigreerd naar uuid.
  activity_id text not null references public.activiteiten(id) on delete cascade,
  context text not null check (context in ('generate', 'lescoach', 'checker')),
  source_type text not null check (source_type in ('knowledge_base', 'knowledge_package')),
  chunk_id uuid not null,
  document_id uuid not null,
  document_title text not null,
  source_label text not null,
  -- Alleen gezet voor source_type='knowledge_package' — bespaart een join
  -- met de admin-only knowledge_package_documents-tabel bij het aggregeren
  -- van "gebruikt in N activiteiten" per pakket op /kennisbank.
  package_id uuid references public.knowledge_packages(id) on delete cascade,
  content text not null,
  similarity real,
  created_at timestamptz not null default now()
);

create index idx_aku_activity_id on public.activity_knowledge_usage (activity_id);
create index idx_aku_document_id on public.activity_knowledge_usage (source_type, document_id);
create index idx_aku_package_id on public.activity_knowledge_usage (package_id) where package_id is not null;

-- ============================================================================
-- RLS: zelfde zichtbaarheidsregel als de activiteiten-rij zelf (openbaar of
-- eigen) — wie de activiteit mag zien, mag ook zien waar ze op gebaseerd is.
-- Insert is beperkt tot de eigenaar van die activiteit: alleen de server-
-- side routes/acties (met de sessie van de daadwerkelijke auteur) mogen
-- hier rijen aan toevoegen, nooit een willekeurige viewer.
-- ============================================================================
alter table public.activity_knowledge_usage enable row level security;
alter table public.activity_knowledge_usage force row level security;

create policy "aku_select_visible_activity" on public.activity_knowledge_usage
  for select
  to authenticated
  using (
    exists (
      select 1 from public.activiteiten a
      where a.id = activity_id
        and (a.is_public = true or a.author_id = (select auth.uid()))
    )
  );

create policy "aku_select_visible_activity_anon" on public.activity_knowledge_usage
  for select
  to anon
  using (
    exists (
      select 1 from public.activiteiten a
      where a.id = activity_id and a.is_public = true
    )
  );

create policy "aku_insert_own_activity" on public.activity_knowledge_usage
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.activiteiten a
      where a.id = activity_id and a.author_id = (select auth.uid())
    )
  );

-- ============================================================================
-- Aggregatie-RPC's voor de "Gebruikt in N activiteiten"-indicatie op
-- /kennisbank. SECURITY DEFINER: het gaat om een simpel aantal (geen
-- fragment-inhoud), geaggregeerd over ALLE gebruikers' activiteiten — zonder
-- dit zou een gewone, RLS-gebonden telling alleen de eigen/openbare
-- activiteiten van de aanroeper meetellen (zelfde precedent als
-- get_own_activity_reuse_count in activity_reuse_count.sql).
-- ============================================================================
create or replace function public.get_knowledge_base_usage_counts()
returns table (document_id uuid, activity_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select aku.document_id, count(distinct aku.activity_id) as activity_count
  from public.activity_knowledge_usage aku
  where aku.source_type = 'knowledge_base'
  group by aku.document_id;
$$;

revoke execute on function public.get_knowledge_base_usage_counts() from public, anon;
grant execute on function public.get_knowledge_base_usage_counts() to authenticated;

create or replace function public.get_knowledge_package_usage_counts()
returns table (package_id uuid, activity_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select aku.package_id, count(distinct aku.activity_id) as activity_count
  from public.activity_knowledge_usage aku
  where aku.source_type = 'knowledge_package' and aku.package_id is not null
  group by aku.package_id;
$$;

revoke execute on function public.get_knowledge_package_usage_counts() from public, anon;
grant execute on function public.get_knowledge_package_usage_counts() to authenticated;
