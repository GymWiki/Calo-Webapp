// Vertaalt een RevenueCat-webhookevent naar een patch voor `subscriptions`
// (en of de proefperiode als gebruikt telt). Puur en testbaar; de route
// (app/api/revenuecat/webhook) doet verificatie, idempotentie en schrijven.

import type { EntitlementSource, EntitlementStatus } from "@/lib/subscription/entitlement";

export interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id: string;
  store?: string;
  environment?: string;
  product_id?: string;
  period_type?: string;
  expiration_at_ms?: number | null;
  original_transaction_id?: string;
  cancel_reason?: string;
}

export interface SubscriptionPatch {
  source: EntitlementSource;
  status: EntitlementStatus;
  expires_at: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  subscription_type: "monthly" | "yearly" | "none";
  store_product_id: string | null;
  store_original_transaction_id: string | null;
}

export interface RevenueCatOutcome {
  patch: SubscriptionPatch | null;
  markTrialUsed: boolean;
}

/** Productnamen: zie docs/store-products.md. */
export const PRODUCT_PLAN: Record<string, "monthly" | "yearly"> = {
  gymwiki_monthly: "monthly",
  gymwiki_yearly: "yearly",
};

export function planForProduct(productId: string | undefined): "monthly" | "yearly" | "none" {
  if (!productId) return "none";
  const base = productId.split(":")[0]; // Google: "<subscription>:<baseplan>"
  if (PRODUCT_PLAN[base]) return PRODUCT_PLAN[base];
  if (/year|jaar/i.test(base)) return "yearly";
  if (/month|maand/i.test(base)) return "monthly";
  return "none";
}

function sourceOf(store: string | undefined): EntitlementSource | null {
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return "apple";
  if (store === "PLAY_STORE") return "google";
  return null; // STRIPE/PROMOTIONAL/etc.: niet via deze route
}

const NO_OP = new Set(["TEST", "SUBSCRIBER_ALIAS", "TRANSFER", "INVOICE_ISSUANCE", "VIRTUAL_CURRENCY_TRANSACTION"]);

export function mapRevenueCatEvent(event: RevenueCatEvent): RevenueCatOutcome {
  const none: RevenueCatOutcome = { patch: null, markTrialUsed: false };
  const source = sourceOf(event.store);
  if (!source || NO_OP.has(event.type)) return none;

  const expiresMs = event.expiration_at_ms ?? null;
  const expires_at = expiresMs ? new Date(expiresMs).toISOString() : null;
  const isTrial = event.period_type === "TRIAL";
  const base = {
    source,
    expires_at,
    trial_ends_at: isTrial ? expires_at : null,
    subscription_type: planForProduct(event.product_id),
    store_product_id: event.product_id ?? null,
    store_original_transaction_id: event.original_transaction_id ?? null,
  } as const;

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "PRODUCT_CHANGE":
    case "NON_RENEWING_PURCHASE":
      return {
        patch: { ...base, status: isTrial ? "trialing" : "active", cancel_at_period_end: false },
        markTrialUsed: isTrial || event.type === "INITIAL_PURCHASE",
      };
    case "CANCELLATION":
      // Toegang loopt door tot expires_at; daarna volgt EXPIRATION.
      return {
        patch: { ...base, status: isTrial ? "trialing" : "active", cancel_at_period_end: true },
        markTrialUsed: isTrial,
      };
    case "BILLING_ISSUE":
      return { patch: { ...base, status: "past_due", cancel_at_period_end: false }, markTrialUsed: false };
    case "EXPIRATION":
      return { patch: { ...base, status: "inactive", cancel_at_period_end: false }, markTrialUsed: false };
    default:
      return none;
  }
}

/** Een gebeurtenis voor een ander bron mag een actief Stripe-abonnement niet overschrijven (voorkomt dubbel/verward). */
export function shouldApplyPatch(
  existing: { source: EntitlementSource; status: EntitlementStatus; expires_at: string | null } | null,
  patch: SubscriptionPatch,
  now: Date = new Date(),
): boolean {
  if (!existing || existing.source === patch.source) return true;
  const stillActive =
    (existing.status === "active" || existing.status === "trialing") &&
    (!existing.expires_at || Date.parse(existing.expires_at) > now.getTime());
  // Actief elders én een niet-actieve store-update: negeren. Actieve store-update naast actief Stripe: ook negeren (UI blokkeert dit; dit is de vangnet-check).
  return !stillActive;
}
