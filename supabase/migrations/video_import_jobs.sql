-- "Activiteit uit video": derde upload-pad naast document-upload, mirror
-- van activity_import_jobs.sql's architectuur (rechtstreekse browser-naar-
-- Storage upload, geen Vercel-bodylimiet-risico) maar uitgebreid met een
-- fasenmodel: video-verwerking (audio-extractie, transcriptie, AI-mapping,
-- frame-scoring) is te lang voor één serverless-aanroep, dus elke fase is
-- een eigen, kort-lopende server-action-call die de client na elke poll
-- opnieuw triggert. Kandidaat-frames worden CLIENT-SIDE (canvas/<video>)
-- vastgelegd en al vóór job-aanmaak geüpload — frame_storage_paths bevat
-- dus alleen storage-paden, nooit beeldbytes.
create table if not exists public.video_import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  video_storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  duration_seconds integer not null,
  frame_storage_paths text[] not null default '{}',
  audio_storage_path text,
  transcript text,
  status text not null default 'uploaded' check (status in (
    'uploaded', 'extracting_audio', 'audio_extracted',
    'transcribing', 'transcribed', 'mapping', 'mapped',
    'scoring_frames', 'done', 'failed'
  )),
  error_stage text check (error_stage in
    ('audio_extraction', 'transcription', 'mapping', 'frame_scoring')),
  error_message text,
  low_audio_content boolean not null default false,
  frame_selection_failed boolean not null default false,
  selected_frame_path text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_import_jobs_user_id_idx
  on public.video_import_jobs (user_id);

-- Voor de "hangende job"-check op het keuzescherm: vindt snel een
-- niet-afgeronde job van de huidige gebruiker (zie findDanglingVideoImportJob).
create index if not exists video_import_jobs_pending_idx
  on public.video_import_jobs (user_id, created_at)
  where status not in ('done', 'failed');

create or replace function public.trg_touch_video_import_job()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists video_import_jobs_touch on public.video_import_jobs;
create trigger video_import_jobs_touch
  before update on public.video_import_jobs
  for each row execute function public.trg_touch_video_import_job();

alter table public.video_import_jobs enable row level security;

drop policy if exists "video_import_jobs_owner_select" on public.video_import_jobs;
create policy "video_import_jobs_owner_select"
  on public.video_import_jobs
  for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "video_import_jobs_owner_insert" on public.video_import_jobs;
create policy "video_import_jobs_owner_insert"
  on public.video_import_jobs
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "video_import_jobs_owner_update" on public.video_import_jobs;
create policy "video_import_jobs_owner_update"
  on public.video_import_jobs
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "video_import_jobs_owner_delete" on public.video_import_jobs;
create policy "video_import_jobs_owner_delete"
  on public.video_import_jobs
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- ============================================================================
-- Storage bucket voor ruwe video's, geëxtraheerde audio en kandidaat-frames.
-- Privé, eigenaar-gescoped op het eerste padsegment (user id) — zelfde
-- patroon als activity-imports. 200MB-limiet komt overeen met
-- VIDEO_MAX_FILE_SIZE_BYTES (lib/ai/videoTypes.ts); audio/jpeg-mimetypes
-- zijn nodig omdat dezelfde bucket ook de geëxtraheerde audio (voor
-- transcriptie) en de client-side vastgelegde kandidaat-frames bevat.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activity-video-imports',
  'activity-video-imports',
  false,
  209715200, -- 200 MB — zie VIDEO_MAX_FILE_SIZE_BYTES (lib/ai/videoTypes.ts)
  array[
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'image/jpeg',
    'audio/mpeg',
    'audio/mp4'
  ]
)
on conflict (id) do nothing;

drop policy if exists "activity_video_imports_owner_rw" on storage.objects;
create policy "activity_video_imports_owner_rw"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'activity-video-imports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'activity-video-imports' and (storage.foldername(name))[1] = (select auth.uid())::text);
