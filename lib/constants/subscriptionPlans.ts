import type { SubscriptionType } from "@/lib/types";

/**
 * Centrale prijs-/quotum-configuratie — landingspagina (app/page.tsx), de
 * ingelogde Abonnement-pagina (app/(protected)/pro/page.tsx) en het
 * blocking-scherm (components/library-access-blocked.tsx, via
 * lib/services/contribution.ts) lezen ALLEMAAL hiervandaan. Een toekomstige
 * prijs- of quotumwijziging hoeft dus maar op deze ene plek.
 */

/** De drie koopbare plannen — 'none' (gratis) staat hier bewust niet in. */
export type SubscriptionPlan = Exclude<SubscriptionType, "none">;

/**
 * Volgorde van "hoeveelheid toegang/looptijd", laag naar hoog — bepaalt het
 * upgrade-pad in app/api/stripe/create-checkout/route.ts: een gebruiker mag
 * altijd naar een HOGERE index, nooit naar dezelfde of een lagere (dat zou
 * een downgrade zijn, wat via deze pagina niet wordt aangeboden — zie de
 * toelichting in create-checkout/route.ts).
 */
export const PLAN_ORDER: Record<SubscriptionPlan, number> = {
  monthly: 0,
  yearly: 1,
  lifetime: 2,
};

/**
 * Puur weergave-velden — components/subscription/PlanCard.tsx accepteert
 * dit (niet het bredere SubscriptionPlanInfo hieronder) zodat ook het
 * gratis-via-bijdrage-"plan" (FREE_PLAN_INFO, geen koopbaar
 * SubscriptionPlan en dus geen id/mode) er dezelfde kaart-component voor
 * kan hergebruiken — zie app/page.tsx's prijzensectie.
 */
export interface PlanCardInfo {
  label: string;
  priceLabel: string;
  periodLabel: string;
  description: string;
  /** Alleen gezet voor plannen met een aantoonbare besparing t.o.v. maandelijks. */
  savingsLabel?: string;
  recommended?: boolean;
  /** Tekst op het "recommended"-badge — default "Meest gekozen" in PlanCard.tsx. */
  badgeLabel?: string;
}

export interface SubscriptionPlanInfo extends PlanCardInfo {
  id: SubscriptionPlan;
  mode: "subscription" | "payment";
}

// Prijzen/besparing zijn platte content, geen berekening — €25/jr t.o.v.
// 12x €3/mnd (=€36) scheelt €11/jr (~3,7 maand gratis, afgerond op "~4
// maanden" in de UI-tekst hieronder).
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlan, SubscriptionPlanInfo> = {
  monthly: {
    id: "monthly",
    label: "Maandelijks",
    priceLabel: "EUR 3,-",
    periodLabel: "/maand",
    description: "Op elk moment opzegbaar.",
    mode: "subscription",
  },
  yearly: {
    id: "yearly",
    label: "Jaarlijks",
    priceLabel: "EUR 25,-",
    periodLabel: "/jaar",
    description: "Op elk moment opzegbaar.",
    savingsLabel: "Bespaar EUR 11,- per jaar t.o.v. maandelijks (~4 maanden gratis)",
    recommended: true,
    badgeLabel: "Meest gekozen",
    mode: "subscription",
  },
  lifetime: {
    id: "lifetime",
    label: "Lifetime",
    priceLabel: "EUR 99,-",
    periodLabel: "eenmalig",
    description: "Eenmalige betaling, voor altijd volledige toegang — nooit meer een terugkerende afschrijving.",
    mode: "payment",
  },
};

export const SUBSCRIPTION_PLAN_ORDER: SubscriptionPlan[] = ["monthly", "yearly", "lifetime"];

/**
 * Aantal activiteiten dat een gratis account per kalendermaand moet laten
 * goedkeuren om die maand onbeperkte, gratis bibliotheektoegang te houden.
 * De daadwerkelijke, functionele telling gebeurt server-side in Postgres
 * (monthly_contribution_tracking.required_count, zie
 * supabase/migrations/subscription_model.sql + de losse migratie die de
 * default van 4 naar 3 verlaagt) — deze constante is de client/server-JS-
 * kant daarvan (weergave-tekst + de fallback in
 * lib/services/contribution.ts voor een gebruiker die deze maand nog geen
 * enkele goedgekeurde bijdrage heeft, en dus nog geen tracking-rij).
 */
export const MONTHLY_CONTRIBUTION_REQUIRED_COUNT = 3;

/**
 * Het vierde, niet-koopbare "plan" — puur voor weergave op de
 * landingspagina naast de drie SUBSCRIPTION_PLANS hierboven (zie
 * app/page.tsx). Geen SubscriptionPlan/id/mode: dit triggert geen
 * Stripe-checkout, de CTA linkt naar /register.
 */
export const FREE_PLAN_INFO: PlanCardInfo = {
  label: "Gratis (via bijdrage)",
  priceLabel: "EUR 0,-",
  periodLabel: "/maand",
  description: `Deel ${MONTHLY_CONTRIBUTION_REQUIRED_COUNT} activiteiten per maand met de bibliotheek — goedgekeurd door onze AI-kwaliteitscontrole — en gebruik GymWiki volledig gratis.`,
  recommended: true,
  badgeLabel: "Aanbevolen",
};

