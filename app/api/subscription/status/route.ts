import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Huidige pro-status; nooit gecachet (client polling na een betaling). */
export async function GET() {
  const profile = await getCurrentUserProfile();
  if (!profile) return Response.json({ error: "Niet ingelogd." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return Response.json(
    { paid: profile.subscription_status === "paid_subscriber", type: profile.subscription_type },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
