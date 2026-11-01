"use server";

import { cookies } from "next/headers";

import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/utils/supabase/server";
import { createServiceClient } from "@/utils/supabase/service";

export const DELETE_ACCOUNT_CONFIRMATION = "VERWIJDEREN";

type Result = { error: string } | { success: true };

/**
 * Verwijdert het account van de ingelogde gebruiker definitief (zie
 * supabase/migrations/account_deletion.sql voor het beleid). Een abonnement
 * via Apple/Google kan alleen de gebruiker zelf in de store opzeggen — de UI
 * zegt dat vooraf; een Stripe-abonnement zeggen wij hier wel op.
 */
export async function deleteAccount(confirmation: string): Promise<Result> {
  if (confirmation.trim().toUpperCase() !== DELETE_ACCOUNT_CONFIRMATION) {
    return { error: `Typ ${DELETE_ACCOUNT_CONFIRMATION} om te bevestigen.` };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Je bent niet ingelogd." };

  const { data: profile } = await supabase.from("users").select("team_id, team_role").eq("id", user.id).single();

  const admin = createServiceClient();

  if (profile?.team_id && profile.team_role === "owner") {
    const { count } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("team_id", profile.team_id)
      .neq("id", user.id);
    if ((count ?? 0) > 0) {
      return {
        error:
          "Je bent eigenaar van een team met andere leden. Draag het eigenaarschap over of verwijder eerst het team (Profiel → Team).",
      };
    }
  }

  // Stripe-abonnement opzeggen zodat er niet doorbetaald wordt.
  try {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_subscription_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub?.stripe_subscription_id) {
      await getStripeClient().subscriptions.cancel(sub.stripe_subscription_id);
    }
  } catch {
    return { error: "Je abonnement kon niet worden opgezegd. Probeer het opnieuw of neem contact op via info@gymwiki.nl." };
  }

  // Niet-goedgekeurde bijdragen verwijderen; goedgekeurde worden anoniem (migratie).
  await admin.from("activiteiten").delete().eq("author_id", user.id).neq("status", "approved");

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return { error: "Verwijderen is mislukt. Probeer het opnieuw of neem contact op via info@gymwiki.nl." };
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // Sessie is toch al ongeldig.
  }
  return { success: true };
}
