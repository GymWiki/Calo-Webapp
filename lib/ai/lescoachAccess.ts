import type { SupabaseClient } from "@supabase/supabase-js";

import { AI_LESCOACH_MONTHLY_LIMIT } from "@/lib/permissions";
import type { SubscriptionStatus } from "@/lib/types";

export type LescoachAccess = {
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
 * Alleen-lezen toegangscheck voor AI Lescoach — een functie van het
 * betaalde abonnement, met een eigen teller (feature='ai_lescoach' in
 * `ai_usage`) en een eigen maandquotum (AI_LESCOACH_MONTHLY_LIMIT, zie
 * lib/permissions.ts), want Lescoach wordt naar verwachting vaker per
 * activiteit geraadpleegd dan een eenmalige AI-aanroep.
 */
export async function checkLescoachAccess(
  supabase: SupabaseClient,
  userId: string,
  subscriptionStatus: SubscriptionStatus,
): Promise<LescoachAccess> {
  const limit = AI_LESCOACH_MONTHLY_LIMIT;

  if (subscriptionStatus !== "paid_subscriber") {
    return { allowed: false, reason: "not_subscriber", used: 0, limit, remaining: 0 };
  }

  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", "ai_lescoach")
    .gte("created_at", startOfMonth().toISOString());

  const used = count ?? 0;
  const remaining = Math.max(limit - used, 0);

  if (used >= limit) {
    return { allowed: false, reason: "limit_reached", used, limit, remaining: 0 };
  }

  return { allowed: true, reason: null, used, limit, remaining };
}
