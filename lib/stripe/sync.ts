// Orkestratie: Stripe-subscription (bron van waarheid) → Supabase-toegang.
// Alle I/O loopt via `BillingDeps`, zodat dit zonder netwerk te testen is.
// Elke schrijffout GOOIT (de webhook geeft dan 500 en Stripe probeert opnieuw);
// niets wordt stil ingeslikt.

import {
  deriveEntitlement,
  resolveUserId,
  type Entitlement,
  type LinkSource,
  type PaidPlan,
  type PriceMap,
  type SubscriptionFacts,
  type UserLookup,
} from "@/lib/stripe/entitlements";

export interface SubscriptionRow {
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: Entitlement["rowStatus"];
  subscription_type: PaidPlan;
  current_period_end: string | null;
  // Meer-bronnen-velden (supabase/migrations/entitlements_multi_source.sql)
  source: "stripe";
  expires_at: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
}

export interface TeamStatusUpdate {
  status: "active" | "past_due" | "canceled";
  current_period_end: string | null;
}

export interface BillingDeps extends UserLookup {
  prices: PriceMap;
  graceDays: number;
  now?: () => Date;
  log: (message: string, fields?: Record<string, string | number | boolean | null>) => void;
  /** Teamabonnement? (teams staan in hun eigen tabel) */
  findTeamBySubscription(subscriptionId: string): Promise<{ id: string } | null>;
  updateTeam(teamId: string, update: TeamStatusUpdate): Promise<void>;
  getUserState(userId: string): Promise<{ subscription_type: string | null } | null>;
  getSubscriptionRow(userId: string): Promise<{ stripe_subscription_id: string | null; subscription_type: string | null } | null>;
  writeSubscriptionRow(row: SubscriptionRow): Promise<void>;
  setUserAccess(userId: string, access: { paid: boolean; plan: PaidPlan | null }): Promise<void>;
  markTrialUsed(userId: string): Promise<void>;
  /** Upgrade: het vervangen oude abonnement opzeggen (bestaand beleid). Alleen bij checkout.session.completed. */
  cancelSubscription?(subscriptionId: string): Promise<void>;
}

export type SyncResult =
  | { kind: "synced"; userId: string; paid: boolean; plan: PaidPlan | null; linkedBy: LinkSource; reason: string }
  | { kind: "team"; teamId: string }
  | { kind: "unlinked"; reason: string }
  | { kind: "ignored"; reason: string };

export interface LinkHints {
  metadataUserId?: string | null;
  clientReferenceId?: string | null;
  email?: string | null;
}

export async function syncSubscription(
  deps: BillingDeps,
  sub: SubscriptionFacts,
  hints: LinkHints = {},
  opts: { replaceOld?: boolean; allowEmail?: boolean } = {},
): Promise<SyncResult> {
  // 1. Team?
  const team = await deps.findTeamBySubscription(sub.id);
  if (team) {
    const ent = deriveEntitlement(sub, { now: deps.now?.(), graceDays: deps.graceDays, prices: deps.prices });
    // Teams: 'unpaid'/'incomplete_expired' blijven in de coulanceperiode (past_due), zoals voorheen.
    const status = sub.status === "active" || sub.status === "trialing" ? "active" : sub.status === "canceled" ? "canceled" : "past_due";
    await deps.updateTeam(team.id, { status, current_period_end: sub.currentPeriodEnd });
    deps.log("team bijgewerkt", { subscription: sub.id, status, reason: ent.reason });
    return { kind: "team", teamId: team.id };
  }

  // 2. Gebruiker koppelen.
  const link = await resolveUserId(
    {
      metadataUserId: hints.metadataUserId ?? sub.metadata.userId ?? sub.metadata.user_id ?? null,
      clientReferenceId: hints.clientReferenceId,
      customerId: sub.customerId,
      email: hints.email,
    },
    deps,
    { allowEmail: opts.allowEmail },
  );
  if (!link) {
    deps.log("geen gebruiker gevonden voor subscription", { subscription: sub.id, customer: sub.customerId });
    return { kind: "unlinked", reason: "no_user" };
  }
  if (link.source === "email" || link.source === "customer_id") {
    deps.log("fallback-koppeling", { subscription: sub.id, via: link.source });
  }
  const userId = link.userId;

  const ent = deriveEntitlement(sub, { now: deps.now?.(), graceDays: deps.graceDays, prices: deps.prices });
  const [user, existing] = await Promise.all([deps.getUserState(userId), deps.getSubscriptionRow(userId)]);

  // Lifetime wordt nooit door een (ander) abonnement ingetrokken.
  if (user?.subscription_type === "lifetime" && ent.plan !== "lifetime") {
    return { kind: "ignored", reason: "lifetime_protected" };
  }
  // Een oud, vervangen abonnement mag het nieuwe niet intrekken.
  if (!ent.paid && existing?.stripe_subscription_id && existing.stripe_subscription_id !== sub.id) {
    return { kind: "ignored", reason: "stale_subscription" };
  }

  const plan: PaidPlan | null = ent.plan ?? (existing?.subscription_type as PaidPlan | null) ?? null;
  if (!ent.plan) deps.log("onbekend plan/price-id; terugval gebruikt", { subscription: sub.id });
  const rowPlan: PaidPlan = plan ?? "monthly";

  await deps.writeSubscriptionRow({
    user_id: userId,
    stripe_customer_id: sub.customerId,
    stripe_subscription_id: sub.id,
    status: ent.rowStatus,
    subscription_type: rowPlan,
    current_period_end: sub.currentPeriodEnd,
    source: "stripe",
    expires_at: sub.currentPeriodEnd,
    trial_ends_at: sub.trialEnd,
    cancel_at_period_end: sub.cancelAtPeriodEnd,
  });
  await deps.setUserAccess(userId, { paid: ent.paid, plan: ent.paid ? rowPlan : null });
  if (ent.paid || sub.trialEnd) await deps.markTrialUsed(userId);

  if (opts.replaceOld && ent.paid && existing?.stripe_subscription_id && existing.stripe_subscription_id !== sub.id && deps.cancelSubscription) {
    try {
      await deps.cancelSubscription(existing.stripe_subscription_id);
    } catch {
      deps.log("oud abonnement opzeggen mislukt (genegeerd)", { old: existing.stripe_subscription_id });
    }
  }
  return { kind: "synced", userId, paid: ent.paid, plan: ent.paid ? rowPlan : null, linkedBy: link.source, reason: ent.reason };
}

/** Lifetime = eenmalige betaling (Checkout mode "payment"), geen Subscription-object. */
export async function syncLifetime(
  deps: BillingDeps,
  session: { paymentStatus: string; customerId: string | null; hints: LinkHints },
): Promise<SyncResult> {
  if (session.paymentStatus !== "paid") return { kind: "ignored", reason: `payment_status_${session.paymentStatus}` };
  const link = await resolveUserId(
    { metadataUserId: session.hints.metadataUserId, clientReferenceId: session.hints.clientReferenceId, customerId: session.customerId },
    deps,
  );
  if (!link) return { kind: "unlinked", reason: "no_user" };
  await deps.writeSubscriptionRow({
    user_id: link.userId,
    stripe_customer_id: session.customerId,
    stripe_subscription_id: null,
    status: "active",
    subscription_type: "lifetime",
    current_period_end: null,
    source: "stripe",
    expires_at: null,
    trial_ends_at: null,
    cancel_at_period_end: false,
  });
  await deps.setUserAccess(link.userId, { paid: true, plan: "lifetime" });
  return { kind: "synced", userId: link.userId, paid: true, plan: "lifetime", linkedBy: link.source, reason: "lifetime" };
}
