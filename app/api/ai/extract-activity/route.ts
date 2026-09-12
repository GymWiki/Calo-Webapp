import { cookies } from "next/headers";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import { SUPPORTED_DOCUMENT_MIME_TYPES, extractDocumentText } from "@/lib/ai/documentText";
import { extractActivityFromText } from "@/lib/ai/activityImportExtraction";
import { CHECK_MODEL } from "@/lib/ai/openai-client";
import { checkAndRecordAiUsage } from "@/lib/ai/usage";
import { recordAiUsage } from "@/lib/ai/usageTracking";

// pdfjs-dist-gebaseerde tekstextractie (unpdf) en de daaropvolgende
// OpenAI-aanroep kunnen bij grotere lesvoorbereidingen samen meer tijd
// kosten dan Vercel's standaard functie-limiet — expliciet ruimte geven
// zodat een groter document niet halverwege wordt afgebroken (wat, net als
// eerder bij generate-activity, een niet-JSON-response en dus een lege
// generieke foutmelding op de frontend zou geven).
export const maxDuration = 60;

// Vercel Functions weigeren elke request-body boven 4,5 MB — een harde,
// niet-instelbare platformlimiet (ook niet via next.config.ts se
// serverActions.bodySizeLimit, die alleen voor Server Actions geldt). Een
// eerdere poging om dit te omzeilen door de browser rechtstreeks naar
// Supabase Storage te laten uploaden bleek zelf onbetrouwbaar (zie
// ActivityImportUploadCard.tsx) — dus i.p.v. die omweg: gewoon een
// duidelijke, eigen limiet ruim onder Vercel's harde grens, met een
// begrijpelijke melding in plaats van een platform-413 die als lege
// generieke fout op het scherm belandt.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB

const EXTRACTION_ERROR = "Kon geen tekst uit dit bestand halen. Probeer een ander bestand of vul de activiteit handmatig in.";
const AI_MAPPING_ERROR = "De AI kon de inhoud van dit bestand niet goed omzetten naar een activiteit. Probeer het opnieuw of vul de activiteit handmatig in.";

function logFailure(stage: string, cause: unknown) {
  if (cause instanceof OpenAI.APIError) {
    console.error(
      `extract-activity (${stage}): OpenAI API-fout (status ${cause.status ?? "onbekend"}, ` +
        `type ${cause.type ?? "onbekend"}, code ${cause.code ?? "onbekend"}): ${cause.message}`,
    );
    return;
  }
  console.error(`extract-activity (${stage}): onverwachte fout:`, cause);
}

function aiMappingUserMessage(cause: unknown): string {
  if (cause instanceof OpenAI.APIError) {
    if (cause.status === 429) {
      return "De AI-service zit tijdelijk aan de limiet. Probeer het over een paar minuten opnieuw.";
    }
    if (cause.status && cause.status >= 500) {
      return "De AI-service is momenteel niet bereikbaar. Probeer het opnieuw.";
    }
  }
  // SyntaxError (ongeldige JSON) of ZodError (onverwachte AI-output) geven
  // beide een té technische .message om rechtstreeks te tonen — altijd de
  // vaste, begrijpelijke melding, de technische fout is al gelogd.
  return AI_MAPPING_ERROR;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }

  const usage = await checkAndRecordAiUsage(supabase, user.id, "extract-activity");

  if (!usage.allowed) {
    return Response.json(
      {
        error: "Je hebt je AI-checks voor deze maand gebruikt. Probeer het volgende maand opnieuw.",
      },
      { status: 429 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (cause) {
    logFailure("aanvraag-parsing", cause);
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Kies een bestand om te uploaden." }, { status: 400 });
  }

  if (!(SUPPORTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return Response.json(
      { error: "Alleen PDF, Word (.docx), PowerPoint (.pptx) en tekstbestanden worden ondersteund." },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json(
      {
        error:
          "Bestand is te groot voor automatische verwerking (max 4 MB). Verklein het bestand of vul de activiteit handmatig in.",
      },
      { status: 400 },
    );
  }

  // Fase 1: tekst uit het bestand halen. Fouten hier (onleesbaar PDF,
  // corrupt bestand, ongebruikelijke .docx/.pptx-structuur) zijn een ander
  // soort probleem dan een AI-fout verderop — vandaar een eigen try/catch
  // met een eigen, herkenbare melding (Stap 4).
  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text = await extractDocumentText(buffer, file.type);
  } catch (cause) {
    logFailure("tekstextractie", cause);
    return Response.json(
      { error: cause instanceof Error ? cause.message : EXTRACTION_ERROR },
      { status: 500 },
    );
  }

  if (!text.trim()) {
    return Response.json(
      {
        error:
          "Er is geen leesbare tekst gevonden in dit bestand. Is het een gescand document zonder tekstlaag? Vul de activiteit dan handmatig in.",
      },
      { status: 422 },
    );
  }

  // Fase 2: de geëxtraheerde tekst laten omzetten naar activiteit-
  // formuliervelden door de AI. Losstaand try/catch van fase 1, zodat een
  // OpenAI-fout hier nooit met een tekstextractie-fout verward wordt.
  try {
    const { activity, inputTokens, outputTokens } = await extractActivityFromText(text);

    // Loggen ongeacht isMovementActivity — de OpenAI-call (en dus de echte
    // kosten) heeft sowieso plaatsgevonden, ook als het document afgekeurd
    // wordt in de check hierna.
    await recordAiUsage(supabase, {
      userId: user.id,
      feature: "activity_import_extraction",
      model: CHECK_MODEL,
      inputTokens,
      outputTokens,
    });

    if (!activity.isMovementActivity) {
      return Response.json(
        {
          error:
            "Dit document lijkt geen bewegingsactiviteit of lesvoorbereiding te bevatten. Controleer het bestand, of vul de activiteit handmatig in.",
        },
        { status: 422 },
      );
    }

    return Response.json({ success: true, activity, remaining: usage.remaining });
  } catch (cause) {
    logFailure("AI-mapping", cause);
    return Response.json({ error: aiMappingUserMessage(cause) }, { status: 500 });
  }
}
