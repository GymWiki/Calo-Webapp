-- Vereenvoudigt de Kennisbank tot één gedeelde, doorzoekbare documentenbak
-- i.p.v. het admin-defaults + per-gebruiker-toggle-systeem hiervoor. Elke
-- upload (bestand of geplakte tekst) is direct voor iedereen beschikbaar
-- als context voor de AI-activiteitenchecker en de AI-activiteitengenerator
-- — er is geen "voorgestelde/aanbevolen literatuur"-concept meer (dat komt
-- later apart terug).

-- ============================================================================
-- 1. Oude structuur opruimen.
-- ============================================================================
drop function if exists public.match_user_knowledge_chunks(vector, uuid, float, int);
drop function if exists public.match_knowledge_chunks(vector, float, int);
drop table if exists public.user_document_preferences;
drop table if exists public.knowledge_chunks;
drop table if exists public.knowledge_documents;

-- ============================================================================
-- 2. Nieuwe structuur: knowledge_base (documenten/metadata) +
-- knowledge_base_chunks (tekstfragmenten + embeddings).
-- ============================================================================
create table public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  tags text[] not null default '{}',
  file_url text not null,
  file_type text not null,
  uploaded_by uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processed', 'failed')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_knowledge_base_uploaded_by on public.knowledge_base (uploaded_by);
create index idx_knowledge_base_created_at on public.knowledge_base (created_at desc);

create table public.knowledge_base_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_base(id) on delete cascade,
  chunk_index integer not null default 0,
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index idx_knowledge_base_chunks_document_id on public.knowledge_base_chunks (document_id);

-- Zelfde ivfflat-tuning als de oude match_knowledge_chunks (schema_kennisbank.sql)
-- — lists=10 + probes=10 in de RPC, omdat het standaard lists=100/probes=1
-- op een kleine/middelgrote tabel relevante chunks stilzwijgend liet vallen.
set maintenance_work_mem = '64MB';

create index idx_knowledge_base_chunks_embedding
  on public.knowledge_base_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- ============================================================================
-- 3. RPC voor retrieval — gedeeld door de AI-activiteitenchecker en de
-- AI-activiteitengenerator (lib/ai/knowledgeRetrieval.ts). Geen
-- gebruikersscoping meer: de hele kennisbank is gedeeld.
-- ============================================================================
create or replace function public.match_knowledge_base_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language plpgsql
set search_path = 'public'
as $$
begin
  set local ivfflat.probes = 10;

  return query
  select
    kbc.id,
    kbc.document_id,
    kbc.content,
    1 - (kbc.embedding <=> query_embedding) as similarity
  from public.knowledge_base_chunks kbc
  where 1 - (kbc.embedding <=> query_embedding) > match_threshold
  order by kbc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- ============================================================================
-- 4. Row Level Security. Iedereen (ingelogd) leest de volledige gedeelde
-- kennisbank; alleen de indiener mag zijn eigen document bewerken/
-- verwijderen (bewerken is nodig zodat het verwerkingsstap — dezelfde
-- request, dezelfde gebruikerssessie — de status naar processed/failed
-- kan bijwerken).
-- ============================================================================
alter table public.knowledge_base enable row level security;
alter table public.knowledge_base force row level security;
alter table public.knowledge_base_chunks enable row level security;
alter table public.knowledge_base_chunks force row level security;

create policy "knowledge_base_select_authenticated" on public.knowledge_base
  for select
  to authenticated
  using (true);

create policy "knowledge_base_insert_own" on public.knowledge_base
  for insert
  to authenticated
  with check (uploaded_by = (select auth.uid()));

create policy "knowledge_base_update_own" on public.knowledge_base
  for update
  to authenticated
  using (uploaded_by = (select auth.uid()))
  with check (uploaded_by = (select auth.uid()));

create policy "knowledge_base_delete_own" on public.knowledge_base
  for delete
  to authenticated
  using (uploaded_by = (select auth.uid()));

create policy "knowledge_base_chunks_select_authenticated" on public.knowledge_base_chunks
  for select
  to authenticated
  using (true);

create policy "knowledge_base_chunks_insert_own" on public.knowledge_base_chunks
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.knowledge_base kb
      where kb.id = document_id and kb.uploaded_by = (select auth.uid())
    )
  );

-- Geen explicit delete-policy voor chunks nodig: ze verdwijnen via
-- document_id's ON DELETE CASCADE zodra het eigen document wordt verwijderd
-- (knowledge_base_delete_own hierboven) — foreign-key-cascade-acties zijn
-- niet aan RLS van de child-tabel onderworpen (zelfde precedent als
-- knowledge_chunks in user_knowledge_base.sql).

-- ============================================================================
-- 5. Storage bucket voor de geüploade bestanden (PDF/Word/tekst).
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kennisbank-documenten',
  'kennisbank-documenten',
  true,
  20971520, -- 20 MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- storage.objects heeft RLS aan by default — anders dan de andere buckets
-- in dit project (afbeeldingen, alleen door de projecteigenaar via de
-- dashboard geüpload), uploaden gewone gebruikers hier zelf via de app met
-- hun eigen sessie, dus dat moet hier expliciet toegestaan worden. Elk
-- bestand staat onder `<user_id>/...` (actions/knowledge.ts), dus dat is
-- meteen de eigendomscontrole voor schrijven/verwijderen.
drop policy if exists "kennisbank_documenten_select" on storage.objects;
create policy "kennisbank_documenten_select" on storage.objects
  for select
  to authenticated
  using (bucket_id = 'kennisbank-documenten');

drop policy if exists "kennisbank_documenten_insert_own" on storage.objects;
create policy "kennisbank_documenten_insert_own" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'kennisbank-documenten'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "kennisbank_documenten_delete_own" on storage.objects;
create policy "kennisbank_documenten_delete_own" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'kennisbank-documenten'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
