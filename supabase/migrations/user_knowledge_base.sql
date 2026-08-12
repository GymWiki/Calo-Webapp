-- Gebruikersspecifieke Kennisbank: elke gebruiker kan eigen documenten
-- uploaden en kiezen welke documenten (globale defaults + eigen uploads)
-- actief worden meegenomen door de AI Lescoach / Activiteiten Generator.
--
-- Deviations from the brief, documented here:
--   * schema_kennisbank.sql already has `uploaded_by uuid references
--     public.users(id)`, recording *who* created a document (used by the
--     existing admin flow). The brief's new `user_id uuid references
--     auth.users(id)` is a distinct concept — *ownership*, used only for the
--     personalized RLS/RPC filtering below. Both columns are kept:
--     `uploaded_by` keeps working exactly as before for admin uploads,
--     `user_id` is set (non-null) only for personal (non-default) uploads.
--   * This project's `knowledge_documents` table currently has 0 rows
--     (verified live), so the `is_default` backfill below is a no-op today,
--     but is kept for correctness: any document that already existed before
--     personal uploads were introduced is the beheerder's shared
--     vakliteratuur and must keep showing up for every user afterwards.
--   * RLS on knowledge_documents/knowledge_chunks previously let ANY
--     authenticated user read ALL rows — there was no concept of a private,
--     per-user document yet. That's no longer safe once personal uploads
--     exist, so the old blanket "_select_authenticated" policies are
--     replaced with own-or-default policies. The existing admin
--     "_write_admin" ALL/is_admin() policies are untouched — admins keep
--     full read/write access to every document, including other users'
--     personal uploads (needed for moderation).
--   * The existing `match_knowledge_chunks` RPC (schema_kennisbank.sql) is
--     left in place rather than dropped, in case anything still references
--     it, but every caller in this codebase is updated to call the new
--     `match_user_knowledge_chunks` instead.

-- A. knowledge_documents: ownership + default flag.
alter table public.knowledge_documents
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists is_default boolean not null default false;

-- Backfill: any document that already existed was uploaded by the
-- beheerder as shared literature — mark it default so it keeps showing up
-- for everyone once personal (non-default) uploads exist.
update public.knowledge_documents set is_default = true where user_id is null;

create index if not exists knowledge_documents_user_id_idx
  on public.knowledge_documents (user_id);

-- B. Per-user toggle preferences ("wel/niet meenemen in AI prompts").
create table if not exists public.user_document_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  document_id uuid references public.knowledge_documents(id) on delete cascade not null,
  is_active boolean default true not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (user_id, document_id)
);

create index if not exists user_document_preferences_user_id_idx
  on public.user_document_preferences (user_id);

-- C. RPC: retrieve matches from only this user's ACTIVE documents (their
-- own uploads + active defaults).
create or replace function public.match_user_knowledge_chunks(
  query_embedding vector(1536),
  p_user_id uuid,
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
  -- Same ivfflat probes fix as match_knowledge_chunks — see the
  -- `lists = 10` comment in schema_kennisbank.sql for why this is needed.
  set local ivfflat.probes = 10;

  return query
  select
    kc.id,
    kc.document_id,
    kc.content,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  join public.knowledge_documents kd on kc.document_id = kd.id
  left join public.user_document_preferences udp
    on udp.document_id = kd.id and udp.user_id = p_user_id
  where
    -- Toegangscontrole: document is globaal default OF van de gebruiker zelf.
    (kd.is_default = true or kd.user_id = p_user_id)
    -- Toggle-controle: zonder expliciete voorkeur staat een document standaard aan.
    and coalesce(udp.is_active, true) = true
    and (1 - (kc.embedding <=> query_embedding)) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- D. Row Level Security.

-- D1. user_document_preferences: fully owner-scoped.
alter table public.user_document_preferences enable row level security;
alter table public.user_document_preferences force row level security;

create policy "user_document_preferences_select_own"
  on public.user_document_preferences for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "user_document_preferences_insert_own"
  on public.user_document_preferences for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "user_document_preferences_update_own"
  on public.user_document_preferences for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "user_document_preferences_delete_own"
  on public.user_document_preferences for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- D2. knowledge_documents: personal uploads must stay private to their
-- owner, so the old "any authenticated user reads everything" policy has
-- to go.
drop policy if exists "knowledge_documents_select_authenticated" on public.knowledge_documents;

create policy "knowledge_documents_select_own_or_default"
  on public.knowledge_documents for select
  to authenticated
  using (is_default = true or user_id = (select auth.uid()));

create policy "knowledge_documents_insert_own"
  on public.knowledge_documents for insert
  to authenticated
  with check (user_id = (select auth.uid()) and is_default = false);

create policy "knowledge_documents_delete_own"
  on public.knowledge_documents for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- knowledge_documents_write_admin (existing ALL/is_admin() policy) is
-- untouched — admins keep full read/write access to every document.

-- D3. knowledge_chunks: same own-or-default gate, checked via the parent
-- document (chunks carry no owner column of their own).
drop policy if exists "knowledge_chunks_select_authenticated" on public.knowledge_chunks;

create policy "knowledge_chunks_select_own_or_default"
  on public.knowledge_chunks for select
  to authenticated
  using (
    exists (
      select 1 from public.knowledge_documents kd
      where kd.id = document_id
        and (kd.is_default = true or kd.user_id = (select auth.uid()))
    )
  );

create policy "knowledge_chunks_insert_own"
  on public.knowledge_chunks for insert
  to authenticated
  with check (
    exists (
      select 1 from public.knowledge_documents kd
      where kd.id = document_id and kd.user_id = (select auth.uid())
    )
  );

-- knowledge_chunks_write_admin (existing ALL/is_admin() policy) is
-- untouched. No explicit delete policy is needed for personal chunks: they
-- disappear via knowledge_chunks.document_id's ON DELETE CASCADE when the
-- owning document row is deleted (knowledge_documents_delete_own above).
