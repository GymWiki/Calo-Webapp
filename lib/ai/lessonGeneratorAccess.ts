import type { SupabaseClient } from "@supabase/supabase-js";

import { LESSON_GENERATOR_MONTHLY_LIMIT } from "@/lib/permissions";
import type { SubscriptionStatus } from "@/lib/types";

export type LessonGeneratorAccess = {
  allowed: boolean;
  reason: "not_subscriber" | "limit_reached" | null;
  used: number;
  limit: number;
  remaining: number;
};

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Alleen-lezen toegangscheck voor de AI-lessengenerator — gebruikt zowel
 * door de pagina (om "X van Y lesgeneraties over" te tonen, vóór er ooit
 * gegenereerd wordt) als door /api/ai/generate-activity (server-side
 * afgedwongen, dus niet te omzeilen door de client-check over te slaan).
 * Telt live het aantal ai_usage-rijen deze kalendermaand — geen losse
 * tellertabel nodig, dus ook geen aparte reset-logica: een nieuwe maand
 * begint vanzelf bij 0 zodra `created_at` in de vorige maand valt.
 */
export async function checkLessonGeneratorAccess(
  supabase: SupabaseClient,
  userId: string,
  subscriptionStatus: SubscriptionStatus,
): Promise<LessonGeneratorAccess> {
  const limit = LESSON_GENERATOR_MONTHLY_LIMIT;

  if (subscriptionStatus !== "paid_subscriber") {
    return { allowed: false, reason: "not_subscriber", used: 0, limit, remaining: 0 };
  }

  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", "lesson_generator")
    .gte("created_at", startOfMonth().toISOString());

  const used = count ?? 0;
  const remaining = Math.max(limit - used, 0);

  if (used >= limit) {
    return { allowed: false, reason: "limit_reached", used, limit, remaining: 0 };
  }

  return { allowed: true, reason: null, used, limit, remaining };
}
