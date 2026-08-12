import type { SupabaseClient } from "@supabase/supabase-js";

import { generateEmbedding } from "@/lib/ai/knowledgeProcessor";
import { CHAT_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import type { KnowledgeMatch } from "@/types/knowledge";

const DEFAULT_MATCH_THRESHOLD = 0.5;
const DEFAULT_MATCH_COUNT = 5;

const LESCOACH_SYSTEM_PROMPT =
  "Je bent de AI Lescoach van Calo, een assistent voor docenten en " +
  "stagiairs Lichamelijke Opvoeding. Geef praktische, didactisch " +
  "onderbouwde feedback en suggesties voor lessen bewegingsonderwijs, " +
  "in het Nederlands.";

/**
 * Embeds `query`, then retrieves the top matching chunks from the
 * Kennisbank via the `match_user_knowledge_chunks` RPC — scoped to `userId`
 * so only that user's active documents (their own uploads + active
 * defaults) are ever returned. This is the retrieval half of the RAG
 * pipeline — call it from any AI feature (Lescoach, Activiteiten
 * Generator, ...) before constructing that feature's system prompt with
 * `buildKnowledgePromptSection`.
 */
export async function getRelevantKnowledge(
  supabase: SupabaseClient,
  query: string,
  userId: string,
  {
    matchThreshold = DEFAULT_MATCH_THRESHOLD,
    matchCount = DEFAULT_MATCH_COUNT,
  }: { matchThreshold?: number; matchCount?: number } = {},
): Promise<KnowledgeMatch[]> {
  const embedding = await generateEmbedding(query);

  const { data: rawMatches, error } = await supabase.rpc("match_user_knowledge_chunks", {
    query_embedding: embedding,
    p_user_id: userId,
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
    .from("knowledge_documents")
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
  }));
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
        `[${index + 1}] (${match.document_title}) ${match.content}`,
    )
    .join("\n\n");

  return (
    "Gebruik onderstaande officiële vakliteratuur-fragmenten om de vraag " +
    "te beantwoorden of de les te beoordelen. Wijk niet af van de hier " +
    `beschreven didactische principes:\n\n${citedFragments}`
  );
}

/**
 * The AI Lescoach integration point: retrieves relevant Kennisbank
 * knowledge for `userQuery`, injects it into the system prompt, and
 * returns a grounded answer plus the sources it was based on.
 */
export async function getLescoachAdvice(
  supabase: SupabaseClient,
  userQuery: string,
  userId: string,
): Promise<{ answer: string; matches: KnowledgeMatch[] }> {
  const matches = await getRelevantKnowledge(supabase, userQuery, userId);
  const knowledgeSection = buildKnowledgePromptSection(matches);

  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: CHAT_MODEL,
    messages: [
      {
        role: "system",
        content: `${LESCOACH_SYSTEM_PROMPT}\n\n${knowledgeSection}`,
      },
      { role: "user", content: userQuery },
    ],
  });

  const answer = completion.choices[0]?.message?.content;

  if (!answer) {
    throw new Error("AI Lescoach gaf geen antwoord terug. Probeer het opnieuw.");
  }

  return { answer, matches };
}
