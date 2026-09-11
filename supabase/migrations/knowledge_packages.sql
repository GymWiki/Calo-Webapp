-- "Standaardbibliotheek": door GymWiki beheerde literatuurpakketten (bijv.
-- CALO-leerlijnen, Athletic Skills Model) naast de bestaande, door
-- gebruikers zelf gevulde `knowledge_base` (die ongewijzigd blijft bestaan
-- en, zoals nu al het geval is, altijd gedeeld/meegenomen wordt voor
-- iedereen — zie knowledge_base_simplify.sql). Gebruikers kiezen per
-- pakket of het meetelt in hún AI-context.
--
-- LET OP — auteursrecht: deze migratie maakt uitsluitend de structuur aan.
-- Er wordt bewust GEEN content geseed (geen CALO-lesmateriaal, geen
-- Athletic Skills Model) — dat vereist eerst bevestigde toestemming/licentie
-- van de rechthebbende. De beheerder voegt pakketten pas toe via
-- /kennisbank/beheer zodra dat is geregeld.
--
-- Er bestaat geen rollensysteem meer in deze app (zie remove_user_roles.sql
-- / de vaste "geen adminrol"-conventie in dit project) — beheer van deze
-- bibliotheek is daarom gegated op een vaste e-mail-allowlist
-- (is_library_admin() hieronder, zie ook lib/adminAccess.ts), niet op een
-- rolkolom.

create extension if not exists vector;

-- ============================================================================
-- 1. is_library_admin() — enige "adminrol" in dit project: een vaste
-- e-mail-allowlist op de JWT-claim, gebruikt door zowel de RLS-policies
-- hieronder als lib/adminAccess.ts (dat is_library_admin() server-side
-- checkt vóórdat een admin-actie/pagina wordt uitgevoerd). Nieuwe beheerders
-- toevoegen: deze functie in een nieuwe migratie bijwerken.
-- ============================================================================
create or replace function public.is_library_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select lower(coalesce((select auth.jwt() ->> 'email'), '')) in (
    'pieter.kluvers06@gmail.com'
  );
$$;

