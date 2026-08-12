-- Vervang de boolean is_pro door een flexibele plan_type tekstkolom, zodat
-- een beheerder via de Supabase Table Editor handmatig een account op
-- 'pro' (of een toekomstige waarde als 'organization'/'admin') kan zetten
-- zonder een schema-wijziging.
alter table public.users
  add column if not exists plan_type text not null default 'free';

-- Bestaande is_pro = true accounts overzetten voordat de kolom verdwijnt.
update public.users
set plan_type = 'pro'
where is_pro = true;

-- award_xp gaf tot nu toe de is_pro-kolom rechtstreeks terug; laat 'm
-- voortaan afleiden uit plan_type, zodat de RPC-contractvorm (old_xp,
-- new_xp, is_pro) ongewijzigd blijft voor lib/gamification.ts.
create or replace function public.award_xp(p_user_id uuid, p_amount integer)
returns table (old_xp integer, new_xp integer, is_pro boolean)
language plpgsql
set search_path = ''
as $$
begin
  return query
  update public.users
  set xp = xp + p_amount
  where id = p_user_id
  returning
    xp - p_amount,
    xp,
    public.users.plan_type in ('pro', 'organization', 'admin');
end;
$$;

alter table public.users drop column if exists is_pro;
