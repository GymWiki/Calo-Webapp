import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";

/**
 * Stripe Customer Portal voor teamfacturatie — alleen de eigenaar (RLS op
 * teams staat toe dat alleen de rij van de eigen team_id/owner terugkomt,
 * de extra .eq("owner_user_id", ...) hieronder is de expliciete,
 * leesbare server-side garantie ernaast).
 */
export async function POST(request: Request) {
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
    .select("stripe_customer_id")
    .eq("owner_user_id", user.id)
    .maybeSingle();

  if (!team?.stripe_customer_id) {
    return Response.json({ error: "Geen teamfacturatie gevonden." }, { status: 404 });
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

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: team.stripe_customer_id,
      return_url: `${origin}/profiel/team`,
    });

    return Response.json({ url: session.url });
  } catch {
    return Response.json(
      { error: "Facturatieportaal openen is mislukt. Probeer het opnieuw." },
      { status: 502 },
    );
  }
}
