import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";
import { TEAM_PLANS, TEAM_PRICE_ENV_VAR, type TeamPlan } from "@/lib/constants/subscriptionPlans";
import { getStripeClient } from "@/lib/stripe/client";

function isTeamPlan(value: unknown): value is TeamPlan {
  return value === "team_s" || value === "team_m" || value === "team_l";
}

const DAYS_UNTIL_DUE = 30;

/**
 * Maakt een teamabonnement aan — facturering op factuur:
 * `collection_method: 'send_invoice'` op de Subscription, i.p.v. Checkout
 * direct een betaalmethode (iDEAL/kaart) te laten innen. GEKOZEN VARIANT:
 * rechtstreeks de Subscriptions-API i.p.v. een Checkout Session, want
 * Checkout Sessions ondersteunen `collection_method`/`days_until_due` in
 * deze Stripe-API-versie niet op `subscription_data` (Checkout is gebouwd
 * rond het INZAMELEN van een betaalmethode — precies wat hier niet gebeurt).
 * Stripe maakt de subscription direct actief (teamtoegang start meteen) en
 * stuurt per factureringsperiode automatisch een factuur die de school/
 * sectie binnen `days_until_due` dagen voldoet — dit past het beste bij
 * hoe Nederlandse scholen inkopen (PO/factuur i.p.v. een lerares die met
 * een privé-creditcard afrekent). Geen redirect/checkout-sessie nodig:
 * de teams-rij wordt hier direct aangemaakt (geen wachten op een webhook),
 * de webhook (app/api/stripe/webhook/route.ts) verwerkt alleen nog
 * STATUSWIJZIGINGEN (betaald/mislukt/opgezegd) op een bestaand team.
 *
 * Factuurgegevens (naam + optioneel btw-nummer) komen uit dit formulier
 * i.p.v. Checkout's tax_id_collection — geen btw-berekening hier: dat is
 * een Stripe Tax/Price-instelling (zie de toelichting in de PR-
 * samenvatting), bewust config, geen code.
 */
export async function POST(request: Request) {
  let plan: unknown;
  let teamName: unknown;
  let invoiceName: unknown;
  let vatNumber: unknown;
  try {
    const body = await request.json();
    plan = body?.plan;
    teamName = body?.teamName;
    invoiceName = body?.invoiceName;
    vatNumber = body?.vatNumber;
  } catch {
    // hieronder afgewezen
  }

  if (!isTeamPlan(plan)) {
    return Response.json({ error: "Ongeldig teampakket." }, { status: 400 });
  }
  if (typeof teamName !== "string" || teamName.trim().length < 2) {
    return Response.json({ error: "Vul een teamnaam in (minstens 2 tekens)." }, { status: 400 });
  }
  if (typeof invoiceName !== "string" || invoiceName.trim().length < 2) {
    return Response.json({ error: "Vul een factuurnaam in (school/sectie)." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }

  const { data: existingTeam } = await supabase
    .from("teams")
    .select("id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  const { data: existingMembership } = await supabase
    .from("team_members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingTeam || existingMembership) {
    return Response.json(
      { error: "Je hebt al een team — je kunt niet nogmaals een team aanmaken." },
      { status: 400 },
    );
  }

  const priceId = process.env[TEAM_PRICE_ENV_VAR[plan]];
  if (!priceId) {
    return Response.json(
      {
        error: `Stripe is nog niet geconfigureerd voor teams. Voeg STRIPE_SECRET_KEY en ${TEAM_PRICE_ENV_VAR[plan]} toe aan de omgevingsvariabelen.`,
      },
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
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: invoiceName.trim(),
      metadata: {
        gymwiki_owner_user_id: user.id,
        ...(typeof vatNumber === "string" && vatNumber.trim() ? { vat_number: vatNumber.trim() } : {}),
      },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      collection_method: "send_invoice",
      days_until_due: DAYS_UNTIL_DUE,
    });

    const service = createServiceClient();
    const { data: newTeam, error: teamError } = await service
      .from("teams")
      .insert({
        name: teamName.trim(),
        owner_user_id: user.id,
        plan,
        seat_limit: TEAM_PLANS[plan].seatLimit,
        status: "active",
        stripe_customer_id: customer.id,
        stripe_subscription_id: subscription.id,
        invoice_name: invoiceName.trim(),
        invoice_vat_number: typeof vatNumber === "string" && vatNumber.trim() ? vatNumber.trim() : null,
      })
      .select("id")
      .single();

    if (teamError || !newTeam) {
      // Best-effort opruimen: geen wees-abonnement achterlaten als de
      // lokale rij niet kon worden aangemaakt.
      try {
        await stripe.subscriptions.cancel(subscription.id);
      } catch {
        // Best-effort.
      }
      return Response.json({ error: "Team aanmaken is mislukt. Probeer het opnieuw." }, { status: 502 });
    }

    await service.from("team_members").insert({
      team_id: newTeam.id,
      user_id: user.id,
      role: "owner",
    });

    return Response.json({ success: true, teamId: newTeam.id });
  } catch (cause) {
    return Response.json(
      {
        error:
          cause instanceof Error
            ? `Team aanmaken is mislukt: ${cause.message}`
            : "Team aanmaken is mislukt. Probeer het opnieuw.",
      },
      { status: 502 },
    );
  }
}
