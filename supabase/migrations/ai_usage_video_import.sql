-- "Activiteit uit video": verbreedt de fair-use-tellers met de nieuwe
-- video-verwerkingsstappen, en repareert als drive-by een bestaand gat:
-- 'activity_import_extraction' staat al in de applicatiecode
-- (lib/ai/usageTracking.ts) en werd ooit in een migratie geschreven
-- (ai_usage_activity_import_extraction.sql), maar die migratie is nooit op
-- deze database toegepast (bevestigd via de live constraint-inhoud) — elke
-- recordAiUsage-aanroep met dat feature-label faalt daardoor vandaag stil
-- (de insert-fout wordt alleen console.error'd, nooit geworpen). Nu in
-- dezelfde slag meegenomen zodat het gat gelijk gedicht wordt.
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;
alter table public.ai_usage add constraint ai_usage_feature_check
  check (feature = any (array[
    'activity_checker', 'lesson_generator', 'ai_lescoach',
    'knowledge_base_embedding', 'taalcheck', 'activity_import_extraction',
    'activity_video_transcription', 'activity_video_text_extraction',
    'activity_video_frame_scoring'
  ]));

-- Video-verwerking deelt hetzelfde maandelijkse quotum
-- (checkAndRecordAiUsage/MONTHLY_AI_LIMIT) als de andere AI-invoerroutes:
-- één quotum-slot per verwerkte video, niet per fase.
alter table public.ai_usage_log drop constraint if exists ai_usage_log_endpoint_check;
alter table public.ai_usage_log
  add constraint ai_usage_log_endpoint_check
    check (endpoint = any (array['analyze-lesson', 'generate-activity', 'extract-activity', 'video-import']));

-- Drive-by fix: de 'activiteit-afbeeldingen'-bucket staat vandaag alleen
-- image/png toe, terwijl lesson-form.tsx's uploadDiagramImage al WebP-
-- exports probeert te uploaden (een bestaande, stil falende mismatch) — en
-- de nieuwe "gebruik videoframe direct als arrangement-afbeelding"-optie
-- (STAP7) heeft een JPEG-upload nodig (frames worden client-side als JPEG
-- vastgelegd). `insert ... on conflict do nothing` raakt een bestaande rij
-- niet aan, dus een expliciete update is nodig.
update storage.buckets
set allowed_mime_types = array['image/png', 'image/webp', 'image/jpeg']
where id = 'activiteit-afbeeldingen';
