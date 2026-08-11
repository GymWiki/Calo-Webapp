import OpenAI from "openai";

// Configurable via env so the model can be changed (e.g. for cost, or a
// newer model) without a code change or redeploy of application logic.
export const EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
export const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

// Tied to the fallback embedding model above (text-embedding-3-small) and
// to the `vector(1536)` column width in schema_kennisbank.sql — if
// OPENAI_EMBEDDING_MODEL is set to a model with a different output
// dimension (e.g. text-embedding-3-large), that column needs a matching
// migration too.
export const EMBEDDING_DIMENSIONS = 1536;

let client: OpenAI | null = null;

// Lazily constructed so importing this module never throws — only calling
// it does, with a Dutch message an admin will actually understand.
export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY ontbreekt. Zet deze omgevingsvariabele om de Kennisbank en AI Lescoach te gebruiken.",
    );
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}
