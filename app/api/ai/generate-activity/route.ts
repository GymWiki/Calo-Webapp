import { cookies } from "next/headers";
import OpenAI from "openai";
import { createClient } from "@/utils/supabase/server";
import {
  buildKnowledgePromptSection,
  getRelevantKnowledge,
  summarizeKnowledgeSources,
} from "@/lib/ai/knowledgeRetrieval";
import { toUsedKnowledgeChunks } from "@/lib/ai/knowledgeUsageLogging";
import { checkLessonGeneratorAccess } from "@/lib/ai/lessonGeneratorAccess";
import { CHAT_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { recordAiUsage } from "@/lib/ai/usageTracking";
import { BEWEGINGSTHEMAS } from "@/lib/constants/learningLines";
import { getAvailableSourceCount } from "@/lib/services/knowledgePackages";
import {
  generateActivityInputSchema,
  generatedLessonSchema,
  type GeneratedLessonWithIds,
} from "@/types/ai";
import type { DidacticItem } from "@/types/lesson";

// Herzien (zie de brief "Verbeter de AI-activiteitengenerator"): voorheen
// resulteerde alleen leerlijn+doelgroep als input vaak in een vage, generieke
// opzet — geen concreet decor (sport/onderwerp) en geen sturende
// leeruitkomst, dus de AI vulde de Leeruitkomsten-sectie zelf niet (of leeg)
// in en bleef algemeen. Nu is topic (onderwerp/sport) + minstens 1 gekozen
// leeruitkomst VERPLICHTE input (generateActivityInputSchema), gebruikt om
// de AI te dwingen tot ÉÉN scherp afgebakende, uitvoerbare activiteit i.p.v.
// een lesoverzicht.
const SYSTEM_PROMPT_BASE =
  "Je bent een ervaren ontwerper van lesvoorbereidingen bewegingsonderwijs, werkend volgens " +
  "de Nederlandse bewegingsonderwijs-praktijk (Basisdocument Bewegingsonderwijs, SLO/KVLO). " +
  "Genereer ÉÉN specifieke, direct uitvoerbare activiteit — GEEN algemeen lesoverzicht, geen " +
  "vage suggesties, geen los rijtje losse tips. De activiteit moet een docent zonder verdere " +
  "uitleg kunnen opzetten en uitvoeren: vul ELKE sectie concreet en toepasbaar in (exacte " +
  "spelregels, exacte opstelling/veldindeling, exact wat deelnemers wel/niet mogen), nooit " +
  "algemene didactische tips die voor bijna elke activiteit zouden gelden. Gebruik de " +
  "opgegeven leeruitkomst(en) als het sturende uitgangspunt voor de HELE activiteit-opzet " +
  "(spelregels, opstelling, aandachtspunten draaien daar expliciet om), niet als een los, " +
  "onderbelicht detail. Baseer je daarnaast op de meegeleverde vakliteratuur-fragmenten.";

// `movementTheme` is een verfijning BINNEN de gekozen leerlijn, geen los
// begrip ernaast — zie lib/constants/learningLines.ts (BEWEGINGSTHEMAS).
function buildMovementThemeInstruction(learningLine: string): string {
  const themeOptions = BEWEGINGSTHEMAS[learningLine];
  if (themeOptions && themeOptions.length > 0) {
    return (
      `Voor de leerlijn "${learningLine}" is "movementTheme" een van deze bewegingsthema's: ` +
      `${themeOptions.join(", ")}. Kies er exact één, verzin geen andere.`
    );
  }
  return (
    `Voor de leerlijn "${learningLine}" bestaat geen vaste bewegingsthema-lijst: zet ` +
    '"movementTheme" gelijk aan de leerlijn zelf ("' +
    learningLine +
    '"), of een korte, specifieke variant daarvan — verzin geen nieuwe leerlijn- of ' +
    "themanaam die niet uit de opgegeven leerlijn zelf volgt."
  );
}

// De gekozen leeruitkomst(en) worden NA generatie deterministisch in de
// output overgenomen (zie POST hieronder) — dit veld hoeft de AI dus niet
// zelf te produceren. Het staat hier alleen als sturende INSTRUCTIE, niet in
// het JSON-uitvoerformaat.
function buildLearningOutcomesInstruction(learningOutcomes: string[]): string {
  const list = learningOutcomes.map((outcome) => `"${outcome}"`).join(", ");
  return (
    `De activiteit moet specifiek gericht zijn op deze gekozen leeruitkomst(en): ${list}. ` +
    "Verwerk elke genoemde leeruitkomst herkenbaar in de spelregels/opstelling (arrangement, " +
    "deelnemersRegels, rules) — een lezer moet direct kunnen zien hoe de activiteit precies " +
    "op déze leeruitkomst(en) traint, niet alleen er losjes bij passen."
  );
}

function buildContextInstruction(input: {
  minParticipants?: number;
  participantsBench?: number;
  location?: "binnen" | "buiten";
  availableMaterials: string[];
}): string {
  const parts: string[] = [];
  if (input.minParticipants !== undefined || input.participantsBench !== undefined) {
    parts.push(
      `Groepsgrootte: ${input.minParticipants ?? "onbekend"} deelnemer(s) actief in het veld` +
        (input.participantsBench !== undefined
          ? `, ${input.participantsBench} deelnemer(s) op de bank (wachtend/observerend)`
          : "") +
        " — houd de opstelling en organisatievorm hier realistisch op afgestemd.",
    );
  }
  if (input.location) {
    parts.push(
      input.location === "binnen"
        ? "De activiteit vindt plaats binnen (gymzaal) — houd rekening met een begrensde ruimte."
        : "De activiteit vindt plaats buiten — een groter, open terrein is mogelijk.",
    );
  }
  if (input.availableMaterials.length > 0) {
    parts.push(
      `Beperk baseMaterials/ruleMaterials tot dit daadwerkelijk beschikbare materiaal: ` +
        `${input.availableMaterials.join(", ")} (plus vanzelfsprekende basisuitrusting zoals ` +
        "pionnen/hesjes) — verzin geen materiaal buiten deze lijst.",
    );
  }
  return parts.length > 0 ? parts.join(" ") : "";
}

const JSON_FORMAT_INSTRUCTION =
  "Antwoord uitsluitend met geldige JSON in dit exacte formaat, zonder extra tekst of " +
  "markdown-opmaak: " +
  '{"title": string, "learningLine": string, "movementProblem": string, ' +
  '"movementTheme": string, ' +
  '"doelgroep": number[] (leid dit af uit de opgegeven doelgroep — kies 1 of meer codes ' +
  "uit deze lijst die het beste passen: 1 = Groep 1/2, 2 = Groep 3/4, 3 = Groep 5/6, " +
  "4 = Groep 7/8, 5 = Onderbouw, 6 = Bovenbouw), " +
  '"goals": string (concreet, verwijst naar de gekozen leeruitkomst(en) en het onderwerp/de ' +
  'sport — geen algemene formulering), ' +
  '"didacticItems": [{"category": "loopt_het" | "lukt_het" | "leeft_het", ' +
  '"subTheme": string of null, "observation": string ("Wat zie je?" — concreet, bij dit ' +
  'onderwerp/deze leeruitkomst), "action": string ("Wat doe je?" — een concrete ' +
  'docentinterventie, geen algemene tip)}] (minimaal 1 item per categorie), ' +
  '"baseMaterials": string[] (exact materiaal, geen "diverse materialen"), ' +
  '"ruleMaterials": string[], ' +
  '"rules": string[] (exacte, afdwingbare spelregels — genummerd/concreet, geen vage tips), ' +
  '"arrangement": string (exacte veldafmetingen/opstelling — waar staan honken/lijnen/doelen), ' +
  '"deelnemersRegels": string (exact wat deelnemers in welke rol doen), ' +
  '"plaatjePraatje": string (de concrete beginsituatie/instructie die de docent uitspreekt), ' +
  '"aandachtspunten": string (specifiek voor déze activiteit, geen generieke veiligheidstip)}';

// Concreet few-shot voorbeeld — softbal/"iemand insluiten tussen de
// honken"/onderbouw, exact het scenario uit de brief — zodat de AI een
// tastbaar patroon van specificiteit heeft om te volgen i.p.v. te moeten
// afleiden wat "concreet genoeg" betekent uit abstracte instructies alleen.
const FEW_SHOT_EXAMPLE = {
  input: {
    topic: "Softbal",
    learningLine: "Honkloopspelen",
    learningOutcomes: ["Iemand insluiten tussen de honken"],
    targetGroup: "Onderbouw",
  },
  output: {
    title: "Insluitspel op drie honken",
    learningLine: "Honkloopspelen",
    movementProblem:
      "Leerlingen rennen vaak blind door naar het volgende honk zonder te kijken waar de bal is, " +
      "waardoor ze getikt worden vlak vóór een honk in plaats van er veilig te blijven staan.",
    movementTheme: "Honkloopspelen",
    doelgroep: [5],
    goals:
      "Leerlingen leren een medespeler tussen twee honken insluiten door de bal snel over te " +
      "spelen en de loper klem te zetten, en leren zelf als loper op tijd te beslissen wanneer " +
      "ze wel of niet doorrennen naar het volgende honk.",
    didacticItems: [
      {
        category: "loopt_het",
        subTheme: "Insluiten tussen de honken",
        observation:
          "Zie je dat de loper twijfelt en halverwege tussen twee honken blijft staan zodra de " +
          "bal bij een veldspeler is?",
        action:
          "Laat de twee dichtstbijzijnde veldspelers de bal snel naar elkaar overspelen terwijl " +
          "ze steeds een stap richting de loper zetten, tot de loper wordt getikt of terug moet.",
      },
      {
        category: "lukt_het",
        subTheme: "Insluiten tussen de honken",
        observation: "Lukt het de veldspelers om de loper binnen 3 overspeelbeurten te tikken?",
        action:
          "Oefen eerst zonder loper: twee veldspelers spelen de bal 3 keer snel over en tikken " +
          "een pion op de honklijn, daarna pas met een echte loper erbij.",
      },
      {
        category: "leeft_het",
        subTheme: "Insluiten tussen de honken",
        observation: "Vieren de veldspelers het samen als het insluiten lukt?",
        action:
          "Geef elk team een punt voor elke succesvolle insluiting, niet alleen voor een tik — " +
          "dat beloont het SAMEN insluiten, niet alleen de laatste tik.",
      },
    ],
    baseMaterials: ["3 honkzakken", "1 startplaat (thuishonk)", "1 softbal", "1 slagbal-knuppel"],
    ruleMaterials: ["4 pionnen (hoeken van het loopvak)"],
    rules: [
      "Een loper mag alleen tussen twee honken worden getikt met de bal in de hand, niet door de bal naar de loper te gooien.",
      "Zodra een loper wordt ingesloten (twee veldspelers staan tussen de loper en beide honken), moet de loper binnen 5 seconden een keuze maken: doorrennen of teruggaan.",
      "Een loper die wordt getikt tussen de honken is af en wisselt van rol met een veldspeler.",
      "Veldspelers mogen de bal alleen onderling overspelen, niet zelf naar het honk rennen om te tikken.",
    ],
    arrangement:
      "Diamant met 3 honken (10 meter tussenafstand) plus het startplaat/thuishonk. Tussen elk " +
      "honkenpaar staat een loopvak van 2 meter breed, gemarkeerd met pionnen op de hoeken — " +
      "daar mag het insluiten plaatsvinden.",
    deelnemersRegels:
      "Groepen van 6: 1 slagman/loper, 2 insluiters bij het honkenpaar waar de loper zich " +
      "bevindt, 3 overige veldspelers verdeeld over de andere honken. Rollen wisselen na elke " +
      "beurt.",
    plaatjePraatje:
      "\"Je slaat de bal en rent naar het eerste honk. Maar let op: zodra twee veldspelers " +
      "tussen jou en het volgende honk komen staan, moet je snel kiezen — doorrennen of terug!\"",
    aandachtspunten:
      "Let op dat de twee insluiters echt SAMEN de loper insluiten (aan beide kanten van het " +
      "loopvak staan) — anders kan de loper er zonder risico langs rennen. Wissel de insluiters " +
      "elke ronde zodat iedereen die rol een keer vervult.",
  },
};

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
    // Onderwerp/sport + leeruitkomst(en) toegevoegd aan de retrieval-query:
    // geeft de RAG-zoekopdracht een veel concreter decor dan leerlijn+
    // doelgroep alleen, dus relevantere vakliteratuur-fragmenten.
    const query = [input.topic, input.learningLine, ...input.learningOutcomes, input.targetGroup]
      .join(". ");

    let matches: Awaited<ReturnType<typeof getRelevantKnowledge>> = [];
    try {
      matches = await getRelevantKnowledge(supabase, user.id, query, { matchCount: 4 });
    } catch (cause) {
      // Retrieval failure shouldn't block generation — falls back to general
      // knowledge, per buildKnowledgePromptSection's empty case. Wél loggen:
      // dit is precies het soort fout die eerder onzichtbaar bleef.
      console.error("AI Activiteiten Generator: Kennisbank-retrieval mislukt:", cause);
    }

    const domainInstruction = buildMovementThemeInstruction(input.learningLine);
    const learningOutcomesInstruction = buildLearningOutcomesInstruction(input.learningOutcomes);
    const contextInstruction = buildContextInstruction(input);
    const fewShotInstruction =
      "Voorbeeld van het gewenste specificiteitsniveau (zelfde structuur, niet letterlijk " +
      `overnemen — pas toe op de daadwerkelijk gevraagde input): input ${JSON.stringify(
        FEW_SHOT_EXAMPLE.input,
      )} -> gewenste output ${JSON.stringify(FEW_SHOT_EXAMPLE.output)}`;
    // Statische instructies eerst, de per-aanroep opgehaalde Kennisbank-
    // fragmenten laatst: OpenAI cachet automatisch een identiek prompt-
    // prefix tussen aanroepen (geen aparte cache-API nodig, in tegenstelling
    // tot Anthropic). Omdat de fragmenten hier query-afhankelijk zijn (RAG op
    // onderwerp/leerlijn/leeruitkomst/doelgroep) is de prefix niet bij élke
    // aanroep identiek, maar deze volgorde maximaliseert het stabiele,
    // cachebare deel en profiteert dus wél zodra twee aanroepen dezelfde
    // combinatie gebruiken.
    const systemPrompt =
      `${SYSTEM_PROMPT_BASE}\n\n${JSON_FORMAT_INSTRUCTION}\n\n${domainInstruction}\n\n` +
      `${learningOutcomesInstruction}\n\n${contextInstruction}\n\n${fewShotInstruction}\n\n` +
      buildKnowledgePromptSection(matches);
    const userPrompt =
      `Onderwerp/sport: ${input.topic}\nLeerlijn: ${input.learningLine}\n` +
      `Gekozen leeruitkomst(en): ${input.learningOutcomes.join("; ")}\n` +
      `Doelgroep: ${input.targetGroup}`;

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
      // Deterministisch overgenomen uit de eigen selectie van de gebruiker
      // — NIET aan de AI overgelaten (die liet deze sectie voorheen leeg of
      // vulde 'm inconsistent). Garandeert dat "Leeruitkomsten" nooit leeg is
      // en exact overeenkomt met wat is gekozen.
      learningOutcomes: input.learningOutcomes,
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
      // Nog geen activity-id op dit moment (de gegenereerde les is nog niet
      // opgeslagen) — deze fragmenten worden pas gelogd (activity_knowledge_
      // usage, context='generate') zodra de gebruiker de activiteit
      // daadwerkelijk opslaat, zie les-maken/lesson-form.tsx +
      // actions/lesson.ts.
      usedKnowledgeChunks: toUsedKnowledgeChunks(matches),
      remaining: Math.max(access.remaining - 1, 0),
    });
  } catch (cause) {
    logGenerationFailure(cause);
    return Response.json({ error: toUserMessage(cause) }, { status: 500 });
  }
}
