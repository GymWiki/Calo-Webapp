import type { SupabaseClient } from "@supabase/supabase-js";

import { CHECK_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import { LANGUAGE_CHECK_SYSTEM_PROMPT, languageCheckResultSchema } from "@/lib/ai/languageCheckPrompt";

export {
  LANGUAGE_CHECK_FIELDS,
  arrayFieldToText,
  textToArrayField,
  type LanguageCheckField,
} from "@/lib/ai/languageCheckPrompt";

export type LanguageCheckResult = {
  changed: boolean;
  correctedText: string;
  reason: string;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Losstaande, herbruikbare taalcheck voor één tekstveld (prompt/schema
 * gedeeld met scripts/taalcheck-batch.mts via lib/ai/languageCheckPrompt.ts
 * — zie de toelichting daar) — het bouwblok achter zowel het eenmalige
 * batch-script als toekomstig gebruik als losse controle-stap (bijv. een
 * "Taal controleren"-knop, of een achtergrondtaak voor nieuw toegevoegde
 * activiteiten zonder last_language_check_at). Schrijft zelf niets weg —
 * de aanroeper beslist wat er met het resultaat gebeurt (batch-script:
 * voorstel opslaan in activiteiten_taalcheck_voorstellen; nooit direct de
 * live activiteiten-rij overschrijven).
 */
export async function checkTextLanguage(originalText: string): Promise<LanguageCheckResult> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: CHECK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: LANGUAGE_CHECK_SYSTEM_PROMPT },
      { role: "user", content: originalText },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Geen antwoord van de taalcheck ontvangen.");
  }

  const parsed = languageCheckResultSchema.parse(JSON.parse(raw));

  return {
    ...parsed,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}

/**
 * Zelfde als checkTextLanguage, maar logt daarnaast het AI-gebruik naar
 * ai_usage (feature='taalcheck') — de vorm die de meeste aanroepers
 * (toekomstige "Taal controleren"-knop, achtergrondtaak) willen; los
 * gehouden van checkTextLanguage zelf zodat een aanroeper zonder Supabase-
 * client (bijv. een losse test) de kale check kan gebruiken.
 */
export async function checkTextLanguageAndLog(
  supabase: SupabaseClient,
  userId: string,
  originalText: string,
): Promise<LanguageCheckResult> {
  const result = await checkTextLanguage(originalText);

  await recordAiUsage(supabase, {
    userId,
    feature: "taalcheck",
    model: CHECK_MODEL,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return result;
}
