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
