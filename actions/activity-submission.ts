"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { checkActivityQuality } from "@/lib/ai/activityQualityCheck";
import { logKnowledgeUsage } from "@/lib/ai/knowledgeUsageLogging";
import { submitActivityInputSchema } from "@/types/activity";

type SubmitResult =
  | { error: string }
  | { success: true; status: "approved"; activityId: string }
  | { success: true; status: "rejected"; reason: string };

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Toevoegen is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";

/**
 * Dient een eerder opgeslagen concept alsnog in: haalt de opgeslagen
 * velden op, draait de kwaliteitscheck en werkt status/rejection_reason/
 * submitted_at bij. `submitted_at` wordt hier pas ververst — niet bij het
 * opslaan van het concept — zodat de maandelijkse bijdrage-teller de
 * indienmaand telt, niet de conceptmaand. Er is geen entry-point meer om
 * een NIEUW concept aan te maken (dat liep via het inmiddels verwijderde
 * "Activiteit toevoegen"-formulier) — dit beheert alleen nog bestaande,
 * al aangemaakte concepten.
 */
export async function submitActivityDraft(activityId: string): Promise<SubmitResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NOT_LOGGED_IN_ERROR };
  }

  const { data: draft, error: fetchError } = await supabase
    .from("activiteiten")
    .select(
      "titel, categorie, leerlijn, doelgroep, beschrijving, beginsituatie, doel, veld, materiaal, regels, loopt, lukt, leeft",
    )
    .eq("id", activityId)
    .eq("author_id", user.id)
    .eq("status", "draft")
    .maybeSingle();

  if (fetchError || !draft) {
    return { error: "Concept niet gevonden." };
  }

  const parsed = submitActivityInputSchema.safeParse({
    ...draft,
    beginsituatie: draft.beginsituatie ?? "",
    veld: draft.veld ?? "",
  });

  if (!parsed.success) {
    return { error: "Dit concept mist verplichte velden. Bewerk het opnieuw voordat je indient." };
  }

  const values = parsed.data;
  const quality = await checkActivityQuality(supabase, user.id, values);

  const { error: updateError } = await supabase
    .from("activiteiten")
    .update({
      status: quality.status,
      rejection_reason: quality.status === "rejected" ? quality.reason : null,
      submitted_at: new Date().toISOString(),
    })
    .eq("id", activityId)
    .eq("author_id", user.id);

  if (updateError) {
    return { error: GENERIC_ERROR };
  }

  await logKnowledgeUsage(supabase, activityId, "checker", quality.usedKnowledgeChunks);

  return quality.status === "approved"
    ? { success: true, status: "approved", activityId }
    : { success: true, status: "rejected", reason: quality.reason };
}

/**
 * Verwijdert een concept. Bewust beperkt tot status 'draft' — eenmaal
 * ingediende activiteiten (pending/approved/rejected) kunnen hier niet mee
 * verwijderd worden, dat is geen onderdeel van deze actie.
 */
export async function deleteActivityDraft(activityId: string): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NOT_LOGGED_IN_ERROR };
  }

  const { error } = await supabase
    .from("activiteiten")
    .delete()
    .eq("id", activityId)
    .eq("author_id", user.id)
    .eq("status", "draft");

  if (error) {
    return { error: "Verwijderen is mislukt. Probeer het opnieuw." };
  }

  return { success: true };
}
