-- Gamification: XP-punten die zowel gratis als Pro-gebruikers verdienen.
-- Level (en dus korting-% / Pro-perks) wordt puur in applicatiecode uit
-- xp afgeleid (lib/gamification.ts) — geen aparte level-kolom nodig, dus
-- nooit uit sync te raken met de daadwerkelijke xp-stand.
alter table public.users
  add column if not exists xp integer not null default 0;

alter table public.users
  add constraint users_xp_non_negative check (xp >= 0);

-- Atomair XP toekennen aan de ingelogde gebruiker zelf. security invoker
-- (standaard) respecteert de bestaande "users_update_own" RLS-policy
-- (auth.uid() = id), dus dit kan nooit XP op een ander account bijschrijven
-- — de aanroepende server action geeft altijd de eigen user.id mee.
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
  returning xp - p_amount, xp, public.users.is_pro;
end;
$$;
