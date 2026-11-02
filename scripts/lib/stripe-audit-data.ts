// Gedeelde, ALLEEN-LEZEN gegevensophaling voor de audit- en reparatiescripts.
// Stripe: uitsluitend GET-aanroepen met een restricted key (rk_...). Supabase:
// uitsluitend select/auth-admin-list. Niets wordt geschreven.

import Stripe from "stripe";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { StripeRecord, SupaLink, SupaUser } from "@/lib/stripe/audit";
import { deriveEntitlement, graceDaysFromEnv } from "@/lib/stripe/entitlements";
import { factsFromStripe } from "@/lib/stripe/adapter";

export const REQUIRED_STRIPE_PERMISSIONS = [
  "Customers: Read",
  "Subscriptions: Read",
  "Invoices: Read",
  "Checkout Sessions: Read",
  "Prices: Read (optioneel)",
];

export function requireEnv(name: string, hint: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`\n✖ ${name} ontbreekt in .env.local.\n  ${hint}\n`);
    process.exit(1);
  }
  return v;
}

export function stripeReadOnly(): Stripe {
  const key = requireEnv(
    "STRIPE_READONLY_KEY",
    "Maak in Stripe (Developers → API keys → Create restricted key) een key met ALLEEN deze rechten op 'Read':\n  " +
      REQUIRED_STRIPE_PERMISSIONS.join(", ") +
      "\n  en alle andere rechten op 'None'. Zet hem als STRIPE_READONLY_KEY=rk_live_... in .env.local (nooit committen, nooit in de chat).",
  );
  if (!key.startsWith("rk_")) {
    console.error("\n✖ STRIPE_READONLY_KEY moet een restricted key zijn (begint met rk_), geen volledige geheime sleutel (sk_).\n");
    process.exit(1);
  }
  return new Stripe(key);
}

export function supabaseReadOnly(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL", "Zet NEXT_PUBLIC_SUPABASE_URL in .env.local.");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY", "Zet SUPABASE_SERVICE_ROLE_KEY in .env.local (Supabase → Project Settings → API). Het script gebruikt hem alleen voor leesacties (en voor schrijven alleen met --apply).");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const iso = (n: number | null | undefined) => (typeof n === "number" ? new Date(n * 1000).toISOString() : null);

export async function fetchStripeRecords(stripe: Stripe, opts: { recentDays: number }): Promise<{ records: StripeRecord[]; facts: Map<string, ReturnType<typeof factsFromStripe>> }> {
  const grace = graceDaysFromEnv(process.env.STRIPE_PAST_DUE_GRACE_DAYS);
  const prices = { monthly: process.env.STRIPE_PRICE_MONTHLY, yearly: process.env.STRIPE_PRICE_YEARLY, lifetime: process.env.STRIPE_PRICE_LIFETIME };
  const cutoff = Date.now() - opts.recentDays * 86_400_000;
  const records: StripeRecord[] = [];
  const facts = new Map<string, ReturnType<typeof factsFromStripe>>();

  // Oudere abonnementen hebben de gebruiker alleen op de Checkout Session (client_reference_id), niet op de subscription.
  const userBySubscription = new Map<string, string>();
  for await (const s of stripe.checkout.sessions.list({ limit: 100 })) {
    const subId = typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? null);
    const owner = s.client_reference_id ?? s.metadata?.userId ?? null;
    if (s.mode === "subscription" && s.status === "complete" && subId && owner) userBySubscription.set(subId, owner);
  }

  for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer", "data.latest_invoice"] })) {
    const customer = typeof sub.customer === "string" ? null : (sub.customer as Stripe.Customer);
    const invoice = typeof sub.latest_invoice === "string" ? null : (sub.latest_invoice as Stripe.Invoice | null);
    const lastPaid = invoice?.status === "paid" ? iso(invoice.status_transitions?.paid_at ?? invoice.created) : null;
    const f = factsFromStripe(sub);
    const ent = deriveEntitlement(f, { graceDays: grace, prices });
    const relevant = ["active", "trialing", "past_due"].includes(sub.status) || (lastPaid && Date.parse(lastPaid) >= cutoff);
    if (!relevant) continue;
    facts.set(sub.id, f);
    records.push({
      customerId: f.customerId ?? "",
      email: customer && !("deleted" in customer && customer.deleted) ? (customer.email ?? null) : null,
      name: customer && !("deleted" in customer && customer.deleted) ? (customer.name ?? null) : null,
      subscriptionId: sub.id,
      kind: "subscription",
      plan: ent.plan,
      status: sub.status,
      startedAt: iso(sub.start_date),
      lastPaidAt: lastPaid,
      expectedPaid: ent.paid,
      metadataUserId: sub.metadata?.userId ?? sub.metadata?.user_id ?? userBySubscription.get(sub.id) ?? null,
    });
  }

  // Lifetime: eenmalige betalingen (Checkout mode "payment", metadata.subscription_type = lifetime).
  for await (const s of stripe.checkout.sessions.list({ limit: 100, expand: ["data.customer"] })) {
    if (s.mode !== "payment" || s.payment_status !== "paid" || s.metadata?.subscription_type !== "lifetime") continue;
    const customer = s.customer && typeof s.customer !== "string" && !("deleted" in s.customer) ? (s.customer as Stripe.Customer) : null;
    records.push({
      customerId: typeof s.customer === "string" ? s.customer : (customer?.id ?? ""),
      email: customer?.email ?? s.customer_details?.email ?? null,
      name: customer?.name ?? s.customer_details?.name ?? null,
      subscriptionId: null,
      kind: "lifetime",
      plan: "lifetime",
      status: "paid",
      startedAt: iso(s.created),
      lastPaidAt: iso(s.created),
      expectedPaid: true,
      metadataUserId: s.client_reference_id ?? s.metadata?.userId ?? null,
    });
  }
  return { records, facts };
}

export async function fetchSupabase(supabase: SupabaseClient): Promise<{ users: SupaUser[]; links: SupaLink[] }> {
  const emails = new Map<string, string | null>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`auth-gebruikers lezen mislukt: ${error.message}`);
    data.users.forEach((u) => emails.set(u.id, u.email ?? null));
    if (data.users.length < 200) break;
  }
  const { data: profiles, error } = await supabase.from("users").select("id, first_name, last_name, subscription_status, subscription_type");
  if (error) throw new Error(`users lezen mislukt: ${error.message}`);
  const users: SupaUser[] = (profiles ?? []).map((p) => ({
    id: p.id,
    email: emails.get(p.id) ?? null,
    name: [p.first_name, p.last_name].filter(Boolean).join(" ") || null,
    status: p.subscription_status ?? "free_contributor",
    type: p.subscription_type ?? "none",
  }));
  const { data: subs, error: subsError } = await supabase.from("subscriptions").select("user_id, stripe_customer_id, stripe_subscription_id");
  if (subsError) throw new Error(`subscriptions lezen mislukt: ${subsError.message}`);
  const links: SupaLink[] = (subs ?? []).map((s) => ({ userId: s.user_id, customerId: s.stripe_customer_id, subscriptionId: s.stripe_subscription_id }));
  return { users, links };
}
