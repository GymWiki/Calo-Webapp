import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import type { CreateLessonFormInput } from "@/types/lesson";

// Geëxtraheerd uit activity-upload-step.tsx (was niet-geëxporteerd, alleen
// voor het document-uploadpad) zodat ander upload-functionaliteit dat
// dezelfde ExtractedActivity-vorm produceert dezelfde mapping kan delen i.p.v.
// te dupliceren.

// De verplichte tekstvelden van het wizardformulier (zie createLessonInputSchema
// in types/lesson.ts) waarvoor deze mapping daadwerkelijk een waarde
// probeert te vinden. "lessonDate" staat hier bewust niet bij: een datum in
// het bron-document is vrijwel nooit de datum waarop DEZE gebruiker de les nu
// gaat geven, dus die wordt nooit automatisch ingevuld en hoeft ook nooit als
// "gemist" gemarkeerd te worden.
export const REQUIRED_TEXT_FIELDS = [
  "title",
  "learningLine",
  "movementProblem",
  "movementTheme",
  "goals",
  "arrangement",
  "deelnemersRegels",
  "plaatjePraatje",
  "aandachtspunten",
] as const satisfies readonly (keyof CreateLessonFormInput)[];

export type RequiredLessonFormField = (typeof REQUIRED_TEXT_FIELDS)[number];

// Elk veld van ExtractedActivity dat de AI een confidence/sourceFragment
// meegeeft (zie lib/ai/activityImportExtraction.ts) — gebruikt door
// computeLowConfidenceFields hieronder. "durationMinutes" staat hier bewust
// niet bij (geen formveld, zie computeUnplacedContent), "isMovementActivity"
// en "unplacedContent" zijn geen gewrapte velden.
const CONFIDENCE_FIELD_NAMES = [
  "title",
  "learningLine",
  "movementProblem",
  "movementTheme",
  "goals",
  "beschrijving",
  "rules",
  "learningOutcomes",
  "aandachtspunten",
  "doelgroep",
  "minParticipants",
  "participantsBench",
  "baseMaterials",
  "ruleMaterials",
  "didacticItems",
  "deelnemersRegels",
  "arrangement",
] as const satisfies readonly (keyof ExtractedActivity & keyof CreateLessonFormInput)[];

// Vertaalt een AI-extractie uit een geüpload document naar het
// lesformulier-formaat — elk veld van ExtractedActivity is {value, confidence,
// sourceFragment}, hier wordt alleen .value uitgepakt (null/leeg -> ""/[]/
// undefined, zoals het formulier verwacht). "Plaatje & Praatje" zit NOOIT in
// extraction (zie activityImportExtraction.ts se generatePlaatjePraatjeSuggestion)
// — meegegeven als los argument.
export function mapExtractedActivityToLessonInput(
  extraction: ExtractedActivity,
  plaatjePraatjeSuggestion?: string,
): Partial<CreateLessonFormInput> {
  return {
    title: extraction.title.value ?? "",
    learningLine: extraction.learningLine.value ?? "",
    doelgroep: extraction.doelgroep.value,
    movementProblem: extraction.movementProblem.value ?? "",
    movementTheme: extraction.movementTheme.value ?? "",
    baseMaterials: extraction.baseMaterials.value,
    ruleMaterials: extraction.ruleMaterials.value,
    minParticipants: extraction.minParticipants.value ?? undefined,
    participantsBench: extraction.participantsBench.value ?? undefined,
    rules: extraction.rules.value,
    goals: extraction.goals.value ?? "",
    beschrijving: extraction.beschrijving.value ?? "",
    learningOutcomes: extraction.learningOutcomes.value,
    arrangement: extraction.arrangement.value ?? "",
    deelnemersRegels: extraction.deelnemersRegels.value ?? "",
    plaatjePraatje: plaatjePraatjeSuggestion ?? "",
    aandachtspunten: extraction.aandachtspunten.value ?? "",
    didacticItems: extraction.didacticItems.value.map((item, index) => ({
      id: `import-${index}`,
      category: item.category,
      subTheme: item.subTheme,
      observation: item.observation,
      action: item.action,
    })),
  };
}

// Welke verplichte velden de AI leeg liet ondanks een geslaagde extractie —
// gebruikt door LessonForm om die velden een visuele "controleer dit"-hint
// te geven i.p.v. stilzwijgend leeg te blijven.
export function computeFlaggedEmptyFields(
  values: Partial<CreateLessonFormInput>,
): Set<RequiredLessonFormField> {
  const flagged = new Set<RequiredLessonFormField>();
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (!values[field]) {
      flagged.add(field);
    }
  }
  return flagged;
}

// Velden die de AI WEL invulde, maar zelf als onzeker aanmerkte
// (confidence:"low") — los van computeFlaggedEmptyFields, dat puur "leeg
// terwijl verplicht" is. Gebruikt voor een tweede, amber "AI onzeker —
// controleer"-markering i.p.v. het bestaande rode "verplicht"-label.
export function computeLowConfidenceFields(
  extraction: ExtractedActivity,
): Set<(typeof CONFIDENCE_FIELD_NAMES)[number]> {
  const flagged = new Set<(typeof CONFIDENCE_FIELD_NAMES)[number]>();
  for (const name of CONFIDENCE_FIELD_NAMES) {
    if (extraction[name].confidence === "low") {
      flagged.add(name);
    }
  }
  return flagged;
}

export type UnplacedContentItem = { text: string; note: string | null };

// De dekkingscheck ("geen dataverlies"): het model se eigen
// unplacedContent-rapportage, aangevuld met een zelf-samengesteld item voor
// een gevonden duur (dat veld heeft geen bestemming in dit formulier — zie
// activityImportExtraction.ts se commentaar bij "durationMinutes").
export function computeUnplacedContent(extraction: ExtractedActivity): UnplacedContentItem[] {
  const items: UnplacedContentItem[] = [...extraction.unplacedContent];
  if (extraction.durationMinutes.value !== null) {
    items.push({
      text: `Duur: ${extraction.durationMinutes.value} minuten`,
      note: "Geen duur-veld in dit formulier — voeg dit eventueel toe aan Beschrijving of Aandachtspunten.",
    });
  }
  return items;
}
