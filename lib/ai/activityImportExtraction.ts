import { z } from "zod";

import { CHECK_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN } from "@/types/activity";
import { DIDACTIC_CATEGORIES, DIDACTIC_SUBTHEMES, GAME_CATEGORIES } from "@/types/lesson";

// De doelvelden zijn nu een (bijna) 1-op-1 spiegel van CreateLessonFormInput
// (types/lesson.ts) — vóór deze herziening had ExtractedActivity maar ~10
// velden terwijl het wizardformulier (de ENIGE plek waar een activiteit
// wordt aangemaakt, zie les-maken/lesson-flow.tsx) er ~20 heeft. Dat
// structurele gat was de daadwerkelijke oorzaak van "het document bevat dit
// wel, maar het veld blijft leeg": de AI had voor groupName, movementTheme,
// ruleMaterials, minParticipants/participantsBench, aandachtspunten,
// didacticItems, gameCategory/gameDimensions/tacticalQuestions letterlijk
// geen plek om iets in te zetten, ongeacht hoe goed de brontekst was.
const gameDimensionsExtractionSchema = z.object({
  space: z.string().trim().nullable(),
  equipment: z.string().trim().nullable(),
  people: z.string().trim().nullable(),
  rules: z.string().trim().nullable(),
});

const didacticItemExtractionSchema = z.object({
  category: z.enum(DIDACTIC_CATEGORIES),
  subTheme: z.string().trim().nullable(),
  observation: z.string().trim().nullable(),
  action: z.string().trim().nullable(),
});

const rawExtractionSchema = z.object({
  isMovementActivity: z.boolean(),
  title: z.string().trim().nullable(),
  groupName: z.string().trim().nullable(),
  learningLine: z.string().trim().nullable(),
  doelgroep: z.array(z.number()).nullable(),
  movementProblem: z.string().trim().nullable(),
  movementTheme: z.string().trim().nullable(),
  baseMaterials: z.array(z.string().trim()).nullable(),
  ruleMaterials: z.array(z.string().trim()).nullable(),
  minParticipants: z.number().int().nullable(),
  participantsBench: z.number().int().nullable(),
  rules: z.array(z.string().trim()).nullable(),
  goals: z.string().trim().nullable(),
  gameCategory: z.string().trim().nullable(),
  gameDimensions: gameDimensionsExtractionSchema.nullable(),
  tacticalQuestions: z.array(z.string().trim()).nullable(),
  arrangement: z.string().trim().nullable(),
  deelnemersRegels: z.string().trim().nullable(),
  plaatjePraatje: z.string().trim().nullable(),
  aandachtspunten: z.string().trim().nullable(),
  didacticItems: z.array(didacticItemExtractionSchema).nullable(),
});

export type ExtractedActivity = {
  isMovementActivity: boolean;
  title: string | null;
  groupName: string | null;
  learningLine: string | null;
  doelgroep: number[] | null;
  movementProblem: string | null;
  movementTheme: string | null;
  baseMaterials: string[] | null;
  ruleMaterials: string[] | null;
  minParticipants: number | null;
  participantsBench: number | null;
  rules: string[] | null;
  goals: string | null;
  gameCategory: (typeof GAME_CATEGORIES)[number] | null;
  gameDimensions: { space: string; equipment: string; people: string; rules: string } | null;
  tacticalQuestions: string[] | null;
  arrangement: string | null;
  deelnemersRegels: string | null;
  plaatjePraatje: string | null;
  aandachtspunten: string | null;
  didacticItems: Array<{
    category: (typeof DIDACTIC_CATEGORIES)[number];
    subTheme: string | null;
    observation: string;
    action: string;
  }> | null;
};

// Ruim boven wat een normale (zelfs uitgebreide, 10-20 pagina's) lesvoorbe-
// reiding aan tekens bevat, maar ver onder gpt-4o-mini's 128k-tokencontext
// — eerder stond dit op 12.000 tekens (~3.000 tokens), wat een langer
// document met meerdere lesblokken/bijlagen kon afkappen nog vóórdat de AI
// de kans kreeg om bijvoorbeeld een "aandachtspunten"-sectie aan het einde
// te zien. Geen inhoudelijke reden om hier zuinig op te zijn: de kosten
// schalen met tokens, en een gemiddeld document blijft ruim onder deze
// grens (afkapping wordt hieronder expliciet gelogd zodat dit zichtbaar
// blijft als het toch een keer gebeurt).
const MAX_SOURCE_CHARS = 60_000;

