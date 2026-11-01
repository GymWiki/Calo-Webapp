import assert from "node:assert/strict";
import { test } from "node:test";

import { canPurchaseInStore, hasActiveEntitlement, isTrialEligible, manageTarget, type EntitlementRow } from "@/lib/subscription/entitlement";
import { mapRevenueCatEvent, planForProduct, shouldApplyPatch, type RevenueCatEvent } from "@/lib/subscription/revenuecat";

const now = new Date("2026-06-01T12:00:00Z");
const row = (over: Partial<EntitlementRow>): EntitlementRow => ({ source: "apple", status: "active", expires_at: "2026-07-01T00:00:00Z", ...over });
const ev = (over: Partial<RevenueCatEvent>): RevenueCatEvent => ({
  id: "e1", type: "INITIAL_PURCHASE", app_user_id: "u1", store: "APP_STORE", product_id: "gymwiki_monthly",
  period_type: "TRIAL", expiration_at_ms: Date.parse("2026-06-08T12:00:00Z"), ...over,
});

test("geen rij of inactief = geen toegang", () => {
  assert.equal(hasActiveEntitlement(null, now), false);
  assert.equal(hasActiveEntitlement(row({ status: "inactive" }), now), false);
});
test("actief en proefperiode geven toegang tot expires_at", () => {
  assert.equal(hasActiveEntitlement(row({}), now), true);
  assert.equal(hasActiveEntitlement(row({ status: "trialing" }), now), true);
  assert.equal(hasActiveEntitlement(row({ expires_at: "2026-05-31T00:00:00Z" }), now), false);
});
test("opgezegd blijft werken tot einde periode, daarna niet", () => {
  assert.equal(hasActiveEntitlement(row({ status: "canceled" }), now), true);
  assert.equal(hasActiveEntitlement(row({ status: "canceled", expires_at: "2026-05-01T00:00:00Z" }), now), false);
  assert.equal(hasActiveEntitlement(row({ status: "canceled", expires_at: null }), now), false);
});
test("past_due: coulance van 14 dagen", () => {
  assert.equal(hasActiveEntitlement(row({ status: "past_due", expires_at: "2026-05-25T00:00:00Z" }), now), true);
  assert.equal(hasActiveEntitlement(row({ status: "past_due", expires_at: "2026-05-10T00:00:00Z" }), now), false);
});
test("lifetime zonder einddatum blijft actief", () => {
  assert.equal(hasActiveEntitlement(row({ source: "stripe", expires_at: null, subscription_type: "lifetime" }), now), true);
});
test("proef: één keer per account", () => {
  assert.equal(isTrialEligible({ trial_used: false }), true);
  assert.equal(isTrialEligible({ trial_used: true }), false);
  assert.equal(isTrialEligible(null), false);
});
test("geen tweede aankoop als er al betaald wordt (ook via Stripe)", () => {
  assert.equal(canPurchaseInStore(row({ source: "stripe" }), now), false);
  assert.equal(canPurchaseInStore(row({ status: "inactive" }), now), true);
});
test("beheerlink per bron", () => {
  assert.equal(manageTarget(row({ source: "apple" })), "app-store");
  assert.equal(manageTarget(row({ source: "google" })), "google-play");
  assert.equal(manageTarget(row({ source: "stripe" })), "stripe-portal");
  assert.equal(manageTarget(row({ source: "stripe", subscription_type: "lifetime" })), "none");
});
test("RevenueCat: proefstart = trialing + trial gebruikt", () => {
  const out = mapRevenueCatEvent(ev({}));
  assert.equal(out.patch?.status, "trialing");
  assert.equal(out.patch?.source, "apple");
  assert.equal(out.patch?.trial_ends_at, "2026-06-08T12:00:00.000Z");
  assert.equal(out.markTrialUsed, true);
});
test("RevenueCat: conversie, opzegging tijdens proef, verlopen", () => {
  assert.equal(mapRevenueCatEvent(ev({ type: "RENEWAL", period_type: "NORMAL" })).patch?.status, "active");
  const cancel = mapRevenueCatEvent(ev({ type: "CANCELLATION" }));
  assert.equal(cancel.patch?.status, "trialing");
  assert.equal(cancel.patch?.cancel_at_period_end, true);
  assert.equal(mapRevenueCatEvent(ev({ type: "EXPIRATION", period_type: "NORMAL" })).patch?.status, "inactive");
});
test("RevenueCat: Google-product met base plan, onbekende/test-events, Stripe-store", () => {
  assert.equal(planForProduct("gymwiki_yearly:p1y"), "yearly");
  assert.equal(mapRevenueCatEvent(ev({ type: "TEST" })).patch, null);
  assert.equal(mapRevenueCatEvent(ev({ store: "STRIPE" })).patch, null);
  assert.equal(mapRevenueCatEvent(ev({ store: "PLAY_STORE" })).patch?.source, "google");
});
test("actief Stripe-abonnement wordt niet door store-event overschreven", () => {
  const patch = mapRevenueCatEvent(ev({})).patch!;
  assert.equal(shouldApplyPatch({ source: "stripe", status: "active", expires_at: "2026-07-01T00:00:00Z" }, patch, now), false);
  assert.equal(shouldApplyPatch({ source: "stripe", status: "inactive", expires_at: null }, patch, now), true);
  assert.equal(shouldApplyPatch(null, patch, now), true);
});
