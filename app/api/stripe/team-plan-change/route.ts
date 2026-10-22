import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { TEAM_PLANS, TEAM_PRICE_ENV_VAR, type TeamPlan } from "@/lib/constants/subscriptionPlans";
import { getSeatUsage } from "@/lib/services/teams";
import { getStripeClient } from "@/lib/stripe/client";

function isTeamPlan(value: unknown): value is TeamPlan {
  return value === "team_s" || value === "team_m" || value === "team_l";
}

/**
 * Pakket wijzigen (S/M/L) op de bestaande teamsubscription — twee stappen
 * in één route, onderscheiden via `action`:
 * - "preview": rekent de proratering door (Stripe's retrieveUpcoming, geen
 *   enkele wijziging) en geeft het bij te betalen/te verrekenen bedrag
 *   terug, voor het bevestigingsscherm uit de brief.
 * - "confirm": past de subscription daadwerkelijk aan
 *   (proration_behavior: 'create_prorations') en stuurt meteen een aparte
 *   factuur voor het prorated bedrag i.p.v. te wachten tot de volgende
 *   jaarlijkse cyclus — bij collection_method 'send_invoice' voegt Stripe
 *   prorated regels anders pas toe aan de VOLGENDE geplande factuur, wat
 *   hier (jaarlijkse facturering) een jaar kan duren.
 *
 * Downgrade (minder seats) wordt geweigerd als het aantal huidige leden +
 * openstaande uitnodigingen niet in het nieuwe limiet past — zowel bij
 * preview als confirm, zodat de fout al zichtbaar is vóór het
 * bevestigingsscherm.
 */
export async function POST(request: Request) {
  let plan: unknown;
  let action: unknown;
  try {
    const body = await request.json();
    plan = body?.plan;
    action = body?.action;
  } catch {
    // hieronder afgewezen
  }

  if (!isTeamPlan(plan)) {
    return Response.json({ error: "Ongeldig teampakket." }, { status: 400 });
  }
  if (action !== "preview" && action !== "confirm") {
    return Response.json({ error: "Ongeldige actie." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }

  const { data: team } = await supabase
    .from("teams")
    .select("id, plan, seat_limit, stripe_customer_id, stripe_subscription_id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!team || !team.stripe_subscription_id || !team.stripe_customer_id) {
    return Response.json({ error: "Geen team met actieve facturatie gevonden." }, { status: 404 });
  }

  if (plan === team.plan) {
    return Response.json({ error: "Je hebt dit pakket al." }, { status: 400 });
  }

  const newSeatLimit = TEAM_PLANS[plan].seatLimit;
  if (newSeatLimit < team.seat_limit) {
    const usage = await getSeatUsage(supabase, team.id);
    if (usage && usage.seatsUsed > newSeatLimit) {
      const toRemove = usage.seatsUsed - newSeatLimit;
      return Response.json(
        {
          error: `Dit pakket biedt maar ${newSeatLimit} seats — je gebruikt er nu ${usage.seatsUsed}. Verwijder eerst minstens ${toRemove} lid/leden of openstaande uitnodiging(en) voordat je kunt downgraden.`,
        },
        { status: 400 },
      );
    }
  }

  const priceId = process.env[TEAM_PRICE_ENV_VAR[plan]];
  if (!priceId) {
    return Response.json(
      { error: `${TEAM_PRICE_ENV_VAR[plan]} ontbreekt in de omgevingsvariabelen.` },
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

  try {
    const subscription = await stripe.subscriptions.retrieve(team.stripe_subscription_id);
    const itemId = subscription.items.data[0]?.id;
    if (!itemId) {
      return Response.json({ error: "Kon het abonnement-item niet vinden." }, { status: 502 });
    }

    if (action === "preview") {
      const upcoming = await stripe.invoices.createPreview({
        customer: team.stripe_customer_id,
        subscription: team.stripe_subscription_id,
        subscription_details: {
          items: [{ id: itemId, price: priceId }],
          proration_date: Math.floor(Date.now() / 1000),
        },
      });

      return Response.json({
        amountDue: upcoming.amount_due,
        currency: upcoming.currency,
      });
    }

    await stripe.subscriptions.update(team.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: "create_prorations",
    });

    const invoice = await stripe.invoices.create({
      customer: team.stripe_customer_id,
      subscription: team.stripe_subscription_id,
      auto_advance: false,
      collection_method: "send_invoice",
      days_until_due: 30,
    });
    if (invoice.id) {
      await stripe.invoices.finalizeInvoice(invoice.id);
      await stripe.invoices.sendInvoice(invoice.id);
    }

    await supabase.from("teams").update({ plan, seat_limit: newSeatLimit }).eq("id", team.id);

    return Response.json({ success: true });
  } catch (cause) {
    return Response.json(
      {
        error:
          cause instanceof Error
            ? `Pakketwijziging is mislukt: ${cause.message}`
            : "Pakketwijziging is mislukt. Probeer het opnieuw.",
      },
      { status: 502 },
    );
  }
}
