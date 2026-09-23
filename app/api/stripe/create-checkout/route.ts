import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getUserPermissions } from "@/lib/permissions";
import { getStripeClient } from "@/lib/stripe/client";

export async function POST(request: Request) {
  // `native: true` betekent: deze checkout is gestart vanuit de /pro-pagina
  // die de native-app-gebruiker via de systeem-browser-link bereikte (zie
  // components/mobile/NativeUpgradeAction.tsx) — draagt dat over naar de
  // Stripe-redirect-URL's zodat /pro na afloop een "Terug naar de app"-knop
  // kan tonen. Geen JSON-body meegestuurd (gewone webgebruikers) is gewoon
  // `native: false`.
  let native = false;
  try {
    const body = await request.json();
    native = body?.native === true;
  } catch {
    // Geen of geen geldige JSON-body — blijft `native: false`.
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
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Profiel niet gevonden." }, { status: 404 });
  }

  if (getUserPermissions(profile).subscriptionStatus === "paid_subscriber") {
    return Response.json(
      { error: "Je hebt al een actief abonnement." },
      { status: 400 },
    );
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return Response.json(
      {
        error:
          "Stripe is nog niet geconfigureerd. Voeg STRIPE_SECRET_KEY en STRIPE_PRICE_ID (het EUR 3,-/mnd-abonnement) toe aan de omgevingsvariabelen.",
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
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: { userId: user.id },
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
