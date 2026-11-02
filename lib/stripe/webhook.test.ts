import assert from "node:assert/strict";
import { test } from "node:test";
import Stripe from "stripe";

import type { SubscriptionFacts } from "@/lib/stripe/entitlements";
import type { BillingDeps, SubscriptionRow } from "@/lib/stripe/sync";
import { handleStripeWebhook, type EventStatus, type WebhookDeps } from "@/lib/stripe/webhook";

const SECRET = "whsec_test_secret";
const stripe = new Stripe("sk_test_dummy");

interface World {
  users: Record<string, { subscription_type: string; paid: boolean; trial_used: boolean }>;
  rows: Record<string, SubscriptionRow>;
  teams: Record<string, { id: string; status?: string }>; // by subscription id
  events: Record<string, { type: string; status: EventStatus; detail: string | null }>;
  subs: Record<string, SubscriptionFacts>;
  customers: Record<string, string>;
  cancelled: string[];
  failWrites?: boolean;
  logs: string[];
}

function world(partial: Partial<World> = {}): World {
  return { users: { u1: { subscription_type: "none", paid: false, trial_used: false } }, rows: {}, teams: {}, events: {}, subs: {}, customers: {}, cancelled: [], logs: [], ...partial };
}

function deps(w: World, secret: string = SECRET): WebhookDeps {
  const billing: BillingDeps = {
    prices: { monthly: "price_m", yearly: "price_y", lifetime: "price_l" },
    graceDays: 3,
    now: () => new Date("2026-11-02T12:00:00Z"),
    log: (m) => void w.logs.push(m),
    byId: async (id) => (w.users[id] ? id : null),
    byCustomerId: async (c) => w.customers[c] ?? Object.values(w.rows).find((r) => r.stripe_customer_id === c)?.user_id ?? null,
    findTeamBySubscription: async (s) => w.teams[s] ?? null,
    updateTeam: async (id, u) => void (Object.values(w.teams).find((t) => t.id === id)!.status = u.status),
    getUserState: async (id) => (w.users[id] ? { subscription_type: w.users[id].subscription_type } : null),
    getSubscriptionRow: async (id) => w.rows[id] ?? null,
    writeSubscriptionRow: async (row) => {
      if (w.failWrites) throw new Error("db kapot");
      w.rows[row.user_id] = row;
    },
    setUserAccess: async (id, a) => void (w.users[id] = { ...w.users[id], paid: a.paid, subscription_type: a.paid ? a.plan! : "none" }),
    markTrialUsed: async (id) => void (w.users[id].trial_used = true),
    cancelSubscription: async (id) => void w.cancelled.push(id),
  };
  return {
    secret,
    constructEvent: (raw, sig, s) => stripe.webhooks.constructEvent(raw, sig, s) as never,
    retrieveSubscription: async (id) => w.subs[id] ?? null,
    billing,
    events: {
      alreadyProcessed: async (id) => !!w.events[id] && w.events[id].status !== "failed",
      record: async (id, type, status, detail) => void (w.events[id] = { type, status, detail }),
    },
    log: (m) => void w.logs.push(m),
  };
}

const facts = (over: Partial<SubscriptionFacts> = {}): SubscriptionFacts => ({
  id: "sub_1", customerId: "cus_1", status: "active", currentPeriodEnd: "2026-12-01T00:00:00Z", cancelAtPeriodEnd: false,
  trialEnd: null, priceId: "price_m", interval: "month", metadata: {}, ...over,
});

function signed(event: object, secret = SECRET) {
  const payload = JSON.stringify(event);
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request("http://localhost/api/stripe/webhook", { method: "POST", body: payload, headers: { "stripe-signature": header } });
}
const evt = (id: string, type: string, object: Record<string, unknown>) => ({ id, object: "event", type, data: { object } });
const checkout = (over: Record<string, unknown> = {}) => ({
  id: "cs_1", mode: "subscription", payment_status: "paid", subscription: "sub_1", customer: "cus_1", client_reference_id: "u1",
  metadata: { userId: "u1", subscription_type: "monthly" }, customer_details: { email: "x@example.com" }, ...over,
});

