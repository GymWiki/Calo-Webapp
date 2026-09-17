import { cookies } from "next/headers";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import {
  buildKnowledgePromptSection,
  getRelevantKnowledge,
  summarizeKnowledgeSources,
} from "@/lib/ai/knowledgeRetrieval";
import { logKnowledgeUsage, toUsedKnowledgeChunks } from "@/lib/ai/knowledgeUsageLogging";
import { CHECK_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { checkAndRecordAiUsage } from "@/lib/ai/usage";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import { BEWEGINGSTHEMAS } from "@/lib/constants/learningLines";
import { getAvailableSourceCount } from "@/lib/services/knowledgePackages";
import { analyzeLessonInputSchema, lescoachFeedbackSchema } from "@/types/ai";

const SYSTEM_PROMPT =
  "Je bent een strenge maar opbouwende ALO/CALO Stagebegeleider. Analyseer onderstaande " +
  "lesvoorbereiding uitsluitend aan de hand van de meegeleverde vakliteratuur-fragmenten. " +
  "Controleer of het bewegingsprobleem aansluit bij de leerlijn en of het bewegingsthema " +
  "daadwerkelijk een verfijning van die leerlijn is (Basisdocument Bewegingsonderwijs, " +
  "SLO/KVLO), en of de 3 L'en concrete 'Wat zie je?' / 'Wat doe je?' acties bevatten.";

const JSON_FORMAT_INSTRUCTION =
  "Antwoord uitsluitend met geldige JSON in dit exacte formaat, zonder extra tekst of " +
  'markdown-opmaak: {"score": number van 0 tot 10, "summary": string, ' +
  '"strengths": string[], "improvements": [{"category": string, "suggestion": string}]}';

const NO_SOURCES_ERROR =
  "Selecteer minstens één bron in de kennisbank — er zijn nog geen eigen artikelen of " +
  "Standaardbibliotheek-pakketten beschikbaar om de AI Lescoach op te baseren.";

function logAnalysisFailure(cause: unknown) {
  if (cause instanceof OpenAI.APIError) {
    console.error(
      `AI Lescoach: OpenAI API-fout (status ${cause.status ?? "onbekend"}, ` +
        `type ${cause.type ?? "onbekend"}, code ${cause.code ?? "onbekend"}): ${cause.message}`,
    );
    return;
  }
  console.error("AI Lescoach: onverwachte fout:", cause);
}

function toUserMessage(cause: unknown): string {
  if (cause instanceof OpenAI.APIError) {
    if (cause.status === 429) {
      return "De AI-service zit tijdelijk aan de limiet. Probeer het over een paar minuten opnieuw.";
    }
    if (cause.status && cause.status >= 500) {
      return "De AI-service is momenteel niet bereikbaar. Probeer het opnieuw.";
    }
    return `AI Lescoach-analyse is mislukt: ${cause.message}`;
  }
  if (cause instanceof Error) return cause.message;
  return "AI Lescoach-analyse is mislukt. Probeer het opnieuw.";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const parsed = analyzeLessonInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Controleer de meegestuurde lesvoorbereiding." },
      { status: 400 },
    );
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "Je bent niet ingelogd." }, { status: 401 });
    }

    const usage = await checkAndRecordAiUsage(supabase, user.id, "analyze-lesson");

    if (!usage.allowed) {
      return Response.json(
        {
          error:
            "Je hebt je AI Lescoach-checks voor deze maand gebruikt. Probeer het volgende maand opnieuw.",
        },
        { status: 429 },
      );
    }

    // Stap 8: geen enkele kennisbron beschikbaar (geen artikelen, geen
    // aangevinkte pakketten) -> harde, duidelijke melding i.p.v. de AI
    // volledig ongegrond te laten analyseren.
    const availableSourceCount = await getAvailableSourceCount(user.id);
    if (availableSourceCount === 0) {
      return Response.json({ error: NO_SOURCES_ERROR }, { status: 422 });
    }

    const lesson = parsed.data;

    const query =
      [
        lesson.title,
        lesson.learningLine,
        lesson.movementProblem,
        lesson.movementTheme,
        lesson.goals,
        ...(lesson.didacticItems ?? []).flatMap((item) => [item.observation, item.action]),
      ]
        .filter(Boolean)
        .join(". ") || "lesvoorbereiding bewegingsonderwijs";

    let matches: Awaited<ReturnType<typeof getRelevantKnowledge>> = [];
    try {
      matches = await getRelevantKnowledge(supabase, user.id, query, { matchCount: 4 });
    } catch (cause) {
      // Retrieval failure shouldn't block feedback — the AI just falls back
      // to general knowledge, per buildKnowledgePromptSection's empty case.
      console.error("AI Lescoach: Kennisbank-retrieval mislukt:", cause);
    }

    // Brontracking (activity_knowledge_usage, context='lescoach') — alleen
    // wanneer dit een bestaande activiteit betreft ÉN de aanroeper
    // daadwerkelijk de auteur is. Dat laatste voorkomt dat een willekeurige
    // viewer op /les/share/[id] hún eigen Kennisbank-selectie aan andermans
    // gedeelde activiteit koppelt (zie de migratie-toelichting bij
    // activity_knowledge_usage.sql).
    if (lesson.activityId) {
      const { data: ownedActivity } = await supabase
        .from("activiteiten")
        .select("id")
        .eq("id", lesson.activityId)
        .eq("author_id", user.id)
        .maybeSingle();

      if (ownedActivity) {
        await logKnowledgeUsage(supabase, lesson.activityId, "lescoach", toUsedKnowledgeChunks(matches));
      }
    }

    const learningLine = lesson.learningLine ?? "";
    const themeOptions = BEWEGINGSTHEMAS[learningLine];
    const domainInstruction =
      themeOptions && themeOptions.length > 0
        ? `Voor de leerlijn "${learningLine}" hoort het bewegingsthema één van deze te zijn: ` +
          `${themeOptions.join(", ")}. Vlag het als "movementTheme" hier niet bij past.`
        : "Er is voor deze leerlijn geen vaste bewegingsthema-lijst — beoordeel alleen of het " +
          "opgegeven bewegingsthema logisch bij de leerlijn aansluit, niet tegen een vaste lijst.";
    const systemPrompt =
      `${SYSTEM_PROMPT}\n\n${domainInstruction}\n\n` +
      `${buildKnowledgePromptSection(matches)}\n\n${JSON_FORMAT_INSTRUCTION}`;
    const userPrompt = `Lesvoorbereiding (JSON):\n${JSON.stringify(lesson, null, 2)}`;

    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: CHECK_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Geen antwoord van de AI Lescoach ontvangen.");
    }

    await recordAiUsage(supabase, {
      userId: user.id,
      feature: "ai_lescoach",
      model: CHECK_MODEL,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    });

    const feedback = lescoachFeedbackSchema.parse(JSON.parse(raw));
    return Response.json({
      success: true,
      feedback,
      sources: summarizeKnowledgeSources(matches),
      usedKnowledgeChunks: toUsedKnowledgeChunks(matches),
      remaining: usage.remaining,
    });
  } catch (cause) {
    logAnalysisFailure(cause);
    return Response.json({ error: toUserMessage(cause) }, { status: 500 });
  }
}
