import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { CHECK_MODEL, DOCUMENT_EXTRACTION_MODEL, getOpenAIClient } from "@/lib/ai/openai-client";
import { BEWEGINGSTHEMAS, ALL_LEARNING_LINES } from "@/lib/constants/learningLines";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN } from "@/types/activity";
import { DIDACTIC_CATEGORIES, DIDACTIC_SUBTHEMES } from "@/types/lesson";
import type { NormalizedImportInput } from "@/lib/ai/documentNormalization";

// Herbouw van "Activiteit uit document": elk veld is hieronder gedefinieerd op
// BETEKENIS ("wat betekent dit veld, functioneel"), niet op een verwacht
// kopje — de vorige versie van dit bestand ging ervan uit dat een document
// ongeveer dezelfde koppen/volgorde gebruikte als de twee few-shot-
// voorbeelden, en viel daarbuiten grotendeels stil. Zie het plan-bestand van
// deze sessie voor de volledige veld-voor-veld-herleiding uit de echte
// UI-labels/placeholders in components/activity-wizard-page.tsx (niet geraden).
//
// Twee onafhankelijke, bewuste ontwerpkeuzes:
// 1. Elk inhoudelijk veld is gewrapt in {value, confidence, sourceFragment} —
//    "confidence" laat het formulier later markeren welke velden de
//    gebruiker extra moet controleren, "sourceFragment" is een (kort,
//    letterlijk) citaat uit het document dat de waarde onderbouwt, puur voor
//    menselijke verificatie. Strict Structured Outputs staat GEEN .optional()
//    toe (elke key moet aanwezig zijn) — vandaar overal .nullable() i.p.v.
//    .optional() voor "niet gevonden".
// 2. "unplacedContent" is de dekkingscheck: in plaats van een eigen
//    tekst-vergelijkingsalgoritme (brontekst vs. ingevulde velden) te bouwen
//    — notoir onbetrouwbaar zodra het model ook maar licht herformuleert,
//    herordent, of opmaak toevoegt — rapporteert het model dit ZELF. Het
//    heeft de volledige brontekst al gezien; een zelfrapportage is
//    betrouwbaarder (hoger bereik, geen valse positieven door toevallige
//    woordoverlap) dan een na-de-feit-diff. Bewust gedocumenteerd hier zodat
//    een latere lezer niet alsnog een fragiele heuristiek erbovenop bouwt.
const confidenceSchema = z.enum(["high", "low"]);

function field<T extends z.ZodTypeAny>(valueSchema: T) {
  return z.object({
    value: valueSchema,
    confidence: confidenceSchema,
    sourceFragment: z.string().nullable(),
  });
}

const didacticItemExtractionSchema = z.object({
  category: z.enum(DIDACTIC_CATEGORIES),
  subTheme: z.string().nullable(),
  observation: z.string(),
  action: z.string(),
});

const extractedActivitySchema = z.object({
  isMovementActivity: z.boolean(),

  title: field(z.string().nullable()),
  movementTheme: field(z.string().nullable()),
  learningLine: field(z.string().nullable()),

  goals: field(z.string().nullable()),
  beschrijving: field(z.string().nullable()),
  rules: field(z.array(z.string())),
  learningOutcomes: field(z.array(z.string())),
  aandachtspunten: field(z.string().nullable()),

  movementProblem: field(z.string().nullable()),
  doelgroep: field(z.array(z.number().int())),
  minParticipants: field(z.number().int().nullable()),
  participantsBench: field(z.number().int().nullable()),

  baseMaterials: field(z.array(z.string())),
  ruleMaterials: field(z.array(z.string())),

  didacticItems: field(z.array(didacticItemExtractionSchema)),

  deelnemersRegels: field(z.string().nullable()),
  arrangement: field(z.string().nullable()),

  // "duur" heeft in dit datamodel geen bestemmingsveld (geen duration-kolom
  // nergens in types/lesson.ts of de activiteiten-tabel) — toch extraheren
  // zodat het niet verloren gaat; de processor zet een gevonden waarde zelf
  // om in een unplacedContent-item (zie extractedActivityMapping.ts).
  durationMinutes: field(z.number().int().nullable()),

  unplacedContent: z.array(
    z.object({
      text: z.string(),
      note: z.string().nullable(),
    }),
  ),
});

export type ExtractedActivity = z.infer<typeof extractedActivitySchema>;