/**
 * Teamabonnement — een eigenaar betaalt jaarlijks op factuur en nodigt
 * collega's uit; elk teamlid krijgt dezelfde toegang als paid_subscriber
 * (zie lib/permissions.ts + de Postgres-functie public.get_effective_access,
 * supabase/migrations/team_plans.sql), zonder zelf te betalen of aan de
 * bijdrage-eis te voldoen. Los van SUBSCRIPTION_PLANS hierboven (dat blijft
 * het individuele-abonnement-model) — eigen type/config zodat een
 * toekomstige wijziging aan het ene niet per ongeluk het andere raakt.
 */
export type TeamPlan = "team_s" | "team_m" | "team_l";

export interface TeamPlanInfo extends PlanCardInfo {
  id: TeamPlan;
  seatLimit: number;
}

export const TEAM_PLANS: Record<TeamPlan, TeamPlanInfo> = {
  team_s: {
    id: "team_s",
    label: "Team S",
    seatLimit: 5,
    priceLabel: "EUR 79,-",
    periodLabel: "/jaar",
    description: "Tot 5 collega's — ideaal voor een kleine vaksectie.",
  },
  team_m: {
    id: "team_m",
    label: "Team M",
    seatLimit: 15,
    priceLabel: "EUR 179,-",
    periodLabel: "/jaar",
    description: "Tot 15 collega's — voor een grotere sectie of kleine school.",
    recommended: true,
    badgeLabel: "Meest gekozen",
  },
  team_l: {
    id: "team_l",
    label: "Team L",
    seatLimit: 40,
    priceLabel: "EUR 399,-",
    periodLabel: "/jaar",
    description: "Tot 40 collega's — voor een hele school.",
  },
};

export const TEAM_PLAN_ORDER: TeamPlan[] = ["team_s", "team_m", "team_l"];

/** Gedeeld tussen create-team-checkout en team-plan-change (upgrade/downgrade). */
export const TEAM_PRICE_ENV_VAR: Record<TeamPlan, string> = {
  team_s: "STRIPE_PRICE_TEAM_S",
  team_m: "STRIPE_PRICE_TEAM_M",
  team_l: "STRIPE_PRICE_TEAM_L",
};

/** Boven dit aantal seats: geen zelfbedieningspakket meer, alleen "Neem contact op". */
export const TEAM_MAX_SELF_SERVICE_SEATS = TEAM_PLANS.team_l.seatLimit;

export const TEAM_CONTACT_EMAIL = "info@gymwiki.nl";

/**
 * Coulanceperiode (dagen) bij een mislukte teambetaling (Stripe-status
 * 'past_due') voordat teamleden de toegang verliezen — moet in sync
 * blijven met de hardcoded "interval '14 days'" in
 * public.get_effective_access (supabase/migrations/team_plans.sql). Deze
 * JS-constante is puur weergave (bijv. een toekomstige "nog N dagen
 * coulance"-melding); de daadwerkelijke afdwinging gebeurt in Postgres,
 * zelfde bewuste duplicatie-patroon als MONTHLY_CONTRIBUTION_REQUIRED_COUNT.
 */
export const TEAM_PAST_DUE_GRACE_DAYS = 14;

/**
 * Gepoolde AI-limiet per team: seats × dit getal per maand, i.p.v.
 * AI_LESCOACH_MONTHLY_LIMIT (lib/permissions.ts) per individu — zie
 * lib/ai/lescoachAccess.ts en public.get_team_ai_usage_count.
 */
export const TEAM_AI_LESCOACH_PER_SEAT_LIMIT = 15;

/**
 * Teambibliotheek — limieten en bewaartermijn. De daadwerkelijke afdwinging
 * van de eerste drie staat in supabase/migrations/team_library.sql
 * (validate_team_library_item/check_team_tag_limit/
 * check_team_library_item_tag) — deze constanten zijn de JS-kant (weergave/
 * foutmeldingen), zelfde bewuste duplicatie-patroon als
 * MONTHLY_CONTRIBUTION_REQUIRED_COUNT hierboven.
 */
export const TEAM_LIBRARY_MAX_ITEMS = 500;
export const TEAM_LIBRARY_MAX_TAGS = 100;
export const TEAM_LIBRARY_MAX_TAGS_PER_ITEM = 10;

/**
 * Bewaartermijn (dagen) van teambibliotheek-inhoud na opzegging — puur
 * documentatie/weergave: deze migratie verwijdert bij opzegging bewust NIETS
 * fysiek (zie actions/team.ts's cancelTeam), dus heractiveren brengt de
 * teambibliotheek hoe dan ook altijd volledig terug, ongeacht hoe lang
 * geleden opgezegd. Een daadwerkelijke opruimjob na deze termijn is bewust
 * niet gebouwd in deze wijziging (zelfde "config, geen code"-afweging als
 * btw bij het teamabonnement) — dat is aan de eigenaar/een toekomstige
 * cron-taak.
 */
export const TEAM_LIBRARY_RETENTION_DAYS = 90;

/** Klein vast palet — team_tags.color mag leeg zijn (geen kleur), of één van deze. */
export const TEAM_TAG_COLORS = [
  "slate",
  "red",
  "amber",
  "emerald",
  "sky",
  "violet",
  "pink",
] as const;
export type TeamTagColor = (typeof TEAM_TAG_COLORS)[number];
