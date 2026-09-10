import type { SupabaseClient } from "@supabase/supabase-js";

import { extractDocumentText } from "@/lib/ai/documentText";
import { EMBEDDING_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 150;

/**
 * Splits text into overlapping ~500-1000 char chunks, breaking on paragraph
 * boundaries where possible so a chunk doesn't cut a sentence in half.
 */
export function chunkText(
  text: string,
  { chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_OVERLAP } = {},
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;

    if (candidate.length <= chunkSize) {
      current = candidate;
      continue;
    }

    if (current) {
      chunks.push(current);
      const tail = current.slice(Math.max(0, current.length - overlap));
      current = tail ? `${tail}\n\n${paragraph}` : paragraph;
    } else {
      current = paragraph;
    }

    // A single paragraph (or tail + paragraph) longer than chunkSize: hard-split it.
    while (current.length > chunkSize) {
      chunks.push(current.slice(0, chunkSize));
      current = current.slice(Math.max(0, chunkSize - overlap));
    }
  }

  if (current) chunks.push(current);

  return chunks;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}

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
    .select("file_url, file_type")
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

    const embeddings = await generateEmbeddings(chunks);

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
