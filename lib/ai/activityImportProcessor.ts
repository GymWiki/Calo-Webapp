import { extractDocumentText } from "@/lib/ai/documentText";
import { extractActivityFromText, type ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import { CHECK_MODEL } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProcessActivityImportResult =
  | { error: string }
  | { success: true; activity: ExtractedActivity };

const EXTRACTION_ERROR =
  "Kon geen tekst uit dit bestand halen. Probeer een ander bestand of vul de activiteit handmatig in.";
const AI_MAPPING_ERROR =
  "De AI kon de inhoud van dit bestand niet goed omzetten naar een activiteit. Probeer het opnieuw of vul de activiteit handmatig in.";

type OpenAiLikeError = { status?: number; type?: string; code?: string; message: string };

function isOpenAiApiError(cause: unknown): cause is OpenAiLikeError {
  return (
    typeof cause === "object" &&
    cause !== null &&
    "message" in cause &&
    ("status" in cause || "type" in cause || "code" in cause)
  );
}

function logFailure(stage: string, cause: unknown) {
  if (isOpenAiApiError(cause)) {
    console.error(
      `processActivityImport (${stage}): OpenAI API-fout (status ${cause.status ?? "onbekend"}, ` +
        `type ${cause.type ?? "onbekend"}, code ${cause.code ?? "onbekend"}): ${cause.message}`,
    );
    return;
  }
  console.error(`processActivityImport (${stage}): onverwachte fout:`, cause);
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

/**
 * Doet het eigenlijke, zware werk voor de "activiteit uit bestand"-upload:
 * tekst extraheren en door de AI laten omzetten naar activiteit-velden.
 * Bewust GEEN "use server"-bestand en niet rechtstreeks geïmporteerd door
 * één — dit is precies wat er ontbrak t.o.v. de Kennisbank-upload
 * (actions/knowledge.ts -> lib/ai/knowledgeProcessor.ts): daar importeert
 * de Server Action zelf nooit de zware tekstextractie (unpdf/mammoth/
 * officeparser) rechtstreeks, alleen via een tussenliggende, gewone module.
 *
 * Build-bewijs dat dit ertoe deed: `next build --webpack` gaf voor
 * officeparser/unpdf's dynamische requires ("Critical dependency: ...")
 * een import-trace die eindigde bij `actions/activityImport.ts` zélf zodra
 * deze module daar rechtstreeks in geïmporteerd werd — terwijl exact
 * dezelfde keten via knowledgeProcessor.ts nooit zo'n waarschuwing gaf voor
 * actions/knowledge.ts. Een "use server"-bestand dat zelf zo'n module met
 * kritieke/dynamische dependencies importeert, kan een kapotte of
 * onvolledige client-zichtbare actie-referentie opleveren — wat zich in de
 * browser uit als een aanvraag die nooit verstuurd wordt (precies het
 * "TypeError: Failed to fetch"-patroon dat deze upload steeds gaf, ook na
 * meerdere andere herbouwpogingen van de client-kant).
 */
export async function processActivityImport(
  file: File,
  supabase: SupabaseClient,
  userId: string,
): Promise<ProcessActivityImportResult> {
  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractDocumentText(buffer, file.type);
  } catch (cause) {
    logFailure("tekstextractie", cause);
    return { error: cause instanceof Error ? cause.message : EXTRACTION_ERROR };
  }

  if (!text.trim()) {
    return {
      error:
        "Er is geen leesbare tekst gevonden in dit bestand. Is het een gescand document zonder tekstlaag? Vul de activiteit dan handmatig in.",
    };
  }

  try {
    const { activity, inputTokens, outputTokens } = await extractActivityFromText(text);

    await recordAiUsage(supabase, {
      userId,
      feature: "activity_import_extraction",
      model: CHECK_MODEL,
      inputTokens,
      outputTokens,
    });

    if (!activity.isMovementActivity) {
      return {
        error:
          "Dit document lijkt geen bewegingsactiviteit of lesvoorbereiding te bevatten. Controleer het bestand, of vul de activiteit handmatig in.",
      };
    }

    return { success: true, activity };
  } catch (cause) {
    logFailure("AI-mapping", cause);
    return { error: aiMappingUserMessage(cause) };
  }
}
