-- get_advisors (performance) flagde overlappende permissive SELECT-policies
-- op knowledge_packages: "knowledge_packages_select" (is_active of admin)
-- en "knowledge_packages_write_admin" (FOR ALL, dus óók SELECT) dekken
-- SELECT allebei, wat Postgres dwingt beide te evalueren per query. SELECT
-- wordt al volledig gedekt door knowledge_packages_select (inclusief het
-- admin-geval), dus de bredere policy hoeft alleen nog INSERT/UPDATE/DELETE
-- te dekken. (Op een verse database bestaat "knowledge_packages_write_admin"
-- niet meer — knowledge_packages.sql is bijgewerkt om deze drie policies
-- direct aan te maken — dus de drop hieronder is dan een no-op.)
drop policy if exists "knowledge_packages_write_admin" on public.knowledge_packages;

drop policy if exists "knowledge_packages_insert_admin" on public.knowledge_packages;
create policy "knowledge_packages_insert_admin" on public.knowledge_packages
  for insert
  to authenticated
  with check (public.is_library_admin());

drop policy if exists "knowledge_packages_update_admin" on public.knowledge_packages;
create policy "knowledge_packages_update_admin" on public.knowledge_packages
  for update
  to authenticated
  using (public.is_library_admin())
  with check (public.is_library_admin());

drop policy if exists "knowledge_packages_delete_admin" on public.knowledge_packages;
create policy "knowledge_packages_delete_admin" on public.knowledge_packages
  for delete
  to authenticated
  using (public.is_library_admin());
