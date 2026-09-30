-- "Activiteit uit video" — YouTube-link als alternatieve invoer naast
-- bestandsupload (zie lib/config/youtubeImportMode.ts voor de volledige
-- juridische afweging achter de twee modi). Breidt video_import_jobs uit
-- met een source_type-discriminator i.p.v. een aparte tabel: de fasen-
-- machine (videoImportProcessor.ts) en de reviewstap (VideoFrameReviewBanner)
-- blijven zo één gedeeld pad voor alle drie de invoerroutes, precies zoals
-- STAP-eis "beide modi resulteren in dezelfde reviewstap".
alter table public.video_import_jobs
  add column if not exists source_type text not null default 'upload'
    check (source_type in ('upload', 'youtube_transcript_only', 'youtube_full_auto'));

-- 'youtube_transcript_only' downloadt nooit een video, dus heeft geen
-- video_storage_path — die kolom was tot nu toe altijd not null omdat elke
-- job tot dusver uit een al-geüpload bestand ontstond.
alter table public.video_import_jobs
  alter column video_storage_path drop not null;

alter table public.video_import_jobs
  add column if not exists youtube_video_id text;
alter table public.video_import_jobs
  add column if not exists youtube_url text;

-- Voor de "hangende job"-banner: welk kaarttype (bestand/YouTube-link) moet
-- hervat worden, zie findDanglingVideoImportJob in actions/videoImport.ts.
-- (Geen aparte index nodig — video_import_jobs_pending_idx dekt de query al,
-- source_type wordt gewoon mee-geselecteerd.)

-- Kostenlogging per invoerroute (STAP-eis "apart feature-label per
-- invoerroute, zodat gebruik per route inzichtelijk is"): 4 nieuwe features
-- naast de 3 bestaande bestandsupload-features (activity_video_*).
-- 'activity_youtube_transcript_only_extraction': de enige AI-kostenstap in
-- transcript_only-modus (geen transcriptiekosten — de ondertiteling komt al
-- kant-en-klaar van YouTube, geen frame-scoring — geen automatische
-- frame-extractie in die modus, zie DEEL3).
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature = any (array[
    'activity_checker', 'lesson_generator', 'ai_lescoach',
    'knowledge_base_embedding', 'taalcheck', 'activity_import_extraction',
    'activity_video_transcription', 'activity_video_text_extraction',
    'activity_video_frame_scoring',
    'activity_youtube_transcript_only_extraction',
    'activity_youtube_full_transcription',
    'activity_youtube_full_text_extraction',
    'activity_youtube_full_frame_scoring'
  ]));

alter table public.ai_usage_log drop constraint if exists ai_usage_log_endpoint_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_endpoint_check
    check (endpoint = any (array[
      'analyze-lesson', 'generate-activity', 'extract-activity', 'video-import',
      'youtube-transcript-import', 'youtube-full-import'
    ]));

-- Handmatige screenshot-upload (transcript_only-fallback voor de
-- arrangement-afbeelding, DEEL3) en full_auto-server-side-frame-extractie
-- schrijven naar dezelfde activity-video-imports-bucket als de bestaande
-- kandidaat-frames — de bucket stond image/jpeg al toe, PNG-screenshots
-- (bijv. Windows Snipping Tool, macOS Cmd+Shift+4 slaan standaard als PNG op)
-- nog niet.
update storage.buckets
set allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'audio/mpeg', 'audio/mp4']
where id = 'activity-video-imports';
