import { ImportNormalizationError, normalizeForImport } from "@/lib/ai/documentNormalization";
import {
  extractActivityFromDocument,
  generatePlaatjePraatjeSuggestion,
  type ExtractedActivity,
} from "@/lib/ai/activityImportExtraction";
import { computeUnplacedContent, type UnplacedContentItem } from "@/lib/ai/extractedActivityMapping";
import { CHECK_MODEL, DOCUMENT_EXTRACTION_MODEL } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import { checkAndRecordAiUsage } from "@/lib/ai/usage";
import { aiMappingUserMessage as sharedAiMappingUserMessage, logAiFailure } from "@/lib/ai/aiErrorMessages";
import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "activity-imports";

const AI_MAPPING_ERROR =
  "De AI kon de inhoud van dit bestand niet goed omzetten naar een activiteit. Probeer het opnieuw of vul de activiteit handmatig in.";
const QUOTA_ERROR =
  "Je hebt je AI-checks voor deze maand gebruikt. Probeer het volgende maand opnieuw.";

const ATTACHMENT_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/bmp": "bmp",
};

export type ActivityImportResult = {
  activity: ExtractedActivity;
  plaatjePraatjeSuggestion: string;
  unplacedContent: UnplacedContentItem[];
  extractedImages: { storagePath: string }[];
};

function logFailure(jobId: string, stage: string, cause: unknown) {
  logAiFailure(`activity-import[${jobId}]`, stage, cause);
}

function aiMappingUserMessage(cause: unknown): string {
  return sharedAiMappingUserMessage(cause, AI_MAPPING_ERROR);
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

// Uploadt de uit het document gehaalde afbeeldingen (plattegronden, foto's —
// zie lib/ai/documentNormalization.ts) naar dezelfde Storage-bucket als het
// brondocument, onder een losse images/-submap. Eén falende afbeelding faalt
// niet de hele job — dat is bijvangst, geen kernresultaat.
async function uploadExtractedImages(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  attachments: Array<{ mimeType: string; base64: string }>,
): Promise<{ storagePath: string }[]> {
  const uploaded: { storagePath: string }[] = [];
  for (const [index, attachment] of attachments.entries()) {
    const extension = ATTACHMENT_EXTENSIONS[attachment.mimeType];
    if (!extension) continue;

    const storagePath = `${userId}/${jobId}/images/${index}.${extension}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, Buffer.from(attachment.base64, "base64"), {
        contentType: attachment.mimeType,
        upsert: true,
      });

    if (error) {
      console.error(`activity-import[${jobId}]: upload van geëxtraheerde afbeelding ${index} mislukt:`, error.message);
      continue;
    }
    uploaded.push({ storagePath });
  }
  return uploaded;
}

/**
 * Voert de volledige verwerkingspijplijn van een activity-import-job uit:
 * bestand ophalen uit Storage -> normaliseren (lib/ai/documentNormalization.ts)
 * -> AI-extractie + Plaatje&Praatje-generatie -> resultaat wegschrijven.
 * Bewust NIET een "use server"-bestand en niet rechtstreeks geïmporteerd
 * door een route/actie die zelf de request-body zou moeten verwerken — dit
 * ontvangt alleen een jobId, en haalt het bestand zelf op uit Storage
 * (uitgaand verkeer vanuit de functie, dus geen inkomend-request-
 * bodylimiet meer relevant). Elke stap logt expliciet met het jobId erin.
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
    .select("storage_path, mime_type, original_filename")
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

  let normalized: Awaited<ReturnType<typeof normalizeForImport>>;
  try {
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    normalized = await normalizeForImport(buffer, claimed.mime_type, claimed.original_filename);
  } catch (cause) {
    logFailure(jobId, "normalisatie", cause);
    const message =
      cause instanceof ImportNormalizationError
        ? cause.message
        : "Kon dit bestand niet lezen. Probeer een ander bestand of vul de activiteit handmatig in.";
    await failJob(supabase, jobId, "extraction", message);
    return;
  }

  if (normalized.input.kind === "text" && !normalized.input.text.trim()) {
    await failJob(
      supabase,
      jobId,
      "extraction",
      "Er is geen leesbare tekst gevonden in dit bestand. Is het een gescand document zonder tekstlaag? Vul de activiteit dan handmatig in, of upload een foto zodat de AI het visueel kan lezen.",
    );
    return;
  }

  const extractedImages = await uploadExtractedImages(supabase, userId, jobId, normalized.attachments);

  console.log(
    `activity-import[${jobId}]: normalisatie klaar (${normalized.input.kind}, ${extractedImages.length} afbeelding(en)) — AI-extractie gestart`,
  );
  await updateJob(supabase, jobId, { status: "mapping" });

  const usage = await checkAndRecordAiUsage(supabase, userId, "extract-activity");
  if (!usage.allowed) {
    await failJob(supabase, jobId, "mapping", QUOTA_ERROR);
    return;
  }

  try {
    const { activity, inputTokens, outputTokens } = await extractActivityFromDocument(normalized.input, jobId);

    await recordAiUsage(supabase, {
      userId,
      feature: "activity_import_extraction",
      model: DOCUMENT_EXTRACTION_MODEL,
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

    const plaatjePraatje = await generatePlaatjePraatjeSuggestion(activity, jobId);
    await recordAiUsage(supabase, {
      userId,
      feature: "activity_import_plaatjepraatje_generation",
      model: CHECK_MODEL,
      inputTokens: plaatjePraatje.inputTokens,
      outputTokens: plaatjePraatje.outputTokens,
    });

    const result: ActivityImportResult = {
      activity,
      plaatjePraatjeSuggestion: plaatjePraatje.value,
      unplacedContent: computeUnplacedContent(activity),
      extractedImages,
    };

    console.log(
      `activity-import[${jobId}]: AI-extractie klaar — ${result.unplacedContent.length} niet-geplaatst item(s)`,
    );
    await updateJob(supabase, jobId, { status: "done", result });
  } catch (cause) {
    logFailure(jobId, "AI-mapping", cause);
    await failJob(supabase, jobId, "mapping", aiMappingUserMessage(cause));
  }
}
