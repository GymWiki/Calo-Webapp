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
 * analyze-lesson (AI Lescoach) used to share this same flat pool, but moved
 * to its own dedicated, paid-subscriber-only quota (ai_usage-table-based —
 * see lib/ai/lescoachAccess.ts) once it became a paid-subscriber feature
 * with its own cost profile, so this is now extract-activity's alone.
 *
 * "video-import" (Activiteit uit video) deelt dezelfde pool — één quotum-
 * slot per verwerkte video (niet per fase), afgeschreven zodra transcriptie
 * daadwerkelijk start (zie videoImportProcessor.ts).
 *
 * "youtube-transcript-import"/"youtube-full-import" (YouTube-linkinvoer,
 * zie lib/ai/youtubeImportMode.ts) delen dezelfde pool — losse endpoint-
 * waarden puur voor herkenbaarheid per invoerroute in de logs, de
 * quotumberekening hierboven telt sowieso ALLE ai_usage_log-rijen van de
 * gebruiker deze maand, ongeacht endpoint.
 */
export async function checkAndRecordAiUsage(
  supabase: SupabaseClient,
  userId: string,
  endpoint: "extract-activity" | "video-import" | "youtube-transcript-import" | "youtube-full-import",
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
