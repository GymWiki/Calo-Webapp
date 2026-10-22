import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { UsedKnowledgeChunk } from "@/lib/ai/knowledgeUsageLogging";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

/**
 * De eerder gelogde "Gebruikte bronnen" voor een activiteit
 * (activity_knowledge_usage, zie lib/ai/knowledgeUsageLogging.ts) — backt de
 * "Gebruikte bronnen"-sectie op de activiteit-detailpagina/editor. RLS regelt
 * de zichtbaarheid (openbaar of eigen activiteit, zelfde regel als
 * activiteiten zelf), dus hier is geen aparte eigenaarschapscheck nodig.
 */
export async function getActivityKnowledgeSources(
  activityId: string,
): Promise<UsedKnowledgeChunk[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("activity_knowledge_usage")
    .select(
      "chunk_id, document_id, document_title, source_label, source_type, package_id, content, similarity",
    )
    .eq("activity_id", activityId)
    .order("created_at", { ascending: true });

  if (error || !data) {
    return [];
  }

  // Dezelfde chunk kan meermaals gelogd zijn (bijv. zowel bij het genereren
  // als bij de daaropvolgende AI-kwaliteitscheck) — hier ontdubbeld op
  // chunk_id zodat UsedSourcesList elk fragment maar één keer toont.
  const byChunkId = new Map<string, UsedKnowledgeChunk>();
  for (const row of data) {
    const chunkId = row.chunk_id as string;
    if (byChunkId.has(chunkId)) continue;
    byChunkId.set(chunkId, {
      chunkId,
      documentId: row.document_id as string,
      documentTitle: row.document_title as string,
      sourceLabel: row.source_label as string,
      sourceType: row.source_type as "knowledge_base" | "knowledge_package",
      packageId: row.package_id as string | null,
      content: row.content as string,
      similarity: (row.similarity as number | null) ?? 0,
    });
  }

  return [...byChunkId.values()];
}
