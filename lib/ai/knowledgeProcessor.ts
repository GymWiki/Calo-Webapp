import type { SupabaseClient } from "@supabase/supabase-js";

import { chunkText, generateEmbeddings } from "@/lib/ai/embeddings";
import { extractDocumentText } from "@/lib/ai/documentText";
import { EMBEDDING_MODEL } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";

/**
 * Verwerkt één knowledge_base-document: downloadt het bestand, extraheert
 * de tekst, chunkt/embedt die, en zet de status op 'processed' of 'failed'
 * (met foutmelding). Draait synchroon binnen de upload-server action, dus
 * een falende extractie blokkeert nooit de upload zelf — het document
 * blijft gewoon zichtbaar in de lijst met status 'failed' + reden.
 */
export async function processKnowledgeDocument(
  supabase: SupabaseClient,
  documentId: string,
): Promise<void> {
  const markFailed = async (message: string) => {
    await supabase
      .from("knowledge_base")
      .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
      .eq("id", documentId);
  };

  const { data: document, error: fetchError } = await supabase
    .from("knowledge_base")
    .select("file_url, file_type, uploaded_by")
    .eq("id", documentId)
    .single();

  if (fetchError || !document) {
    return;
  }

  try {
    const response = await fetch(document.file_url);
    if (!response.ok) {
      throw new Error("Bestand kon niet worden gedownload.");
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const text = await extractDocumentText(buffer, document.file_type);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("Er is geen tekst gevonden in dit bestand.");
    }

    const { embeddings, totalTokens } = await generateEmbeddings(chunks);

    await recordAiUsage(supabase, {
      userId: document.uploaded_by,
      feature: "knowledge_base_embedding",
      model: EMBEDDING_MODEL,
      inputTokens: totalTokens,
      outputTokens: 0,
    });

    const { error: chunksError } = await supabase.from("knowledge_base_chunks").insert(
      chunks.map((content, index) => ({
        document_id: documentId,
        chunk_index: index,
        content,
        embedding: embeddings[index],
      })),
    );

    if (chunksError) {
      throw new Error("Fragmenten opslaan is mislukt.");
    }

    await supabase
      .from("knowledge_base")
      .update({ status: "processed", error_message: null, updated_at: new Date().toISOString() })
      .eq("id", documentId);
  } catch (cause) {
    await markFailed(
      cause instanceof Error ? cause.message : "Verwerken van dit document is mislukt.",
    );
  }
}
