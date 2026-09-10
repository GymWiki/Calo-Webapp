-- Derde AI-endpoint voor de fair-use-teller: de bestandsupload-extractie op
-- "Activiteit toevoegen" (lib/ai/activityImportExtraction.ts) deelt dezelfde
-- maandelijkse pool als analyze-lesson/generate-activity.
alter table public.ai_usage_log drop constraint if exists ai_usage_log_endpoint_check;

alter table public.ai_usage_log
  add constraint ai_usage_log_endpoint_check
    check (endpoint = any (array['analyze-lesson', 'generate-activity', 'extract-activity']));
