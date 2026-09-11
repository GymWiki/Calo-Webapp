"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { isLibraryAdmin } from "@/lib/adminAccess";
import { processKnowledgePackageDocument } from "@/lib/ai/knowledgePackageProcessor";
import {
  ALLOWED_PACKAGE_MIME_TYPES,
  PACKAGE_MAX_FILE_SIZE_BYTES,
  createPackageInputSchema,
  uploadPackageDocumentMetaSchema,
} from "@/types/knowledgePackages";

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Actie is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const NOT_ADMIN_ERROR = "Je hebt geen toegang tot het bibliotheekbeheer.";
const BUCKET = "knowledge-packages";

type AdminAuthResult =
  | { error: string }
  | { supabase: ReturnType<typeof createClient>; userId: string };

async function requireLibraryAdmin(): Promise<AdminAuthResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NOT_LOGGED_IN_ERROR };
  }

  if (!isLibraryAdmin(user.email)) {
    return { error: NOT_ADMIN_ERROR };
  }

  return { supabase, userId: user.id };
}

/**
 * Nieuw pakket aanmaken (leeg — documenten komen er apart bij via
 * uploadKnowledgePackageDocument). is_active/default_enabled staan bewust
 * op de kolomdefaults (true/false) — de beheerder zet default_enabled pas
 * aan via SQL/een latere actie zodra de rechten voor dit specifieke pakket
 * zijn bevestigd (zie knowledge_packages.sql-intro).
 */
export async function createKnowledgePackage(formData: FormData): Promise<ActionResult> {
  const auth = await requireLibraryAdmin();
  if ("error" in auth) return { error: auth.error };

  const parsed = createPackageInputSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    sourceAttribution: formData.get("sourceAttribution") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Controleer de ingevulde velden." };
  }

  const { error } = await auth.supabase.from("knowledge_packages").insert({
    name: parsed.data.name,
    description: parsed.data.description || null,
    source_attribution: parsed.data.sourceAttribution || null,
  });

  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/kennisbank/beheer");
  return { success: true };
}

export async function setKnowledgePackageActive(
  packageId: string,
  isActive: boolean,
): Promise<ActionResult> {
  const auth = await requireLibraryAdmin();
  if ("error" in auth) return { error: auth.error };

  const { error } = await auth.supabase
    .from("knowledge_packages")
    .update({ is_active: isActive })
    .eq("id", packageId);

  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/kennisbank/beheer");
  revalidatePath("/kennisbank");
  return { success: true };
}

export async function deleteKnowledgePackage(packageId: string): Promise<ActionResult> {
  const auth = await requireLibraryAdmin();
  if ("error" in auth) return { error: auth.error };

  // Documenten/chunks verdwijnen via ON DELETE CASCADE; de bijbehorende
  // Storage-bestanden blijven achter (geen kritiek pad — een beheerder kan
  // die desgewenst los opruimen in de Supabase-dashboard) om deze actie
  // eenvoudig en snel te houden.
  const { error } = await auth.supabase.from("knowledge_packages").delete().eq("id", packageId);

  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/kennisbank/beheer");
  revalidatePath("/kennisbank");
  return { success: true };
}

/**
 * Uploadt één volledig document naar een pakket: bestand naar de private
 * `knowledge-packages`-bucket, metadata naar knowledge_package_documents, en
 * verwerkt het direct (zelfde synchrone patroon als
 * actions/knowledge.ts#uploadKnowledgeDocument).
 */
export async function uploadKnowledgePackageDocument(formData: FormData): Promise<ActionResult> {
  const auth = await requireLibraryAdmin();
  if ("error" in auth) return { error: auth.error };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Kies een bestand om te uploaden." };
  }

  if (!(ALLOWED_PACKAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Alleen PDF, Word (.docx) en tekstbestanden worden ondersteund." };
  }

  if (file.size > PACKAGE_MAX_FILE_SIZE_BYTES) {
    return { error: "Bestand is te groot (max 20 MB)." };
  }

  const parsed = uploadPackageDocumentMetaSchema.safeParse({
    packageId: formData.get("packageId"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Controleer de ingevulde velden." };
  }

  const { supabase, userId } = auth;
  const path = `${parsed.data.packageId}/${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type });

  if (uploadError) {
    return { error: GENERIC_ERROR };
  }

  const { data: document, error: insertError } = await supabase
    .from("knowledge_package_documents")
    .insert({
      package_id: parsed.data.packageId,
      title: parsed.data.title,
      original_file_url: path,
      file_type: file.type,
    })
    .select("id")
    .single();

  if (insertError || !document) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { error: GENERIC_ERROR };
  }

  await processKnowledgePackageDocument(supabase, document.id, userId);

  revalidatePath("/kennisbank/beheer");
  return { success: true };
}

/** Herstart verwerking voor een (meestal mislukt) document — Stap 9. */
export async function reprocessKnowledgePackageDocument(documentId: string): Promise<ActionResult> {
  const auth = await requireLibraryAdmin();
  if ("error" in auth) return { error: auth.error };

  await processKnowledgePackageDocument(auth.supabase, documentId, auth.userId);

  revalidatePath("/kennisbank/beheer");
  return { success: true };
}

export async function deleteKnowledgePackageDocument(documentId: string): Promise<ActionResult> {
  const auth = await requireLibraryAdmin();
  if ("error" in auth) return { error: auth.error };

  const { data: document } = await auth.supabase
    .from("knowledge_package_documents")
    .select("original_file_url")
    .eq("id", documentId)
    .maybeSingle();

  const { error } = await auth.supabase
    .from("knowledge_package_documents")
    .delete()
    .eq("id", documentId);

  if (error) return { error: GENERIC_ERROR };

  if (document?.original_file_url) {
    await auth.supabase.storage.from(BUCKET).remove([document.original_file_url]);
  }

  revalidatePath("/kennisbank/beheer");
  return { success: true };
}

/**
 * Gebruikerskant: pakket aan/uit voor de eigen AI-context (Stap 6). RLS
 * (ukp_*-policies) is de echte handhaving van "alleen eigen voorkeur" — deze
 * action doet alleen de auth-check + upsert.
 */
export async function setKnowledgePackagePreference(
  packageId: string,
  enabled: boolean,
): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NOT_LOGGED_IN_ERROR };
  }

  const { error } = await supabase
    .from("user_knowledge_preferences")
    .upsert(
      { user_id: user.id, package_id: packageId, enabled, updated_at: new Date().toISOString() },
      { onConflict: "user_id,package_id" },
    );

  if (error) return { error: GENERIC_ERROR };

  revalidatePath("/kennisbank");
  return { success: true };
}
