import type { SupabaseClient } from "@supabase/supabase-js";

import { EMBEDDING_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import type { CreateKnowledgeDocumentInput } from "@/types/knowledge";

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

export type DocumentOwner = {
  // Who created the row — unchanged meaning from before personal uploads
  // existed, kept for admin uploads' audit trail.
  uploadedBy: string;
  // Non-null only for a personal (non-default) upload — the RLS/RPC
  // ownership key. Null for the beheerder's shared vakliteratuur.
  userId: string | null;
  isDefault: boolean;
};

export async function processAndStoreDocument(
  supabase: SupabaseClient,
  input: CreateKnowledgeDocumentInput,
  owner: DocumentOwner,
): Promise<{ documentId: string; chunkCount: number }> {
  const chunks = chunkText(input.content);

  if (chunks.length === 0) {
    throw new Error("Geen tekst om te verwerken.");
  }

  const { data: document, error: documentError } = await supabase
    .from("knowledge_documents")
    .insert({
      title: input.title,
      author: input.author || null,
      category: input.category,
      uploaded_by: owner.uploadedBy,
      user_id: owner.userId,
      is_default: owner.isDefault,
    })
    .select("id")
    .single();

  if (documentError || !document) {
    throw new Error("Document aanmaken is mislukt.");
  }

  try {
    const embeddings = await generateEmbeddings(chunks);

    const { error: chunksError } = await supabase.from("knowledge_chunks").insert(
      chunks.map((content, index) => ({
        document_id: document.id,
        chunk_index: index,
        content,
        embedding: embeddings[index],
      })),
    );

    if (chunksError) {
      throw new Error("Chunks opslaan is mislukt.");
    }
  } catch (cause) {
    // Roll back the document row (cascades to any chunks that did insert).
    await supabase.from("knowledge_documents").delete().eq("id", document.id);
    throw cause instanceof Error ? cause : new Error("Verwerken van document is mislukt.");
  }

  return { documentId: document.id, chunkCount: chunks.length };
}
