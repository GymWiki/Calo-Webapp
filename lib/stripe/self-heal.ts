// Zelfherstel: heeft deze ingelogde gebruiker bij Stripe een actief of betaald
// abonnement terwijl hier geen pro-status staat? Dan herstellen we dat (op
// basis van de Stripe-subscription als bron van waarheid) — idempotent.
// Server-only. Rate-limited per gebruiker (in-memory per instance + goedkoop).

import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { factsFromStripe, supabaseBillingDeps } from "@/lib/stripe/adapter";
import { deriveEntitlement } from "@/lib/stripe/entitlements";
import { syncLifetime, syncSubscription, type BillingDeps } from "@/lib/stripe/sync";

const RATE_LIMIT_MS = 30_000;
const lastRun = new Map<string, number>();

/** Alleen voor tests. */
export function resetHealRateLimit() {
  lastRun.clear();
}

export type HealResult =
  | { status: "rate_limited" }
  | { status: "nothing_found" }
  | { status: "synced"; paid: boolean };

export interface HealInput {
  userId: string;
  email: string | null;
  /** Is het e-mailadres bewezen (bevestigd)? Alleen dan mag er op e-mail teruggevallen worden. */
  emailVerified: boolean;
}

export async function healUserSubscription(
  supabase: SupabaseClient,
  stripe: Stripe,
  input: HealInput,
  log: BillingDeps["log"],
  now: number = Date.now(),
): Promise<HealResult> {
  const last = lastRun.get(input.userId) ?? 0;
  if (now - last < RATE_LIMIT_MS) return { status: "rate_limited" };
  lastRun.set(input.userId, now);

  const deps = supabaseBillingDeps(supabase, stripe, log);

  // Klanten van deze gebruiker: eerst de bekende (via subscriptions-rij), anders — alleen bij een
  // bevestigd e-mailadres — op e-mail. Elke terugval wordt gelogd.
  const customerIds = new Set<string>();
  const { data: row } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", input.userId).maybeSingle();
  if (row?.stripe_customer_id) customerIds.add(row.stripe_customer_id);
  if (customerIds.size === 0 && input.email && input.emailVerified) {
    const found = await stripe.customers.list({ email: input.email, limit: 10 });
    found.data.forEach((c) => customerIds.add(c.id));
    if (found.data.length) log("zelfherstel: klant gevonden op e-mailadres", { count: found.data.length });
  }
  if (customerIds.size === 0) return { status: "nothing_found" };

  let best: { paid: boolean } | null = null;
  for (const customer of customerIds) {
    const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 10 });
    for (const sub of subs.data) {
      const facts = factsFromStripe(sub);
      const ent = deriveEntitlement(facts, { graceDays: deps.graceDays, prices: deps.prices });
      if (!ent.paid && best) continue; // alleen een betaald abonnement overschrijft
      const result = await syncSubscription(deps, facts, { metadataUserId: input.userId }, { allowEmail: false });
      if (result.kind === "synced" && (result.paid || !best)) best = { paid: result.paid };
    }
    if (!best?.paid) {
      // Lifetime: eenmalige betalingen hebben geen subscription.
      const sessions = await stripe.checkout.sessions.list({ customer, limit: 20 });
      for (const s of sessions.data) {
        if (s.mode !== "payment" || s.payment_status !== "paid" || s.metadata?.subscription_type !== "lifetime") continue;
        const r = await syncLifetime(deps, {
          paymentStatus: s.payment_status,
          customerId: customer,
          hints: { metadataUserId: input.userId },
        });
        if (r.kind === "synced") best = { paid: true };
      }
    }
  }
  return best ? { status: "synced", paid: best.paid } : { status: "nothing_found" };
}
