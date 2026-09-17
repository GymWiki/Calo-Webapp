import { cookies } from "next/headers";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import {
  buildKnowledgePromptSection,
  getRelevantKnowledge,
} from "@/lib/ai/knowledgeRetrieval";
import {
  buildKnowledgeContextCacheKey,
  getCachedKnowledgeContext,
  setCachedKnowledgeContext,
} from "@/lib/ai/knowledgeContextCache";
import { logKnowledgeUsage, toUsedKnowledgeChunks } from "@/lib/ai/knowledgeUsageLogging";
import { checkLescoachAccess } from "@/lib/ai/lescoachAccess";
import { CHECK_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import { getAvailableSourceCount } from "@/lib/services/knowledgePackages";
import {
  analyzeLessonInputSchema,
  lescoachAnalysisSchema,
  LESCOACH_SECTIONS,
  type AnalyzeLessonInput,
} from "@/types/ai";
import { DIDACTIC_CATEGORY_LABELS } from "@/types/lesson";

// Herontworpen (zie de brief "Herontwerp de AI-activiteitengenerator naar AI
// Lescoach"): dit was een AI-oordeel over de HELE les (score + samenvatting +
// verbeterpunten). Nu: kritisch meekijken met wat er al staat en per sectie
// concrete, direct toepasbare suggesties teruggeven — geen nieuwe activiteit,
// geen algemeen "goed gedaan"-praatje.
const SYSTEM_PROMPT_BASE =
  "Je bent een kritische, ervaren ALO/CALO-stagebegeleider (AI Lescoach). Je krijgt de HUIDIGE " +
  "STAND van een activiteit die een docent zelf aan het opbouwen is — geen lege activiteit, geen " +
  "verzoek om een nieuwe activiteit te maken. Analyseer kritisch en geef UITSLUITEND concrete, " +
  "direct toepasbare suggesties op wat er al staat. Genereer NOOIT een complete nieuwe activiteit " +
  "of hele ontbrekende secties in bulk, en noem nooit gewoon wat al goed is als los 'sterk punt' " +
  "— elke suggestie moet een concrete wijziging of aanvulling voorstellen, geen commentaar zonder " +
  "actie. Werk zoveel mogelijk vanuit de meegeleverde vakliteratuur-fragmenten en vermeld de bron " +
  "(sourceLabel) wanneer een suggestie daar concreet op steunt.";

const FLEXIBLE_ADVICE_INSTRUCTION =
  "Geef ZOVEEL suggesties als de activiteit daadwerkelijk nodig heeft — nul suggesties voor een " +
  "sectie/aspect dat al concreet en goed doordacht is, meerdere voor een zwakke of vage sectie. " +
  "Gebruik GEEN vaste checklist met altijd hetzelfde aantal/soort suggesties. Denkrichtingen (niet " +
  "verplicht, niet uitputtend, en meerdere per suggestie mogelijk): groepsgrootte/organisatie-" +
  "advies, veiligheidswaarschuwingen, de aansluiting tussen Doel en Leeruitkomsten, een " +
  "concreetheid-check op vage secties (te algemene regels/opstelling), en alternatieve Leerhulp-" +
  "varianten.";

const SECTION_LIST = LESCOACH_SECTIONS.join('" | "');

const JSON_FORMAT_INSTRUCTION =
  "Antwoord uitsluitend met geldige JSON in dit exacte formaat, zonder extra tekst of " +
  'markdown-opmaak: {"suggestions": [{"section": "' +
  SECTION_LIST +
  '", "type": string (korte, vrije categorie-naam, bijv. "Groepsgrootte", "Veiligheid", ' +
  '"Concreetheid", "Aansluiting doel-leeruitkomst"), "suggestion": string (voor tekstsecties: de ' +
  "volledige voorgestelde VERVANGENDE tekst voor dat veld; voor learningOutcomes/rules/" +
  'baseMaterials/ruleMaterials: precies ÉÉN nieuw toe te voegen item), "reasoning": string (kort, ' +
  'concreet, waarom), "sourceLabel": string (optioneel, alleen als een vakliteratuur-fragment ' +
  'de directe basis is)}], "didacticSuggestions": [{"category": "loopt_het" | "lukt_het" | ' +
  '"leeft_het", "observation": string ("Wat zie je?"), "action": string ("Wat doe je?"), ' +
  '"reasoning": string}]} (2-3 ALTERNATIEVE didacticSuggestions per categorie die aanvulling ' +
  "verdient — als aanvulling op eventuele bestaande items, nooit als vervanging).";

// Eén volledig uitgewerkt voorbeeld van het gewenste kritische, concrete
// adviesniveau — bewust een PARTIEEL ingevulde activiteit als input (niet
// een lege), want dat is exact het scenario waarin AI Lescoach draait.
const FEW_SHOT_EXAMPLE = {
  input: {
    title: "Insluitspel op drie honken",
    learningLine: "Honkloopspelen",
    movementTheme: "Honkloopspelen",
    movementProblem:
      "Leerlingen rennen vaak blind door naar het volgende honk zonder te kijken waar de bal is.",
    goals: "Leerlingen leren een medespeler insluiten tussen twee honken.",
    learningOutcomes: ["Iemand insluiten tussen de honken"],
    deelnemersRegels: "Groepen van 6, iedereen speelt om de beurt loper en veldspeler.",
    rules: ["Een loper mag alleen tussen twee honken worden getikt."],
    arrangement: "Diamant met 3 honken.",
    didacticItems: [
      {
        category: "loopt_het",
        observation: "Zie je dat de loper twijfelt tussen twee honken zodra de bal bij een veldspeler is?",
        action: "Laat de twee dichtstbijzijnde veldspelers de bal snel overspelen richting de loper.",
      },
    ],
  },
  output: {
    suggestions: [
      {
        section: "deelnemersRegels",
        type: "Groepsgrootte/organisatie",
        suggestion:
          "Groepen van 6: 2 insluiters bij het honkenpaar waar de loper zich bevindt, 3 " +
          "veldspelers verdeeld over de overige honken, 1 loper/slagman. Wissel de rollen elke ronde.",
        reasoning:
          "\"Iedereen speelt om de beurt\" legt geen vaste rolverdeling per ronde vast — zonder " +
          "dat weten leerlingen bij de start van elke ronde niet waar ze moeten staan.",
      },
      {
        section: "rules",
        type: "Veiligheid",
        suggestion: "Tikken mag alleen met de bal in de hand, nooit door de bal naar de loper te gooien.",
        reasoning:
          "Zonder deze regel kan een leerling de bal naar een medeleerling gooien, wat bij dit " +
          "type spel een reëel verwondingsrisico geeft.",
      },
      {
        section: "aandachtspunten",
        type: "Concreetheid",
        suggestion:
          "Let op dat de twee insluiters daadwerkelijk aan BEIDE kanten van het loopvak staan — " +
          "anders kan de loper er zonder risico langsrennen.",
        reasoning:
          "Aandachtspunten ontbrak volledig, terwijl \"insluiten\" als leeruitkomst juist om een " +
          "specifieke coach-observatie vraagt om te bepalen of het daadwerkelijk lukt.",
      },
    ],
    didacticSuggestions: [
      {
        category: "lukt_het",
        observation: "Lukt het de veldspelers om de loper binnen 3 overspeelbeurten te tikken?",
        action:
          "Oefen eerst zonder loper: 2 veldspelers spelen de bal 3 keer snel over en tikken een " +
          "pion op de honklijn, daarna pas met een echte loper erbij.",
        reasoning:
          "Er stond al een \"Loopt het?\"-item, maar \"Lukt het?\" en \"Leeft het?\" ontbraken " +
          "volledig terwijl de activiteit daar wel aanleiding voor geeft.",
      },
      {
        category: "leeft_het",
        observation: "Vieren de veldspelers het samen als het insluiten lukt?",
        action:
          "Geef een punt voor elke succesvolle insluiting (niet alleen voor de laatste tik) — " +
          "dat beloont het SAMEN insluiten, niet alleen wie toevallig de laatste tik geeft.",
        reasoning: "Zie hierboven — \"Leeft het?\" ontbrak volledig.",
      },
    ],
  },
};

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

// Alleen de velden die daadwerkelijk in de aanvraag zaten worden getoond —
// bij een vervolg-aanroep (isFollowUp) ontbreken de ongewijzigde secties
// bewust (zie analyzeLessonInputSchema's toelichting), dus die worden hier
// ook niet als "leeg" aan de AI voorgelegd.
function buildActivitySnapshot(input: AnalyzeLessonInput): string {
  const lines: string[] = [];
  const addText = (label: string, value: string | undefined) => {
    if (value !== undefined && value.trim().length > 0) lines.push(`${label}: ${value}`);
  };
  const addList = (label: string, value: string[] | undefined) => {
    if (value !== undefined) lines.push(`${label}: ${value.length > 0 ? value.join("; ") : "(leeg)"}`);
  };

  addText("Titel", input.title);
  addText("Leerlijn", input.learningLine);
  addText("Bewegingsthema", input.movementTheme);
  addText("Beginsituatie", input.movementProblem);
  if (input.doelgroep !== undefined) lines.push(`Doelgroep-codes: ${input.doelgroep.join(", ") || "(geen)"}`);
  if (input.minParticipants !== undefined) lines.push(`Aantal in het veld: ${input.minParticipants}`);
  if (input.participantsBench !== undefined) lines.push(`Aantal op de bank: ${input.participantsBench}`);
  addText("Doel", input.goals);
  addList("Leeruitkomsten", input.learningOutcomes);
  addText("Deelnemers & Regels", input.deelnemersRegels);
  addText("Plaatje & Praatje", input.plaatjePraatje);
  addText("Aandachtspunten", input.aandachtspunten);
  addList("Regels", input.rules);
  addText("Veldafmetingen & opstelling (arrangement)", input.arrangement);
  addList("Basismateriaal", input.baseMaterials);
  addList("Regelmateriaal", input.ruleMaterials);

  if (input.didacticItems !== undefined) {
    if (input.didacticItems.length === 0) {
      lines.push("Leerhulp (3 L'en): (nog helemaal leeg)");
    } else {
      lines.push("Leerhulp (3 L'en):");
      for (const item of input.didacticItems) {
        lines.push(
          `- [${DIDACTIC_CATEGORY_LABELS[item.category]}] Zie: ${item.observation} / Doe: ${item.action}`,
        );
      }
    }
  }

  return lines.join("\n");
}

function buildFollowUpInstruction(input: AnalyzeLessonInput): string {
  if (!input.isFollowUp) return "";

  const knownSections = new Set(Object.keys(input));
  const omittedSections = LESCOACH_SECTIONS.filter((section) => !knownSections.has(section));
  const previous = input.previousSuggestionTypes ?? [];

  const parts: string[] = [
    "Dit is een VERVOLG-analyse op een activiteit die je al eerder hebt geanalyseerd — alleen de " +
      "secties die de gebruiker daadwerkelijk heeft gewijzigd zijn hieronder meegestuurd.",
  ];
  if (omittedSections.length > 0) {
    parts.push(
      `De volgende secties ontbreken bewust (ongewijzigd sinds de vorige analyse, al beoordeeld — ` +
        `ga ervan uit dat ze in orde zijn en beoordeel ze niet opnieuw): ${omittedSections.join(", ")}.`,
    );
  }
  if (previous.length > 0) {
    const summary = previous.map((p) => `${p.section}/${p.type}`).join(", ");
    parts.push(
      `Eerder al gegeven suggestietypes (vermijd een suggestie die daar inhoudelijk mee overeenkomt): ${summary}.`,
    );
  }
  return parts.join(" ");
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

    const { data: profile } = await supabase
      .from("users")
      .select("subscription_status")
      .eq("id", user.id)
      .single();

    const access = await checkLescoachAccess(
      supabase,
      user.id,
      profile?.subscription_status ?? "free_contributor",
    );

    if (!access.allowed) {
      return Response.json(
        {
          error:
            access.reason === "not_subscriber"
              ? "AI Lescoach is een functie van het betaalde abonnement (EUR 3,-/mnd). Upgrade om 'm te gebruiken."
              : `Je hebt je ${access.limit} AI Lescoach-raadplegingen voor deze maand gebruikt. Volgende maand heb je weer ${access.limit} beschikbaar.`,
          reason: access.reason,
        },
        { status: access.reason === "not_subscriber" ? 403 : 429 },
      );
    }

    const availableSourceCount = await getAvailableSourceCount(user.id);
    if (availableSourceCount === 0) {
      return Response.json({ error: NO_SOURCES_ERROR }, { status: 422 });
    }

    const input = parsed.data;

    // Retrieval-query bewust op de STABIELE identiteitsvelden (nooit
    // gedift weg door de client, zie analyzeLessonInputSchema) — dit houdt
    // de query, en dus de opgehaalde fragmenten, consistent tussen een
    // eerste en een vervolg-aanroep op dezelfde activiteit.
    const query =
      [input.title, input.learningLine, input.movementTheme, input.movementProblem, input.goals]
        .filter(Boolean)
        .join(". ") || "lesvoorbereiding bewegingsonderwijs";

    const cacheKey = buildKnowledgeContextCacheKey(user.id, input.activityId, query);
    let matches = getCachedKnowledgeContext(cacheKey);
    if (matches === null) {
      try {
        matches = await getRelevantKnowledge(supabase, user.id, query, { matchCount: 4 });
        setCachedKnowledgeContext(cacheKey, matches);
      } catch (cause) {
        // Retrieval failure shouldn't block feedback — the AI just falls back
        // to general knowledge, per buildKnowledgePromptSection's empty case.
        console.error("AI Lescoach: Kennisbank-retrieval mislukt:", cause);
        matches = [];
      }
    }

    // Brontracking (activity_knowledge_usage, context='lescoach') — alleen
    // wanneer dit een bestaande activiteit betreft ÉN de aanroeper
    // daadwerkelijk de auteur is. Dat laatste voorkomt dat een willekeurige
    // viewer hún eigen Kennisbank-selectie aan andermans activiteit koppelt.
    if (input.activityId) {
      const { data: ownedActivity } = await supabase
        .from("activiteiten")
        .select("id")
        .eq("id", input.activityId)
        .eq("author_id", user.id)
        .maybeSingle();

      if (ownedActivity) {
        await logKnowledgeUsage(supabase, input.activityId, "lescoach", toUsedKnowledgeChunks(matches));
      }
    }

    // Volgorde bewust zo dat het STABIELE deel van de prompt (instructies,
    // JSON-formaat, few-shot, Kennisbank-context — via de cache hierboven nu
    // ook stabiel tussen herhaalde aanroepen op dezelfde activiteit) vooraan
    // staat en het per-aanroep VARIABELE deel (vervolg-instructie, dan de
    // daadwerkelijke activiteit-inhoud in het user-bericht) achteraan — dat
    // maximaliseert de kans dat OpenAI's eigen automatische prompt-prefix-
    // caching daadwerkelijk een cache-hit oplevert.
    const fewShotInstruction =
      "Voorbeeld van het gewenste kritische, concrete adviesniveau (structuur, niet letterlijk " +
      `overnemen): input ${JSON.stringify(FEW_SHOT_EXAMPLE.input)} -> gewenste output ${JSON.stringify(
        FEW_SHOT_EXAMPLE.output,
      )}`;
    const followUpInstruction = buildFollowUpInstruction(input);
    const systemPrompt =
      `${SYSTEM_PROMPT_BASE}\n\n${FLEXIBLE_ADVICE_INSTRUCTION}\n\n${JSON_FORMAT_INSTRUCTION}\n\n` +
      `${fewShotInstruction}\n\n${buildKnowledgePromptSection(matches)}` +
      (followUpInstruction ? `\n\n${followUpInstruction}` : "");
    const userPrompt = `Huidige stand van de activiteit:\n${buildActivitySnapshot(input)}`;

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

    const analysis = lescoachAnalysisSchema.parse(JSON.parse(raw));
    return Response.json({
      success: true,
      suggestions: analysis.suggestions,
      didacticSuggestions: analysis.didacticSuggestions,
      usedKnowledgeChunks: toUsedKnowledgeChunks(matches),
      remaining: Math.max(access.remaining - 1, 0),
    });
  } catch (cause) {
    logAnalysisFailure(cause);
    return Response.json({ error: toUserMessage(cause) }, { status: 500 });
  }
}
