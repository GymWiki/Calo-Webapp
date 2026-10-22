import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildKnowledgePromptSection, getRelevantKnowledge } from "@/lib/ai/knowledgeRetrieval";
import { toUsedKnowledgeChunks, type UsedKnowledgeChunk } from "@/lib/ai/knowledgeUsageLogging";
import { CHECK_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import { SEO_SUMMARY_CORE_INSTRUCTION, buildSeoSummaryUserMessage } from "@/lib/ai/seoSummaryPrompt";

// Lichter dan SubmitActivityInput (types/activity.ts, de oorspronkelijke
// "eenvoudige activiteit"-vorm met een verplichte categorie-enum en
// loopt/lukt/leeft) — deze check draait nu ook voor wizard-activiteiten
// (actions/lesson.ts's createLesson, bij isPublic=true), die geen categorie
// of 3L's-tekstvelden meer hebben (zie de Basisdocument-leerlijn/
// bewegingsthema-koppeling). SubmitActivityInput voldoet hier structureel
// nog steeds aan, dus activity-submission.ts blijft ongewijzigd werken.
export type ActivityQualityCheckInput = {
  titel: string;
  leerlijn: string;
  doel: string;
  beschrijving: string;
  categorie?: string;
  beginsituatie?: string;
  veld?: string;
  materiaal?: string[];
  regels?: string[];
};

// Drempelwaarde voor de duplicaatcheck (pg_trgm similarity, 0-1) — hoe hoger,
// hoe strenger. Bewust hier als los getal (niet in de SQL-functie
// hardcoded) zodat de drempel zonder migratie is aan te passen.
const DUPLICATE_SIMILARITY_THRESHOLD = 0.6;

export type ActivityQualityResult =
  | { status: "approved"; usedKnowledgeChunks: UsedKnowledgeChunk[]; seoSummary: string }
  | { status: "rejected"; reason: string; usedKnowledgeChunks: UsedKnowledgeChunk[] };

const qualityCheckSchema = z.object({
  acceptable: z.boolean(),
  reason: z.string(),
  // Alleen betekenisvol bij acceptable=true — zie SEO_SUMMARY_INSTRUCTION.
  // Bij een afkeuring stuurt het model hier een lege string; die wordt
  // hieronder genegeerd (nooit weggeschreven voor een afgekeurde inzending).
  seo_summary: z.string(),
});

// Eén extra, verplicht JSON-veld bovenop de bestaande goed/afkeuren-check —
// geen tweede AI-aanroep nodig. De eigenlijke instructie (wat een goede
// seo_summary is) staat in lib/ai/seoSummaryPrompt.ts, GEDEELD met
// scripts/backfill-activity-seo.mts (dat losse script draait via kale
// node-executie, die geen @/-aliases kent — zie het commentaar daar).
const SEO_SUMMARY_INSTRUCTION =
  `Genereer ALLEEN wanneer acceptable=true ook een \`seo_summary\`. ${SEO_SUMMARY_CORE_INSTRUCTION} ` +
  "Bij acceptable=false: seo_summary is een lege string.";

const CONTENT_QUALITY_SYSTEM_PROMPT =
  "Je bent kwaliteitscontroleur voor GymWiki, een gedeelde activiteitenbibliotheek voor " +
  "bewegingsonderwijs. Beoordeel of een ingediende activiteit compleet en bruikbaar genoeg is " +
  "om in de bibliotheek te publiceren, en of ze aansluit bij de meegeleverde vakliteratuur-" +
  "fragmenten uit de Kennisbank (indien aanwezig). Keur af bij: onzin-invoer (test-tekst, " +
  "willekeurige tekens, duidelijk niet-serieuze inhoud), een beschrijving die geen daadwerkelijke " +
  "les-/spelactiviteit beschrijft, instructies die te vaag/onvolledig zijn om zonder verdere " +
  "uitleg uit te voeren, of inhoud die duidelijk in strijd is met de meegeleverde vakliteratuur. " +
  "Zijn er geen relevante fragmenten gevonden, beoordeel dan alleen op algemene bruikbaarheid. " +
  "Wees niet overdreven streng op stijl of spelling — het gaat om bruikbaarheid, niet perfectie. " +
  `${SEO_SUMMARY_INSTRUCTION} ` +
  'Antwoord uitsluitend met geldige JSON: {"acceptable": boolean, "reason": string, ' +
  '"seo_summary": string} — reason is een korte, opbouwende Nederlandse toelichting (1-2 zinnen), ' +
  "ook bij goedkeuring.";

async function checkContentQuality(
  supabase: SupabaseClient,
  authorId: string,
  input: ActivityQualityCheckInput,
): Promise<ActivityQualityResult> {
  let usedKnowledgeChunks: UsedKnowledgeChunk[] = [];
  try {
    const query = [input.titel, input.leerlijn, input.beschrijving].join(". ");
    let knowledgeSection = "";
    try {
      const matches = await getRelevantKnowledge(supabase, authorId, query, { matchCount: 4 });
      knowledgeSection = `\n\n${buildKnowledgePromptSection(matches)}`;
      usedKnowledgeChunks = toUsedKnowledgeChunks(matches);
    } catch {
      // Retrieval-storing mag de kwaliteitscheck niet blokkeren — de check
      // valt dan terug op algemene beoordeling zonder Kennisbank-grounding.
    }

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: CHECK_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${CONTENT_QUALITY_SYSTEM_PROMPT}${knowledgeSection}` },
        { role: "user", content: buildSeoSummaryUserMessage(input) },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Geen antwoord van de kwaliteitscheck ontvangen.");
    }

    await recordAiUsage(supabase, {
      userId: authorId,
      feature: "activity_checker",
      model: CHECK_MODEL,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    });

    const result = qualityCheckSchema.parse(JSON.parse(raw));
    return result.acceptable
      ? { status: "approved", usedKnowledgeChunks, seoSummary: result.seo_summary }
      : { status: "rejected", reason: result.reason, usedKnowledgeChunks };
  } catch {
    // Bij een storing in de AI-check (geen API-key, netwerkfout, onverwacht
    // antwoord) niet stilzwijgend goedkeuren — een falende kwaliteitscheck
    // mag nooit ongecontroleerde content live laten gaan.
    return {
      status: "rejected",
      reason:
        "De kwaliteitscheck kon niet worden uitgevoerd. Probeer het later opnieuw.",
      usedKnowledgeChunks: [],
    };
  }
}

async function checkForDuplicate(
  supabase: SupabaseClient,
  authorId: string,
  input: ActivityQualityCheckInput,
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
      usedKnowledgeChunks: [],
    };
  }

  const match = (data as { id: string; titel: string; similarity: number }[] | null)?.[0];
  if (match) {
    return {
      status: "rejected",
      reason: `Deze activiteit lijkt sterk op je eerdere inzending "${match.titel}".`,
      usedKnowledgeChunks: [],
    };
  }

  // "approved" hier is puur een tussenresultaat — checkActivityQuality laat
  // alleen een "rejected" hier al kortsluiten en negeert dit "approved"-
  // resultaat verder altijd (valt door naar checkContentQuality, dat de
  // ECHTE seoSummary levert). seoSummary hier wordt dus nooit gelezen.
  return { status: "approved", usedKnowledgeChunks: [], seoSummary: "" };
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
  input: ActivityQualityCheckInput,
): Promise<ActivityQualityResult> {
  const duplicateResult = await checkForDuplicate(supabase, authorId, input);
  if (duplicateResult.status === "rejected") {
    return duplicateResult;
  }

  return checkContentQuality(supabase, authorId, input);
}
