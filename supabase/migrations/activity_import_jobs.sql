-- Herbouw van "Upload een bestaande activiteit": lost de aanhoudende
-- "TypeError: Failed to fetch" structureel op door de upload zelf NOOIT
-- meer via een Next.js/Vercel-functie te laten lopen. Root cause: Vercel
-- Functions hebben een harde request-bodylimiet van 4,5MB, ONGEACHT Next's
-- eigen `serverActions.bodySizeLimit`-config (die alleen Next's eigen
-- parser regelt, niet het platform-niveau waarop de aanvraag al kapot kan
-- gaan vóórdat Next's code ooit draait). Een POST-body die dat plafond
-- overschrijdt wordt door Vercel's edge-netwerk afgebroken vóór er een
-- nette HTTP-respons is — en dát is precies wat de browser als
-- "TypeError: Failed to fetch" rapporteert: geen serverfout, geen timeout,
-- gewoon een nooit voltooide aanvraag. Eerdere pogingen pakten allemaal
-- code-laag-problemen aan (webpack "Critical dependency"-waarschuwingen,
-- directe imports in "use server"-bestanden) die ook echt bestonden en ook
-- echt gefixed zijn — maar die het transportlaag-probleem nooit konden
-- oplossen, vandaar dat de fout na elke fix in een andere vorm terugkwam.
--
-- Nieuwe architectuur: de browser uploadt het bestand rechtstreeks naar
-- Supabase Storage (buiten Vercel om, dus geen 4,5MB-limiet meer relevant).
-- Verwerking (tekstextractie + AI-mapping) gebeurt daarna server-side, maar
-- ontvangt alleen de storage-path — een paar bytes, nooit het bestand zelf.
-- Deze tabel houdt de voortgang van die verwerking bij zodat de client kan
-- pollen i.p.v. op één blokkerende aanvraag te wachten.

create table if not exists public.activity_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'extracting', 'mapping', 'done', 'failed')),
  error_stage text check (error_stage in ('extraction', 'mapping')),
  error_message text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists activity_import_jobs_user_id_idx
  on public.activity_import_jobs (user_id);

create or replace function public.trg_touch_activity_import_job()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists activity_import_jobs_touch on public.activity_import_jobs;
create trigger activity_import_jobs_touch
  before update on public.activity_import_jobs
  for each row execute function public.trg_touch_activity_import_job();

alter table public.activity_import_jobs enable row level security;

drop policy if exists "activity_import_jobs_owner_select" on public.activity_import_jobs;
create policy "activity_import_jobs_owner_select"
  on public.activity_import_jobs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "activity_import_jobs_owner_insert" on public.activity_import_jobs;
create policy "activity_import_jobs_owner_insert"
  on public.activity_import_jobs
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "activity_import_jobs_owner_update" on public.activity_import_jobs;
create policy "activity_import_jobs_owner_update"
  on public.activity_import_jobs
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "activity_import_jobs_owner_delete" on public.activity_import_jobs;
create policy "activity_import_jobs_owner_delete"
  on public.activity_import_jobs
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================================
-- Storage bucket voor de ruwe geüploade bestanden. Privé: elke gebruiker
-- mag alleen binnen zijn eigen map (eerste padsegment = zijn user id)
-- schrijven/lezen/verwijderen — vergelijkbaar met het patroon in
-- knowledge_packages.sql, maar owner-scoped i.p.v. admin-only, want dit is
-- de eigen upload van de gebruiker zelf, niet een beheer-bibliotheek.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activity-imports',
  'activity-imports',
  false,
  20971520, -- 20 MB — zie DOCUMENT_MAX_FILE_SIZE_BYTES (lib/ai/documentTypes.ts)
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ]
)
on conflict (id) do nothing;

drop policy if exists "activity_imports_owner_rw" on storage.objects;
create policy "activity_imports_owner_rw"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'activity-imports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'activity-imports' and (storage.foldername(name))[1] = (select auth.uid())::text);
