"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { awardXp, XP_REWARDS, type LevelUpEvent } from "@/lib/gamification";

type ToggleResult =
  | { error: string }
  | { success: true; saved: boolean; levelUp?: LevelUpEvent };

const GENERIC_ERROR = "Opslaan is mislukt. Probeer het opnieuw.";

export async function toggleSavedActivity(
  activityId: string,
): Promise<ToggleResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("opgeslagen_activiteiten")
    .select("id")
    .eq("user_id", user.id)
    .eq("activiteit_id", activityId)
    .maybeSingle();

  if (lookupError) {
    return { error: GENERIC_ERROR };
  }

  if (existing) {
    const { error } = await supabase
      .from("opgeslagen_activiteiten")
      .delete()
      .eq("id", existing.id);

    if (error) {
      return { error: GENERIC_ERROR };
    }

    return { success: true, saved: false };
  }

  const { error } = await supabase
    .from("opgeslagen_activiteiten")
    .insert({ user_id: user.id, activiteit_id: activityId });

  if (error) {
    return { error: GENERIC_ERROR };
  }

  const { levelUp } = await awardXp(supabase, user.id, XP_REWARDS.activitySaved);
  return levelUp ? { success: true, saved: true, levelUp } : { success: true, saved: true };
}
