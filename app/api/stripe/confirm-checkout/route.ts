import { cookies } from "next/headers";

import { factsFromStripe, supabaseBillingDeps } from "@/lib/stripe/adapter";
import { getStripeClient } from "@/lib/stripe/client";
import { processCheckoutSession } from "@/lib/stripe/webhook";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * De succespagina wacht niet blind op de webhook: bij terugkomst verifiëren we
 * de Checkout Session server-side bij Stripe en activeren we idempotent
 * (zelfde logica als de webhook). De sessie moet van déze gebruiker zijn.
 */
export async function POST(request: Request) {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Je bent niet ingelogd." }, { status: 401, headers: NO_STORE });

  const sessionId = (await request.json().catch(() => null))?.session_id;
  if (typeof sessionId !== "string" || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
    return Response.json({ error: "Ongeldige sessie." }, { status: 400, headers: NO_STORE });
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const owner = session.client_reference_id ?? session.metadata?.userId ?? null;
    if (owner !== user.id) return Response.json({ error: "Deze betaling hoort niet bij jouw account." }, { status: 403, headers: NO_STORE });

    const log = (m: string, f?: Record<string, string | number | boolean | null>) => console.error(`[confirm-checkout] ${m}`, f ?? {});
    const result = await processCheckoutSession(
      {
        retrieveSubscription: async (id) => factsFromStripe(await stripe.subscriptions.retrieve(id)),
        billing: supabaseBillingDeps(createServiceClient(), stripe, log),
      },
      session as unknown as Record<string, unknown>,
    );
    return Response.json({ result: result?.kind ?? "none", paid: result?.kind === "synced" ? result.paid : false }, { headers: NO_STORE });
  } catch (cause) {
    console.error("[confirm-checkout] mislukt", cause instanceof Error ? cause.message : "onbekend");
    return Response.json({ error: "Bevestigen is nu niet gelukt." }, { status: 502, headers: NO_STORE });
  }
}