const FIELD_DESCRIPTIONS = `
Vul dit exacte veldenschema in — gebruik voor ELK veld null (of [] voor lijsten) als het écht niet in het document staat, maar laat NOOIT een key weg uit je JSON-antwoord:
- "title": titel van de activiteit — een korte, herkenbare naam.
- "groupName": groep/klas in vrije tekst zoals in het document genoemd, bijv. "Groep 7/8" of "Klas 2 VMBO".
- "learningLine": de leerlijn/het vakgebied (bijv. Doelspelen, Turnen, Atletiek, Vechtspelen, Bewegen op muziek) — vrije tekst, zo dicht mogelijk bij wat het document zelf noemt.
- "doelgroep": array met codes uit ${DOELGROEP_WAARDEN.map((code) => `${code}=${DOELGROEP_LABELS[code]}`).join(", ")} — alleen invullen als het document dit ondubbelzinnig aangeeft.
- "movementProblem": het bewegingsprobleem/de kernvraag die leerlingen moeten oplossen.
- "movementTheme": het overkoepelende bewegingsthema van de les.
- "baseMaterials": array met basismateriaal (bijv. "8 kleine doeltjes", "4 ballen") — doorzoek het HELE document hiervoor, dit staat soms verspreid over een inleiding én een aparte materialenlijst; combineer alles wat je vindt in één lijst zonder dubbele items.
- "ruleMaterials": materiaal specifiek voor afbakening/regelhandhaving (bijv. pionnen voor een middengebied) — laat leeg ([]) als het document geen apart onderscheid met basismateriaal maakt.
- "minParticipants": aantal leerlingen dat tegelijk actief meedoet (getal, of null).
- "participantsBench": aantal wisselspelers/leerlingen op de bank (getal, of null).
- "rules": array met spelregels.
- "goals": motorische en/of sociale leerdoelen, als lopende tekst.
- "gameCategory": ALLEEN bij een duidelijk spelgebaseerde activiteit, exact één van: ${GAME_CATEGORIES.join(", ")} — anders null.
- "gameDimensions": ALLEEN bij een spelgebaseerde activiteit, object {"space", "equipment", "people", "rules"} — korte omschrijving van resp. de ruimte, het materiaal, de aantallen en de regels van het spel (Game-Based Pedagogy); anders null.
- "tacticalQuestions": array met 2-3 tactische reflectievragen voor leerlingen, ALLEEN als deze expliciet in het document staan.
- "arrangement": de fysieke opstelling/het speelveld.
- "deelnemersRegels": rolverdeling, teamindeling, wisselregels — let op: dit is vaak uitgebreidere, beschrijvende tekst en niet hetzelfde als de losse "rules"-lijst hierboven.
- "plaatjePraatje": hoe de instructie visueel getoond en mondeling uitgelegd wordt, wisselafspraken.
- "aandachtspunten": veiligheid, houding, tactiek — waar moet de docent op letten? Dit staat vaak in een apart "let op"/"aandachtspunten"-kopje, soms pas aan het einde van het document — mis dit niet.
- "didacticItems": array van 3L's-analyse-items, ALLEEN als het document expliciet deze differentiatie-structuur bevat (bijv. "wat als het niet lukt", "loopt het", "leeft het" of duidelijk vergelijkbare taal). Elk item: {"category": exact "loopt_het"|"lukt_het"|"leeft_het", "subTheme": een van ${Object.entries(
  DIDACTIC_SUBTHEMES,
)
  .map(([category, subthemes]) => `${category}: ${subthemes.join("/")}`)
  .join("; ")} (of null als niet duidelijk), "observation": wat je ziet/wat er misgaat, "action": wat je als docent doet}. Laat dit [] als het document deze structuur niet gebruikt.`;

