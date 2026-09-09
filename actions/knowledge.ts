"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { processKnowledgeDocument } from "@/lib/ai/knowledgeProcessor";
import {
  ALLOWED_KNOWLEDGE_MIME_TYPES,
  KNOWLEDGE_MAX_FILE_SIZE_BYTES,
  uploadKnowledgeDocumentMetaSchema,
} from "@/types/knowledge";

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Uploaden is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const BUCKET = "kennisbank-documenten";

type AuthResult =
  | { error: string }
  | { supabase: ReturnType<typeof createClient>; userId: string };

async function requireAuth(): Promise<AuthResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NOT_LOGGED_IN_ERROR };
  }

  return { supabase, userId: user.id };
}

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/**
 * Uploadt één document naar de gedeelde Kennisbank: bestand naar Storage,
 * metadata naar knowledge_base, en verwerkt het direct (tekst extraheren +
 * chunken/embedden) — synchroon binnen deze action, zodat de gebruiker de
 * uiteindelijke status (processed/failed) al bij de eerste refresh ziet in
 * plaats van permanent op "pending" te blijven staan.
 */
export async function uploadKnowledgeDocument(formData: FormData): Promise<ActionResult> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Kies een bestand om te uploaden." };
  }

  if (!(ALLOWED_KNOWLEDGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Alleen PDF, Word (.docx) en tekstbestanden worden ondersteund." };
  }

  if (file.size > KNOWLEDGE_MAX_FILE_SIZE_BYTES) {
    return { error: "Bestand is te groot (max 20 MB)." };
  }

  const parsed = uploadKnowledgeDocumentMetaSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    tags: parseTags(formData.get("tags")),
  });

  if (!parsed.success) {
    return { error: "Controleer de ingevulde velden en probeer het opnieuw." };
  }

  const { supabase, userId } = auth;
  const path = `${userId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return { error: GENERIC_ERROR };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { data: document, error: insertError } = await supabase
    .from("knowledge_base")
    .insert({
      title: parsed.data.title,
      description: parsed.data.description || null,
      tags: parsed.data.tags,
      file_url: publicUrl,
      file_type: file.type,
      uploaded_by: userId,
    })
    .select("id")
    .single();

  if (insertError || !document) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: GENERIC_ERROR };
  }

  await processKnowledgeDocument(supabase, document.id);

  revalidatePath("/kennisbank");
  return { success: true };
}

/**
 * Verwijdert een document (en, via cascade, zijn chunks). RLS
 * ("knowledge_base_delete_own") is de daadwerkelijke handhaving — een
 * document dat de aanroeper niet zelf uploadde matcht simpelweg niet.
 */
export async function deleteKnowledgeDocument(documentId: string): Promise<ActionResult> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const { data: document } = await auth.supabase
    .from("knowledge_base")
    .select("file_url")
    .eq("id", documentId)
    .maybeSingle();

  const { error } = await auth.supabase.from("knowledge_base").delete().eq("id", documentId);

  if (error) {
    return { error: "Verwijderen is mislukt. Probeer het opnieuw." };
  }

  const path = document?.file_url.split(`/${BUCKET}/`)[1];
  if (path) {
    await auth.supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);
  }

  revalidatePath("/kennisbank");
  return { success: true };
}
