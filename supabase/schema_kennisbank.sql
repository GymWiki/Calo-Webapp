-- Kennisbank (Knowledge Bucket) — pgvector-backed RAG source store.
--
-- Lets a beheerder ("admin") upload didactische vakliteratuur (Basisdocument
-- Bewegingsonderwijs, Game-Based Pedagogy, het 3L-model van Walinga &
-- Koekoek, beoordelingskaders, ...) so the AI Lescoach / Activiteiten
-- Generator can ground its answers in this material instead of general
-- knowledge.
--
-- Deviations from the brief, documented here:
--   * The brief's `category TEXT NOT NULL` is constrained with a CHECK
--     instead of left fully free-form, to keep the admin UI's category
--     picker meaningful. An 'overig' escape hatch is added alongside the
--     brief's four example categories, matching the "Anders, namelijk..."
--     pattern already used elsewhere in this app (see
--     schema_didactics_and_basisdocument.sql).
--   * `public.users.role` is a Postgres enum (`user_role`), not a free TEXT
--     column with a check constraint — 'admin' was added to that enum in a
--     prior, separate migration (`add_admin_value_to_user_role_enum`),
--     since a new enum value can't be referenced in the same transaction
--     that adds it.
--   * RLS follows this repo's established convention (see e.g.
--     schema_tournaments.sql): enable + force RLS, explicit policies per
--     command. Any authenticated user (docent or student) may READ
--     documents/chunks, since the AI Lescoach retriever runs as the calling
--     user via the normal server client (this repo has no service-role
--     client, see get-current-profile.ts) — only admins may write.

-- 1. Enable the pgvector extension.
create extension if not exists vector;

-- 2. Documents table: one row per uploaded book/article/richtlijn.
create table if not exists public.knowledge_documents (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  author text,
  category text not null check (
    category in (
      'basisdocument',
      'game_based_pedagogy',
      '3L_model',
      'beoordeling',
      'overig'
    )
  ),
  uploaded_by uuid references public.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Chunks table: the actual paragraphs + their embeddings.
create table if not exists public.knowledge_chunks (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references public.knowledge_documents(id) on delete cascade not null,
  chunk_index int not null default 0,
  content text not null,
  embedding vector(1536),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Index for fast vector similarity search.
--
-- `lists = 100` (as literally given in the brief) was tried first and
-- empirically verified — via a direct insert + match_knowledge_chunks call
-- against this project — to silently drop relevant results on a
-- small/medium table: ivfflat's default `probes = 1` only scans 1 of the
-- 100 clusters per query, so a chunk landing in an unprobed cluster never
-- comes back, even above match_threshold. A freshly-launched Kennisbank
-- (a handful of uploaded documents) is exactly that scale, so `lists` is
-- set lower here, and the RPC itself raises `probes` (see below) so
-- retrieval quality doesn't depend on every caller remembering to tune it.
set maintenance_work_mem = '64MB';

create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

create index if not exists knowledge_chunks_document_id_idx
  on public.knowledge_chunks (document_id);

-- 5. RPC for retrieving the most relevant chunks for a query embedding.
create or replace function public.match_knowledge_chunks(
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
as $$
begin
  -- See the `lists = 10` comment above — this is the other half of that fix.
  set local ivfflat.probes = 10;

  return query
  select
    knowledge_chunks.id,
    knowledge_chunks.document_id,
    knowledge_chunks.content,
    1 - (knowledge_chunks.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks
  where 1 - (knowledge_chunks.embedding <=> query_embedding) > match_threshold
  order by knowledge_chunks.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 6. Row Level Security.
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_documents force row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_chunks force row level security;

-- Small reusable admin check. Not SECURITY DEFINER: public.users already
-- allows any authenticated user to SELECT all rows (users_select_authenticated),
-- so this needs no elevated privileges to evaluate.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

create policy "knowledge_documents_select_authenticated"
  on public.knowledge_documents for select
  to authenticated
  using (true);

create policy "knowledge_documents_write_admin"
  on public.knowledge_documents for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "knowledge_chunks_select_authenticated"
  on public.knowledge_chunks for select
  to authenticated
  using (true);

create policy "knowledge_chunks_write_admin"
  on public.knowledge_chunks for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
