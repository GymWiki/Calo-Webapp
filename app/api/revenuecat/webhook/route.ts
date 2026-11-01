import { timingSafeEqual } from "node:crypto";

import { hasActiveEntitlement } from "@/lib/subscription/entitlement";
import { mapRevenueCatEvent, shouldApplyPatch, type RevenueCatEvent } from "@/lib/subscription/revenuecat";
import { createServiceClient } from "@/utils/supabase/service";

/**
 * RevenueCat-webhook: houdt `subscriptions`/`users` bij voor Apple- en
 * Google-abonnementen (bron van waarheid, net als de Stripe-webhook).
 * Beveiliging: RevenueCat stuurt de waarde die jij in het dashboard als
 * "Authorization header value" instelt; die vergelijken we constant-time met
 * REVENUECAT_WEBHOOK_AUTH. Idempotent via public.billing_events (event.id).
 * RevenueCat app_user_id = Supabase user id (zie docs/revenuecat-setup.md).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorized(request: Request): boolean {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  const received = request.headers.get("authorization");
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.REVENUECAT_WEBHOOK_AUTH) {
    return Response.json({ error: "REVENUECAT_WEBHOOK_AUTH is niet geconfigureerd." }, { status: 501 });
  }
  if (!authorized(request)) {
    return Response.json({ error: "Ongeautoriseerd." }, { status: 401 });
  }

  let event: RevenueCatEvent | undefined;
  try {
    event = (await request.json())?.event;
  } catch {
    return Response.json({ error: "Ongeldige body." }, { status: 400 });
  }
  if (!event?.id || !event.type) {
    return Response.json({ error: "Ongeldig event." }, { status: 400 });
  }

  // Sandbox-aankopen mogen nooit productietoegang geven.
  if (event.environment === "SANDBOX" && process.env.REVENUECAT_ACCEPT_SANDBOX !== "true") {
    return Response.json({ ok: true, ignored: "sandbox" });
  }

  const outcome = mapRevenueCatEvent(event);
  if (!outcome.patch || !UUID.test(event.app_user_id ?? "")) {
    return Response.json({ ok: true, ignored: "no-op" });
  }

  const supabase = createServiceClient();

  // Idempotentie: een herhaald event-id doet niets.
  const { error: dupError } = await supabase
    .from("billing_events")
    .insert({ id: `revenuecat:${event.id}`, source: "revenuecat" });
  if (dupError) {
    if (dupError.code === "23505") return Response.json({ ok: true, duplicate: true });
    return Response.json({ error: "Opslaan mislukt." }, { status: 500 });
  }

  const userId = event.app_user_id;
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("source, status, expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!shouldApplyPatch(existing, outcome.patch)) {
    return Response.json({ ok: true, ignored: "other-source-active" });
  }

  const { error: subError } = await supabase
    .from("subscriptions")
    .upsert({ user_id: userId, ...outcome.patch, current_period_end: outcome.patch.expires_at }, { onConflict: "user_id" });
  if (subError) {
    // Event vrijgeven zodat RevenueCat's retry het opnieuw kan proberen.
    await supabase.from("billing_events").delete().eq("id", `revenuecat:${event.id}`);
    return Response.json({ error: "Opslaan mislukt." }, { status: 500 });
  }

  const active = hasActiveEntitlement({ ...outcome.patch });
  await supabase
    .from("users")
    .update({
      subscription_status: active ? "paid_subscriber" : "free_contributor",
      subscription_type: active ? outcome.patch.subscription_type : "none",
      ...(outcome.markTrialUsed ? { trial_used: true } : {}),
    })
    .eq("id", userId);

  return Response.json({ ok: true });
}
