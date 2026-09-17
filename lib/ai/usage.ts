import type { SupabaseClient } from "@supabase/supabase-js";
import { MONTHLY_AI_LIMIT } from "@/lib/permissions";

export type AiUsageResult =
  | { allowed: true; remaining: number | null }
  | { allowed: false; remaining: 0 };

/**
 * Fair-use gate for extract-activity: a flat monthly quota (MONTHLY_AI_LIMIT,
 * lib/permissions.ts) for every user regardless of subscription status.
 * Records the attempt in `ai_usage_log` when it's allowed.
 *
 * analyze-lesson (AI Lescoach) and generate-activity (AI Activiteiten
 * Generator) used to share this same flat pool, but both moved to their own
 * dedicated, paid-subscriber-only quota (ai_usage-table-based — see
 * lib/ai/lescoachAccess.ts / lib/ai/lessonGeneratorAccess.ts) once they
 * became paid-subscriber features with their own cost profile, so this is
 * now extract-activity's alone.
 */
export async function checkAndRecordAiUsage(
  supabase: SupabaseClient,
  userId: string,
  endpoint: "extract-activity",
): Promise<AiUsageResult> {
  const monthlyAiLimit = MONTHLY_AI_LIMIT;

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
