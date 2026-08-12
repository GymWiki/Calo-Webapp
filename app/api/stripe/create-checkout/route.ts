import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getLevelInfo } from "@/lib/gamification";
import { getUserPermissions } from "@/lib/permissions";
import { getStripeClient } from "@/lib/stripe/client";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }

  // Nooit een door de client meegestuurd kortingspercentage vertrouwen —
  // altijd opnieuw uit de xp-stand in de database afleiden.
  const { data: profile } = await supabase
    .from("users")
    .select("xp, plan_type")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Profiel niet gevonden." }, { status: 404 });
  }

  if (getUserPermissions(profile).isPro) {
    return Response.json(
      { error: "Je hebt al een actief Pro-abonnement." },
      { status: 400 },
    );
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    return Response.json(
      {
        error:
          "Stripe is nog niet geconfigureerd. Voeg STRIPE_SECRET_KEY en STRIPE_PRICE_ID toe aan de omgevingsvariabelen om Pro-upgrades te verwerken.",
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

  const discountPercent = getLevelInfo(profile.xp).freeDiscountPercent;
  const origin = new URL(request.url).origin;

  try {
    // Dynamische Maker-korting: geen vooraf aangemaakte Stripe-coupon per
    // niveau nodig — we maken 'm on-the-fly op basis van het huidige level.
    const discounts = discountPercent > 0
      ? [
          {
            coupon: (
              await stripe.coupons.create({
                percent_off: discountPercent,
                duration: "forever",
                name: `GymWiki Maker-korting ${discountPercent}%`,
              })
            ).id,
          },
        ]
      : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      discounts,
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      metadata: { userId: user.id, discountPercent: String(discountPercent) },
      success_url: `${origin}/pro?checkout=success`,
      cancel_url: `${origin}/pro?checkout=cancelled`,
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
