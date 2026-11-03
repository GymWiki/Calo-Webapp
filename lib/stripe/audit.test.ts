import assert from "node:assert/strict";
import { test } from "node:test";

import { auditRecords, summarize, type StripeRecord, type SupaUser } from "@/lib/stripe/audit";

const rec = (o: Partial<StripeRecord> = {}): StripeRecord => ({
  customerId: "cus_aaaaaaaaaa", email: "anna@example.com", name: "Anna de Vries", subscriptionId: "sub_1", kind: "subscription", plan: "monthly",
  status: "active", startedAt: "2026-10-01", lastPaidAt: "2026-10-01", expectedPaid: true, metadataUserId: null, ...o,
});
const user = (o: Partial<SupaUser> = {}): SupaUser => ({ id: "u1", email: "anna@example.com", name: "Anna de Vries", status: "free_blocked", type: "none", ...o });

test("betaald maar geen pro (gekoppeld op e-mail)", () => {
  const [row] = auditRecords([rec()], [user()], []);
  assert.equal(row.deviation, "betaald maar geen pro");
  assert.equal(row.linkedBy, "e-mail");
});
test("ok als gebruiker pro is, gekoppeld in de tabel en het type klopt", () => {
  const [row] = auditRecords([rec()], [user({ status: "paid_subscriber", type: "monthly" })], [{ userId: "u1", customerId: "cus_aaaaaaaaaa", subscriptionId: "sub_1" }]);
  assert.equal(row.deviation, "ok");
});
test("pro maar niet gekoppeld: handmatig op pro gezet, type 'none' en geen abonnementsrij", () => {
  const [row] = auditRecords([rec({ plan: "yearly", metadataUserId: "u1" })], [user({ status: "paid_subscriber", type: "none" })], []);
  assert.equal(row.deviation, "pro maar niet gekoppeld");
  assert.equal(row.userId, "u1");
});
test("geen account gevonden + voorstel op naam", () => {
  const [row] = auditRecords([rec({ email: "ander@voorbeeld.nl" })], [user({ email: "anna@school.nl" })], []);
  assert.equal(row.deviation, "geen account gevonden");
  assert.deepEqual(row.proposal, { userId: "u1", reason: "zelfde naam" });
});
test("voorstel op e-mail-lokaal-deel, geen voorstel bij twijfel", () => {
  const [a] = auditRecords([rec({ name: null, email: "anna.devries@gmail.com" })], [user({ name: null, email: "anna.devries@school.nl" })], []);
  assert.equal(a.proposal?.reason, "zelfde deel voor de @ bij ander domein");
  const [b] = auditRecords([rec({ name: "X", email: "q@x.nl" })], [user({ name: "Y", email: "z@z.nl" })], []);
  assert.equal(b.proposal, null);
});
test("koppeling via tabel met afwijkend e-mailadres", () => {
  const [row] = auditRecords([rec({ email: "privé@gmail.com" })], [user({ status: "paid_subscriber", type: "monthly" })], [{ userId: "u1", customerId: "cus_aaaaaaaaaa", subscriptionId: null }]);
  assert.equal(row.deviation, "e-mail komt niet overeen");
  assert.equal(row.linkedBy, "koppeling-tabel");
});
test("metadata-koppeling wint van e-mail; betaald maar geen pro blijft zichtbaar", () => {
  const [row] = auditRecords([rec({ email: "x@x.nl", metadataUserId: "u1" })], [user()], []);
  assert.equal(row.linkedBy, "metadata");
  assert.equal(row.deviation, "betaald maar geen pro");
});
test("dubbele klant: twee Stripe-klanten, één e-mailadres", () => {
  const rows = auditRecords([rec(), rec({ customerId: "cus_bbbbbbbbbb", subscriptionId: "sub_2" })], [user({ status: "paid_subscriber", type: "monthly" })], [{ userId: "u1", customerId: "cus_aaaaaaaaaa", subscriptionId: "sub_1" }, { userId: "u1", customerId: "cus_bbbbbbbbbb", subscriptionId: "sub_2" }]);
  assert.ok(rows.every((r) => r.deviation === "dubbele klant"));
});
test("niet-verwacht-betaald (geannuleerd) is ok, ook zonder pro", () => {
  const [row] = auditRecords([rec({ expectedPaid: false, status: "canceled" })], [user()], []);
  assert.equal(row.deviation, "ok");
});
test("pro zonder Stripe-abonnement wordt gemeld; samenvatting telt", () => {
  const rows = auditRecords([], [user({ status: "paid_subscriber" })], []);
  assert.equal(rows[0].deviation, "pro zonder Stripe-abonnement");
  assert.equal(summarize(rows)["pro zonder Stripe-abonnement"], 1);
});