const FIELD_DESCRIPTIONS = `
Elk veld hieronder is gedefinieerd op FUNCTIE/BETEKENIS, niet op een verwacht kopje. Documenten gebruiken wisselende sjablonen: kopjes kunnen anders heten, ontbreken, of de waarde kan onder/naast/in dezelfde tabelcel als het kopje staan in plaats van erna. Zoek naar de BETEKENIS, niet naar een letterlijke koptekst-match.

- "title": de naam/titel van de activiteit.
- "movementTheme" (type activiteit): het bewegingsthema. Sommige leerlijnen hebben een vaste thema-lijst: ${Object.entries(
  BEWEGINGSTHEMAS,
)
  .map(([line, themes]) => `${line} -> ${themes.join("/")}`)
  .join("; ")}. Valt "learningLine" onder zo'n leerlijn, kies dan exact één daaruit; anders een korte, specifieke variant die duidelijk bij die leerlijn hoort.
- "learningLine": de leerlijn/het vakgebied. Kies bij voorkeur exact één van: ${ALL_LEARNING_LINES.join(", ")}. Staat er een vergelijkbare maar anders geformuleerde naam in het document, kies de dichtstbijzijnde uit deze lijst.
- "goals" (doel): wat leerlingen in het spel proberen te bereiken — de opdracht/winvoorwaarde, en/of wat ze ervan leren.
- "beschrijving": het VOLLEDIGE spelverloop als lopende tekst — opstelling, hoe het spel start, wat spelers precies doen, hoe gescoord/gewisseld wordt. Dit is vaak de langste, centrale tekst in het document; neem het zo volledig en letterlijk mogelijk over, vat niet samen.
- "rules" (regels): array met afspraken die tijdens het spel gelden — ÉÉN afspraak per item, geen volledige verloopzinnen (die horen bij "beschrijving"). Niet hetzelfde als "deelnemersRegels" hieronder.
- "learningOutcomes" (leeruitkomsten): array met wat leerlingen ontwikkelen/leren — motorisch, sociaal, cognitief, etc.
- "aandachtspunten": veiligheid en aandachtspunten voor de docent (houding, tactiek, risico's) — staat vaak in een apart "let op"-kopje, soms pas aan het einde; mis dit niet.
- "movementProblem" (beginsituatie): wat wordt verondersteld dat leerlingen al kunnen/hebben gedaan — voorkennis, context, niveau-aanname. Onderdeel van "beginsituatie & doelgroep" samen met de drie velden hieronder.
- "doelgroep": array met codes uit ${DOELGROEP_WAARDEN.map((code) => `${code}=${DOELGROEP_LABELS[code]}`).join(", ")} — alleen invullen als het document dit ondubbelzinnig aangeeft.
- "minParticipants"/"participantsBench": aantal actieve spelers / aantal wisselspelers-op-de-bank, als getallen genoemd worden.
- "baseMaterials"/"ruleMaterials" (materiaal): benodigdheden. Doorzoek het HELE document (vaak verspreid over inleiding én een aparte materialenlijst). Groepeer zoals het document dat zelf doet als het een onderscheid maakt tussen basismateriaal en materiaal specifiek voor een regel/afbakening ("ruleMaterials") — anders alles in "baseMaterials".
- "didacticItems" (leerhulp): array van differentiatie-items (moeilijker/makkelijker maken, hulp voor leerlingen), ALLEEN als het document deze structuur expliciet bevat (bijv. "wat als het niet lukt", "loopt het"/"lukt het"/"leeft het" of duidelijk vergelijkbare taal). Elk item: {"category": exact "loopt_het"|"lukt_het"|"leeft_het", "subTheme": een van ${Object.entries(
  DIDACTIC_SUBTHEMES,
)
  .map(([category, subthemes]) => `${category}: ${subthemes.join("/")}`)
  .join("; ")} (of null), "observation": wat je ziet/wat er misgaat, "action": wat de docent doet}.
- "deelnemersRegels": WIE welke rol heeft tijdens het spel — posities, wissel-/rotatieafspraken, scheidsrechter-/tellerrol. NIET de algemene spelregels (die horen bij "rules") en NIET het volledige spelverloop (dat hoort bij "beschrijving").
- "arrangement": tekstuele beschrijving van de fysieke opstelling/het speelveld (veldafmetingen, indeling) — los van een eventuele getekende plattegrond.
- "durationMinutes": de duur van de activiteit in minuten, als genoemd.

Vul voor ELK veld hierboven een object {"value": ..., "confidence": "high"|"low", "sourceFragment": "..."} in:
- "value": null (of [] voor lijsten) als het écht niet in het document staat — verzin NOOIT een waarde.
- "confidence": "high" als de waarde expliciet en ondubbelzinnig in het document staat; "low" als je een redelijke afleiding/interpretatie deed (bijv. een leerlijn/thema dichtstbijzijnd gekozen, of informatie uit context afgeleid in plaats van letterlijk genoemd).
- "sourceFragment": een kort (max ~15 woorden), LETTERLIJK citaat uit het document dat deze waarde onderbouwt, of null als "value" null is of puur afgeleid.

"unplacedContent": array van {"text": "...", "note": "..."|null} — noteer hier ELK betekenisvol stuk brontekst dat NERGENS in een veld hierboven past (bijv. een duur die je al wel in "durationMinutes" zet maar ook hier als controle, een los stukje tekst dat niet bij een van de bovenstaande categorieën hoort). Laat niets relevants weg — dit is de enige vangnet tegen dataverlies.`;

