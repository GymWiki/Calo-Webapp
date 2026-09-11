import { cookies } from "next/headers";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import {
  buildKnowledgePromptSection,
  getRelevantKnowledge,
  summarizeKnowledgeSources,
} from "@/lib/ai/knowledgeRetrieval";
import { checkLessonGeneratorAccess } from "@/lib/ai/lessonGeneratorAccess";
import { CHAT_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import { isGameDomain } from "@/lib/constants/learningLines";
import { getAvailableSourceCount } from "@/lib/services/knowledgePackages";
import {
  generateActivityInputSchema,
  generatedLessonSchema,
  type GeneratedLessonWithIds,
} from "@/types/ai";
import type { DidacticItem } from "@/types/lesson";

const SYSTEM_PROMPT_BASE =
  "Je bent een ervaren ontwerper van lesvoorbereidingen bewegingsonderwijs, gespecialiseerd " +
  "in Game-Based Pedagogy (Koekoek, Dokman & Walinga) en het Basisdocument Bewegingsonderwijs. " +
  "Genereer een kant-en-klare, direct bruikbare lesvoorbereiding op basis van de gevraagde " +
  "leerlijn en doelgroep, gebaseerd op de meegeleverde vakliteratuur-fragmenten.";

const GAME_DOMAIN_INSTRUCTION =
  "Deze leerlijn valt onder het domein 'Spel': baseer de Game-Based Pedagogy-dimensies " +
  "(gameDimensions: Space, Equipment, People, Rules) en de tactische reflectievragen " +
  "expliciet op de meegeleverde Game-Based Pedagogy-richtlijnen uit de Kennisbank.";

const NON_GAME_DOMAIN_INSTRUCTION =
  "Deze leerlijn valt niet onder het spel-domein: Game-Based Pedagogy is hier niet van " +
  "toepassing. Laat gameCategory, gameDimensions en tacticalQuestions leeg (lege " +
  "strings/lege array) in plaats van iets te verzinnen.";

const JSON_FORMAT_INSTRUCTION =
  "Antwoord uitsluitend met geldige JSON in dit exacte formaat, zonder extra tekst of " +
  "markdown-opmaak: " +
  '{"title": string, "learningLine": string, "movementProblem": string, ' +
  '"movementTheme": string, "groupName": string, ' +
  '"doelgroep": number[] (leid dit af uit de opgegeven doelgroep — kies 1 of meer codes ' +
  "uit deze lijst die het beste passen: 1 = Groep 1/2, 2 = Groep 3/4, 3 = Groep 5/6, " +
  "4 = Groep 7/8, 5 = Onderbouw, 6 = Bovenbouw), " +
  '"goals": string, "gameCategory": string, ' +
  '"gameDimensions": {"space": string, "equipment": string, "people": string, "rules": string}, ' +
  '"tacticalQuestions": string[] (2 tot 3 tactische reflectievragen), ' +
  '"didacticItems": [{"category": "loopt_het" | "lukt_het" | "leeft_het", ' +
  '"subTheme": string of null, "observation": string ("Wat zie je?"), ' +
  '"action": string ("Wat doe je?")}] (minimaal 1 item per categorie), ' +
  '"baseMaterials": string[], "ruleMaterials": string[], "rules": string[], ' +
  '"arrangement": string, "deelnemersRegels": string, "plaatjePraatje": string, ' +
  '"aandachtspunten": string}';

function createId() {
  return `d-${Math.random().toString(36).slice(2, 10)}`;
}

const NO_SOURCES_ERROR =
  "Selecteer minstens één bron in de kennisbank — er zijn nog geen eigen artikelen of " +
  "Standaardbibliotheek-pakketten beschikbaar om de lesvoorbereiding op te baseren.";

// Logt de daadwerkelijke oorzaak server-side (zichtbaar in de Vercel
// function logs) vóórdat er een nette, generieke melding teruggaat naar de
// client — zonder dit was een fout als "OPENAI_MODEL bestaat niet" of een
// verkeerd geconfigureerde afhankelijkheid onmogelijk te onderscheiden van
// elke andere 500 in de UI.
function logGenerationFailure(cause: unknown) {
  if (cause instanceof OpenAI.APIError) {
    console.error(
      `AI Activiteiten Generator: OpenAI API-fout (status ${cause.status ?? "onbekend"}, ` +
        `type ${cause.type ?? "onbekend"}, code ${cause.code ?? "onbekend"}): ${cause.message}`,
    );
    return;
  }
  console.error("AI Activiteiten Generator: onverwachte fout:", cause);
}

// Een specifieke, herkenbare melding voor de meest voorkomende faalmodi —
// de rest valt terug op de rauwe foutmelding (nog altijd specifieker dan de
// oude generieke "mislukt"-tekst) zodat toekomstige problemen sneller te
// herleiden zijn vanuit de UI alleen, zonder de logs te hoeven raadplegen.
function toUserMessage(cause: unknown): string {
  if (cause instanceof OpenAI.APIError) {
    if (cause.status === 401) {
      return "De AI-configuratie is ongeldig (OpenAI-sleutel wordt geweigerd). Neem contact op met de beheerder.";
    }
    if (cause.status === 404) {
      return "Het geconfigureerde AI-model bestaat niet (meer). Neem contact op met de beheerder.";
    }
    if (cause.status === 429) {
      return "De AI-service zit tijdelijk aan de limiet. Probeer het over een paar minuten opnieuw.";
    }
    if (cause.status && cause.status >= 500) {
      return "De AI-service is momenteel niet bereikbaar. Probeer het opnieuw.";
    }
    return `Genereren van de lesvoorbereiding is mislukt: ${cause.message}`;
  }
  if (cause instanceof Error) {
    return cause.message;
  }
  return "Genereren van de lesvoorbereiding is mislukt. Probeer het opnieuw.";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const parsed = generateActivityInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Controleer de ingevulde velden." },
      { status: 400 },
    );
  }

  // Alles ná validatie in één try/catch: eerder ontbrak dit, waardoor een
  // onverwachte fout (bijv. een module die niet in de Node-omgeving laadt)
  // Next.js' eigen, contentloze 500-afhandeling raakte — de client kreeg
  // dan geen bruikbare "error" terug en viel stil terug op de generieke
  // wizard-toast, zonder dat er ook maar iets in de server-logs stond.
  try {
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
      .select("subscription_status")
      .eq("id", user.id)
      .single();

    const access = await checkLessonGeneratorAccess(
      supabase,
      user.id,
      profile?.subscription_status ?? "free_contributor",
    );

    if (!access.allowed) {
      return Response.json(
        {
          error:
            access.reason === "not_subscriber"
              ? "De AI-lessengenerator is een functie van het betaalde abonnement (EUR 3,-/mnd). Upgrade om 'm te gebruiken."
              : `Je hebt je ${access.limit} lesgeneraties voor deze maand gebruikt. Volgende maand heb je weer ${access.limit} beschikbaar.`,
          reason: access.reason,
        },
        { status: access.reason === "not_subscriber" ? 403 : 429 },
      );
    }

    // Stap 8: geen enkele kennisbron beschikbaar (geen artikelen, geen
    // aangevinkte pakketten) -> harde, duidelijke melding i.p.v. de AI een
    // hele lesvoorbereiding volledig ongegrond te laten verzinnen.
    const availableSourceCount = await getAvailableSourceCount(user.id);
    if (availableSourceCount === 0) {
      return Response.json({ error: NO_SOURCES_ERROR }, { status: 422 });
    }

    const input = parsed.data;
    const isGame = isGameDomain(input.learningLine);

    const queryParts = [input.learningLine, input.targetGroup];
    if (isGame) {
      queryParts.push(
        "Game-Based Pedagogy speldimensies Space Equipment People Rules tactische reflectievragen",
      );
    }
    const query = queryParts.join(". ");

    let matches: Awaited<ReturnType<typeof getRelevantKnowledge>> = [];
    try {
      matches = await getRelevantKnowledge(supabase, user.id, query, { matchCount: 4 });
    } catch (cause) {
      // Retrieval failure shouldn't block generation — falls back to general
      // knowledge, per buildKnowledgePromptSection's empty case. Wél loggen:
      // dit is precies het soort fout die eerder onzichtbaar bleef.
      console.error("AI Activiteiten Generator: Kennisbank-retrieval mislukt:", cause);
    }

    const domainInstruction = isGame ? GAME_DOMAIN_INSTRUCTION : NON_GAME_DOMAIN_INSTRUCTION;
    // Statische instructies eerst, de per-aanroep opgehaalde Kennisbank-
    // fragmenten laatst: OpenAI cachet automatisch een identiek prompt-
    // prefix tussen aanroepen (geen aparte cache-API nodig, in tegenstelling
    // tot Anthropic). Omdat de fragmenten hier query-afhankelijk zijn (RAG op
    // leerlijn+doelgroep) is de prefix niet bij élke aanroep identiek, maar
    // deze volgorde maximaliseert het stabiele, cachebare deel en profiteert
    // dus wél zodra twee aanroepen dezelfde leerlijn/doelgroep-combinatie
    // gebruiken.
    const systemPrompt =
      `${SYSTEM_PROMPT_BASE}\n\n${JSON_FORMAT_INSTRUCTION}\n\n${domainInstruction}\n\n` +
      buildKnowledgePromptSection(matches);
    const userPrompt = `Leerlijn: ${input.learningLine}\nDoelgroep: ${input.targetGroup}`;

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
      throw new Error("Geen antwoord van de AI Activiteiten Generator ontvangen.");
    }

    const generated = generatedLessonSchema.parse(JSON.parse(raw));
    const lesson: GeneratedLessonWithIds = {
      ...generated,
      didacticItems: generated.didacticItems.map(
        (item) => ({ ...item, id: createId() }) as DidacticItem,
      ),
    };

    await recordAiUsage(supabase, {
      userId: user.id,
      feature: "lesson_generator",
      model: CHAT_MODEL,
      inputTokens: completion.usage?.prompt_tokens ?? 0,
      outputTokens: completion.usage?.completion_tokens ?? 0,
    });

    return Response.json({
      success: true,
      lesson,
      sources: summarizeKnowledgeSources(matches),
      remaining: Math.max(access.remaining - 1, 0),
    });
  } catch (cause) {
    logGenerationFailure(cause);
    return Response.json({ error: toUserMessage(cause) }, { status: 500 });
  }
}