-- ============================================================================
-- 2. knowledge_packages — het pakket zelf (naam, beschrijving, bronvermelding).
-- ============================================================================
create table if not exists public.knowledge_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  source_attribution text,
  is_active boolean not null default true,
  -- Of dit pakket voor NIEUWE gebruikers standaard aan staat (Stap 8: "mits
  -- rechtenmatig toegestaan") — bewust default false; de beheerder zet dit
  -- pas op true voor een specifiek pakket zodra de rechten zijn bevestigd.
  default_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_knowledge_packages_is_active
  on public.knowledge_packages (is_active);

-- ============================================================================
-- 3. knowledge_package_documents — de volledige, ruwe bestanden per pakket.
-- ============================================================================
create table if not exists public.knowledge_package_documents (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.knowledge_packages(id) on delete cascade,
  title text not null,
  original_file_url text not null,
  file_type text not null,
  processing_status text not null default 'pending'
    check (processing_status in ('pending', 'processing', 'processed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_kpd_package_id on public.knowledge_package_documents (package_id);
create index if not exists idx_kpd_status on public.knowledge_package_documents (processing_status);

-- ============================================================================
-- 4. knowledge_package_chunks — tekstfragmenten + embeddings per document.
-- ============================================================================
create table if not exists public.knowledge_package_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_package_documents(id) on delete cascade,
  chunk_index integer not null default 0,
  chunk_text text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists idx_kpc_document_id on public.knowledge_package_chunks (document_id);

-- Zelfde ivfflat-tuning als knowledge_base_chunks (knowledge_base_simplify.sql)
-- — lists=10 + probes=10 in de RPC hieronder, want de standaard
-- lists=100/probes=1 laat op een kleine/middelgrote tabel relevante chunks
-- stilzwijgend vallen.
set maintenance_work_mem = '64MB';

create index if not exists idx_kpc_embedding
  on public.knowledge_package_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- ============================================================================
-- 5. user_knowledge_preferences — per gebruiker, per pakket aan/uit.
-- Ontbrekende rij = terugvallen op knowledge_packages.default_enabled (zie
-- de RPC hieronder), dus geen backfill-rij nodig voor bestaande gebruikers.
-- ============================================================================
create table if not exists public.user_knowledge_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  package_id uuid not null references public.knowledge_packages(id) on delete cascade,
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, package_id)
);

create index if not exists idx_ukp_user_id on public.user_knowledge_preferences (user_id);
create index if not exists idx_ukp_package_id on public.user_knowledge_preferences (package_id);

-- ============================================================================
-- 6. match_knowledge_package_chunks — retrieval-RPC, analoog aan
-- match_knowledge_base_chunks. SECURITY DEFINER: de onderliggende
-- documents/chunks-tabellen zijn admin-only leesbaar (zie RLS hieronder,
-- Stap 6/7 hebben normale gebruikers alleen het pakket zelf nodig om aan/uit
-- te zetten, niet de losse documenten/fragmenten) — deze functie is de
-- bewust smalle, door de app gebruikte doorgang die alléén matchende
-- fragmenten + het bijbehorende pakket teruggeeft, gefilterd op pakketten
-- die (a) actief zijn én (b) door déze gebruiker zijn aangevinkt (of
-- default_enabled zijn zonder expliciete voorkeur).
create or replace function public.match_knowledge_package_chunks(
  query_embedding vector(1536),
  p_user_id uuid,
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  document_title text,
  package_id uuid,
  package_name text,
  content text,
  similarity float
)
language plpgsql
security definer
set search_path = 'public'
as $$
begin
  set local ivfflat.probes = 10;

  return query
  select
    kpc.id,
    kpc.document_id,
    kpd.title as document_title,
    kp.id as package_id,
    kp.name as package_name,
    kpc.chunk_text as content,
    1 - (kpc.embedding <=> query_embedding) as similarity
  from public.knowledge_package_chunks kpc
  join public.knowledge_package_documents kpd on kpd.id = kpc.document_id
  join public.knowledge_packages kp on kp.id = kpd.package_id
  left join public.user_knowledge_preferences ukp
    on ukp.package_id = kp.id and ukp.user_id = p_user_id
  where
    kp.is_active = true
    and coalesce(ukp.enabled, kp.default_enabled) = true
    and (1 - (kpc.embedding <=> query_embedding)) > match_threshold
  order by kpc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Puur bedoeld voor server-side gebruik met een ingelogde gebruikerssessie
-- (lib/ai/knowledgeRetrieval.ts). LET OP: deze functie is SECURITY DEFINER
-- en omzeilt dus RLS — zie knowledge_packages_revoke_anon_rpc.sql voor de
-- noodzakelijke follow-up (anon-rol expliciet intrekken, anders kan een
-- uitgelogde bezoeker er via /rest/v1/rpc/... alsnog bij).

-- ============================================================================
-- 7. Row Level Security.
-- ============================================================================

-- 7a. knowledge_packages: iedereen leest actieve pakketten (nodig voor de
-- Standaardbibliotheek-toggle-lijst); de beheerder ziet ook inactieve/
-- concept-pakketten en is de enige die mag schrijven.
alter table public.knowledge_packages enable row level security;
alter table public.knowledge_packages force row level security;

create policy "knowledge_packages_select" on public.knowledge_packages
  for select
  to authenticated
  using (is_active = true or public.is_library_admin());

-- Bewust drie losse policies i.p.v. één "for all": een aparte SELECT-policy
-- zou overlappen met knowledge_packages_select hierboven (beide permissive
-- voor dezelfde rol/actie, dus Postgres evalueert dan onnodig allebei —
-- zie knowledge_packages_split_admin_policy.sql, toegepast na een
-- get_advisors performance-melding).
create policy "knowledge_packages_insert_admin" on public.knowledge_packages
  for insert
  to authenticated
  with check (public.is_library_admin());

create policy "knowledge_packages_update_admin" on public.knowledge_packages
  for update
  to authenticated
  using (public.is_library_admin())
  with check (public.is_library_admin());

create policy "knowledge_packages_delete_admin" on public.knowledge_packages
  for delete
  to authenticated
  using (public.is_library_admin());

-- 7b. knowledge_package_documents / knowledge_package_chunks: admin-only op
-- tabelniveau. Gewone gebruikers hebben deze rijen nooit rechtstreeks nodig
-- — de Standaardbibliotheek-UI toont alleen pakketten (7a), en retrieval
-- loopt via de SECURITY DEFINER-RPC hierboven, niet via directe SELECTs.
-- Dit houdt de ruwe brondocumenten or de losse fragmenten weg van de
-- publieke PostgREST-API, wat gezien de auteursrechtelijke gevoeligheid van
-- dit materiaal (zie migratie-intro) een bewuste, extra voorzichtige keuze
-- is — niet strikt vereist voor de retrieval-functionaliteit zelf.
alter table public.knowledge_package_documents enable row level security;
alter table public.knowledge_package_documents force row level security;

create policy "knowledge_package_documents_admin" on public.knowledge_package_documents
  for all
  to authenticated
  using (public.is_library_admin())
  with check (public.is_library_admin());

alter table public.knowledge_package_chunks enable row level security;
alter table public.knowledge_package_chunks force row level security;

create policy "knowledge_package_chunks_admin" on public.knowledge_package_chunks
  for all
  to authenticated
  using (public.is_library_admin())
  with check (public.is_library_admin());

-- 7c. user_knowledge_preferences: volledig eigenaar-gescoped, zelfde
-- patroon als het oudere user_document_preferences (user_knowledge_base.sql).
alter table public.user_knowledge_preferences enable row level security;
alter table public.user_knowledge_preferences force row level security;

create policy "ukp_select_own" on public.user_knowledge_preferences
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "ukp_insert_own" on public.user_knowledge_preferences
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "ukp_update_own" on public.user_knowledge_preferences
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "ukp_delete_own" on public.user_knowledge_preferences
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================================
-- 8. Storage bucket voor de ruwe pakket-bestanden. Bewust PRIVAAT (anders
-- dan de publieke `kennisbank-documenten`-bucket voor gebruikersuploads) —
-- alleen de beheerder kan de volledige, mogelijk auteursrechtelijk
-- beschermde brondocumenten uploaden/downloaden; gewone gebruikers krijgen
-- nooit een directe link naar het ruwe bestand, alleen de doorzoekbare
-- fragmenten via de RPC hierboven.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-packages',
  'knowledge-packages',
  false,
  20971520, -- 20 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do nothing;

drop policy if exists "knowledge_packages_bucket_admin" on storage.objects;
create policy "knowledge_packages_bucket_admin" on storage.objects
  for all
  to authenticated
  using (bucket_id = 'knowledge-packages' and public.is_library_admin())
  with check (bucket_id = 'knowledge-packages' and public.is_library_admin());
