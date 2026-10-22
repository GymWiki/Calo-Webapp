-- Voegt jaar- en lifetime-abonnementen toe naast het bestaande maand-
-- abonnement. users.subscription_status blijft ONGEWIJZIGD (free_contributor/
-- free_blocked/paid_subscriber) — dat veld blijft de enige bron van waarheid
-- voor toegangscontrole (lib/permissions.ts) en is al plan-agnostisch: een
-- lifetime-koper krijgt gewoon subscription_status = 'paid_subscriber',
-- exact zoals een maand-/jaarabonnee, dus bestaande toegangscontrole werkt
-- voor alle drie types zonder wijziging. subscription_type hieronder is een
-- puur informatief/weergave-veld (welk plan precies) + bepaalt het
-- upgrade-pad in app/api/stripe/create-checkout/route.ts.
-- Idempotent, dus veilig opnieuw te draaien.

-- ============================================================================
-- 1. users.subscription_type
-- ============================================================================
alter table public.users
  add column if not exists subscription_type text not null default 'none';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'users_subscription_type_check'
  ) then
    alter table public.users
      add constraint users_subscription_type_check
        check (subscription_type in ('none', 'monthly', 'yearly', 'lifetime'));
  end if;
end;
$$;

-- Bestaande betaalde abonnees hadden vóór deze migratie alleen de
-- maandoptie — backfillen als 'monthly' zodat FreemiumStatusCard/pro-pagina
-- meteen het juiste plan tonen i.p.v. 'none' voor iemand die wél al betaalt.
update public.users
set subscription_type = 'monthly'
where subscription_status = 'paid_subscriber'
  and subscription_type = 'none';

-- ============================================================================
-- 2. subscriptions.subscription_type — audit-kant, zelfde reden als users
-- hierboven. Ook hier: geen wijziging aan de bestaande status/
-- current_period_end-kolommen nodig, lifetime-rijen laten
-- current_period_end gewoon null (geen vervaldatum, zie
-- app/api/stripe/webhook/route.ts) en stripe_subscription_id null (het is
-- een PaymentIntent, geen Subscription-object — de unique-constraint op die
-- kolom staat meerdere NULLs toe, dus dat botst niet tussen lifetime-rijen).
-- ============================================================================
alter table public.subscriptions
  add column if not exists subscription_type text not null default 'monthly';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'subscriptions_subscription_type_check'
  ) then
    alter table public.subscriptions
      add constraint subscriptions_subscription_type_check
        check (subscription_type in ('monthly', 'yearly', 'lifetime'));
  end if;
end;
$$;