const SYSTEM_PROMPT =
  "Je zet een geüploade lesvoorbereiding (bewegingsonderwijs) om naar het GymWiki-activiteitenformaat. " +
  "Je ontvangt het document mogelijk als bestand/afbeelding (lees dan ook de VISUELE lay-out: tabellen, " +
  "kolommen, plattegronden) of als tekst. Haal ALLEEN informatie op die daadwerkelijk in het document staat " +
  "— verzin nooit een waarde die je niet kunt onderbouwen. Lees het VOLLEDIGE document (informatie staat vaak " +
  "verspreid over een inleiding, een tabel, en een los aandachtspunten-/materialenblok aan het einde), niet " +
  "alleen het eerste deel.\n\n" +
  FIELD_DESCRIPTIONS +
  '\n\nZet "isMovementActivity" op false wanneer het document duidelijk geen bewegingsactiviteit of ' +
  "lesvoorbereiding bewegingsonderwijs bevat (bijv. een factuur, een heel ander vak, willekeurige tekst) — " +
  "vul in dat geval alle overige velden met null/[] en laat unplacedContent leeg.";

// Ruim boven wat een normale (zelfs uitgebreide) lesvoorbereiding aan tekens
// bevat, ver onder de modelcontext — alleen relevant voor het kind:"text"-pad
// (docx/pptx/odt/txt/md via officeparser); een PDF/foto gaat als heel
// bestand naar het model, daar is geen tekstlimiet op toe te passen.
const MAX_SOURCE_CHARS = 60_000;

function buildUserContent(input: NormalizedImportInput) {
  const instruction = { type: "input_text" as const, text: "Hier is de lesvoorbereiding om te verwerken:" };

  if (input.kind === "file") {
    return [
      instruction,
      {
        type: "input_file" as const,
        filename: input.filename,
        file_data: `data:${input.mimeType};base64,${input.base64}`,
      },
    ];
  }

  if (input.kind === "image") {
    return [
      instruction,
      {
        type: "input_image" as const,
        detail: "auto" as const,
        image_url: `data:${input.mimeType};base64,${input.base64}`,
      },
    ];
  }

  const wasTruncated = input.text.length > MAX_SOURCE_CHARS;
  const text = wasTruncated ? input.text.slice(0, MAX_SOURCE_CHARS) : input.text;
  if (wasTruncated) {
    console.warn(
      `activityImportExtraction: brontekst afgekapt van ${input.text.length} naar ${MAX_SOURCE_CHARS} tekens.`,
    );
  }
  return [instruction, { type: "input_text" as const, text }];
}

