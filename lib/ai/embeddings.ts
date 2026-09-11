import { EMBEDDING_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";

const DEFAULT_CHUNK_SIZE = 800;
const DEFAULT_OVERLAP = 150;

/**
 * Losstaand van knowledgeProcessor.ts (dat ook lib/ai/documentText.ts —
 * en dus pdf-parse/pdfjs-dist — importeert): elke route die alleen wil
 * embedden/matchen (generate-activity, analyze-lesson,
 * activityQualityCheck, via knowledgeRetrieval.ts) mag pdf-parse nooit in
 * z'n module-graaf krijgen. pdfjs-dist's Node-build voert namelijk
 * ongeconditioneerd `new DOMMatrix()` uit op module-top-level — zonder de
 * optionele @napi-rs/canvas-polyfill crasht dát alleen al bij het
 * *importeren* van pdf-parse, nog voordat er iets geparsed wordt. Dat
 * veroorzaakte de "Genereren van de lesvoorbereiding is mislukt"-fout:
 * generate-activity importeerde deze functies voorheen uit
 * knowledgeProcessor.ts, wat pdf-parse ongewild meesleepte.
 */

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

export async function generateEmbeddings(
  texts: string[],
): Promise<{ embeddings: number[][]; totalTokens: number }> {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return {
    embeddings: response.data.map((item) => item.embedding),
    totalTokens: response.usage?.total_tokens ?? 0,
  };
}
