import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { PLAN_ORDER, type SubscriptionPlan } from "@/lib/constants/subscriptionPlans";
import { getUserPermissions } from "@/lib/permissions";
import { getStripeClient } from "@/lib/stripe/client";
import type { SubscriptionType } from "@/lib/types";

const PRICE_ENV_VAR: Record<SubscriptionPlan, string> = {
  monthly: "STRIPE_PRICE_MONTHLY",
  yearly: "STRIPE_PRICE_YEARLY",
  lifetime: "STRIPE_PRICE_LIFETIME",
};

function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return value === "monthly" || value === "yearly" || value === "lifetime";
}

export async function POST(request: Request) {
  // `native: true` betekent: deze checkout is gestart vanuit de /pro-pagina
  // die de native-app-gebruiker via de systeem-browser-link bereikte (zie
  // components/mobile/NativeUpgradeAction.tsx) — draagt dat over naar de
  // Stripe-redirect-URL's zodat /pro na afloop een "Terug naar de app"-knop
  // kan tonen. `plan` is verplicht: welk van de drie opties (zie
  // lib/constants/subscriptionPlans.ts) de gebruiker koos op /pro.
  let plan: unknown;
  let native = false;
  try {
    const body = await request.json();
    plan = body?.plan;
    native = body?.native === true;
  } catch {
    // Geen/ongeldige JSON-body — plan blijft undefined en wordt hieronder afgewezen.
  }

  if (!isSubscriptionPlan(plan)) {
    return Response.json({ error: "Ongeldige abonnementskeuze." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("subscription_status, subscription_type")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Profiel niet gevonden." }, { status: 404 });
  }

  // Upgrade-pad: alleen naar een HOGER plan (monthly < yearly < lifetime),
  // nooit hetzelfde plan opnieuw of een downgrade — zie
  // lib/constants/subscriptionPlans.ts's PLAN_ORDER. Downgraden (bv. van
  // lifetime terug naar maandelijks) wordt bewust niet via deze pagina
  // aangeboden; dat is geen aankoopflow maar een opzegging + latere nieuwe
  // aankoop, en hoort dus bij "abonnement beheren", niet bij checkout.
  const currentType: SubscriptionType =
    getUserPermissions(profile).subscriptionStatus === "paid_subscriber"
      ? profile.subscription_type
      : "none";

  if (currentType !== "none") {
    if (currentType === plan) {
      return Response.json({ error: "Je hebt dit abonnement al." }, { status: 400 });
    }
    if (PLAN_ORDER[plan] < PLAN_ORDER[currentType]) {
      return Response.json(
        { error: "Downgraden kan niet via deze pagina — neem contact op als je dit wilt wijzigen." },
        { status: 400 },
      );
    }
  }

  const priceId = process.env[PRICE_ENV_VAR[plan]];
  if (!priceId) {
    return Response.json(
      {
        error: `Stripe is nog niet geconfigureerd. Voeg STRIPE_SECRET_KEY en ${PRICE_ENV_VAR[plan]} toe aan de omgevingsvariabelen.`,
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

  const origin = new URL(request.url).origin;
  const nativeParam = native ? "&native=1" : "";

  try {
    const session = await stripe.checkout.sessions.create({
      // Lifetime is een eenmalige betaling (mode "payment"), geen
      // Stripe-Subscription-object — maand/jaar blijven "subscription" zoals
      // voorheen.
      mode: plan === "lifetime" ? "payment" : "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      // subscription_type in de metadata i.p.v. de Price-ID terug-mappen in
      // de webhook: dat zou breken zodra iemand ooit een Price-ID in Stripe
      // wijzigt/dupliceert. De webhook (app/api/stripe/webhook/route.ts)
      // leest dit veld direct.
      metadata: { userId: user.id, subscription_type: plan },
      success_url: `${origin}/pro?checkout=success${nativeParam}`,
      cancel_url: `${origin}/pro?checkout=cancelled${nativeParam}`,
    });

    if (!session.url) {
      return Response.json(
        { error: "Checkout aanmaken is mislukt. Probeer het opnieuw." },
        { status: 502 },
      );
    }

    return Response.json({ url: session.url });
  } catch {
    return Response.json(
      { error: "Checkout aanmaken is mislukt. Probeer het opnieuw." },
      { status: 502 },
    );
  }
}
