import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type {
  KnowledgeDocument,
  KnowledgeDocumentWithChunkCount,
  UserKnowledgeDocument,
} from "@/types/knowledge";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

type RawDocument = KnowledgeDocument & { knowledge_chunks: { count: number }[] };

function withChunkCount(
  rows: RawDocument[] | null,
): KnowledgeDocumentWithChunkCount[] {
  return (rows ?? []).map(({ knowledge_chunks, ...document }) => ({
    ...document,
    chunk_count: knowledge_chunks?.[0]?.count ?? 0,
  }));
}

// Backs the "shared vakliteratuur" management section on /kennisbank —
// explicitly scoped to defaults so a user's private upload never shows up
// here; that section only manages the shared literature, not other
// people's personal documents.
export async function getKnowledgeDocuments(): Promise<
  KnowledgeDocumentWithChunkCount[]
> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*, knowledge_chunks(count)")
    .eq("is_default", true)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return withChunkCount(data as RawDocument[]);
}

// User-facing /kennisbank page: the shared defaults and this user's own
// uploads, each annotated with this user's resolved on/off toggle state.
export async function getUserKnowledgeOverview(userId: string): Promise<{
  defaults: UserKnowledgeDocument[];
  own: UserKnowledgeDocument[];
}> {
  const supabase = await getServerClient();

  const [defaultsResult, ownResult, preferencesResult] = await Promise.all([
    supabase
      .from("knowledge_documents")
      .select("*, knowledge_chunks(count)")
      .eq("is_default", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("knowledge_documents")
      .select("*, knowledge_chunks(count)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("user_document_preferences")
      .select("document_id, is_active")
      .eq("user_id", userId),
  ]);

  const activeById = new Map(
    (preferencesResult.data ?? []).map((preference) => [
      preference.document_id as string,
      preference.is_active as boolean,
    ]),
  );

  // No preference row yet means the document is active by default — the
  // same COALESCE(udp.is_active, true) rule match_user_knowledge_chunks
  // applies during retrieval.
  function withActiveState(
    rows: RawDocument[] | null,
  ): UserKnowledgeDocument[] {
    return withChunkCount(rows).map((document) => ({
      ...document,
      is_active: activeById.get(document.id) ?? true,
    }));
  }

  return {
    defaults: withActiveState(defaultsResult.data as RawDocument[] | null),
    own: withActiveState(ownResult.data as RawDocument[] | null),
  };
}

// Backs the "AI analyseert op basis van N actieve bronnen" info label near
// the AI Lescoach / Activiteiten Generator triggers.
export async function getActiveKnowledgeSourceCount(
  userId: string,
): Promise<number> {
  const { defaults, own } = await getUserKnowledgeOverview(userId);
  return (
    defaults.filter((document) => document.is_active).length +
    own.filter((document) => document.is_active).length
  );
}
