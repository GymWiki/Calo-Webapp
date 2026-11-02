import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { graceDaysFromEnv, type PaidPlan, type SubscriptionFacts } from "@/lib/stripe/entitlements";
import type { BillingDeps, SubscriptionRow } from "@/lib/stripe/sync";
import type { EventStatus, EventStore } from "@/lib/stripe/webhook";

const iso = (n: number | null | undefined) => (typeof n === "number" ? new Date(n * 1000).toISOString() : null);

/** Stripe.Subscription → de feiten die we nodig hebben (ook voor API-versies zonder subscription.current_period_end). */
export function factsFromStripe(sub: Stripe.Subscription): SubscriptionFacts {
  const item = sub.items.data[0];
  return {
    id: sub.id,
    customerId: typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null),
    status: sub.status as SubscriptionFacts["status"],
    currentPeriodEnd: iso(item?.current_period_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    trialEnd: iso(sub.trial_end),
    priceId: item?.price?.id ?? null,
    interval: item?.price?.recurring?.interval ?? null,
    metadata: (sub.metadata ?? {}) as Record<string, string>,
  };
}

const MISSING_COLUMN = new Set(["42703", "PGRST204"]);
const CHECK_VIOLATION = "23514";
const MISSING_TABLE = new Set(["42P01", "PGRST205"]);

type Log = BillingDeps["log"];

/** Supabase-implementatie van de database-kant. Service-role client, alleen server-side. */
export function supabaseBillingDeps(supabase: SupabaseClient, stripe: Stripe | null, log: Log): BillingDeps {
  const oneId = async (query: PromiseLike<{ data: { id?: string; user_id?: string } | null; error: { message: string } | null }>, key: "id" | "user_id") => {
    const { data, error } = await query;
    if (error) throw new Error(`lookup mislukt: ${error.message}`);
    return data?.[key] ?? null;
  };

  return {
    prices: {
      monthly: process.env.STRIPE_PRICE_MONTHLY,
      yearly: process.env.STRIPE_PRICE_YEARLY,
      lifetime: process.env.STRIPE_PRICE_LIFETIME,
    },
    graceDays: graceDaysFromEnv(process.env.STRIPE_PAST_DUE_GRACE_DAYS),
    log,

    byId: (id) => oneId(supabase.from("users").select("id").eq("id", id).maybeSingle(), "id"),
    byCustomerId: (customerId) => oneId(supabase.from("subscriptions").select("user_id").eq("stripe_customer_id", customerId).limit(1).maybeSingle(), "user_id"),
    byEmail: async (email) => {
      // Alleen bedoeld voor gecontroleerd gebruik (reparatie-voorstellen), via auth-admin.
      const { data, error } = await supabase.rpc("find_user_id_by_email", { p_email: email });
      if (error) return null;
      return (data as string | null) ?? null;
    },

    async findTeamBySubscription(subscriptionId) {
      const { data, error } = await supabase.from("teams").select("id").eq("stripe_subscription_id", subscriptionId).maybeSingle();
      if (error) throw new Error(`teams-lookup mislukt: ${error.message}`);
      return data ?? null;
    },
    async updateTeam(teamId, update) {
      const { error } = await supabase.from("teams").update(update).eq("id", teamId);
      if (error) throw new Error(`team bijwerken mislukt: ${error.message}`);
    },
    async getUserState(userId) {
      const { data, error } = await supabase.from("users").select("subscription_type").eq("id", userId).maybeSingle();
      if (error) throw new Error(`gebruiker lezen mislukt: ${error.message}`);
      return data ?? null;
    },
    async getSubscriptionRow(userId) {
      const { data, error } = await supabase.from("subscriptions").select("stripe_subscription_id, subscription_type").eq("user_id", userId).maybeSingle();
      if (error) throw new Error(`subscriptions lezen mislukt: ${error.message}`);
      return data ?? null;
    },

    async writeSubscriptionRow(row: SubscriptionRow) {
      const full = await supabase.from("subscriptions").upsert(row, { onConflict: "user_id" });
      if (!full.error) return;
      // Productie kan nog het oude schema hebben (entitlements-migratie nog niet gedraaid):
      // schrijf dan de kernvelden, met 'trialing' als 'active'.
      const code = full.error.code ?? "";
      if (!MISSING_COLUMN.has(code) && code !== CHECK_VIOLATION) throw new Error(`subscriptions schrijven mislukt: ${full.error.message}`);
      log("legacy schema: kernvelden geschreven", { code });
      const legacy = await supabase.from("subscriptions").upsert(
        {
          user_id: row.user_id,
          stripe_customer_id: row.stripe_customer_id,
          stripe_subscription_id: row.stripe_subscription_id,
          status: row.status === "trialing" ? "active" : row.status,
          subscription_type: row.subscription_type,
          current_period_end: row.current_period_end,
        },
        { onConflict: "user_id" },
      );
      if (legacy.error) throw new Error(`subscriptions schrijven mislukt: ${legacy.error.message}`);
    },

    async setUserAccess(userId, access: { paid: boolean; plan: PaidPlan | null }) {
      const { error } = await supabase
        .from("users")
        .update(access.paid ? { subscription_status: "paid_subscriber", subscription_type: access.plan } : { subscription_status: "free_contributor", subscription_type: "none" })
        .eq("id", userId);
      if (error) throw new Error(`gebruiker bijwerken mislukt: ${error.message}`);
    },
    async markTrialUsed(userId) {
      // Kolom bestaat pas na de entitlements-migratie; ontbreken is niet erg.
      const { error } = await supabase.from("users").update({ trial_used: true }).eq("id", userId);
      if (error && !MISSING_COLUMN.has(error.code ?? "")) throw new Error(`trial_used zetten mislukt: ${error.message}`);
    },
    cancelSubscription: stripe ? async (id) => void (await stripe.subscriptions.cancel(id)) : undefined,
  };
}

/** Event-log in `stripe_events` (idempotentie + beheerweergave). Tolereert dat de tabel nog niet bestaat. */
export function supabaseEventStore(supabase: SupabaseClient, log: Log): EventStore {
  return {
    async alreadyProcessed(eventId) {
      const { data, error } = await supabase.from("stripe_events").select("status").eq("id", eventId).maybeSingle();
      if (error) {
        if (!MISSING_TABLE.has(error.code ?? "")) log("stripe_events lezen mislukt", { reason: error.message.slice(0, 120) });
        return false;
      }
      return !!data && data.status !== "failed";
    },
    async record(eventId, type, status: EventStatus, detail) {
      const { error } = await supabase
        .from("stripe_events")
        .upsert({ id: eventId, type, status, detail, processed_at: new Date().toISOString() }, { onConflict: "id" });
      if (error && !MISSING_TABLE.has(error.code ?? "")) log("stripe_events schrijven mislukt", { reason: error.message.slice(0, 120) });
    },
  };
}
