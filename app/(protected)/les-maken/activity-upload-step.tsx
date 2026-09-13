"use client";

import { ArrowLeft } from "lucide-react";

import { ActivityImportUploadCard } from "@/components/ActivityImportUploadCard";
import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import { EMPTY_GAME_DIMENSIONS, type CreateLessonFormInput } from "@/types/lesson";

// De verplichte tekstvelden van het wizardformulier (zie createLessonInputSchema
// in types/lesson.ts) waarvoor deze upload-stap daadwerkelijk een waarde
// probeert te vinden. "lessonDate" staat hier bewust niet bij: een datum in
// het brondocument is vrijwel nooit de datum waarop DEZE gebruiker de les nu
// gaat geven, dus die wordt nooit automatisch ingevuld en hoeft ook nooit
// als "gemist" gemarkeerd te worden.
const REQUIRED_TEXT_FIELDS = [
  "title",
  "groupName",
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

// Vertaalt een AI-extractie uit een geüpload document naar het lesformulier-
// formaat. ExtractedActivity spiegelt sinds de promptherziening bijna 1-op-1
// de velden van CreateLessonFormInput (zie lib/ai/activityImportExtraction.ts
// voor waarom) — deze mapping is dus grotendeels een naam-voor-naam
// overname, met alleen de null->""/[]-conversie die het formulier verwacht.
// Telt, net als de "Kopieer & bewerk"-prefill (page.tsx's
// mapActivityToLessonInput), gewoon mee voor de maandelijkse bijdrage-eis
// zodra de gebruiker de activiteit afrondt en openbaar maakt — dit is de
// gebruiker's eigen, bestaande lesvoorbereiding die alleen automatisch is
// overgetikt, geen door AI vanuit niets gegenereerde activiteit.
function mapExtractedActivityToLessonInput(
  extraction: ExtractedActivity,
): Partial<CreateLessonFormInput> {
  return {
    title: extraction.title ?? "",
    groupName: extraction.groupName ?? "",
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
    gameCategory: extraction.gameCategory ?? "",
    gameDimensions: extraction.gameDimensions ?? EMPTY_GAME_DIMENSIONS,
    tacticalQuestions: extraction.tacticalQuestions ?? [],
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
// te geven i.p.v. stilzwijgend leeg te blijven, zie de brief se stap 4.
function computeFlaggedEmptyFields(
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

/**
 * "Upload een bestaande lesvoorbereiding"-stap op /les-maken. Hergebruikt
 * het bestaande upload-component — na een geslaagde extractie schakelt de
 * wizard door naar het gewone lesformulier (LessonForm), al vooraf ingevuld
 * met wat de AI uit het document haalde, klaar om te controleren en aan te
 * vullen. Er bestaat geen apart "activiteit toevoegen"-formulier meer: elke
 * invoerroute (wizard, AI-generator, deze upload) komt uit bij dezelfde
 * createLesson-opslag.
 */
export function ActivityUploadStep({
  onCancel,
  onExtracted,
}: {
  onCancel: () => void;
  onExtracted: (
    values: Partial<CreateLessonFormInput>,
    flaggedEmptyFields: Set<RequiredLessonFormField>,
  ) => void;
}) {
  function handleExtracted(activity: ExtractedActivity) {
    const values = mapExtractedActivityToLessonInput(activity);
    onExtracted(values, computeFlaggedEmptyFields(values));
  }

  return (
    <div className="animate-fade-up space-y-4">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Terug
      </button>
      <ActivityImportUploadCard
        onExtracted={handleExtracted}
        description="PDF, Word (.docx), PowerPoint (.pptx) of tekstbestand — we zetten het automatisch om naar een ingevuld lesformulier, klaar om te controleren en aan te vullen."
      />
    </div>
  );
}
