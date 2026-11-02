import { cookies } from "next/headers";

import { healUserSubscription } from "@/lib/stripe/self-heal";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** "Abonnement synchroniseren": controleert bij Stripe of deze gebruiker betaald heeft en herstelt de pro-status. */
export async function POST() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Je bent niet ingelogd." }, { status: 401, headers: { "Cache-Control": "no-store" } });

  try {
    const result = await healUserSubscription(
      createServiceClient(),
      getStripeClient(),
      { userId: user.id, email: user.email ?? null, emailVerified: Boolean(user.email_confirmed_at) },
      (m, f) => console.error(`[stripe-sync] ${m}`, f ?? {}),
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    console.error("[stripe-sync] mislukt", cause instanceof Error ? cause.message : "onbekend");
    return Response.json({ error: "Synchroniseren is nu niet gelukt. Probeer het zo opnieuw." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
