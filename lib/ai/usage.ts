import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserPermissions } from "@/lib/permissions";

export type AiUsageResult =
  | { allowed: true; remaining: number | null }
  | { allowed: false; remaining: 0 };

/**
 * Fair-use gate for the AI endpoints: unlimited for Pro users, otherwise
 * `monthlyAiLimit` (lib/permissions.ts — the single source of truth for
 * this number) checks per calendar month across both AI endpoints
 * (analyze-lesson + generate-activity share one pool). Records the attempt
 * in `ai_usage_log` when it's allowed.
 */
export async function checkAndRecordAiUsage(
  supabase: SupabaseClient,
  userId: string,
  isPro: boolean,
  endpoint: "analyze-lesson" | "generate-activity",
): Promise<AiUsageResult> {
  const { monthlyAiLimit } = getUserPermissions({ is_pro: isPro });

  if (!Number.isFinite(monthlyAiLimit)) {
    await supabase.from("ai_usage_log").insert({ user_id: userId, endpoint });
    return { allowed: true, remaining: null };
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfMonth.toISOString());

  const used = count ?? 0;

  if (used >= monthlyAiLimit) {
    return { allowed: false, remaining: 0 };
  }

  await supabase.from("ai_usage_log").insert({ user_id: userId, endpoint });
  return { allowed: true, remaining: monthlyAiLimit - used - 1 };
}
