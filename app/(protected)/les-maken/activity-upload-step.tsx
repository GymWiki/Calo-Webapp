"use client";

import { ArrowLeft } from "lucide-react";

import { ActivityImportUploadCard } from "@/components/ActivityImportUploadCard";
import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import type { CreateLessonFormInput } from "@/types/lesson";

// Vertaalt een AI-extractie uit een geüpload document naar het lesformulier-
// formaat. Bewust géén ai_generated-herkomst (zie lesson-form.tsx's
// stashedGenerated/createLesson-aanroep): dit is de gebruiker's eigen,
// bestaande lesvoorbereiding die alleen automatisch is overgetikt, geen
// door AI vanuit niets gegenereerde les — telt daarom, net als de "Kopieer
// & bewerk"-prefill (page.tsx's mapActivityToLessonInput), gewoon mee voor
// de maandelijkse bijdrage-eis zodra de gebruiker de les afrondt en
// openbaar maakt. Ontbrekende velden (categorie/veld hebben geen
// lesformulier-equivalent, en zeker niet elk veld haalt de AI uit het
// document) blijven leeg — de gebruiker vult ze zelf aan, exact zoals bij
// elke andere prefill in dit formulier.
function mapExtractedActivityToLessonInput(
  extraction: ExtractedActivity,
): Partial<CreateLessonFormInput> {
  return {
    title: extraction.titel ?? "",
    learningLine: extraction.leerlijn ?? "",
    doelgroep: extraction.doelgroep ?? [],
    goals: extraction.doel ?? "",
    baseMaterials: extraction.materiaal ?? [],
    rules: extraction.regels ?? [],
    arrangement: extraction.beschrijving ?? "",
    deelnemersRegels: (extraction.regels ?? []).join("\n"),
    plaatjePraatje: extraction.beginsituatie ?? "",
  };
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
  onExtracted: (values: Partial<CreateLessonFormInput>) => void;
}) {
  function handleExtracted(activity: ExtractedActivity) {
    onExtracted(mapExtractedActivityToLessonInput(activity));
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
