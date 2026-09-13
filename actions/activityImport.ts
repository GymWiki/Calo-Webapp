"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { SUPPORTED_DOCUMENT_MIME_TYPES } from "@/lib/ai/documentTypes";
import { processActivityImport } from "@/lib/ai/activityImportProcessor";
import { checkAndRecordAiUsage } from "@/lib/ai/usage";
import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";

type ActionResult =
  | { error: string }
  | { success: true; activity: ExtractedActivity; remaining: number | null };

// Was een fetch()-aanroep naar een eigen /api-route (Route Handler), toen een
// Server Action die alle logica zelf bevatte, toen dezelfde Server Action
// maar dan zonder een rechtstreekse "openai"-import — geen van die versies
// loste de aanhoudende "TypeError: Failed to fetch" op (bevestigd: de
// aanvraag bereikte nooit het netwerk, op elke pagina, met elk bestand, elke
// grootte, zowel via fetch() als via een Server Action, zowel via een
// programmatische aanroep als via een echte <form onSubmit>-indiening).
//
// De daadwerkelijke, build-bevestigde oorzaak: dit bestand importeerde
// lib/ai/documentText.ts rechtstreeks — dat bestand bevat unpdf/mammoth/
// officeparser, en officeparser/unpdf's dynamische requires gaven bij
// `next build --webpack` expliciete "Critical dependency"-waarschuwingen
// met een import-trace die eindigde bij DIT bestand. De structureel
// vergelijkbare, altijd werkende Kennisbank-upload (actions/knowledge.ts)
// importeert diezelfde tekstextractie nooit rechtstreeks — alleen via een
// tussenliggende, gewone module (lib/ai/knowledgeProcessor.ts) — en gaf
// daardoor nooit zo'n waarschuwing. Een "use server"-bestand dat zelf zo'n
// module met kritieke/dynamische dependencies importeert, kan een kapotte
// of onvolledige client-zichtbare actie-referentie opleveren: de browser
// kan de actie dan nooit daadwerkelijk versturen, wat zich uit als precies
// dit "Failed to fetch"-patroon.
//
// Nu, net als bij Kennisbank, volledig thin: alle zware logica (tekst-
// extractie + AI-mapping) zit in lib/ai/activityImportProcessor.ts, een
// gewone (niet "use server") module die dit bestand alleen aanroept.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB — ruim onder Vercel's harde 4,5MB request-limiet.

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

  const result = await processActivityImport(file, supabase, user.id);

  if ("error" in result) {
    return result;
  }

  return { success: true, activity: result.activity, remaining: usage.remaining };
}
