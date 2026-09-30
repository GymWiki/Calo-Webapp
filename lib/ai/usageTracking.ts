import type { SupabaseClient } from "@supabase/supabase-js";

import { estimateCostUsd } from "./modelPricing";

export type AiUsageFeature =
  | "activity_checker"
  | "ai_lescoach"
  | "knowledge_base_embedding"
  | "activity_import_extraction"
  | "taalcheck"
  | "activity_video_transcription"
  | "activity_video_text_extraction"
  | "activity_video_frame_scoring";

/**
 * Losstaande, herbruikbare logservice voor elke betaalde AI-aanroep — vult
 * de ai_usage-tabel (supabase/migrations/ai_usage_tracking.sql), die het
 * kostenoverzicht voor de eigenaar en de fair-use-limieten voedt.
 * Best-effort: een falende logregel mag de AI-functie zelf nooit
 * blokkeren, dus fouten worden alleen gelogd, nooit doorgegooid.
 */
export async function recordAiUsage(
  supabase: SupabaseClient,
  params: {
    userId: string;
    feature: AiUsageFeature;
    model: string;
    inputTokens: number;
    outputTokens: number;
    /** Gezet voor een teamlid — zie supabase/migrations/team_plans.sql's
     *  ai_usage.team_id, voor de gepoolde limiet + per-team kostenanalyse. */
    teamId?: string | null;
    /** Voor niet-token-gebaseerde kosten (bijv. audiotranscriptie, die per
     *  minuut rekent — zie lib/ai/audioModelPricing.ts). Wanneer gezet,
     *  overschrijft dit de normale token-gebaseerde estimateCostUsd-berekening. */
    costUsdOverride?: number;
  },
): Promise<void> {
  const estimatedCostUsd =
    params.costUsdOverride ?? estimateCostUsd(params.model, params.inputTokens, params.outputTokens);

  const { error } = await supabase.from("ai_usage").insert({
    user_id: params.userId,
    feature: params.feature,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    estimated_cost_usd: estimatedCostUsd,
    team_id: params.teamId ?? null,
  });

  if (error) {
    console.error("Kon AI-gebruik niet loggen:", error.message);
  }
}
