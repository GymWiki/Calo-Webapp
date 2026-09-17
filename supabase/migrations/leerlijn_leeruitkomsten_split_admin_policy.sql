-- Zelfde performance-fix als knowledge_packages_split_admin_policy.sql: een
-- "for all" admin-policy overlapt met de SELECT-policy hierboven (beide
-- permissive voor dezelfde rol/actie), waardoor Postgres onnodig beide
-- evalueert bij elke SELECT. Vervangen door drie losse insert/update/delete-
-- policies die de SELECT-actie niet aanraken.
drop policy if exists "leerlijn_leeruitkomsten_write_admin" on public.leerlijn_leeruitkomsten;

create policy "leerlijn_leeruitkomsten_insert_admin" on public.leerlijn_leeruitkomsten
  for insert
  to authenticated
  with check (public.is_library_admin());

create policy "leerlijn_leeruitkomsten_update_admin" on public.leerlijn_leeruitkomsten
  for update
  to authenticated
  using (public.is_library_admin())
  with check (public.is_library_admin());

create policy "leerlijn_leeruitkomsten_delete_admin" on public.leerlijn_leeruitkomsten
  for delete
  to authenticated
  using (public.is_library_admin());
