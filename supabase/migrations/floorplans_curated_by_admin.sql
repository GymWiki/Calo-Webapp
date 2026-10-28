-- Een beheerder (admin/owner) kan een 3D-plattegrond maken of koppelen bij ELKE activiteit, ook bij de bibliotheekactiviteiten
-- zonder auteur. Tot nu toe was een plattegrond alleen zichtbaar voor bekijkers als de eigenaar van de plattegrond de AUTEUR van
-- de activiteit was (supabase/migrations/floorplans_3d_activity_view.sql). Nu geldt: auteur óf een beheerder.
--
-- DRAAIEN: SQL-editor, na admin_roles_audit.sql. Idempotent; alleen functies en één bestaande policy worden aangepast.
-- Terugdraaien: `alter policy "floorplans_3d_activity_select" on public.floorplans_3d using (activiteit_id is not null and exists
-- (select 1 from public.activiteiten a where a.id = floorplans_3d.activiteit_id and a.author_id = floorplans_3d.user_id));`

create or replace function public.is_curator(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.users where id = p_user_id and role in ('admin', 'owner'));
$$;

-- Alleen de id's van beheerders (voor de weergavelogica in de app); geen namen of e-mailadressen.
create or replace function public.curator_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.users where role in ('admin', 'owner');
$$;

revoke all on function public.is_curator(uuid) from public;
revoke all on function public.curator_ids() from public;
grant execute on function public.is_curator(uuid) to anon, authenticated, service_role;
grant execute on function public.curator_ids() to authenticated, service_role;

alter policy "floorplans_3d_activity_select" on public.floorplans_3d
  using (
    activiteit_id is not null
    and exists (
      select 1
      from public.activiteiten a
      where a.id = floorplans_3d.activiteit_id
        and (a.author_id = floorplans_3d.user_id or public.is_curator(floorplans_3d.user_id))
    )
  );
