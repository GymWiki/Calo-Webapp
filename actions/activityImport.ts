"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { SUPPORTED_DOCUMENT_MIME_TYPES, extractDocumentText } from "@/lib/ai/documentText";
import { extractActivityFromText, type ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import { CHECK_MODEL } from "@/lib/ai/openai-client";
import { checkAndRecordAiUsage } from "@/lib/ai/usage";
import { recordAiUsage } from "@/lib/ai/usageTracking";

type ActionResult =
  | { error: string }
  | { success: true; activity: ExtractedActivity; remaining: number | null };

// Was een fetch()-aanroep naar een eigen /api-route (Route Handler), maar dat
// bleek op Android Chrome structureel te falen met "TypeError: Failed to
// fetch" zodra de FormData een echt File-object bevatte — bevestigd doordat
// eenzelfde fetch() zonder bestand (generate-activity) wél werkte, en een
// FormData-upload mét bestand via een Server Action (Kennisbank, zie
// actions/knowledge.ts) op hetzelfde toestel/netwerk ook wél werkte. fetch()
// moet een geselecteerd bestand zelf (opnieuw) inlezen om de multipart-body
// te bouwen; een Server Action-aanroep (React's eigen formulier-actie-
// protocol) gebruikt de browser's oudere, robuustere native form-encoding
// hiervoor. Vercel's logs bevestigden dit ook: er kwam voor deze route nooit
// ook maar één binnenkomend request aan, terwijl gewone pagina-navigatie en
// de niet-bestand-AI-aanroepen op hetzelfde moment gewoon succesvol waren.
const EXTRACTION_ERROR =
  "Kon geen tekst uit dit bestand halen. Probeer een ander bestand of vul de activiteit handmatig in.";
const AI_MAPPING_ERROR =
  "De AI kon de inhoud van dit bestand niet goed omzetten naar een activiteit. Probeer het opnieuw of vul de activiteit handmatig in.";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB — ruim onder Vercel's harde 4,5MB request-limiet.

// Duck-typing i.p.v. `cause instanceof OpenAI.APIError`: een "use server"-
// bestand mag geen zware SDK's rechtstreeks op het top-level importeren — de
// echte functie-implementatie hoort nooit in de client-bundel terecht te
// komen, maar de OpenAI-package rechtstreeks hier importeren (i.p.v. alleen
// via lib/ai/openai-client.ts, zoals de rest van de codebase al deed) bleek
// hier de enige structurele afwijking t.o.v. actions/knowledge.ts, dat wél
// altijd werkte met een vergelijkbare (grote) afhankelijkheidsketen.
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
      `extractActivityFromUpload (${stage}): OpenAI API-fout (status ${cause.status ?? "onbekend"}, ` +
        `type ${cause.type ?? "onbekend"}, code ${cause.code ?? "onbekend"}): ${cause.message}`,
    );
    return;
  }
  console.error(`extractActivityFromUpload (${stage}): onverwachte fout:`, cause);
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

export async function extractActivityFromUpload(formData: FormData): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const usage = await checkAndRecordAiUsage(supabase, user.id, "extract-activity");

  if (!usage.allowed) {
    return { error: "Je hebt je AI-checks voor deze maand gebruikt. Probeer het volgende maand opnieuw." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Kies een bestand om te uploaden." };
  }

  if (!(SUPPORTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { error: "Alleen PDF, Word (.docx), PowerPoint (.pptx) en tekstbestanden worden ondersteund." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      error:
        "Bestand is te groot voor automatische verwerking (max 4 MB). Verklein het bestand of vul de activiteit handmatig in.",
    };
  }

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
      userId: user.id,
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

    return { success: true, activity, remaining: usage.remaining };
  } catch (cause) {
    logFailure("AI-mapping", cause);
    return { error: aiMappingUserMessage(cause) };
  }
}
