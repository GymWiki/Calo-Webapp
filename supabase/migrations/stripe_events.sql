-- Event-log voor de Stripe-webhook: idempotentie + zichtbaarheid van mislukte
-- of niet-koppelbare betalingen (/beheer/betalingen). Idempotent. NIET
-- automatisch uitgevoerd: zie docs/stripe-herstel.md. De webhook werkt ook
-- zonder deze tabel (dan geen event-log, wel volledige verwerking).

create table if not exists public.stripe_events (
  id text primary key,                       -- Stripe event-id (evt_...)
  type text not null,
  status text not null check (status in ('processed', 'failed', 'unlinked', 'ignored')),
  detail text,                               -- korte reden, nooit persoonsgegevens
  processed_at timestamptz not null default now()
);
create index if not exists stripe_events_status_idx on public.stripe_events (status, processed_at desc);

alter table public.stripe_events enable row level security;
alter table public.stripe_events force row level security;
-- Bewust geen policies: alleen de service role (webhook, beheerpagina) leest/schrijft.

-- Gecontroleerde e-mail → gebruiker-opzoeking voor reparatie/zelfherstel.
-- Alleen de service role mag dit aanroepen; geeft null bij geen of dubbele match.
create or replace function public.find_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case when count(*) = 1 then (array_agg(u.id))[1] end
  from auth.users u
  where lower(u.email) = lower(p_email);
$$;
revoke all on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;
