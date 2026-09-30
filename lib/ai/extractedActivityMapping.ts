import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import type { CreateLessonFormInput } from "@/types/lesson";

// Geëxtraheerd uit activity-upload-step.tsx (was niet-geëxporteerd, alleen
// voor het document-uploadpad) zodat het video-uploadpad (dat dezelfde
// ExtractedActivity-vorm produceert, gevoed door een transcriptie i.p.v.
// document-tekst) dezelfde mapping deelt i.p.v. te dupliceren. Geen
// gedragswijziging t.o.v. de oorspronkelijke versie.

// De verplichte tekstvelden van het wizardformulier (zie createLessonInputSchema
// in types/lesson.ts) waarvoor deze mapping daadwerkelijk een waarde
// probeert te vinden. "lessonDate" staat hier bewust niet bij: een datum in
// het bron-document/de bron-video is vrijwel nooit de datum waarop DEZE
// gebruiker de les nu gaat geven, dus die wordt nooit automatisch ingevuld
// en hoeft ook nooit als "gemist" gemarkeerd te worden.
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

// Vertaalt een AI-extractie uit een geüpload document/transcriptie naar het
// lesformulier-formaat. ExtractedActivity spiegelt sinds de promptherziening
// bijna 1-op-1 de velden van CreateLessonFormInput (zie
// lib/ai/activityImportExtraction.ts voor waarom) — deze mapping is dus
// grotendeels een naam-voor-naam overname, met alleen de null->""/[]-
// conversie die het formulier verwacht.
export function mapExtractedActivityToLessonInput(
  extraction: ExtractedActivity,
): Partial<CreateLessonFormInput> {
  return {
    title: extraction.title ?? "",
    learningLine: extraction.learningLine ?? "",
    doelgroep: extraction.doelgroep ?? [],
    movementProblem: extraction.movementProblem ?? "",
    movementTheme: extraction.movementTheme ?? "",
    baseMaterials: extraction.baseMaterials ?? [],
    ruleMaterials: extraction.ruleMaterials ?? [],
    minParticipants: extraction.minParticipants ?? undefined,
    participantsBench: extraction.participantsBench ?? undefined,
    rules: extraction.rules ?? [],
    goals: extraction.goals ?? "",
    arrangement: extraction.arrangement ?? "",
    deelnemersRegels: extraction.deelnemersRegels ?? "",
    plaatjePraatje: extraction.plaatjePraatje ?? "",
    aandachtspunten: extraction.aandachtspunten ?? "",
    didacticItems: (extraction.didacticItems ?? []).map((item, index) => ({
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
