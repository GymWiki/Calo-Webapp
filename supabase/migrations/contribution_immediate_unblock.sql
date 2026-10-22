-- Preview-slot voor de bibliotheek (zie de brief): zodra een free_blocked-
-- gebruiker binnen de lopende maand alsnog aan de bijdrage-eis voldoet, moet
-- de blokkade DIRECT vervallen — niet pas op de 1e van de volgende maand.
--
-- sync_monthly_contribution_tracking (laatst herzien in
-- consolidate_lessons_into_activiteiten.sql) werkt uitsluitend de
-- maand-telling bij en raakt users.subscription_status nooit aan; alleen
-- evaluate_monthly_contributions (de maandelijkse cron-job) zet die status,
-- en beoordeelt daarbij altijd de zojuist AFGESLOTEN vorige maand — dus een
-- free_blocked-gebruiker die deze maand de 4e activiteit publiceert, bleef
-- tot nu toe tot 1 minuut na middernacht op de 1e van de volgende maand
-- geblokkeerd, ook al was aan de eis al voldaan.
--
-- Fix: sync_monthly_contribution_tracking flipt de status nu zelf, meteen
-- na het bijwerken van de telling, wanneer dat de LOPENDE maand betreft.
-- Deze functie wordt uitsluitend live vanuit de publiceer-trigger
-- (trg_sync_contribution_on_public, hieronder ongewijzigd) aangeroepen met
-- period_start = de maand van het zojuist gezette public_since — in de
-- praktijk dus altijd "nu" — maar de datumcheck maakt de functie ook veilig
-- voor een eventueel toekomstig retroactief gebruik met een ouder
-- period_start (dat mag nooit met terugwerkende kracht blokkades opheffen).
create or replace function public.sync_monthly_contribution_tracking(
  p_user_id uuid,
  p_period_start date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_required integer;
begin
  select count(*)
  into v_count
  from public.activiteiten
  where author_id = p_user_id
    and is_public = true
    and is_ai_generated = false
    and public_since is not null
    and public_since >= p_period_start
    and public_since < p_period_start + interval '1 month';

  insert into public.monthly_contribution_tracking (user_id, period_start, approved_count)
  values (p_user_id, p_period_start, v_count)
  on conflict (user_id, period_start)
    do update set approved_count = excluded.approved_count, updated_at = now()
  returning required_count into v_required;

  if v_count >= v_required and p_period_start = date_trunc('month', now())::date then
    update public.users
    set subscription_status = 'free_contributor'
    where id = p_user_id
      and subscription_status = 'free_blocked';
  end if;
end;
$$;

revoke execute on function public.sync_monthly_contribution_tracking(uuid, date)
  from public, anon, authenticated;
