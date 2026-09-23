import type { SubscriptionType } from "@/lib/types";

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

export interface SubscriptionPlanInfo {
  id: SubscriptionPlan;
  label: string;
  priceLabel: string;
  periodLabel: string;
  description: string;
  /** Alleen gezet voor plannen met een aantoonbare besparing t.o.v. maandelijks. */
  savingsLabel?: string;
  recommended?: boolean;
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