export type ExtractActivityResult = {
  activity: ExtractedActivity;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Hoofdextractie: stuurt het genormaliseerde document (lib/ai/documentNormalization.ts)
 * naar GPT-4o via OpenAI's Responses API met strict Structured Outputs
 * (zodTextFormat) — geen losse json_object-mode + handmatige zod-validatie
 * achteraf meer, het model kan nu structureel geen ongeldige vorm teruggeven.
 * "Plaatje & Praatje" zit hier BEWUST niet in — zie generatePlaatjePraatjeSuggestion
 * hieronder, dat veld wordt nooit uit het document gehaald.
 */
export async function extractActivityFromDocument(
  input: NormalizedImportInput,
  logContext = "onbekend",
): Promise<ExtractActivityResult> {
  const client = getOpenAIClient();

  const response = await client.responses.parse({
    model: DOCUMENT_EXTRACTION_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserContent(input) },
    ],
    text: { format: zodTextFormat(extractedActivitySchema, "extracted_activity") },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(`extractActivityFromDocument[${logContext}]: geen geparseerd antwoord van de AI-extractie.`);
  }

  // Zelfde discipline als vóór deze herbouw: AI-output opnieuw valideren
  // tegen de echte, vaste waardelijsten — een gehallucineerde code/categorie
  // wordt stilzwijgend null (of uit de lijst gefilterd) i.p.v. een ongeldige
  // waarde het formulier in te laten stromen.
  const geldigeDoelgroep = parsed.doelgroep.value.filter((code) =>
    (DOELGROEP_WAARDEN as readonly number[]).includes(code),
  );
  const geldigeDidacticItems = parsed.didacticItems.value.map((item) => ({
    ...item,
    subTheme:
      item.subTheme && (DIDACTIC_SUBTHEMES[item.category] as readonly string[]).includes(item.subTheme)
        ? item.subTheme
        : null,
  }));

  // learningLine wordt NIET tegen ALL_LEARNING_LINES gefilterd (zelfde
  // gedrag als vóór deze herbouw) — de prompt vraagt al om een bestaande
  // leerlijn, en een harde filter zou een AI-genormaliseerde-maar-net-niet-
  // letterlijke variant onterecht wegvangen.
  const activity: ExtractedActivity = {
    ...parsed,
    doelgroep: { ...parsed.doelgroep, value: geldigeDoelgroep },
    didacticItems: { ...parsed.didacticItems, value: geldigeDidacticItems },
  };

  return {
    activity,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

const plaatjePraatjeSchema = z.object({ plaatjePraatje: z.string() });

/**
 * "Plaatje & Praatje" beschrijft HOE de docent de instructie visueel toont en
 * mondeling uitlegt — dat staat vrijwel nooit letterlijk in een
 * lesvoorbereiding, dus wordt het (anders dan elk ander veld) nooit uit het
 * document geëxtraheerd maar altijd apart GEGENEREERD als suggestie, op basis
 * van de net geëxtraheerde velden. Bewust een tweede, goedkope call
 * (CHECK_MODEL i.p.v. DOCUMENT_EXTRACTION_MODEL — geen bestand/afbeelding
 * nodig, puur tekst-naar-tekst) zodat de hoofdextractie-call dit niet hoeft
 * mee te dragen. De aanroeper markeert het resultaat als AI-voorstel (nooit
 * als "confidence" uit het document, want het IS nooit uit het document).
 */
export async function generatePlaatjePraatjeSuggestion(
  activity: ExtractedActivity,
  logContext = "onbekend",
): Promise<{ value: string; inputTokens: number; outputTokens: number }> {
  const client = getOpenAIClient();

  const context = [
    activity.goals.value && `Doel: ${activity.goals.value}`,
    activity.beschrijving.value && `Beschrijving: ${activity.beschrijving.value}`,
    activity.rules.value.length > 0 && `Regels: ${activity.rules.value.join("; ")}`,
    activity.arrangement.value && `Arrangement: ${activity.arrangement.value}`,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.responses.parse({
    model: CHECK_MODEL,
    input: [
      {
        role: "system",
        content:
          'Je schrijft een korte "Plaatje & Praatje" voor een bewegingsonderwijs-activiteit: hoe de docent de ' +
          "instructie visueel toont (bijv. op een bord/plattegrond) en mondeling uitlegt aan leerlingen, inclusief " +
          "eventuele wisselafspraken. Baseer je ALLEEN op de meegegeven activiteitgegevens, verzin geen nieuwe " +
          "spelregels. Kort en praktisch, 2-4 zinnen.",
      },
      { role: "user", content: context || "Geen verdere gegevens beschikbaar." },
    ],
    text: { format: zodTextFormat(plaatjePraatjeSchema, "plaatje_praatje") },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(`generatePlaatjePraatjeSuggestion[${logContext}]: geen geparseerd antwoord van de AI.`);
  }

  return {
    value: parsed.plaatjePraatje,
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}
