import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import type { KnowledgeBaseDocument, KnowledgeBaseDocumentWithUploader } from "@/types/knowledge";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

/**
 * De volledige, gedeelde Kennisbank-lijst voor het overzicht op
 * /kennisbank — nieuwste eerst, met de naam van de indiener erbij.
 */
export async function getAllKnowledgeDocuments(): Promise<
  KnowledgeBaseDocumentWithUploader[]
> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("knowledge_base")
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  const documents = data as KnowledgeBaseDocument[];
  const uploaderIds = [...new Set(documents.map((document) => document.uploaded_by))];

  const { data: uploaders } = await supabase
    .from("users")
    .select("id, first_name, last_name")
    .in("id", uploaderIds);

  const nameById = new Map(
    (uploaders ?? []).map((user) => [
      user.id as string,
      `${user.first_name} ${user.last_name}`.trim(),
    ]),
  );

  return documents.map((document) => ({
    ...document,
    uploader_name: nameById.get(document.uploaded_by) ?? "Onbekende gebruiker",
  }));
}

/**
 * Aantal succesvol verwerkte documenten — backt het "AI baseert zich op N
 * bronnen"-informatielabel bij de AI Lescoach / Activiteiten Generator
 * (components/KnowledgeSourceHint.tsx). Geen per-gebruiker scoping meer:
 * de hele Kennisbank is gedeeld.
 */
export async function getKnowledgeBaseDocumentCount(): Promise<number> {
  const supabase = await getServerClient();

  const { count } = await supabase
    .from("knowledge_base")
    .select("id", { count: "exact", head: true })
    .eq("status", "processed");

  return count ?? 0;
}
