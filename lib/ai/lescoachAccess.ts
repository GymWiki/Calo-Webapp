import type { SupabaseClient } from "@supabase/supabase-js";

import { AI_LESCOACH_MONTHLY_LIMIT } from "@/lib/permissions";
import { TEAM_AI_LESCOACH_PER_SEAT_LIMIT } from "@/lib/constants/subscriptionPlans";
import type { SubscriptionStatus } from "@/lib/types";

export type LescoachAccess = {
  allowed: boolean;
  reason: "not_subscriber" | "limit_reached" | null;
  used: number;
  limit: number;
  remaining: number;
  /** True zolang used/limit een GEPOOLD teamtegoed is i.p.v. een individueel. */
  pooled: boolean;
};

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Alleen-lezen toegangscheck voor AI Lescoach — een functie van het
 * betaalde abonnement (eigen OF via een team, zie subscriptionStatus die de
 * aanroeper al effectief bepaald moet hebben, bijv. via
 * public.get_effective_access), met een eigen teller (feature='ai_lescoach'
 * in `ai_usage`) en een eigen maandquotum (AI_LESCOACH_MONTHLY_LIMIT, zie
 * lib/permissions.ts), want Lescoach wordt naar verwachting vaker per
 * activiteit geraadpleegd dan een eenmalige AI-aanroep.
 *
 * Voor een teamlid (teamId gezet) geldt i.p.v. het individuele quotum een
 * GEPOOLDE maandlimiet: seats × TEAM_AI_LESCOACH_PER_SEAT_LIMIT, geteld over
 * ALLE teamleden samen (public.get_team_ai_usage_count) — zie de brief
 * "AI-KOSTEN".
 */
export async function checkLescoachAccess(
  supabase: SupabaseClient,
  userId: string,
  subscriptionStatus: SubscriptionStatus,
  team?: { id: string; seatLimit: number } | null,
): Promise<LescoachAccess> {
  if (subscriptionStatus !== "paid_subscriber") {
    return {
      allowed: false,
      reason: "not_subscriber",
      used: 0,
      limit: AI_LESCOACH_MONTHLY_LIMIT,
      remaining: 0,
      pooled: false,
    };
  }

  if (team) {
    const limit = team.seatLimit * TEAM_AI_LESCOACH_PER_SEAT_LIMIT;
    const { data: used, error } = await supabase.rpc("get_team_ai_usage_count", {
      p_team_id: team.id,
      p_feature: "ai_lescoach",
    });

    if (error) {
      // Fail-closed: bij een fout in de telling liever geen toegang dan
      // onbeperkt toegang.
      return { allowed: false, reason: "limit_reached", used: limit, limit, remaining: 0, pooled: true };
    }

    const usedCount = used ?? 0;
    const remaining = Math.max(limit - usedCount, 0);

    if (usedCount >= limit) {
      return { allowed: false, reason: "limit_reached", used: usedCount, limit, remaining: 0, pooled: true };
    }

    return { allowed: true, reason: null, used: usedCount, limit, remaining, pooled: true };
  }

  const limit = AI_LESCOACH_MONTHLY_LIMIT;
  const { count } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("feature", "ai_lescoach")
    .gte("created_at", startOfMonth().toISOString());

  const used = count ?? 0;
  const remaining = Math.max(limit - used, 0);

  if (used >= limit) {
    return { allowed: false, reason: "limit_reached", used, limit, remaining: 0, pooled: false };
  }

  return { allowed: true, reason: null, used, limit, remaining, pooled: false };
}
