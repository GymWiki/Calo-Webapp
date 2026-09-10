-- Voegt 'activity_import_extraction' toe aan de toegestane ai_usage.feature-
-- waarden: de extract-activity-route (nu ook bereikbaar via de nieuwe
-- "Activiteit uploaden uit bestand"-kaart op /les-maken, naast de bestaande
-- inline upload op /activiteit-toevoegen) loggen we voortaan als losse
-- feature i.p.v. helemaal niet, voor volledige kostenzichtbaarheid.
alter table public.ai_usage drop constraint if exists ai_usage_feature_check;

alter table public.ai_usage add constraint ai_usage_feature_check check (
  feature in (
    'activity_checker',
    'lesson_generator',
    'ai_lescoach',
    'knowledge_base_embedding',
    'activity_import_extraction'
  )
);
