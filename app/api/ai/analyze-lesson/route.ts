import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { buildKnowledgePromptSection, getRelevantKnowledge } from "@/lib/ai/lescoach";
import { CHAT_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { checkAndRecordAiUsage } from "@/lib/ai/usage";
import { isGameDomain } from "@/lib/constants/learningLines";
import { analyzeLessonInputSchema, lescoachFeedbackSchema } from "@/types/ai";

const SYSTEM_PROMPT =
  "Je bent een strenge maar opbouwende ALO/CALO Stagebegeleider. Analyseer onderstaande " +
  "lesvoorbereiding uitsluitend aan de hand van de meegeleverde vakliteratuur-fragmenten. " +
  "Controleer of het bewegingsprobleem aansluit bij de leerlijn en of de 3 L'en concrete " +
  "'Wat zie je?' / 'Wat doe je?' acties bevatten.";

const GAME_DOMAIN_ANALYSIS_INSTRUCTION =
  "Deze leerlijn valt onder het domein 'Spel': controleer expliciet of er sprake is van " +
  "een rijke leeromgeving volgens Game-Based Pedagogy — zijn de speldimensies (Space, " +
  "Equipment, People, Rules) en de tactische reflectievragen concreet en aanwezig?";

const NON_GAME_DOMAIN_ANALYSIS_INSTRUCTION =
  "Deze leerlijn valt niet onder het spel-domein: Game-Based Pedagogy is hier niet van " +
  "toepassing, dus beoordeel daar niet op.";

const JSON_FORMAT_INSTRUCTION =
  "Antwoord uitsluitend met geldige JSON in dit exacte formaat, zonder extra tekst of " +
  'markdown-opmaak: {"score": number van 0 tot 10, "summary": string, ' +
  '"strengths": string[], "improvements": [{"category": string, "suggestion": string}]}';

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

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Je bent niet ingelogd." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("users")
    .select("is_pro")
    .eq("id", user.id)
    .single();

  const usage = await checkAndRecordAiUsage(
    supabase,
    user.id,
    profile?.is_pro ?? false,
    "analyze-lesson",
  );

  if (!usage.allowed) {
    return Response.json(
      {
        error:
          "Je hebt je gratis AI Lescoach-checks voor deze maand gebruikt. Upgrade naar Pro voor onbeperkt gebruik.",
      },
      { status: 429 },
    );
  }

  const lesson = parsed.data;
  const isGame = isGameDomain(lesson.learningLine ?? "");

  const queryParts = [
    lesson.title,
    lesson.learningLine,
    lesson.movementProblem,
    lesson.movementTheme,
    lesson.goals,
    ...(lesson.didacticItems ?? []).flatMap((item) => [item.observation, item.action]),
  ].filter(Boolean);
  if (isGame) {
    queryParts.push(
      "Game-Based Pedagogy speldimensies Space Equipment People Rules tactische reflectievragen",
    );
  }
  const query = queryParts.join(". ") || "lesvoorbereiding bewegingsonderwijs";

  let matches: Awaited<ReturnType<typeof getRelevantKnowledge>> = [];
  try {
    matches = await getRelevantKnowledge(supabase, query, user.id, { matchCount: 4 });
  } catch {
    // Retrieval failure shouldn't block feedback — the AI just falls back
    // to general knowledge, per buildKnowledgePromptSection's empty case.
  }

  const domainInstruction = isGame
    ? GAME_DOMAIN_ANALYSIS_INSTRUCTION
    : NON_GAME_DOMAIN_ANALYSIS_INSTRUCTION;
  const systemPrompt =
    `${SYSTEM_PROMPT}\n\n${domainInstruction}\n\n` +
    `${buildKnowledgePromptSection(matches)}\n\n${JSON_FORMAT_INSTRUCTION}`;
  const userPrompt = `Lesvoorbereiding (JSON):\n${JSON.stringify(lesson, null, 2)}`;

  try {
    const client = getOpenAIClient();
    const completion = await client.chat.completions.create({
      model: CHAT_MODEL,
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

    const feedback = lescoachFeedbackSchema.parse(JSON.parse(raw));
    return Response.json({ success: true, feedback, remaining: usage.remaining });
  } catch (cause) {
    return Response.json(
      {
        error:
          cause instanceof Error
            ? cause.message
            : "AI Lescoach-analyse is mislukt. Probeer het opnieuw.",
      },
      { status: 500 },
    );
  }
}
