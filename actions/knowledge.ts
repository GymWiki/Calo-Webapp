"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { processAndStoreDocument } from "@/lib/ai/knowledgeProcessor";
import { getLescoachAdvice } from "@/lib/ai/lescoach";
import {
  createKnowledgeDocumentInputSchema,
  testLescoachQueryInputSchema,
  type CreateKnowledgeDocumentInput,
  type TestLescoachQueryInput,
} from "@/types/knowledge";

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Document verwerken is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const NOT_ADMIN_ERROR = "Alleen beheerders kunnen de Kennisbank beheren.";

type AdminAuthResult =
  | { error: string }
  | { supabase: ReturnType<typeof createClient>; userId: string };

async function requireAdmin(): Promise<AdminAuthResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NOT_LOGGED_IN_ERROR };
  }

  const { data: profile } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: NOT_ADMIN_ERROR };
  }

  return { supabase, userId: user.id };
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
    await processAndStoreDocument(auth.supabase, parsed.data, auth.userId);
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
