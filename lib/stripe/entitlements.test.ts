import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveEntitlement, graceDaysFromEnv, resolvePlan, resolveUserId, type SubscriptionFacts, type UserLookup } from "@/lib/stripe/entitlements";

const now = new Date("2026-11-02T12:00:00Z");
const sub = (over: Partial<SubscriptionFacts> = {}): SubscriptionFacts => ({
  id: "sub_1", customerId: "cus_1", status: "active", currentPeriodEnd: "2026-12-01T00:00:00Z", cancelAtPeriodEnd: false,
  trialEnd: null, priceId: "price_m", interval: "month", metadata: {}, ...over,
});
const prices = { monthly: "price_m", yearly: "price_y", lifetime: "price_l" };

test("active en trialing geven pro", () => {
  assert.deepEqual(deriveEntitlement(sub(), { now }).paid, true);
  const t = deriveEntitlement(sub({ status: "trialing" }), { now });
  assert.equal(t.paid, true);
  assert.equal(t.rowStatus, "trialing");
});
test("opgezegd aan einde periode blijft pro (status active + cancel_at_period_end)", () => {
  assert.equal(deriveEntitlement(sub({ cancelAtPeriodEnd: true }), { now }).paid, true);
});
test("canceled, unpaid, incomplete, incomplete_expired, paused geven geen pro", () => {
  for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"] as const) {
    assert.equal(deriveEntitlement(sub({ status }), { now }).paid, false, status);
  }
});
test("past_due: coulance configureerbaar", () => {
  const s = sub({ status: "past_due", currentPeriodEnd: "2026-11-01T12:00:00Z" });
  assert.equal(deriveEntitlement(s, { now, graceDays: 3 }).paid, true);
  assert.equal(deriveEntitlement(s, { now, graceDays: 0 }).paid, false);
  assert.equal(deriveEntitlement(sub({ status: "past_due", currentPeriodEnd: null }), { now }).paid, false);
});
test("graceDaysFromEnv: default 3, begrensd 0-30, ongeldig = default", () => {
  assert.equal(graceDaysFromEnv(undefined), 3);
  assert.equal(graceDaysFromEnv("7"), 7);
  assert.equal(graceDaysFromEnv("999"), 30);
  assert.equal(graceDaysFromEnv("-2"), 0);
  assert.equal(graceDaysFromEnv("abc"), 3);
});
test("plan: metadata wint, dan price-id, dan interval, onbekend = null", () => {
  assert.equal(resolvePlan(sub({ metadata: { subscription_type: "yearly" } }), prices), "yearly");
  assert.equal(resolvePlan(sub({ priceId: "price_y", interval: "month" }), prices), "yearly");
  assert.equal(resolvePlan(sub({ priceId: "price_nieuw", interval: "year" }), prices), "yearly");
  assert.equal(resolvePlan(sub({ priceId: "price_nieuw", interval: "week" }), prices), null);
});

const lookup = (users: { ids?: string[]; customers?: Record<string, string>; emails?: Record<string, string> }): UserLookup => ({
  byId: async (id) => (users.ids?.includes(id) ? id : null),
  byCustomerId: async (c) => users.customers?.[c] ?? null,
  byEmail: async (e) => users.emails?.[e] ?? null,
});
test("koppeling: metadata → client_reference_id → customer → (alleen toegestaan) e-mail", async () => {
  const l = lookup({ ids: ["u1", "u2"], customers: { cus_1: "u3" }, emails: { "a@b.nl": "u4" } });
  assert.deepEqual(await resolveUserId({ metadataUserId: "u1", clientReferenceId: "u2" }, l), { userId: "u1", source: "metadata" });
  assert.deepEqual(await resolveUserId({ clientReferenceId: "u2" }, l), { userId: "u2", source: "client_reference_id" });
  assert.deepEqual(await resolveUserId({ metadataUserId: "bestaat-niet", customerId: "cus_1" }, l), { userId: "u3", source: "customer_id" });
  assert.equal(await resolveUserId({ email: "a@b.nl" }, l), null, "e-mail is standaard NIET toegestaan");
  assert.deepEqual(await resolveUserId({ email: "a@b.nl" }, l, { allowEmail: true }), { userId: "u4", source: "email" });
  assert.equal(await resolveUserId({}, l, { allowEmail: true }), null);
});
