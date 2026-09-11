import type { SupabaseClient } from "@supabase/supabase-js";

import { extractDocumentText } from "@/lib/ai/documentText";
import { chunkText, generateEmbeddings } from "@/lib/ai/embeddings";
import { EMBEDDING_MODEL } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";

/**
 * Verwerkt één Standaardbibliotheek-document: downloadt het volledige
 * bestand uit de private `knowledge-packages`-bucket, extraheert de tekst,
 * chunkt/embedt die, en zet processing_status op 'processed' of 'failed'
 * (met foutmelding, zichtbaar in /kennisbank/beheer). Bewust hetzelfde
 * synchrone patroon als lib/ai/knowledgeProcessor.ts's
 * processKnowledgeDocument (geen aparte Edge Function/queue): kleinschalige,
 * door de beheerder geïnitieerde uploads, dus geen achtergrondinfrastructuur
 * nodig — en dit houdt beide verwerkingspaden consistent.
 */
export async function processKnowledgePackageDocument(
  supabase: SupabaseClient,
  documentId: string,
  adminUserId: string,
): Promise<void> {
  const markStatus = async (
    status: "processing" | "processed" | "failed",
    errorMessage: string | null = null,
  ) => {
    await supabase
      .from("knowledge_package_documents")
      .update({
        processing_status: status,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);
  };

  const { data: document, error: fetchError } = await supabase
    .from("knowledge_package_documents")
    .select("original_file_url, file_type")
    .eq("id", documentId)
    .single();

  if (fetchError || !document) {
    return;
  }

  await markStatus("processing");

  try {
    // original_file_url is een opslagpad in de private bucket (geen publieke
    // URL, zie knowledge_packages.sql) — dus ophalen via de Storage-API met
    // de (admin-)sessie van de aanroeper, niet via een kale fetch().
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from("knowledge-packages")
      .download(document.original_file_url);

    if (downloadError || !fileBlob) {
      throw new Error("Bestand kon niet worden gedownload uit Storage.");
    }

    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    const text = await extractDocumentText(buffer, document.file_type);
    const chunks = chunkText(text);

    if (chunks.length === 0) {
      throw new Error("Er is geen tekst gevonden in dit bestand.");
    }

    const { embeddings, totalTokens } = await generateEmbeddings(chunks);

    await recordAiUsage(supabase, {
      userId: adminUserId,
      feature: "knowledge_base_embedding",
      model: EMBEDDING_MODEL,
      inputTokens: totalTokens,
      outputTokens: 0,
    });

    const { error: chunksError } = await supabase.from("knowledge_package_chunks").insert(
      chunks.map((chunkTextValue, index) => ({
        document_id: documentId,
        chunk_index: index,
        chunk_text: chunkTextValue,
        embedding: embeddings[index],
      })),
    );

    if (chunksError) {
      throw new Error("Fragmenten opslaan is mislukt.");
    }

    await markStatus("processed");
  } catch (cause) {
    await markStatus(
      "failed",
      cause instanceof Error ? cause.message : "Verwerken van dit document is mislukt.",
    );
  }
}
