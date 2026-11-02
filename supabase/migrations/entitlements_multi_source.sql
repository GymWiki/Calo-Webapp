-- Eén bron van waarheid voor toegang, ongeacht waar er betaald is (Stripe op
-- de website, Apple of Google via RevenueCat). Idempotent. NIET automatisch
-- uitgevoerd: draai handmatig, zie docs/release/checklist.md (volgorde + backup).

-- 1. Entitlement-velden op subscriptions.
alter table public.subscriptions
  add column if not exists source text not null default 'stripe',
  add column if not exists expires_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists store_product_id text,
  add column if not exists store_original_transaction_id text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_source_check') then
    alter table public.subscriptions
      add constraint subscriptions_source_check check (source in ('stripe', 'apple', 'google'));
  end if;
  -- 'trialing' toevoegen aan de toegestane statussen.
  alter table public.subscriptions drop constraint if exists subscriptions_status_check;
  alter table public.subscriptions
    add constraint subscriptions_status_check
      check (status in ('inactive', 'trialing', 'active', 'canceled', 'past_due'));
end;
$$;

-- Bestaande Stripe-rijen: expires_at gelijk aan current_period_end.
update public.subscriptions
   set expires_at = current_period_end
 where expires_at is null and current_period_end is not null;

-- 2. Proefperiode eenmalig per account, gedeeld over alle bronnen.
alter table public.users
  add column if not exists trial_used boolean not null default false;

-- Wie nu al een betaald abonnement heeft (gehad) komt niet meer in aanmerking.
update public.users u
   set trial_used = true
 where trial_used = false
   and exists (select 1 from public.subscriptions s where s.user_id = u.id);

-- Een gebruiker mag trial_used niet zelf aanpassen (alleen service role).
revoke update (trial_used) on public.users from authenticated, anon;

-- 3. Idempotentie voor webhooks (Stripe event.id, RevenueCat event.id).
create table if not exists public.billing_events (
  id text primary key,
  source text not null check (source in ('stripe', 'apple', 'google', 'revenuecat')),
  received_at timestamptz not null default now()
);
alter table public.billing_events enable row level security;
alter table public.billing_events force row level security;
-- Bewust geen policies: alleen de service role (webhooks) leest/schrijft.
