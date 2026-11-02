import { getStripeClient } from "@/lib/stripe/client";
import { factsFromStripe, supabaseBillingDeps, supabaseEventStore } from "@/lib/stripe/adapter";
import { handleStripeWebhook, type WebhookDeps } from "@/lib/stripe/webhook";
import { createServiceClient } from "@/utils/supabase/service";

// Node.js-runtime (de Stripe-SDK + ruwe body vereisen dat) en genoeg tijd voor
// de Stripe-API-aanroep + Supabase-schrijfacties. Altijd dynamisch, nooit gecachet.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const log: WebhookDeps["log"] = (message, fields) => console.error(`[stripe-webhook] ${message}`, fields ?? {});

/**
 * Stripe → Supabase. De subscription is de bron van waarheid; zie
 * lib/stripe/webhook.ts voor het gedrag per event. Config-fouten (ontbrekende
 * secrets) geven een 500 met duidelijke melding in de logs, nooit stilte.
 */
export async function POST(request: Request) {
  let stripe;
  let supabase;
  try {
    stripe = getStripeClient();
    supabase = createServiceClient();
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Configuratie ontbreekt.";
    log(`configuratiefout: ${message}`);
    return Response.json({ error: message }, { status: 500 });
  }

  return handleStripeWebhook(request, {
    secret: process.env.STRIPE_WEBHOOK_SECRET,
    constructEvent: (raw, signature, secret) => stripe.webhooks.constructEvent(raw, signature, secret) as never,
    retrieveSubscription: async (id) => factsFromStripe(await stripe.subscriptions.retrieve(id)),
    billing: supabaseBillingDeps(supabase, stripe, log),
    events: supabaseEventStore(supabase, log),
    log,
  });
}
