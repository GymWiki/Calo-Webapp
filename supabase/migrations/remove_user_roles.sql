-- Verwijder het rollensysteem (admin/docent/student): één universele
-- gebruikerservaring, geen rolonderscheid meer op database-niveau.

-- 1. Profile-creation trigger: niet langer een role kolom vullen.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, first_name, last_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- 2. RLS-policies die op is_admin() (role = 'admin') leunden voor het
-- beheren van de gedeelde Kennisbank-documenten: voortaan mag iedere
-- ingelogde gebruiker deze op dezelfde manier beheren.
drop policy if exists "knowledge_documents_write_admin" on public.knowledge_documents;
create policy "knowledge_documents_write_shared" on public.knowledge_documents
  for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

drop policy if exists "knowledge_chunks_write_admin" on public.knowledge_chunks;
create policy "knowledge_chunks_write_shared" on public.knowledge_chunks
  for all
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- 3. is_admin() is nu ongebruikt.
drop function if exists public.is_admin();

-- 4. De role-kolom en het bijbehorende enum-type zelf.
alter table public.users drop column if exists role;
drop type if exists public.user_role;
