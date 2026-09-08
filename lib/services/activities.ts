import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { Activity } from "@/types/activity";

const ACTIVITY_SELECT =
  "id, titel, actcode, afbeelding, beginsituatie, beschrijving, categorie, beweegthema, doel, leerlijn, loopt, lukt, leeft, niveau, materiaal, onderwijs_type, veld, regels, doelgroep, learning_outcomes, author_id, status, rejection_reason, submitted_at";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

/**
 * De gedeelde, doorzoekbare bibliotheek — alleen goedgekeurde activiteiten.
 * Voor free_blocked-gebruikers (bijdrage-eis niet gehaald) filtert de
 * aanroepende pagina hier apart op via getOwnSubmissions, zie
 * lib/permissions.ts's hasFullLibraryAccess.
 */
export async function getAllActivities(): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_SELECT)
    .eq("status", "approved")
    .order("titel", { ascending: true });

  if (error) {
    throw new Error(`Kon activiteiten niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Eigen inzendingen van een gebruiker, ongeacht status (pending/approved/
 * rejected) — gebruikt voor "Mijn bijdragen" en voor de beperkte
 * bibliotheekweergave van free_blocked-accounts.
 */
export async function getOwnSubmissions(authorId: string): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_SELECT)
    .eq("author_id", authorId)
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(`Kon eigen bijdragen niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

export async function getActivityById(
  activityId: string,
): Promise<Activity | null> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_SELECT)
    .eq("id", activityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kon activiteit niet ophalen: ${error.message}`);
  }

  return data;
}

export async function isActivitySaved(
  userId: string,
  activityId: string,
): Promise<boolean> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("opgeslagen_activiteiten")
    .select("id")
    .eq("user_id", userId)
    .eq("activiteit_id", activityId)
    .maybeSingle();

  if (error) {
    throw new Error(`Kon opgeslagen status niet ophalen: ${error.message}`);
  }

  return data !== null;
}

export async function getSavedActivityIds(
  userId: string,
): Promise<Set<string>> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("opgeslagen_activiteiten")
    .select("activiteit_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Kon opgeslagen activiteiten niet ophalen: ${error.message}`);
  }

  return new Set((data ?? []).map((row) => row.activiteit_id));
}
