"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { processAndStoreDocument } from "@/lib/ai/knowledgeProcessor";
import { getLescoachAdvice } from "@/lib/ai/lescoach";
import {
  createKnowledgeDocumentInputSchema,
  createPersonalKnowledgeDocumentInputSchema,
  testLescoachQueryInputSchema,
  toggleDocumentActiveInputSchema,
  type CreateKnowledgeDocumentInput,
  type CreatePersonalKnowledgeDocumentInput,
  type TestLescoachQueryInput,
  type ToggleDocumentActiveInput,
} from "@/types/knowledge";

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Document verwerken is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const NOT_ADMIN_ERROR = "Alleen beheerders kunnen de Kennisbank beheren.";

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

async function requireAdmin(): Promise<AuthResult> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return auth;
  }

  const { data: profile } = await auth.supabase
    .from("users")
    .select("role")
    .eq("id", auth.userId)
    .single();

  if (profile?.role !== "admin") {
    return { error: NOT_ADMIN_ERROR };
  }

  return auth;
}

export async function addKnowledgeDocument(
  input: CreateKnowledgeDocumentInput,
): Promise<ActionResult> {
  const parsed = createKnowledgeDocumentInputSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Controleer de ingevulde velden en probeer het opnieuw." };
  }

  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  try {
    await processAndStoreDocument(auth.supabase, parsed.data, {
      uploadedBy: auth.userId,
      userId: null,
      isDefault: true,
    });
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : GENERIC_ERROR };
  }

  revalidatePath("/admin/kennisbank");
  return { success: true };
}

export async function deleteKnowledgeDocument(
  documentId: string,
): Promise<ActionResult> {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const { error } = await auth.supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    return { error: "Document verwijderen is mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/admin/kennisbank");
  return { success: true };
}

// The user-facing counterparts below back the /kennisbank page (Sectie 2:
// "Mijn Uploads") — any logged-in user, not just admins, since every user
// manages their own personal documents.

export async function addPersonalKnowledgeDocument(
  input: CreatePersonalKnowledgeDocumentInput,
): Promise<ActionResult> {
  const parsed = createPersonalKnowledgeDocumentInputSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Controleer de ingevulde velden en probeer het opnieuw." };
  }

  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  try {
    // Personal uploads (eigen lesplannen/stagescripts/artikelen) don't fit
    // the beheerder's curated categories, so they're filed under "overig"
    // — the category picker stays admin-only, keeping this upload form to
    // just title + tekst.
    await processAndStoreDocument(
      auth.supabase,
      { title: parsed.data.title, category: "overig", content: parsed.data.content },
      { uploadedBy: auth.userId, userId: auth.userId, isDefault: false },
    );
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : GENERIC_ERROR };
  }

  revalidatePath("/kennisbank");
  return { success: true };
}

export async function deleteOwnKnowledgeDocument(
  documentId: string,
): Promise<ActionResult> {
  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  // RLS ("knowledge_documents_delete_own") is the actual enforcement here —
  // a document the caller doesn't own simply won't match and nothing is
  // deleted. Chunks disappear via ON DELETE CASCADE.
  const { error } = await auth.supabase
    .from("knowledge_documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    return { error: "Document verwijderen is mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/kennisbank");
  return { success: true };
}

export async function toggleDocumentActive(
  input: ToggleDocumentActiveInput,
): Promise<ActionResult> {
  const parsed = toggleDocumentActiveInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Ongeldige aanvraag." };
  }

  const auth = await requireAuth();
  if ("error" in auth) {
    return { error: auth.error };
  }

  const { error } = await auth.supabase.from("user_document_preferences").upsert(
    {
      user_id: auth.userId,
      document_id: parsed.data.documentId,
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,document_id" },
  );

  if (error) {
    return { error: "Voorkeur opslaan is mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/kennisbank");
  return { success: true };
}

type TestLescoachResult =
  | { error: string }
  | {
      success: true;
      answer: string;
      sources: { title: string; similarity: number }[];
    };

export async function testLescoachQuery(
  input: TestLescoachQueryInput,
): Promise<TestLescoachResult> {
  const parsed = testLescoachQueryInputSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Stel een vraag van minimaal 3 tekens." };
  }

  const auth = await requireAdmin();
  if ("error" in auth) {
    return { error: auth.error };
  }

  try {
    const { answer, matches } = await getLescoachAdvice(
      auth.supabase,
      parsed.data.query,
      auth.userId,
    );

    return {
      success: true,
      answer,
      sources: matches.map((match) => ({
        title: match.document_title,
        similarity: match.similarity,
      })),
    };
  } catch (cause) {
    return {
      error: cause instanceof Error ? cause.message : GENERIC_ERROR,
    };
  }
}
