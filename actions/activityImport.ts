"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { SUPPORTED_DOCUMENT_MIME_TYPES } from "@/lib/ai/documentTypes";
import { runActivityImportJob } from "@/lib/ai/activityImportProcessor";
import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";

// Serverless functions (Vercel) hebben een harde request-bodylimiet van
// 4,5MB, ONGEACHT Next's eigen `serverActions.bodySizeLimit`-config — die
// regelt alleen hoe Next zelf een binnengekomen body parseert, niet het
// platformniveau waarop een te grote aanvraag al wordt afgebroken vóórdat
// Next's code ooit draait. Dat afbreken verschijnt in de browser als
// "TypeError: Failed to fetch": geen serverresponse, geen 413, gewoon een
// nooit voltooide aanvraag. Dít bleek de daadwerkelijke, structurele oorzaak
// van de steeds terugkerende fout op deze upload (bevestigd doordat
// exact hetzelfde bestand, chaos.doelenspel.pdf, ná de architectuurwijziging
// hieronder wél verwerkt kon worden, zonder enige codewijziging aan de
// extractie/AI-mapping zelf) — NIET de webpack "Critical dependency"-
// waarschuwing die een eerdere poging aanwees: die waarschuwing komt ook
// voor in de altijd-werkende Kennisbank-upload (actions/knowledge.ts ->
// lib/ai/knowledgeProcessor.ts -> lib/ai/documentText.ts, dezelfde keten),
// dus die was nooit de boosdoener.
//
// Structurele oplossing: het bestand gaat NOOIT meer als request-body naar
// een Vercel-functie. ActivityImportUploadCard uploadt het rechtstreeks
// vanuit de browser naar Supabase Storage (met de eigen, RLS-beperkte
// sessie van de gebruiker). Deze acties ontvangen daarna alleen de
// storage-path — een paar bytes, ver onder elke limiet — en verwerken het
// bestand server-side via een download uit Storage (geen inkomend-request-
// limiet meer relevant, want dat is uitgaand verkeer vanuit de functie).
//
// `maxDuration` kan niet in dit "use server"-bestand zelf staan (Next staat
// alleen async function-exports toe in zo'n bestand) — die staat daarom in
// app/(protected)/les-maken/page.tsx, de route van waaruit deze acties
// worden aangeroepen.

const GENERIC_ERROR = "Er is iets misgegaan. Probeer het opnieuw.";

type CreateJobResult = { error: string } | { success: true; jobId: string };

/**
 * Registreert een al-geüpload bestand als verwerkingsjob. Doet zelf geen
 * AI-aanroep en dus geen quotumcheck — dat gebeurt pas in
 * runActivityImportJob, vlak vóór de AI-mapping, zodat een bestand dat
 * uiteindelijk geen leesbare tekst blijkt te bevatten nooit een AI-quotum-
 * slot verbruikt.
 */
export async function createActivityImportJob(input: {
  storagePath: string;
  originalFilename: string;
  mimeType: string;
}): Promise<CreateJobResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  if (!(SUPPORTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(input.mimeType)) {
    return { error: "Alleen PDF, Word (.docx), PowerPoint (.pptx) en tekstbestanden worden ondersteund." };
  }

  // De storage-path hoort te beginnen met de eigen user id — zo niet, dan
  // zou het aanmaken van het bestand hoe dan ook al op RLS zijn afgeketst,
  // maar deze check geeft een duidelijkere foutmelding dan een kale
  // Postgres-foutcode als hier ooit een verzonnen path binnenkomt.
  if (!input.storagePath.startsWith(`${user.id}/`)) {
    return { error: "Ongeldig bestandspad." };
  }

  const { data, error } = await supabase
    .from("activity_import_jobs")
    .insert({
      user_id: user.id,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      status: "uploaded",
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createActivityImportJob: kon job niet aanmaken:", error?.message);
    return { error: GENERIC_ERROR };
  }

  console.log(`activity-import[${data.id}]: job aangemaakt (${input.originalFilename})`);
  return { success: true, jobId: data.id };
}

/**
 * Start de daadwerkelijke verwerking (tekstextractie + AI-mapping, zie
 * lib/ai/activityImportProcessor.ts) van een eerder aangemaakte job. De
 * client wacht dit resultaat niet af — die pollt in plaats daarvan
 * getActivityImportJobStatus hieronder, dus een client die deze aanroep
 * zelf laat timeouten (bijv. door een trage AI-respons) merkt daar niets
 * van; `maxDuration` hierboven geeft de pijplijn zelf ruim de tijd om af
 * te ronden.
 */
export async function processActivityImportJob(
  jobId: string,
): Promise<{ error: string } | { success: true }> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  await runActivityImportJob(supabase, user.id, jobId);
  return { success: true };
}

export type ActivityImportJobStatus = {
  status: "uploaded" | "extracting" | "mapping" | "done" | "failed";
  errorStage: "extraction" | "mapping" | null;
  errorMessage: string | null;
  result: ExtractedActivity | null;
};

export async function getActivityImportJobStatus(
  jobId: string,
): Promise<{ error: string } | ({ success: true } & ActivityImportJobStatus)> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { data, error } = await supabase
    .from("activity_import_jobs")
    .select("status, error_stage, error_message, result")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) {
    return { error: "Verwerkingsstatus niet gevonden." };
  }

  return {
    success: true,
    status: data.status,
    errorStage: data.error_stage,
    errorMessage: data.error_message,
    result: data.result,
  };
}
