-- Gratis 3D-tool zonder account (/gratis-gymzaal-plattegrond-maken): anonieme bezoekers mogen de ACTIEVE itemdefinities
-- (naam, afmetingen, indeling, publieke GLB-/thumbnail-URL's) lezen. Alleen select, alleen actieve rijen; schrijven blijft
-- uitsluitend via de service-role (importscript). Het is dezelfde data die ingelogde gebruikers al zien, zonder gebruikersgegevens.
--
-- Draaien: Supabase SQL-editor (of `supabase db push`). Terugdraaien:
--   drop policy "material_models_select_anon_active" on public.material_models;
grant select on public.material_models to anon;

drop policy if exists "material_models_select_anon_active" on public.material_models;
create policy "material_models_select_anon_active"
  on public.material_models
  for select
  to anon
  using (active = true);
