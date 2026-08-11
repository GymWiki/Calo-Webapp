import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const CHAT_MODEL = "gpt-4o-mini";

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