test("handtekening ongeldig → 400, niets geschreven", async () => {
  const w = world({ subs: { sub_1: facts() } });
  const res = await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout()), "whsec_andere"), deps(w));
  assert.equal(res.status, 400);
  assert.deepEqual(w.rows, {});
});
test("ontbrekende signature-header → 400; ontbrekend secret → 500 met duidelijke melding", async () => {
  const w = world();
  const noSig = new Request("http://x", { method: "POST", body: "{}" });
  assert.equal((await handleStripeWebhook(noSig, deps(w))).status, 400);
  const res = await handleStripeWebhook(signed(evt("e1", "x", {})), deps(w, ""));
  assert.equal(res.status, 500);
  assert.match(JSON.stringify(await res.json()), /STRIPE_WEBHOOK_SECRET/);
});
test("checkout.session.completed (maandelijks) → pro + rij + trial_used", async () => {
  const w = world({ subs: { sub_1: facts() } });
  const res = await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout())), deps(w));
  assert.equal(res.status, 200);
  assert.equal(w.users.u1.paid, true);
  assert.equal(w.users.u1.subscription_type, "monthly");
  assert.equal(w.rows.u1.status, "active");
  assert.equal(w.users.u1.trial_used, true);
  assert.equal(w.events.e1.status, "processed");
});
test("trialing → pro met status trialing", async () => {
  const w = world({ subs: { sub_1: facts({ status: "trialing", trialEnd: "2026-11-09T00:00:00Z" }) } });
  await handleStripeWebhook(signed(evt("e1", "customer.subscription.created", { id: "sub_1" })), deps(w));
  assert.equal(w.users.u1.paid, false, "zonder koppeling nog niet");
});
test("trialing via checkout → pro", async () => {
  const w = world({ subs: { sub_1: facts({ status: "trialing", trialEnd: "2026-11-09T00:00:00Z" }) } });
  await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout())), deps(w));
  assert.equal(w.users.u1.paid, true);
  assert.equal(w.rows.u1.status, "trialing");
  assert.equal(w.rows.u1.trial_ends_at, "2026-11-09T00:00:00Z");
});
test("dubbel event (zelfde id) → tweede keer geen werk", async () => {
  const w = world({ subs: { sub_1: facts() } });
  const d = deps(w);
  await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout())), d);
  w.users.u1.paid = false; // zou terug op true moeten blijven NIET gezet worden
  const res = await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout())), d);
  assert.equal((await res.json() as { duplicate?: boolean }).duplicate, true);
  assert.equal(w.users.u1.paid, false);
});
test("verlopen/geannuleerd abonnement: subscription.deleted trekt pro in", async () => {
  const w = world({ subs: { sub_1: facts() } });
  await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout())), deps(w));
  await handleStripeWebhook(signed(evt("e2", "customer.subscription.deleted", { id: "sub_1", status: "canceled" })), deps(w));
  assert.equal(w.users.u1.paid, false);
  assert.equal(w.rows.u1.status, "canceled");
});
test("opzeggen aan einde periode (active + cancel_at_period_end) behoudt pro", async () => {
  const w = world({ subs: { sub_1: facts({ cancelAtPeriodEnd: true }) } });
  await handleStripeWebhook(signed(evt("e1", "customer.subscription.updated", { id: "sub_1" })), deps(w));
  // Zonder bekende koppeling (geen checkout): customer-lookup
  assert.equal(w.users.u1.paid, false);
  w.customers.cus_1 = "u1";
  await handleStripeWebhook(signed(evt("e2", "customer.subscription.updated", { id: "sub_1" })), deps(w));
  assert.equal(w.users.u1.paid, true);
  assert.equal(w.rows.u1.cancel_at_period_end, true);
  assert.ok(w.logs.some((l) => l.includes("fallback")), "fallback wordt gelogd");
});
test("invoice.paid herstelt een gemist checkout-event (subscription als bron van waarheid)", async () => {
  const w = world({ subs: { sub_1: facts({ metadata: { userId: "u1" } }) } });
  const invoice = { id: "in_1", parent: { subscription_details: { subscription: "sub_1" } } };
  await handleStripeWebhook(signed(evt("e1", "invoice.paid", invoice)), deps(w));
  assert.equal(w.users.u1.paid, true);
});
test("past_due: pro binnen coulance, daarna niet", async () => {
  const w = world({ customers: { cus_1: "u1" }, subs: { sub_1: facts({ status: "past_due", currentPeriodEnd: "2026-11-01T12:00:00Z" }) } });
  await handleStripeWebhook(signed(evt("e1", "invoice.payment_failed", { id: "in", parent: { subscription_details: { subscription: "sub_1" } } })), deps(w));
  assert.equal(w.users.u1.paid, true);
  w.subs.sub_1 = facts({ status: "past_due", currentPeriodEnd: "2026-10-20T00:00:00Z" });
  await handleStripeWebhook(signed(evt("e2", "invoice.payment_failed", { id: "in2", parent: { subscription_details: { subscription: "sub_1" } } })), deps(w));
  assert.equal(w.users.u1.paid, false);
});
test("onbekend price-id: nog steeds pro (interval/terugval), met logregel", async () => {
  const w = world({ subs: { sub_1: facts({ priceId: "price_onbekend", interval: "year" }) } });
  await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout({ metadata: { userId: "u1" } }))), deps(w));
  assert.equal(w.users.u1.paid, true);
  assert.equal(w.users.u1.subscription_type, "yearly");
});
test("ontbrekende koppeling → 200, vastgelegd als 'unlinked', niemand krijgt pro", async () => {
  const w = world({ subs: { sub_1: facts() } });
  const res = await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout({ client_reference_id: null, metadata: {} }))), deps(w));
  assert.equal(res.status, 200);
  assert.equal(w.events.e1.status, "unlinked");
  assert.equal(w.users.u1.paid, false);
});
test("koppeling via client_reference_id wanneer metadata ontbreekt", async () => {
  const w = world({ subs: { sub_1: facts() } });
  await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout({ metadata: {} }))), deps(w));
  assert.equal(w.users.u1.paid, true);
});
test("database-fout → 500 en event als failed vastgelegd (Stripe probeert opnieuw), daarna wél verwerkt", async () => {
  const w = world({ subs: { sub_1: facts() }, failWrites: true });
  const d = deps(w);
  const res = await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout())), d);
  assert.equal(res.status, 500);
  assert.equal(w.events.e1.status, "failed");
  w.failWrites = false;
  const retry = await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout())), d);
  assert.equal(retry.status, 200);
  assert.equal(w.users.u1.paid, true);
});
test("lifetime (eenmalige betaling) → pro lifetime; wordt niet ingetrokken door oud abonnement", async () => {
  const w = world({ subs: { sub_1: facts({ status: "canceled" }) } });
  await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout({ mode: "payment", subscription: null, metadata: { userId: "u1", subscription_type: "lifetime" } }))), deps(w));
  assert.equal(w.users.u1.subscription_type, "lifetime");
  w.customers.cus_1 = "u1";
  await handleStripeWebhook(signed(evt("e2", "customer.subscription.deleted", { id: "sub_1", status: "canceled" })), deps(w));
  assert.equal(w.users.u1.paid, true);
  assert.equal(w.users.u1.subscription_type, "lifetime");
});
test("upgrade: nieuw abonnement vervangt het oude; oud wordt opgezegd; oud-deleted-event trekt niets in", async () => {
  const w = world({ subs: { sub_old: facts({ id: "sub_old" }), sub_new: facts({ id: "sub_new", priceId: "price_y", interval: "year" }) } });
  await handleStripeWebhook(signed(evt("e1", "checkout.session.completed", checkout({ subscription: "sub_old" }))), deps(w));
  await handleStripeWebhook(signed(evt("e2", "checkout.session.completed", checkout({ subscription: "sub_new" }))), deps(w));
  assert.deepEqual(w.cancelled, ["sub_old"]);
  w.subs.sub_old = facts({ id: "sub_old", status: "canceled" });
  await handleStripeWebhook(signed(evt("e3", "customer.subscription.deleted", { id: "sub_old", status: "canceled" })), deps(w));
  assert.equal(w.users.u1.paid, true);
  assert.equal(w.users.u1.subscription_type, "yearly");
});
test("team-abonnement: teamstatus bijgewerkt, geen gebruikerstoegang", async () => {
  const w = world({ teams: { sub_t: { id: "t1" } }, subs: { sub_t: facts({ id: "sub_t", status: "past_due" }) } });
  await handleStripeWebhook(signed(evt("e1", "customer.subscription.updated", { id: "sub_t" })), deps(w));
  assert.equal(w.teams.sub_t.status, "past_due");
  assert.equal(w.users.u1.paid, false);
});
test("onbekend eventtype wordt genegeerd met 200", async () => {
  const w = world();
  const res = await handleStripeWebhook(signed(evt("e1", "customer.created", {})), deps(w));
  assert.equal(res.status, 200);
});
