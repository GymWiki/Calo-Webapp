-- Storage bucket voor de automatisch gegenereerde activiteit-afbeelding: een
-- PNG-export van het canvas-arrangement (zie components/canvas/
-- FullscreenDiagramEditor.tsx), geüpload zodra de volledig-scherm editor
-- wordt gesloten en gebruikt als `activiteiten.afbeelding` (de foto op de
-- bibliotheekkaart en bovenaan de detailpagina). Elke activiteit heeft een
-- stabiel pad (`${user_id}/${activity_id}.png`, upsert:true) zodat een
-- nieuwe versie de vorige gewoon vervangt i.p.v. oude bestanden op te
-- stapelen.
--
-- Publiek (net als materialen-afbeeldingen in materials_library.sql): een
-- activiteit-afbeelding moet zichtbaar zijn voor iedereen die de activiteit
-- bekijkt, niet alleen de eigenaar — dus geen SELECT-policy nodig, publieke
-- buckets serveren leesverzoeken via een publieke CDN-URL, buiten RLS om.
-- Schrijven blijft wel eigenaar-gescoped (zelfde patroon als
-- activity_import_jobs.sql's activity-imports-bucket): het eerste
-- padsegment moet de eigen user id zijn.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activiteit-afbeeldingen',
  'activiteit-afbeeldingen',
  true,
  10485760, -- 10 MB
  array['image/png']
)
on conflict (id) do nothing;

drop policy if exists "activiteit_afbeeldingen_owner_rw" on storage.objects;
create policy "activiteit_afbeeldingen_owner_rw"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'activiteit-afbeeldingen' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'activiteit-afbeeldingen' and (storage.foldername(name))[1] = (select auth.uid())::text);
