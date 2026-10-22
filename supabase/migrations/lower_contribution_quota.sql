-- Verlaagt het maandelijkse bijdrage-quotum voor gratis toegang van 4 naar
-- 3 activiteiten (zie lib/constants/subscriptionPlans.ts's
-- MONTHLY_CONTRIBUTION_REQUIRED_COUNT, de JS-kant van dezelfde waarde).
-- Idempotent, dus veilig opnieuw te draaien.

-- Nieuwe tracking-rijen (sync_monthly_contribution_tracking-upsert,
-- evaluate_monthly_contributions — beide in subscription_model.sql) zetten
-- required_count nooit expliciet, dus leunen op deze kolomdefault.
alter table public.monthly_contribution_tracking
  alter column required_count set default 3;

-- Bestaande rijen (inclusief de lopende maand) die nog op de oude default
-- van 4 staan, verlagen naar 3 — een versoepeling is altijd veilig met
-- terugwerkende kracht (maakt de eis nooit zwaarder voor iemand die al
-- bezig was). Rijen met een afwijkende, bewust andere waarde (geen van de
-- huidige functies zet die, maar toekomstbestendig) blijven onaangeroerd.
update public.monthly_contribution_tracking
set required_count = 3, updated_at = now()
where required_count = 4;
