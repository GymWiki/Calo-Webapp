// Pure toegangslogica voor abonnementen, los van Stripe/RevenueCat. De
// webhooks schrijven de rij (supabase/migrations/entitlements_multi_source.sql);
// webapp en app lezen alleen en vragen hier "heeft deze gebruiker toegang?".

export type EntitlementSource = "stripe" | "apple" | "google";
export type EntitlementStatus = "inactive" | "trialing" | "active" | "canceled" | "past_due";

export interface EntitlementRow {
  source: EntitlementSource;
  status: EntitlementStatus;
  /** Einde van de betaalde/proef-periode; null = doorlopend (bv. lifetime). */
  expires_at: string | null;
  trial_ends_at?: string | null;
  cancel_at_period_end?: boolean;
  subscription_type?: "none" | "monthly" | "yearly" | "lifetime";
}

/** Coulanceperiode bij mislukte betaling, gelijk aan de bestaande teamregel. */
export const PAST_DUE_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function toMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** Volledige toegang? Een proefperiode telt als volledige toegang; een opgezegd abonnement blijft werken tot `expires_at`. */
export function hasActiveEntitlement(row: EntitlementRow | null | undefined, now: Date = new Date()): boolean {
  if (!row) return false;
  const expires = toMs(row.expires_at);
  const t = now.getTime();
  switch (row.status) {
    case "active":
    case "trialing":
    case "canceled":
      return expires === null ? row.status !== "canceled" : expires > t;
    case "past_due":
      return expires !== null && expires + PAST_DUE_GRACE_DAYS * DAY_MS > t;
    default:
      return false;
  }
}

/** Een proefperiode is er één keer per account, over alle bronnen heen. */
export function isTrialEligible(user: { trial_used: boolean } | null | undefined): boolean {
  return !!user && !user.trial_used;
}

/** In de app mag alleen een store-aankoop gedaan worden als er niet al (elders) betaald wordt. */
export function canPurchaseInStore(row: EntitlementRow | null | undefined, now: Date = new Date()): boolean {
  return !hasActiveEntitlement(row, now);
}

export type ManageTarget = "stripe-portal" | "app-store" | "google-play" | "none";

/** Waar beheert de gebruiker dit abonnement? Nooit Stripe-portaal voor een store-abonnement. */
export function manageTarget(row: EntitlementRow | null | undefined): ManageTarget {
  if (!row || row.subscription_type === "lifetime") return "none";
  if (row.source === "apple") return "app-store";
  if (row.source === "google") return "google-play";
  return "stripe-portal";
}

export const MANAGE_URLS = {
  "app-store": "https://apps.apple.com/account/subscriptions",
  "google-play": "https://play.google.com/store/account/subscriptions",
} as const;
