import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/ai/embeddings";
import type { KnowledgeMatch } from "@/types/knowledge";

const DEFAULT_MATCH_THRESHOLD = 0.5;
const DEFAULT_MATCH_COUNT = 5;

const OWN_KNOWLEDGE_BASE_LABEL = "Eigen kennisbank";

async function matchKnowledgeBase(
  supabase: SupabaseClient,
  embedding: number[],
  matchThreshold: number,
  matchCount: number,
): Promise<KnowledgeMatch[]> {
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
    source_label: OWN_KNOWLEDGE_BASE_LABEL,
  }));
}

async function matchKnowledgePackages(
  supabase: SupabaseClient,
  userId: string,
  embedding: number[],
  matchThreshold: number,
  matchCount: number,
): Promise<KnowledgeMatch[]> {
  const { data: rawMatches, error } = await supabase.rpc("match_knowledge_package_chunks", {
    query_embedding: embedding,
    p_user_id: userId,
    match_threshold: matchThreshold,
    match_count: matchCount,
  });

  if (error || !rawMatches || rawMatches.length === 0) {
    return [];
  }

  return (
    rawMatches as {
      id: string;
      document_id: string;
      document_title: string;
      package_name: string;
      content: string;
      similarity: number;
    }[]
  ).map((match) => ({
    id: match.id,
    document_id: match.document_id,
    document_title: match.document_title ?? "Onbekend document",
    content: match.content,
    similarity: match.similarity,
    source_label: match.package_name,
  }));
}

/**
 * Losstaande, herbruikbare retrieval-service: haalt de meest relevante
 * fragmenten op uit zowel de gedeelde, eigen Kennisbank (knowledge_base —
 * altijd meegenomen, ongewijzigd t.o.v. voorheen) als de
 * Standaardbibliotheek-pakketten die déze gebruiker heeft aangevinkt
 * (knowledge_package_chunks, zie knowledge_packages.sql). Beide bronnen
 * worden samengevoegd en puur op relevantie (similarity) geherrangschikt —
 * geen quotum per bron — en afgekapt op matchCount totaal, voor
 * voorspelbare tokenkosten. Gedeeld door de AI-activiteitenchecker
 * (lib/ai/activityQualityCheck.ts), de AI Lescoach (analyze-lesson/route.ts)
 * en de AI-activiteitengenerator (generate-activity/route.ts).
 */
export async function getRelevantKnowledge(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  {
    matchThreshold = DEFAULT_MATCH_THRESHOLD,
    matchCount = DEFAULT_MATCH_COUNT,
  }: { matchThreshold?: number; matchCount?: number } = {},
): Promise<KnowledgeMatch[]> {
  const embedding = await generateEmbedding(query);

  const [baseMatches, packageMatches] = await Promise.all([
    matchKnowledgeBase(supabase, embedding, matchThreshold, matchCount),
    matchKnowledgePackages(supabase, userId, embedding, matchThreshold, matchCount),
  ]);

  return [...baseMatches, ...packageMatches]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);
}

export type KnowledgeSourceSummary = { label: string; count: number };

/**
 * Groepeert matches per bron voor de "Gebaseerd op: eigen kennisbank
 * (3 bronnen), Athletic Skills Model (2 bronnen)"-attributie in de UI
 * (Stap 7). Volgorde: meest-fragmenten-eerst.
 */
export function summarizeKnowledgeSources(matches: KnowledgeMatch[]): KnowledgeSourceSummary[] {
  const counts = new Map<string, number>();
  for (const match of matches) {
    counts.set(match.source_label, (counts.get(match.source_label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
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
        `[${index + 1}] (${match.document_title} — ${match.source_label}) ${match.content}`,
    )
    .join("\n\n");

  return (
    "Gebruik onderstaande officiële vakliteratuur-fragmenten om de vraag " +
    "te beantwoorden of de les te beoordelen. Wijk niet af van de hier " +
    `beschreven didactische principes:\n\n${citedFragments}`
  );
}
