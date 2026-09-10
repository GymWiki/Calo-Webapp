// Centrale, makkelijk aan te passen configuratie van modelprijzen — USD per
// 1.000.000 tokens. GymWiki draait volledig op OpenAI (zie openai-client.ts);
// er is geen Anthropic/Claude-integratie, dus alleen OpenAI-modellen staan
// hier. Prijzen hier zijn een momentopname bij het schrijven van deze
// module — controleer https://openai.com/api/pricing bij twijfel en werk
// dit bestand bij zodra OpenAI de tarieven wijzigt; er is verder nergens in
// de app een harde prijs gecodeerd.
export const MODEL_PRICING: Record<
  string,
  { inputPerMillion: number; outputPerMillion: number }
> = {
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
  // Gebruikt voor de "check"-taken (kwaliteitscontrole, AI Lescoach,
  // document-extractie) — zie CHECK_MODEL in openai-client.ts.
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  // Embeddings hebben geen "output" in de gebruikelijke zin — alle kosten
  // zitten in de inputtokens.
  "text-embedding-3-small": { inputPerMillion: 0.02, outputPerMillion: 0 },
};

/**
 * Berekent de geschatte kosten in USD voor één AI-aanroep. Een onbekend
 * model levert bewust 0 op i.p.v. een gok — dat maakt een ontbrekende
 * prijsregel direct zichtbaar in het kostenoverzicht (0,00 voor een model
 * met wél tokens springt eruit) in plaats van een stilzwijgend verkeerd
 * bedrag.
 */
export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}
