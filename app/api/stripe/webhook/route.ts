import type Stripe from "stripe";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceClient } from "@/utils/supabase/service";

/** Stripe verplaatste `invoice.subscription` per API-versie 2025+ onder
 *  `invoice.parent.subscription_details.subscription`. */
function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = invoice.parent?.subscription_details?.subscription;
  return typeof subscription === "string" ? subscription : (subscription?.id ?? null);
}

/**
 * Houdt users.subscription_status/subscription_type en de subscriptions-
 * tabel synchroon met Stripe. Draait zonder gebruikerssessie (Stripe roept
 * dit rechtstreeks aan), dus gebruikt de service-role client die RLS
 * omzeilt — de enige plek in de app die dat mag.
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

      // Teamaankoop loopt NIET via Checkout (zie app/api/stripe/
      // create-team/route.ts — rechtstreeks de Subscriptions-API, met de
      // teams-rij meteen daar aangemaakt), dus dit event heeft voor teams
      // niets te doen. Deze case blijft puur het individuele-abonnement-pad.
      const userId = session.client_reference_id ?? session.metadata?.userId;
      const subscriptionType = session.metadata?.subscription_type;
      if (
        !userId ||
        (subscriptionType !== "monthly" &&
          subscriptionType !== "yearly" &&
          subscriptionType !== "lifetime")
      ) {
        break;
      }

      const isLifetime = subscriptionType === "lifetime";
      // Lifetime is mode "payment" (eenmalige betaling, geen Stripe-
      // Subscription-object) — session.subscription is dan altijd leeg.
      // Voor monthly/yearly (mode "subscription") verwachten we die juist
      // wél; zonder subscription-id is er niets zinnigs om op te slaan.
      const newSubscriptionId =
        !isLifetime && typeof session.subscription === "string" ? session.subscription : null;
      if (!isLifetime && !newSubscriptionId) break;

      // Gekozen upgrade-beleid: "direct upgraden, oude abonnement meteen
      // opzeggen" i.p.v. Stripe's proration-/subscription-update-API. Bij
      // een lage prijs (EUR 3–99) en laag volume weegt de eenvoud en
      // voorspelbaarheid hiervan (nooit twee tegelijk "actieve" betaalde
      // states in de DB) zwaarder dan het bouwen van correcte proration-
      // afhandeling. Bijeffect: geen automatische terugbetaling van de
      // ongebruikte periode van het oude abonnement — voor een uitzondering
      // kan dat handmatig via het Stripe-dashboard.
      const { data: existingSubscription } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("user_id", userId)
        .maybeSingle();
      const previousSubscriptionId = existingSubscription?.stripe_subscription_id ?? null;

      await supabase
        .from("users")
        .update({ subscription_status: "paid_subscriber", subscription_type: subscriptionType })
        .eq("id", userId);

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
          stripe_subscription_id: newSubscriptionId,
          subscription_type: subscriptionType,
          status: "active",
          // Geen vervaldatum voor lifetime; voor monthly/yearly volgt deze
          // vrijwel meteen via het bijbehorende customer.subscription.updated-
          // event hieronder (dat dezelfde rij bijwerkt via
          // stripe_subscription_id), dus hier alvast null is geen
          // regressie t.o.v. de oude, maand-only flow.
          current_period_end: null,
        },
        { onConflict: "user_id" },
      );

      // Het eventueel vervangen oude abonnement opzeggen — NA de upsert
      // hierboven, zodat de subscriptions-rij al naar het nieuwe plan wijst
      // vóórdat Stripe het bijbehorende customer.subscription.deleted-event
      // voor het oude abonnement stuurt. Die handler hieronder zoekt op
      // stripe_subscription_id; omdat dat veld inmiddels is overschreven,
      // vindt hij voor het oude id geen rij meer en doet dus terecht niets
      // (zie die case) — geen race, gewoon toeval-vrije bescherming door de
      // volgorde van deze twee stappen.
      if (previousSubscriptionId && previousSubscriptionId !== newSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(previousSubscriptionId);
        } catch {
          // Best-effort: als opzeggen faalt (bv. al opgezegd/verlopen) mag
          // de upgrade zelf niet mislukken — de gebruiker heeft via de
          // upsert hierboven hoe dan ook al de juiste, nieuwe toegang.
        }
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;

      // Teamabonnement? — apart, want teams staan in hun eigen tabel, niet
      // in subscriptions (die is uitsluitend voor individuele abonnees).
      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

      if (team) {
        const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
        // 'unpaid'/'incomplete_expired' behandelen we hier als past_due i.p.v.
        // canceled — de coulanceperiode (public.get_effective_access) geeft
        // de eigenaar alsnog de kans om de openstaande factuur te voldoen
        // vóórdat teamleden toegang verliezen. Een expliciete opzegging
        // komt altijd als customer.subscription.deleted binnen (status
        // 'canceled'), dat pad blijft ongewijzigd.
        const status =
          subscription.status === "active" || subscription.status === "trialing"
            ? "active"
            : subscription.status === "canceled"
              ? "canceled"
              : "past_due";

        await supabase
          .from("teams")
          .update({
            status,
            current_period_end: currentPeriodEnd
              ? new Date(currentPeriodEnd * 1000).toISOString()
              : null,
          })
          .eq("id", team.id);
        break;
      }

      const { data: existing } = await supabase
        .from("subscriptions")
        .select("user_id, subscription_type")
        .eq("stripe_subscription_id", subscription.id)
        .maybeSingle();

      if (!existing) break;

      // Expliciete veiligheidscheck (STAP 4 uit de brief): een lifetime-
      // aankoop heeft geen Stripe-Subscription-object en dus structureel
      // altijd stripe_subscription_id = null in de subscriptions-tabel,
      // dus deze lookup kan een lifetime-rij normaliter al niet raken. Deze
      // check is puur een tweede, expliciete garantie tegen een toekomstige
      // datafout die dat ooit zou doorbreken.
      if (existing.subscription_type === "lifetime") break;

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
          .update({ subscription_status: "free_contributor", subscription_type: "none" })
          .eq("id", existing.user_id);
      }
      break;
    }

    // Teamfacturen — collection_method 'send_invoice' (zie
    // create-team/route.ts) genereert per periode een factuur i.p.v.
    // automatisch een kaart/iDEAL te belasten; deze twee events zijn de
    // signalen of die factuur (op tijd) betaald is. customer.subscription.
    // updated hierboven blijft de tweede, onafhankelijke bevestiging van
    // dezelfde statusovergang (Stripe stuurt voor eenzelfde wijziging vaak
    // beide) — beide handlers zijn puur idempotente UPDATE's, dus dubbel
    // verwerken is onschadelijk.
    case "invoice.paid":
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!subscriptionId) break;

      const { data: team } = await supabase
        .from("teams")
        .select("id")
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      if (!team) break;

      const periodEnd = invoice.lines.data[0]?.period?.end;
      await supabase
        .from("teams")
        .update({
          status: "active",
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        })
        .eq("id", team.id);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = getInvoiceSubscriptionId(invoice);
      if (!subscriptionId) break;

      await supabase
        .from("teams")
        .update({ status: "past_due" })
        .eq("stripe_subscription_id", subscriptionId);
      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}
