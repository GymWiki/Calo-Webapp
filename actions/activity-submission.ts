"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { checkActivityQuality } from "@/lib/ai/activityQualityCheck";
import { submitActivityInputSchema, type SubmitActivityInput } from "@/types/activity";

type SubmitResult =
  | { error: string }
  | { success: true; status: "approved"; activityId: string }
  | { success: true; status: "rejected"; reason: string };

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Toevoegen is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";

function toInsertRow(userId: string, values: SubmitActivityInput) {
  return {
    author_id: userId,
    titel: values.titel,
    categorie: values.categorie,
    leerlijn: values.leerlijn,
    doelgroep: values.doelgroep,
    beschrijving: values.beschrijving,
    beginsituatie: values.beginsituatie || null,
    doel: values.doel,
    veld: values.veld || null,
    materiaal: values.materiaal,
    regels: values.regels,
    loopt: values.loopt,
    lukt: values.lukt,
    leeft: values.leeft,
    taalcode: "nl",
    in_gymwiki: true,
  };
}

/**
 * Voegt een nieuwe activiteit toe aan de gedeelde bibliotheek. De status
 * (approved/rejected) wordt hier — server-side, vóór de insert — bepaald
 * door de losstaande kwaliteitscheck (lib/ai/activityQualityCheck.ts): de
 * client kan nooit zelf 'approved' forceren, zie de insert-RLS-policy in
 * subscription_model.sql. De activiteit wordt altijd meteen toegevoegd
 * (insert gebeurt ongeacht status); alleen goedgekeurde activiteiten tellen
 * mee voor de maandelijkse bijdrage-eis (via de activiteiten_sync_
 * contribution-trigger) en verschijnen in de gedeelde bibliotheek.
 */
export async function addActivity(
  input: SubmitActivityInput,
): Promise<SubmitResult> {
  const parsed = submitActivityInputSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Controleer de ingevulde velden en probeer het opnieuw." };
  }

  const values = parsed.data;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NOT_LOGGED_IN_ERROR };
  }

  const quality = await checkActivityQuality(supabase, user.id, values);

  const { data: activity, error } = await supabase
    .from("activiteiten")
    .insert({
      ...toInsertRow(user.id, values),
      status: quality.status,
      rejection_reason: quality.status === "rejected" ? quality.reason : null,
    })
    .select("id")
    .single();

  if (error || !activity) {
    return { error: GENERIC_ERROR };
  }

  return quality.status === "approved"
    ? { success: true, status: "approved", activityId: activity.id }
    : { success: true, status: "rejected", reason: quality.reason };
}

/**
 * Slaat een volledig ingevulde activiteit op als concept: zelfde validatie
 * als addActivity, maar zonder kwaliteitscheck en met status 'draft'. Telt
 * dus niet mee voor de maandelijkse bijdrage-eis totdat 'ie via
 * submitActivityDraft alsnog wordt ingediend.
 */
export async function saveActivityDraft(
  input: SubmitActivityInput,
): Promise<{ error: string } | { success: true; activityId: string }> {
  const parsed = submitActivityInputSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Controleer de ingevulde velden en probeer het opnieuw." };
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NOT_LOGGED_IN_ERROR };
  }

  const { data: activity, error } = await supabase
    .from("activiteiten")
    .insert({
      ...toInsertRow(user.id, parsed.data),
      status: "draft",
      rejection_reason: null,
    })
    .select("id")
    .single();

  if (error || !activity) {
    return { error: "Concept opslaan is mislukt. Probeer het opnieuw." };
  }

  return { success: true, activityId: activity.id };
}

/**
 * Dient een eerder opgeslagen concept alsnog in: haalt de opgeslagen
 * velden op, draait de kwaliteitscheck (zelfde als addActivity) en werkt
 * status/rejection_reason/submitted_at bij. `submitted_at` wordt hier pas
 * ververst — niet bij het opslaan van het concept — zodat de maandelijkse
 * bijdrage-teller de indienmaand telt, niet de conceptmaand.
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
