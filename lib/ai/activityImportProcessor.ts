import { extractDocumentText } from "@/lib/ai/documentText";
import { extractActivityFromText } from "@/lib/ai/activityImportExtraction";
import { CHECK_MODEL } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import { checkAndRecordAiUsage } from "@/lib/ai/usage";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "activity-imports";

const EXTRACTION_ERROR =
  "Kon geen tekst uit dit bestand halen. Probeer een ander bestand of vul de activiteit handmatig in.";
const AI_MAPPING_ERROR =
  "De AI kon de inhoud van dit bestand niet goed omzetten naar een activiteit. Probeer het opnieuw of vul de activiteit handmatig in.";
const QUOTA_ERROR =
  "Je hebt je AI-checks voor deze maand gebruikt. Probeer het volgende maand opnieuw.";

type OpenAiLikeError = { status?: number; type?: string; code?: string; message: string };

function isOpenAiApiError(cause: unknown): cause is OpenAiLikeError {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "message" in cause &&
    ("status" in cause || "type" in cause || "code" in cause)
  );
}

function logFailure(jobId: string, stage: string, cause: unknown) {
  if (isOpenAiApiError(cause)) {
    console.error(
      `activity-import[${jobId}] (${stage}): OpenAI API-fout (status ${cause.status ?? "onbekend"}, ` +
        `type ${cause.type ?? "onbekend"}, code ${cause.code ?? "onbekend"}): ${cause.message}`,
    );
    return;
  }
  console.error(`activity-import[${jobId}] (${stage}): onverwachte fout:`, cause);
}

function aiMappingUserMessage(cause: unknown): string {
  if (isOpenAiApiError(cause)) {
    if (cause.status === 429) {
      return "De AI-service zit tijdelijk aan de limiet. Probeer het over een paar minuten opnieuw.";
    }
    if (cause.status && cause.status >= 500) {
      return "De AI-service is momenteel niet bereikbaar. Probeer het opnieuw.";
    }
  }
  return AI_MAPPING_ERROR;
}

async function updateJob(
  supabase: SupabaseClient,
  jobId: string,
  patch: Record<string, unknown>,
) {
  const { error } = await supabase.from("activity_import_jobs").update(patch).eq("id", jobId);
  if (error) {
    console.error(`activity-import[${jobId}]: kon jobstatus niet bijwerken:`, error.message);
  }
}

async function failJob(
  supabase: SupabaseClient,
  jobId: string,
  stage: "extraction" | "mapping",
  message: string,
) {
  console.error(`activity-import[${jobId}]: mislukt in stage=${stage}: ${message}`);
  await updateJob(supabase, jobId, {
    status: "failed",
    error_stage: stage,
    error_message: message,
  });
}

/**
 * Voert de volledige verwerkingspijplijn van een activity-import-job uit:
 * bestand ophalen uit Storage -> tekst extraheren -> AI-mapping -> resultaat
 * wegschrijven. Bewust NIET een "use server"-bestand en niet rechtstreeks
 * geïmporteerd door een route/actie die zelf de request-body zou moeten
 * verwerken — dit ontvangt alleen een jobId, en haalt het bestand zelf op
 * uit Storage (uitgaand verkeer vanuit de functie, dus geen inkomend-
 * request-bodylimiet meer relevant). Elke stap logt expliciet met het jobId
 * erin, zodat een toekomstig probleem in seconden te lokaliseren is i.p.v.
 * dagen puzzelen over welke stap precies faalde.
 */
export async function runActivityImportJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
): Promise<void> {
  // Atomisch claimen: alleen doorgaan als de job nog 'uploaded' is. Voorkomt
  // dubbele verwerking als de client processActivityImportJob per ongeluk
  // twee keer aanroept (bijv. een dubbele klik) terwijl de eerste aanroep
  // nog bezig is.
  const { data: claimed, error: claimError } = await supabase
    .from("activity_import_jobs")
    .update({ status: "extracting" })
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("status", "uploaded")
    .select("storage_path, mime_type")
    .maybeSingle();

  if (claimError) {
    console.error(`activity-import[${jobId}]: kon job niet claimen:`, claimError.message);
    return;
  }

  if (!claimed) {
    console.log(`activity-import[${jobId}]: al geclaimd of niet gevonden — overgeslagen.`);
    return;
  }

  console.log(`activity-import[${jobId}]: bestand ophalen uit Storage (${claimed.storage_path})`);

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(claimed.storage_path);

  if (downloadError || !fileBlob) {
    console.error(`activity-import[${jobId}]: kon bestand niet ophalen uit Storage:`, downloadError?.message);
    await failJob(
      supabase,
      jobId,
      "extraction",
      "Kon het geüploade bestand niet ophalen. Probeer opnieuw te uploaden.",
    );
    return;
  }

  let text: string;
  try {
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    text = await extractDocumentText(buffer, claimed.mime_type);
  } catch (cause) {
    logFailure(jobId, "extractie", cause);
    await failJob(supabase, jobId, "extraction", cause instanceof Error ? cause.message : EXTRACTION_ERROR);
    return;
  }

  if (!text.trim()) {
    await failJob(
      supabase,
      jobId,
      "extraction",
      "Er is geen leesbare tekst gevonden in dit bestand. Is het een gescand document zonder tekstlaag? Vul de activiteit dan handmatig in.",
    );
    return;
  }

  console.log(`activity-import[${jobId}]: extractie klaar (${text.length} tekens) — AI-mapping gestart`);
  await updateJob(supabase, jobId, { status: "mapping" });

  const usage = await checkAndRecordAiUsage(supabase, userId, "extract-activity");
  if (!usage.allowed) {
    await failJob(supabase, jobId, "mapping", QUOTA_ERROR);
    return;
  }

  try {
    const { activity, inputTokens, outputTokens } = await extractActivityFromText(text, jobId);

    await recordAiUsage(supabase, {
      userId,
      feature: "activity_import_extraction",
      model: CHECK_MODEL,
      inputTokens,
      outputTokens,
    });

    if (!activity.isMovementActivity) {
      await failJob(
        supabase,
        jobId,
        "mapping",
        "Dit document lijkt geen bewegingsactiviteit of lesvoorbereiding te bevatten. Controleer het bestand, of vul de activiteit handmatig in.",
      );
      return;
    }

    // Stap 4 van de brief: een leeg gebleven titel terwijl het document
    // duidelijk substantiële inhoud had, is het duidelijkste signaal dat de
    // AI iets miste (situatie a, geen bug in het document zelf) — apart
    // loggen zodat dit patroon herkenbaar blijft voor toekomstige
    // promptverfijning, los van de gewone jobstatus.
    if (!activity.title && text.trim().length > 200) {
      console.warn(
        `activity-import[${jobId}]: AI-mapping gaf geen titel terug ondanks ${text.trim().length} tekens brontekst — mogelijk gemist veld, controleer de prompt.`,
      );
    }

    console.log(`activity-import[${jobId}]: AI-mapping klaar`);
    await updateJob(supabase, jobId, { status: "done", result: activity });
  } catch (cause) {
    logFailure(jobId, "AI-mapping", cause);
    await failJob(supabase, jobId, "mapping", aiMappingUserMessage(cause));
  }
}
