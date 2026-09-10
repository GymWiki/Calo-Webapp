"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { checkActivityQuality } from "@/lib/ai/activityQualityCheck";
import { submitActivityInputSchema, type SubmitActivityInput } from "@/types/activity";

type SubmitResult =
  | { error: string }
  | { success: true; status: "approved"; activityId: string }
  | { success: true; status: "rejected"; reason: string };

const GENERIC_ERROR = "Toevoegen is mislukt. Probeer het opnieuw.";

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
    return { error: "Je bent niet ingelogd." };
  }

  const quality = await checkActivityQuality(supabase, user.id, values);

  const { data: activity, error } = await supabase
    .from("activiteiten")
    .insert({
      author_id: user.id,
      status: quality.status,
      rejection_reason: quality.status === "rejected" ? quality.reason : null,
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
