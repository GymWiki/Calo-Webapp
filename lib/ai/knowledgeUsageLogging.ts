import type { SupabaseClient } from "@supabase/supabase-js";

import type { KnowledgeMatch } from "@/types/knowledge";

export type KnowledgeUsageContext = "generate" | "lescoach" | "checker";

// Serialiseerbare vorm van een gebruikt fragment — dezelfde velden als
// KnowledgeMatch, maar losgekoppeld zodat dit probleemloos via JSON
// (API-response, sessionStorage, server action-argument) kan reizen zonder
// impliciet aan het interne KnowledgeMatch-schema vast te zitten.
export type UsedKnowledgeChunk = {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  sourceLabel: string;
  sourceType: "knowledge_base" | "knowledge_package";
  packageId: string | null;
  content: string;
  similarity: number;
};

export function toUsedKnowledgeChunks(matches: KnowledgeMatch[]): UsedKnowledgeChunk[] {
  return matches.map((match) => ({
    chunkId: match.id,
    documentId: match.document_id,
    documentTitle: match.document_title,
    sourceLabel: match.source_label,
    sourceType: match.source_type,
    packageId: match.package_id,
    content: match.content,
    similarity: match.similarity,
  }));
}

/**
 * Legt vast welke Kennisbank-fragmenten daadwerkelijk zijn meegestuurd naar
 * de AI voor een specifieke activiteit (activity_knowledge_usage, zie de
 * gelijknamige migratie) — backt de "Gebruikte bronnen"-sectie op de
 * activiteit-detailpagina en de "Gebruikt in N activiteiten"-indicatie op
 * /kennisbank. Best-effort: een loggingfout mag de daadwerkelijke AI-actie
 * (genereren/controleren/Lescoach-feedback) nooit blokkeren of laten falen.
 */
export async function logKnowledgeUsage(
  supabase: SupabaseClient,
  activityId: string,
  context: KnowledgeUsageContext,
  chunks: UsedKnowledgeChunk[],
): Promise<void> {
  if (chunks.length === 0) return;

  const { error } = await supabase.from("activity_knowledge_usage").insert(
    chunks.map((chunk) => ({
      activity_id: activityId,
      context,
      source_type: chunk.sourceType,
      chunk_id: chunk.chunkId,
      document_id: chunk.documentId,
      document_title: chunk.documentTitle,
      source_label: chunk.sourceLabel,
      package_id: chunk.packageId,
      content: chunk.content,
      similarity: chunk.similarity,
    })),
  );

  if (error) {
    console.error(`Kennisbank-brontracking loggen mislukt (context=${context}):`, error);
  }
}
