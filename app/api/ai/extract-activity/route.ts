import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { DOCUMENT_MAX_FILE_SIZE_BYTES, SUPPORTED_DOCUMENT_MIME_TYPES, extractDocumentText } from "@/lib/ai/documentText";
import { extractActivityFromText } from "@/lib/ai/activityImportExtraction";
import { checkAndRecordAiUsage } from "@/lib/ai/usage";

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
  } catch {
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

  if (file.size > DOCUMENT_MAX_FILE_SIZE_BYTES) {
    return Response.json({ error: "Bestand is te groot (max 20 MB)." }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractDocumentText(buffer, file.type);

    if (!text.trim()) {
      return Response.json(
        {
          error:
            "Er is geen leesbare tekst gevonden in dit bestand. Is het een gescand document zonder tekstlaag? Vul de activiteit dan handmatig in.",
        },
        { status: 422 },
      );
    }

    const extraction = await extractActivityFromText(text);

    if (!extraction.isMovementActivity) {
      return Response.json(
        {
          error:
            "Dit document lijkt geen bewegingsactiviteit of lesvoorbereiding te bevatten. Controleer het bestand, of vul de activiteit handmatig in.",
        },
        { status: 422 },
      );
    }

    return Response.json({ success: true, activity: extraction, remaining: usage.remaining });
  } catch (cause) {
    return Response.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "Verwerken van dit bestand is mislukt. Probeer het opnieuw of vul de activiteit handmatig in.",
      },
      { status: 500 },
    );
  }
}