const FEW_SHOT_EXAMPLES: Array<{ user: string; assistant: Record<string, unknown> }> = [
  {
    user:
      "Chaosdoelenspel\n\nGroep 7/8. Leerlijn: Doelspelen.\n" +
      "Bewegingsprobleem: overzicht houden en kiezen tussen aanvallen en verdedigen in wisselende spelsituaties.\n" +
      "Bewegingsthema: doelen maken en verdedigen in chaos.\n\n" +
      "Inleiding: we spelen op een veld van 20x20m met 8 kleine doeltjes verspreid over het veld, in twee kleurgroepen " +
      "(4 rood, 4 blauw). Materiaal: 4 ballen, hesjes in 2 kleuren.\n\n" +
      "Twee teams van 4-6 spelers vallen de doeltjes van de andere kleur aan en verdedigen de eigen kleur. " +
      "Wisselspelers op de bank wisselen elke 2 minuten in. Elk doelpunt telt 1 punt, niet hard op de keeper schieten.\n\n" +
      "Doel: leerlingen kunnen doelpogingen op meerdere doelen afwisselen en spelen samen zonder ruzie over de telling.\n\n" +
      "Toon op het bord waar de doeltjes staan en welke kleur bij welk team hoort.\n\n" +
      "Materialenlijst (bijlage): 8 kleine doeltjes, 4 pionnen voor het middengebied.\n\n" +
      "Aandachtspunten: let op overbelasting bij het duiken/keepen; wissel keepers regelmatig.\n\n" +
      "Lukt het niet: speler mist het doel of durft niet te schieten -> laat de zwakkere speler dichterbij een groter " +
      "doel starten.",
    assistant: {
      isMovementActivity: true,
      title: "Chaosdoelenspel",
      groupName: "Groep 7/8",
      learningLine: "Doelspelen",
      doelgroep: [4],
      movementProblem:
        "Overzicht houden en kiezen tussen aanvallen en verdedigen in wisselende spelsituaties",
      movementTheme: "Doelen maken en verdedigen in chaos",
      baseMaterials: ["8 kleine doeltjes", "4 ballen", "hesjes in 2 kleuren"],
      ruleMaterials: ["4 pionnen voor het middengebied"],
      minParticipants: null,
      participantsBench: null,
      rules: ["Elk doelpunt telt 1 punt", "Niet hard op de keeper schieten"],
      goals:
        "Motorisch: leerlingen kunnen doelpogingen op meerdere doelen afwisselen. Sociaal: leerlingen spelen samen zonder ruzie over de telling.",
      gameCategory: "Target Games",
      gameDimensions: {
        space: "Veld van 20x20m met 8 kleine doeltjes verspreid over het veld",
        equipment: "4 ballen, 8 kleine doeltjes, hesjes in 2 kleuren",
        people: "Twee teams van 4-6 spelers",
        rules: "Elk doelpunt telt 1 punt, niet hard op de keeper schieten",
      },
      tacticalQuestions: [],
      arrangement:
        "Speelveld van ongeveer 20x20m met 8 kleine doeltjes verspreid over het veld, in twee kleurgroepen (4 rood, 4 blauw).",
      deelnemersRegels:
        "Twee teams van elk 4-6 spelers. Iedereen valt de doeltjes van de andere kleur aan en verdedigt de eigen kleur. Wisselspelers op de bank wisselen elke 2 minuten in.",
      plaatjePraatje: "Toon op het bord waar de doeltjes staan en welke kleur bij welk team hoort.",
      aandachtspunten: "Let op overbelasting bij het duiken/keepen; wissel keepers regelmatig.",
      didacticItems: [
        {
          category: "lukt_het",
          subTheme: "Differentiatie (zwakke vs betere beweger)",
          observation: "Speler mist het doel of durft niet te schieten.",
          action: "Laat de zwakkere speler dichterbij een groter doel starten.",
        },
      ],
    },
  },
  {
    user:
      "Tikspel opwarmer\n\n- Groep: onbekend, gewone gymles\n- Tikkertje met 2 tikkers, hesjes\n- Regels: getikte spelers " +
      "zitten tot een medespeler ze bevrijdt",
    assistant: {
      isMovementActivity: true,
      title: "Tikspel opwarmer",
      groupName: null,
      learningLine: null,
      doelgroep: null,
      movementProblem: null,
      movementTheme: null,
      baseMaterials: ["hesjes"],
      ruleMaterials: [],
      minParticipants: null,
      participantsBench: null,
      rules: ["Getikte spelers zitten tot een medespeler ze bevrijdt"],
      goals: null,
      gameCategory: null,
      gameDimensions: null,
      tacticalQuestions: [],
      arrangement: null,
      deelnemersRegels: "2 tikkers tikken de rest van de groep.",
      plaatjePraatje: null,
      aandachtspunten: null,
      didacticItems: [],
    },
  },
];

const SYSTEM_PROMPT =
  "Je zet een geüploade lesvoorbereiding (bewegingsonderwijs) om naar het GymWiki-activiteitenformaat. " +
  "Haal ALLEEN informatie op die daadwerkelijk in de tekst staat — verzin NOOIT een waarde die je niet kunt " +
  "onderbouwen uit de tekst. Zet een veld op null (of [] voor lijsten) als het niet met voldoende zekerheid " +
  "is af te leiden; de gebruiker vult dat daarna zelf aan vóór het indienen. Dit is BELANGRIJKER dan " +
  "volledigheid: liever een terecht leeg veld dan een gegokte waarde.\n\n" +
  "Het document kan de informatie over meerdere secties of pagina's verspreid hebben (bijv. materiaal dat " +
  "zowel in een inleiding als in een aparte materialenlijst genoemd wordt, of aandachtspunten die pas aan " +
  "het einde van het document staan) — lees en gebruik de VOLLEDIGE tekst, niet alleen het eerste deel.\n\n" +
  FIELD_DESCRIPTIONS +
  "\n\nZet \"isMovementActivity\" op false wanneer het document duidelijk geen bewegingsactiviteit of " +
  "lesvoorbereiding bewegingsonderwijs bevat (bijv. een factuur, een heel ander vak, willekeurige tekst) — " +
  "vul in dat geval alle overige velden met null/[].\n\n" +
  "Antwoord uitsluitend met geldige JSON die ALLE bovenstaande keys bevat, zonder extra tekst of " +
  "markdown-opmaak.";

