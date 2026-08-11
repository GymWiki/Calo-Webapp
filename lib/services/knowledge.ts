import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { KnowledgeDocument, KnowledgeDocumentWithChunkCount } from "@/types/knowledge";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

export async function getKnowledgeDocuments(): Promise<
  KnowledgeDocumentWithChunkCount[]
> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("knowledge_documents")
    .select("*, knowledge_chunks(count)")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return (
    data as (KnowledgeDocument & { knowledge_chunks: { count: number }[] })[]
  ).map(({ knowledge_chunks, ...document }) => ({
    ...document,
    chunk_count: knowledge_chunks?.[0]?.count ?? 0,
  }));
}
