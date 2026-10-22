-- ============================================================================
-- 3D-plattegrond tonen bij de activiteitbeschrijving.
--
-- 1. Leesrechten: tot nu toe was floorplans_3d alleen leesbaar voor de
--    eigenaar. Bekijkers van een activiteit moeten de gekoppelde
--    plattegrond (floorplans_3d.activiteit_id, bestond al) kunnen lezen.
--    De policy volgt de zichtbaarheid van de activiteit zelf: de subquery
--    op activiteiten draait onder dezelfde RLS, dus een plattegrond is
--    alleen leesbaar voor wie ook de activiteit mag zien. Daarnaast moet
--    de eigenaar van de plattegrond de AUTEUR van de activiteit zijn —
--    anders zou iedereen zijn eigen plattegrond aan andermans activiteit
--    kunnen hangen.
--
-- 2. Storage: thumbnail ("statische preview") van een plattegrond, door de
--    editor bij het opslaan gerenderd en geüpload als
--    `${user_id}/${floorplan_id}.webp`. Publiek leesbaar (zelfde patroon
--    als activity_diagram_image_storage.sql), schrijven alleen in de eigen
--    map.
--
-- Backwards compatible: geen kolommen toegevoegd of gewijzigd.
-- ============================================================================

drop policy if exists "floorplans_3d_activity_select" on public.floorplans_3d;
create policy "floorplans_3d_activity_select"
  on public.floorplans_3d
  for select
  to authenticated
  using (
    activiteit_id is not null
    and exists (
      select 1
      from public.activiteiten a
      where a.id = floorplans_3d.activiteit_id
        and a.author_id = floorplans_3d.user_id
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'floorplan-previews',
  'floorplan-previews',
  true,
  1048576, -- 1 MB
  array['image/webp', 'image/png']
)
on conflict (id) do nothing;

drop policy if exists "floorplan_previews_owner_rw" on storage.objects;
create policy "floorplan_previews_owner_rw"
  on storage.objects
  for all
  to authenticated
  using (bucket_id = 'floorplan-previews' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'floorplan-previews' and (storage.foldername(name))[1] = (select auth.uid())::text);
