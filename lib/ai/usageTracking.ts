import type { SupabaseClient } from "@supabase/supabase-js";

import { estimateCostUsd } from "@/lib/ai/modelPricing";

export type AiUsageFeature =
  | "activity_checker"
  | "lesson_generator"
  | "ai_lescoach"
  | "knowledge_base_embedding";

/**
 * Losstaande, herbruikbare logservice voor elke betaalde AI-aanroep — vult
 * de ai_usage-tabel (supabase/migrations/ai_usage_tracking.sql), die het
 * kostenoverzicht voor de eigenaar en de lessengenerator-fair-use-limiet
 * voedt. Best-effort: een falende logregel mag de AI-functie zelf nooit
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
  },
): Promise<void> {
  const estimatedCostUsd = estimateCostUsd(params.model, params.inputTokens, params.outputTokens);

  const { error } = await supabase.from("ai_usage").insert({
    user_id: params.userId,
    feature: params.feature,
    model: params.model,
    input_tokens: params.inputTokens,
    output_tokens: params.outputTokens,
    estimated_cost_usd: estimatedCostUsd,
  });

  if (error) {
    console.error("Kon AI-gebruik niet loggen:", error.message);
  }
}
