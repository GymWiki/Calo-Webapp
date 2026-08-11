import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { Activity } from "@/types/activity";

const ACTIVITY_SELECT =
  "id, titel, actcode, afbeelding, beginsituatie, beschrijving, categorie, beweegthema, doel, leerlijn, loopt, lukt, leeft, niveau, materiaal, onderwijs_type, veld, regels, doelgroep";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

export async function getAllActivities(): Promise<Activity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activiteiten")
    .select(ACTIVITY_SELECT)
    .order("titel", { ascending: true });

  if (error) {
    throw new Error(`Kon activiteiten niet ophalen: ${error.message}`);
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
