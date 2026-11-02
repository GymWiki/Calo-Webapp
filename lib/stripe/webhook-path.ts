// ÉÉN bron van waarheid voor het webhook-pad. Wijzig je dit, pas dan ook
// docs/stripe-webhook.md, het Stripe-dashboard en de matcher in proxy.ts aan
// (lib/stripe/webhook-path.test.ts faalt als die uit de pas lopen).

/** Het pad dat in Stripe (live én test) moet staan: https://www.gymwiki.nl + dit pad. */
export const STRIPE_WEBHOOK_PATH = "/api/stripe/webhook";

/**
 * Veelvoorkomende afwijkende paden die ook werken. Next.js herschrijft ze
 * (rewrite, géén redirect: Stripe volgt geen redirects en een 301/307/308 op
 * een POST telt als mislukt) naar het echte pad.
 */
export const STRIPE_WEBHOOK_ALIASES = [
  "/api/webhooks/stripe",
  "/api/stripe/webhooks",
  "/api/stripe-webhook",
  "/api/webhook/stripe",
] as const;

export const STRIPE_WEBHOOK_BASE_URL = "https://www.gymwiki.nl";

/** Alle events die in het Stripe-endpoint aangevinkt moeten staan (gelijk aan wat de verwerking afhandelt). */
export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
] as const;
