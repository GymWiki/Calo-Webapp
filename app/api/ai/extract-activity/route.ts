import { cookies } from "next/headers";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import { DOCUMENT_MAX_FILE_SIZE_BYTES, SUPPORTED_DOCUMENT_MIME_TYPES, extractDocumentText } from "@/lib/ai/documentText";
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

const BUCKET = "kennisbank-documenten";

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

/**
 * Verwacht GEEN rauw bestand meer in de request-body — zie
 * components/ActivityImportUploadCard.tsx: de browser uploadt het bestand
 * rechtstreeks naar Supabase Storage en stuurt hier alleen het opslagpad
 * mee. Reden: Vercel Functions hanteren een harde, niet-instelbare limiet
 * van 4,5 MB op de request-body — een rauw bestand van een paar MB (een
 * reële lesvoorbereiding met afbeeldingen komt daar zomaar overheen) werd
 * dus al door Vercel's infrastructuur met een 413 geweigerd, nog vóórdat
 * deze route-code ooit draaide. Vandaar dat er nooit iets in de
 * server-logs verscheen: de aanvraag bereikte de functie niet eens. Met
 * alleen het pad in de body blijft de request-body altijd klein,
 * ongeacht bestandsgrootte (tot de eigen 20MB-grens hieronder).
 */
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const path = (body as Record<string, unknown> | null)?.path;
  const fileType = (body as Record<string, unknown> | null)?.fileType;

  if (typeof path !== "string" || !path.startsWith(`${user.id}/`)) {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  if (typeof fileType !== "string" || !(SUPPORTED_DOCUMENT_MIME_TYPES as readonly string[]).includes(fileType)) {
    return Response.json(
      { error: "Alleen PDF, Word (.docx), PowerPoint (.pptx) en tekstbestanden worden ondersteund." },
      { status: 400 },
    );
  }

  // Best-effort opruimen: dit is een tijdelijk scratch-bestand, alleen
  // bedoeld om deze ene extractie te voeden — nooit bedoeld om te blijven
  // staan in de (gedeelde) Kennisbank-bucket. Wordt hoe dan ook verwijderd,
  // ook als extractie/AI-mapping hieronder mislukt.
  const cleanup = () => supabase.storage.from(BUCKET).remove([path]).catch(() => {});

  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from(BUCKET)
    .download(path);

  if (downloadError || !fileBlob) {
    console.error("extract-activity: download uit Storage mislukt:", downloadError?.message);
    return Response.json({ error: EXTRACTION_ERROR }, { status: 500 });
  }

  if (fileBlob.size > DOCUMENT_MAX_FILE_SIZE_BYTES) {
    await cleanup();
    return Response.json({ error: "Bestand is te groot (max 20 MB)." }, { status: 400 });
  }

  // Fase 1: tekst uit het bestand halen. Fouten hier (onleesbaar PDF,
  // corrupt bestand, ongebruikelijke .docx/.pptx-structuur) zijn een ander
  // soort probleem dan een AI-fout verderop — vandaar een eigen try/catch
  // met een eigen, herkenbare melding (Stap 4).
  let text: string;
  try {
    const buffer = Buffer.from(await fileBlob.arrayBuffer());
    text = await extractDocumentText(buffer, fileType);
  } catch (cause) {
    logFailure("tekstextractie", cause);
    await cleanup();
    return Response.json(
      { error: cause instanceof Error ? cause.message : EXTRACTION_ERROR },
      { status: 500 },
    );
  }

  await cleanup();

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
