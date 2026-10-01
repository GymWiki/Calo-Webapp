-- "Activiteit uit video" (bestandsupload + YouTube-linkinvoer) is uit de app
-- verwijderd: de transcriptie-/AI-mapping-pijplijn werkte onvoldoende
-- betrouwbaar en bleef doorlopend AI-kosten maken. Droppen van de
-- bijbehorende job-tabel — die is altijd experimenteel geweest (6
-- testrijen), dus veilig te verwijderen. De storage-policy wordt ook
-- verwijderd; de lege 'activity-video-imports'-bucket zelf kan niet via SQL
-- gedropt worden (storage.buckets blokkeert directe DML — "Use Storage API
-- instead") en blijft daarom als lege, kosteloze bucket staan totdat iemand
-- 'm via het Supabase-dashboard verwijdert.
drop policy if exists "activity_video_imports_owner_rw" on storage.objects;

drop table if exists public.video_import_jobs;
