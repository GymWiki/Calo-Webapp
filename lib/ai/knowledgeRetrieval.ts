import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/ai/knowledgeProcessor";
import type { KnowledgeMatch } from "@/types/knowledge";

const DEFAULT_MATCH_THRESHOLD = 0.5;
const DEFAULT_MATCH_COUNT = 5;

/**
 * Losstaande, herbruikbare retrieval-service: haalt de meest relevante
 * Kennisbank-fragmenten op voor een query. Gedeeld door de AI-
 * activiteitenchecker (lib/ai/activityQualityCheck.ts) en de AI-
 * activiteitengenerator (app/api/ai/generate-activity/route.ts) — beide
 * roepen dit aan in plaats van zelf te embedden/matchen. Geen
 * gebruikersscoping meer: de Kennisbank is nu één gedeelde bron voor
 * iedereen (zie supabase/migrations/knowledge_base_simplify.sql).
 */
export async function getRelevantKnowledge(
  supabase: SupabaseClient,
  query: string,
  {
    matchThreshold = DEFAULT_MATCH_THRESHOLD,
    matchCount = DEFAULT_MATCH_COUNT,
  }: { matchThreshold?: number; matchCount?: number } = {},
): Promise<KnowledgeMatch[]> {
  const embedding = await generateEmbedding(query);

  const { data: rawMatches, error } = await supabase.rpc("match_knowledge_base_chunks", {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error || !rawMatches || rawMatches.length === 0) {
    return [];
  }

  const documentIds = [
    ...new Set(rawMatches.map((match: { document_id: string }) => match.document_id)),
  ];

  const { data: documents } = await supabase
    .from("knowledge_base")
    .select("id, title")
    .in("id", documentIds);

  const titleById = new Map(
    (documents ?? []).map((document: { id: string; title: string }) => [
      document.id,
      document.title,
    ]),
  );

  return (
    rawMatches as {
      id: string;
      document_id: string;
      content: string;
      similarity: number;
    }[]
  ).map((match) => ({
    ...match,
    document_title: titleById.get(match.document_id) ?? "Onbekend document",
  }));
}

/**
 * Formats retrieved chunks into the exact grounding instruction the AI
 * prompts should carry — the AI is told not to deviate from the sourced
 * didactic principles.
 */
export function buildKnowledgePromptSection(matches: KnowledgeMatch[]): string {
  if (matches.length === 0) {
    return "Er zijn geen relevante fragmenten gevonden in de Kennisbank. " +
      "Baseer je antwoord op algemene didactische kennis en vermeld dat " +
      "er geen brondocumenten beschikbaar waren.";
  }

  const citedFragments = matches
    .map(
      (match, index) =>
        `[${index + 1}] (${match.document_title}) ${match.content}`,
    )
    .join("\n\n");

  return (
    "Gebruik onderstaande officiële vakliteratuur-fragmenten om de vraag " +
    "te beantwoorden of de les te beoordelen. Wijk niet af van de hier " +
    `beschreven didactische principes:\n\n${citedFragments}`
  );
}
