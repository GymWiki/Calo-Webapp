import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import Stripe from "stripe";

import { STRIPE_WEBHOOK_ALIASES, STRIPE_WEBHOOK_BASE_URL, STRIPE_WEBHOOK_EVENTS, STRIPE_WEBHOOK_PATH } from "@/lib/stripe/webhook-path";
import { HANDLED_EVENTS } from "@/lib/stripe/webhook";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

test("het gedocumenteerde pad bestaat echt als route met POST en GET", () => {
  const file = path.join("app", STRIPE_WEBHOOK_PATH, "route.ts");
  assert.ok(existsSync(path.join(root, file)), `${file} ontbreekt — het webhook-pad in Stripe zou een 404 geven`);
  const source = read(file);
  assert.match(source, /export\s+(async\s+)?function\s+POST\b/, "POST-export ontbreekt");
  assert.match(source, /export\s+(async\s+)?function\s+GET\b/, "GET-healthcheck ontbreekt");
  assert.match(source, /export const runtime = "nodejs"/);
});

test("docs/stripe-webhook.md noemt exact deze URL, alle events en de secret-namen", () => {
  const doc = read("docs/stripe-webhook.md");
  assert.ok(doc.includes(`${STRIPE_WEBHOOK_BASE_URL}${STRIPE_WEBHOOK_PATH}`), "volledige URL ontbreekt in de documentatie");
  for (const event of STRIPE_WEBHOOK_EVENTS) assert.ok(doc.includes(event), `event ${event} ontbreekt in de documentatie`);
  for (const name of ["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) assert.ok(doc.includes(name), `${name} ontbreekt`);
});

test("verwerking en documentatie gebruiken dezelfde eventlijst", () => {
  assert.deepEqual([...HANDLED_EVENTS], [...STRIPE_WEBHOOK_EVENTS]);
});

test("proxy.ts sluit het webhook-pad en alle aliassen uit (geen auth-gate of sessie-refresh)", () => {
  const proxy = read("proxy.ts");
  const matcher = proxy.slice(proxy.indexOf("matcher:"));
  for (const p of [STRIPE_WEBHOOK_PATH, ...STRIPE_WEBHOOK_ALIASES]) {
    assert.ok(matcher.includes(p.slice(1)), `${p} staat niet in de proxy-matcher-uitsluitingen`);
  }
  // En het pad zelf is nergens een beschermd prefix.
  const protectedBlock = proxy.slice(proxy.indexOf("PROTECTED_PREFIXES"), proxy.indexOf("];", proxy.indexOf("PROTECTED_PREFIXES")));
  assert.ok(!protectedBlock.includes("/api"), "/api mag geen beschermd prefix zijn");
});

test("next.config.ts herschrijft (geen redirect) de aliassen naar het echte pad", () => {
  const config = read("next.config.ts");
  assert.match(config, /rewrites\(\)/);
  assert.match(config, /STRIPE_WEBHOOK_ALIASES\.map\(\(source\) => \(\{ source, destination: STRIPE_WEBHOOK_PATH \}\)\)/);
  assert.doesNotMatch(config, /source:\s*"\/api\/stripe\/webhook"[^}]*permanent/);
});

// --- Route-niveau: echte handler, testsleutels, geen netwerk ------------------------------------------------------
const SECRET = "whsec_test_pad_secret";
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_WEBHOOK_SECRET = SECRET;
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.SUPABASE_SERVICE_ROLE_KEY = "dummy-service-role";

const stripe = new Stripe("sk_test_dummy");
const post = (payload: string, header: string | null) =>
  new Request(`${STRIPE_WEBHOOK_BASE_URL}${STRIPE_WEBHOOK_PATH}`, { method: "POST", body: payload, headers: header ? { "stripe-signature": header } : {} });

test("POST met geldige testhandtekening → 2xx (event dat geen database vraagt)", async () => {
  const { POST } = await import("@/app/api/stripe/webhook/route");
  const payload = JSON.stringify({ id: "evt_test_1", object: "event", type: "customer.created", data: { object: {} } });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const res = await POST(post(payload, header));
  assert.ok(res.status >= 200 && res.status < 300, `status ${res.status}`);
});

test("POST met ongeldige of ontbrekende handtekening → 400", async () => {
  const { POST } = await import("@/app/api/stripe/webhook/route");
  const payload = JSON.stringify({ id: "evt_test_2", object: "event", type: "customer.created", data: { object: {} } });
  const wrong = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_een_andere" });
  assert.equal((await POST(post(payload, wrong))).status, 400);
  assert.equal((await POST(post(payload, null))).status, 400);
});

test("GET-healthcheck → 200 zonder gevoelige info", async () => {
  const { GET } = await import("@/app/api/stripe/webhook/route");
  const res = GET();
  assert.equal(res.status, 200);
  const text = JSON.stringify(await res.json());
  assert.doesNotMatch(text, /whsec_|sk_|rk_|secret/i);
});
