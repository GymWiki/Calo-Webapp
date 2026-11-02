// Pure vertaling van een Stripe-subscription naar de toegang in Supabase.
// De subscription is de bron van waarheid; elk event leidt tot één
// `deriveEntitlement()` en één idempotente schrijfactie. Geen I/O hier.

export type StripeSubStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "unpaid"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "paused";

export type PaidPlan = "monthly" | "yearly" | "lifetime";

/** Wat we uit een Stripe.Subscription nodig hebben (los van de SDK-types, makkelijk te faken). */
export interface SubscriptionFacts {
  id: string;
  customerId: string | null;
  status: StripeSubStatus;
  /** Einde lopende periode (ISO) — null als onbekend. */
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
  /** Price-ID van het eerste item. */
  priceId: string | null;
  /** "month" | "year" van het eerste item. */
  interval: string | null;
  metadata: Record<string, string>;
}

export interface PriceMap {
  monthly?: string;
  yearly?: string;
  lifetime?: string;
}

export type RowStatus = "inactive" | "trialing" | "active" | "canceled" | "past_due";

export interface Entitlement {
  /** Krijgt de gebruiker pro-toegang? */
  paid: boolean;
  /** Waarde voor subscriptions.status. */
  rowStatus: RowStatus;
  plan: PaidPlan | null;
  /** Reden voor logs (geen persoonsgegevens). */
  reason: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Coulance bij mislukte betaling: `STRIPE_PAST_DUE_GRACE_DAYS` (default 3, 0–30). */
export function graceDaysFromEnv(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && raw !== undefined && raw !== "" ? Math.min(30, Math.max(0, Math.floor(n))) : 3;
}

/** Plan bepalen: metadata → price-id-mapping → interval. `null` = onbekend (nooit raden). */
export function resolvePlan(sub: Pick<SubscriptionFacts, "metadata" | "priceId" | "interval">, prices: PriceMap = {}): PaidPlan | null {
  const meta = sub.metadata.subscription_type;
  if (meta === "monthly" || meta === "yearly" || meta === "lifetime") return meta;
  if (sub.priceId) {
    if (sub.priceId === prices.monthly) return "monthly";
    if (sub.priceId === prices.yearly) return "yearly";
    if (sub.priceId === prices.lifetime) return "lifetime";
  }
  if (sub.interval === "month") return "monthly";
  if (sub.interval === "year") return "yearly";
  return null;
}

export function deriveEntitlement(
  sub: SubscriptionFacts,
  opts: { now?: Date; graceDays?: number; prices?: PriceMap } = {},
): Entitlement {
  const now = (opts.now ?? new Date()).getTime();
  const grace = (opts.graceDays ?? 3) * DAY_MS;
  const plan = resolvePlan(sub, opts.prices);
  const end = sub.currentPeriodEnd ? Date.parse(sub.currentPeriodEnd) : null;

  switch (sub.status) {
    case "active":
      return { paid: true, rowStatus: "active", plan, reason: "active" };
    case "trialing":
      return { paid: true, rowStatus: "trialing", plan, reason: "trialing" };
    case "past_due": {
      // Korte, configureerbare coulance vanaf het einde van de laatst betaalde periode.
      const ok = end !== null && end + grace > now;
      return { paid: ok, rowStatus: "past_due", plan, reason: ok ? "past_due-grace" : "past_due-expired" };
    }
    case "canceled":
      // Stripe's 'canceled' = het abonnement is al beëindigd. (Opzeggen aan het
      // einde van de periode blijft 'active' met cancel_at_period_end tot het einde.)
      return { paid: false, rowStatus: "canceled", plan, reason: "canceled" };
    case "unpaid":
    case "incomplete_expired":
    case "paused":
      return { paid: false, rowStatus: "inactive", plan, reason: sub.status };
    case "incomplete":
    default:
      return { paid: false, rowStatus: "inactive", plan, reason: "incomplete" };
  }
}

export type LinkSource = "metadata" | "client_reference_id" | "customer_id" | "email";

export interface UserLookup {
  byId(id: string): Promise<string | null>;
  byCustomerId(customerId: string): Promise<string | null>;
  /** Alleen toegestaan als de aanroeper het e-mailadres als bewezen beschouwt. */
  byEmail?(email: string): Promise<string | null>;
}

/** Koppeling Stripe → gebruiker, in vaste volgorde; geeft ook terug WAAROP is gekoppeld (voor logs). */
export async function resolveUserId(
  hints: { metadataUserId?: string | null; clientReferenceId?: string | null; customerId?: string | null; email?: string | null },
  lookup: UserLookup,
  opts: { allowEmail?: boolean } = {},
): Promise<{ userId: string; source: LinkSource } | null> {
  for (const [id, source] of [
    [hints.metadataUserId, "metadata"],
    [hints.clientReferenceId, "client_reference_id"],
  ] as const) {
    if (id) {
      const found = await lookup.byId(id);
      if (found) return { userId: found, source };
    }
  }
  if (hints.customerId) {
    const found = await lookup.byCustomerId(hints.customerId);
    if (found) return { userId: found, source: "customer_id" };
  }
  if (opts.allowEmail && hints.email && lookup.byEmail) {
    const found = await lookup.byEmail(hints.email);
    if (found) return { userId: found, source: "email" };
  }
  return null;
}