export type ExtractActivityResult = {
  activity: ExtractedActivity;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Losstaande AI-extractie/mapping-service: zet ruwe documenttekst (uit
 * lib/ai/documentText.ts) om naar de GymWiki-activiteitenstructuur. Bewust
 * hier geïsoleerd van actions/activityImport.ts zodat dezelfde mapping later
 * voor andere import-functionaliteit hergebruikt kan worden. Geeft ook de
 * token-usage terug zodat de aanroeper dit als echte AI-kosten kan loggen
 * (zie lib/ai/usageTracking.ts).
 *
 * `logContext` is puur voor diagnose (bijv. een jobId) — verschijnt alleen
 * in de afkap-waarschuwing hieronder.
 */
export async function extractActivityFromText(
  sourceText: string,
  logContext = "onbekend",
): Promise<ExtractActivityResult> {
  const client = getOpenAIClient();
  const wasTruncated = sourceText.length > MAX_SOURCE_CHARS;
  const truncated = wasTruncated ? sourceText.slice(0, MAX_SOURCE_CHARS) : sourceText;

  if (wasTruncated) {
    console.warn(
      `extractActivityFromText[${logContext}]: brontekst afgekapt van ${sourceText.length} naar ${MAX_SOURCE_CHARS} tekens — mogelijk mist de AI hierdoor informatie verderop in het document.`,
    );
  }

  const fewShotMessages = FEW_SHOT_EXAMPLES.flatMap(({ user, assistant }) => [
    { role: "user" as const, content: user },
    { role: "assistant" as const, content: JSON.stringify(assistant) },
  ]);

  const completion = await client.chat.completions.create({
    model: CHECK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...fewShotMessages,
      { role: "user", content: truncated },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Geen antwoord van de AI-extractie ontvangen.");
  }

  const parsed = rawExtractionSchema.parse(JSON.parse(raw));

  // De AI-output valideren tegen de echte, vaste waardelijsten — een
  // gehallucineerde code/categorie wordt stilzwijgend null (of uit de
  // lijst gefilterd) i.p.v. een ongeldige waarde het formulier in te laten
  // stromen.
  const geldigeDoelgroep = (parsed.doelgroep ?? []).filter((code) =>
    (DOELGROEP_WAARDEN as readonly number[]).includes(code),
  );

  const gameCategory =
    parsed.gameCategory && (GAME_CATEGORIES as readonly string[]).includes(parsed.gameCategory)
      ? (parsed.gameCategory as (typeof GAME_CATEGORIES)[number])
      : null;

  const gameDimensions = parsed.gameDimensions
    ? {
        space: parsed.gameDimensions.space ?? "",
        equipment: parsed.gameDimensions.equipment ?? "",
        people: parsed.gameDimensions.people ?? "",
        rules: parsed.gameDimensions.rules ?? "",
      }
    : null;

  const didacticItems = (parsed.didacticItems ?? [])
    .filter((item) => item.observation && item.action)
    .map((item) => ({
      category: item.category,
      subTheme:
        item.subTheme && (DIDACTIC_SUBTHEMES[item.category] as readonly string[]).includes(item.subTheme)
          ? item.subTheme
          : null,
      observation: item.observation as string,
      action: item.action as string,
    }));

  return {
    activity: {
      isMovementActivity: parsed.isMovementActivity,
      title: parsed.title || null,
      groupName: parsed.groupName || null,
      learningLine: parsed.learningLine || null,
      doelgroep: geldigeDoelgroep.length > 0 ? geldigeDoelgroep : null,
      movementProblem: parsed.movementProblem || null,
      movementTheme: parsed.movementTheme || null,
      baseMaterials: parsed.baseMaterials && parsed.baseMaterials.length > 0 ? parsed.baseMaterials : null,
      ruleMaterials: parsed.ruleMaterials && parsed.ruleMaterials.length > 0 ? parsed.ruleMaterials : null,
      minParticipants: parsed.minParticipants ?? null,
      participantsBench: parsed.participantsBench ?? null,
      rules: parsed.rules && parsed.rules.length > 0 ? parsed.rules : null,
      goals: parsed.goals || null,
      gameCategory,
      gameDimensions,
      tacticalQuestions:
        parsed.tacticalQuestions && parsed.tacticalQuestions.length > 0 ? parsed.tacticalQuestions : null,
      arrangement: parsed.arrangement || null,
      deelnemersRegels: parsed.deelnemersRegels || null,
      plaatjePraatje: parsed.plaatjePraatje || null,
      aandachtspunten: parsed.aandachtspunten || null,
      didacticItems: didacticItems.length > 0 ? didacticItems : null,
    },
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
}
