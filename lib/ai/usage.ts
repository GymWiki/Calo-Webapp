import type { SupabaseClient } from "@supabase/supabase-js";

const FREE_MONTHLY_LIMIT = 3;

export type AiUsageResult =
  | { allowed: true; remaining: number | null }
  | { allowed: false; remaining: 0 };

/**
 * Fair-use gate for the AI endpoints: unlimited for Pro users, otherwise
 * `FREE_MONTHLY_LIMIT` checks per calendar month across both AI endpoints
 * (analyze-lesson + generate-activity share one pool). Records the attempt
 * in `ai_usage_log` when it's allowed.
 */
export async function checkAndRecordAiUsage(
  supabase: SupabaseClient,
  userId: string,
  isPro: boolean,
  endpoint: "analyze-lesson" | "generate-activity",
): Promise<AiUsageResult> {
  if (isPro) {
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

  if (used >= FREE_MONTHLY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  await supabase.from("ai_usage_log").insert({ user_id: userId, endpoint });
  return { allowed: true, remaining: FREE_MONTHLY_LIMIT - used - 1 };
}
