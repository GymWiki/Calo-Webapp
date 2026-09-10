-- Telt hoe vaak andere gebruikers een van jouw goedgekeurde activiteiten
-- hebben opgeslagen — de "hergebruikt"-proxy op de profielpagina (er is
-- geen view-teller in deze database). security definer + self-scoped via
-- auth.uid() (geen parameter) is nodig omdat opgeslagen_activiteiten's
-- select-RLS alleen je eigen rijen toont: zonder dit zou een gewone,
-- RLS-gebonden telling altijd 0 geven voor andermans opslag-rijen.
create or replace function public.get_own_activity_reuse_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.opgeslagen_activiteiten oa
  join public.activiteiten a on a.id = oa.activiteit_id
  where a.author_id = (select auth.uid())
    and a.status = 'approved';
$$;

revoke execute on function public.get_own_activity_reuse_count() from public, anon;
grant execute on function public.get_own_activity_reuse_count() to authenticated;
