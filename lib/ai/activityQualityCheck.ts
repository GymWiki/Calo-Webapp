import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { CHAT_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import type { SubmitActivityInput } from "@/types/activity";

// Drempelwaarde voor de duplicaatcheck (pg_trgm similarity, 0-1) — hoe hoger,
// hoe strenger. Bewust hier als los getal (niet in de SQL-functie
// hardcoded) zodat de drempel zonder migratie is aan te passen.
const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

export type ActivityQualityResult =
  | { status: "approved" }
  | { status: "rejected"; reason: string };

const qualityCheckSchema = z.object({
  acceptable: z.boolean(),
  reason: z.string(),
});

const CONTENT_QUALITY_SYSTEM_PROMPT =
  "Je bent kwaliteitscontroleur voor GymWiki, een gedeelde activiteitenbibliotheek voor " +
  "bewegingsonderwijs. Beoordeel of een ingediende activiteit compleet en bruikbaar genoeg is " +
  "om in de bibliotheek te publiceren. Keur af bij: onzin-invoer (test-tekst, willekeurige " +
  "tekens, duidelijk niet-serieuze inhoud), een beschrijving die geen daadwerkelijke " +
  "les-/spelactiviteit beschrijft, of instructies die te vaag/onvolledig zijn om zonder verdere " +
  "uitleg uit te voeren. Wees niet overdreven streng op stijl of spelling — het gaat om " +
  "bruikbaarheid, niet perfectie. " +
  'Antwoord uitsluitend met geldige JSON: {"acceptable": boolean, "reason": string} — ' +
  "reason is een korte, opbouwende Nederlandse toelichting (1-2 zinnen), ook bij goedkeuring.";

function buildSubmissionSummary(input: SubmitActivityInput): string {
  return [
    `Titel: ${input.titel}`,
    `Categorie: ${input.categorie}`,
    `Leerlijn: ${input.leerlijn}`,
    `Doel: ${input.doel}`,
    input.beginsituatie ? `Beginsituatie: ${input.beginsituatie}` : null,
    `Beschrijving: ${input.beschrijving}`,
    input.veld ? `Veld: ${input.veld}` : null,
    input.materiaal.length ? `Materiaal: ${input.materiaal.join(", ")}` : null,
    input.regels.length ? `Regels: ${input.regels.join("; ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

async function checkContentQuality(
  input: SubmitActivityInput,
): Promise<ActivityQualityResult> {
  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: CONTENT_QUALITY_SYSTEM_PROMPT },
        { role: "user", content: buildSubmissionSummary(input) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Geen antwoord van de kwaliteitscheck ontvangen.");
    }

    const result = qualityCheckSchema.parse(JSON.parse(raw));
    return result.acceptable
      ? { status: "approved" }
      : { status: "rejected", reason: result.reason };
  } catch {
    // Bij een storing in de AI-check (geen API-key, netwerkfout, onverwacht
    // antwoord) niet stilzwijgend goedkeuren — een falende kwaliteitscheck
    // mag nooit ongecontroleerde content live laten gaan.
    return {
      status: "rejected",
      reason:
        "De kwaliteitscheck kon niet worden uitgevoerd. Probeer het later opnieuw.",
    };
  }
}

async function checkForDuplicate(
  supabase: SupabaseClient,
  authorId: string,
  input: SubmitActivityInput,
): Promise<ActivityQualityResult> {
  const { data, error } = await supabase.rpc("find_similar_own_activities", {
    p_author_id: authorId,
    p_text: input.beschrijving,
    p_threshold: DUPLICATE_SIMILARITY_THRESHOLD,
  });

  if (error) {
    // Zelfde principe als hierboven: een falende duplicaatcheck mag geen
    // inzending stilzwijgend doorlaten.
    return {
      status: "rejected",
      reason: "De duplicaatcheck kon niet worden uitgevoerd. Probeer het later opnieuw.",
    };
  }

  const match = (data as { id: string; titel: string; similarity: number }[] | null)?.[0];
  if (match) {
    return {
      status: "rejected",
      reason: `Deze activiteit lijkt sterk op je eerdere inzending "${match.titel}".`,
    };
  }

  return { status: "approved" };
}

/**
 * Losstaande kwaliteitscheck-service voor nieuwe activiteiten-inzendingen —
 * bewust hier geïsoleerd (los van actions/activity-submission.ts) zodat het
 * onderliggende algoritme (nu: OpenAI content-check + pg_trgm
 * duplicaatdetectie) later vervangen kan worden zonder de rest van de
 * inzend-flow te hoeven aanpassen. Duplicaatcheck loopt eerst — goedkoper
 * dan een AI-call, en een duidelijkere reden om af te keuren.
 */
export async function checkActivityQuality(
  supabase: SupabaseClient,
  authorId: string,
  input: SubmitActivityInput,
): Promise<ActivityQualityResult> {
  const duplicateResult = await checkForDuplicate(supabase, authorId, input);
  if (duplicateResult.status === "rejected") {
    return duplicateResult;
  }

  return checkContentQuality(input);
}
