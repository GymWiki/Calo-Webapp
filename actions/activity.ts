"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

type ToggleResult = { error: string } | { success: true; saved: boolean };

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

  return { success: true, saved: true };
}

type LikeToggleResult = { error: string } | { success: true; liked: boolean };

const LIKE_GENERIC_ERROR = "Waarderen is mislukt. Probeer het opnieuw.";

/**
 * Toggelt "Dit werkte goed" op een activiteit — zelfde patroon als
 * toggleSavedActivity hierboven (activity_likes i.p.v. opgeslagen_activiteiten,
 * unique(activity_id, user_id)). Het geaggregeerde aantal (activiteiten.
 * like_count) wordt door een DB-trigger bijgehouden (zie
 * supabase/migrations/activity_likes.sql), niet hier.
 *
 * Zelf-like-preventie staat hier expliciet (voor een duidelijke
 * foutmelding i.p.v. een kale RLS-fout) ÉN nogmaals op RLS-niveau (de
 * activity_likes_insert-policy) — een bug in deze check alleen zou dus
 * geen zelf-like doorlaten.
 */
export async function toggleActivityLike(
  activityId: string,
): Promise<LikeToggleResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { data: activity, error: activityError } = await supabase
    .from("activiteiten")
    .select("author_id")
    .eq("id", activityId)
    .maybeSingle();

  if (activityError || !activity) {
    return { error: LIKE_GENERIC_ERROR };
  }

  if (activity.author_id === user.id) {
    return { error: "Je kunt je eigen activiteit niet waarderen." };
  }

  const { data: existing, error: lookupError } = await supabase
    .from("activity_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .maybeSingle();

  if (lookupError) {
    return { error: LIKE_GENERIC_ERROR };
  }

  if (existing) {
    const { error } = await supabase.from("activity_likes").delete().eq("id", existing.id);

    if (error) {
      return { error: LIKE_GENERIC_ERROR };
    }

    return { success: true, liked: false };
  }

  const { error } = await supabase
    .from("activity_likes")
    .insert({ user_id: user.id, activity_id: activityId });

  if (error) {
    return { error: LIKE_GENERIC_ERROR };
  }

  return { success: true, liked: true };
}
