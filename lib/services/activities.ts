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
 * Eigen ingediende activiteiten (pending/approved/rejected) — gebruikt voor
 * "Mijn activiteiten" en voor de beperkte bibliotheekweergave van
 * free_blocked-accounts. Sluit concepten (status 'draft') bewust uit — die
 * zijn nog niet ingediend, zie getActivityDrafts hieronder.
 */
export async function getOwnSubmissions(authorId: string): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_SELECT)
    .eq("author_id", authorId)
    .neq("status", "draft")
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(`Kon eigen bijdragen niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Eigen concepten (status 'draft') — volledig ingevuld maar nog niet
 * ingediend, dus nog niet door de AI-kwaliteitscheck gegaan. Zie
 * submitActivityDraft/deleteActivityDraft in actions/activity-submission.ts.
 */
export async function getActivityDrafts(authorId: string): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_SELECT)
    .eq("author_id", authorId)
    .eq("status", "draft")
    .order("submitted_at", { ascending: false });

  if (error) {
    throw new Error(`Kon concepten niet ophalen: ${error.message}`);
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

/**
 * Volledige, opgeslagen-favorieten-lijst voor de profielpagina — meest
 * recent opgeslagen eerst. Twee stappen (i.p.v. een embedded select) zodat
 * de save-volgorde expliciet bewaard blijft ondanks Postgres' `in()` geen
 * volgorde garandeert.
 */
export async function getSavedActivities(userId: string): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data: saved, error: savedError } = await supabase
    .from("opgeslagen_activiteiten")
    .select("activiteit_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (savedError) {
    throw new Error(`Kon opgeslagen activiteiten niet ophalen: ${savedError.message}`);
  }

  const orderedIds = (saved ?? []).map((row) => row.activiteit_id);
  if (orderedIds.length === 0) return [];

  const { data: activities, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_SELECT)
    .in("id", orderedIds);

  if (error) {
    throw new Error(`Kon opgeslagen activiteiten niet ophalen: ${error.message}`);
  }

  const byId = new Map((activities ?? []).map((activity) => [activity.id, activity]));
  return orderedIds
    .map((id) => byId.get(id))
    .filter((activity): activity is Activity => activity !== undefined);
}
