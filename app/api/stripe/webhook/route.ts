import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceClient } from "@/utils/supabase/service";

/**
 * Houdt users.subscription_status en de subscriptions-tabel synchroon met
 * Stripe. Draait zonder gebruikerssessie (Stripe roept dit rechtstreeks
 * aan), dus gebruikt de service-role client die RLS omzeilt — de enige
 * plek in de app die dat mag.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json(
      { error: "STRIPE_WEBHOOK_SECRET ontbreekt." },
      { status: 501 },
    );
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (cause) {
    return Response.json(
      { error: cause instanceof Error ? cause.message : "Stripe is niet geconfigureerd." },
      { status: 501 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("Ontbrekende stripe-signature header.");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return Response.json({ error: "Ongeldige webhook-signature." }, { status: 400 });
  }

  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.userId;
      if (!userId || typeof session.subscription !== "string") break;

      await supabase.from("users").update({ subscription_status: "paid_subscriber" }).eq("id", userId);
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id: session.subscription,
          status: "active",
        },
        { onConflict: "user_id" },
      );
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const { data: existing } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

      if (!existing) break;

      const isActive = subscription.status === "active" || subscription.status === "trialing";
      const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

      await supabase
        .from("subscriptions")
        .update({
          status: isActive ? "active" : subscription.status === "past_due" ? "past_due" : "canceled",
          current_period_end: currentPeriodEnd
            ? new Date(currentPeriodEnd * 1000).toISOString()
            : null,
        })
        .eq("stripe_subscription_id", subscription.id);

      // Een opgezegd/verlopen abonnement verliest de onvoorwaardelijke
      // toegang en valt terug op het bijdrage-model — niet meteen geblokkeerd,
      // pas als de eerstvolgende maandevaluatie de bijdrage-eis niet gehaald
      // ziet (evaluate_monthly_contributions, subscription_model.sql).
      if (!isActive) {
        await supabase
          .from("users")
          .update({ subscription_status: "free_contributor" })
          .eq("id", existing.user_id);
      }
      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}
