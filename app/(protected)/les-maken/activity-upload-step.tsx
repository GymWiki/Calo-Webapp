"use client";

import { ArrowLeft } from "lucide-react";

import { ActivityImportUploadCard } from "@/components/ActivityImportUploadCard";
import type { ActivityImportResult } from "@/lib/ai/activityImportProcessor";
import {
  computeFlaggedEmptyFields,
  computeLowConfidenceFields,
  mapExtractedActivityToLessonInput,
  type RequiredLessonFormField,
  type UnplacedContentItem,
} from "@/lib/ai/extractedActivityMapping";
import type { CreateLessonFormInput } from "@/types/lesson";

export type { RequiredLessonFormField } from "@/lib/ai/extractedActivityMapping";

// Alles wat lesson-flow.tsx nodig heeft na een geslaagde import — gebundeld
// in één object i.p.v. steeds meer losse callback-argumenten, nu dat een
// import ook confidence/niet-geplaatste-inhoud/een jobId (voor de
// afbeeldingenbanner + feedbacklogging) teruggeeft, niet alleen de gemapte
// formulierwaarden.
export type ActivityImportOutcome = {
  values: Partial<CreateLessonFormInput>;
  flaggedEmptyFields: Set<RequiredLessonFormField>;
  lowConfidenceFields: Set<string>;
  unplacedContent: UnplacedContentItem[];
  jobId: string;
};

/**
 * "Upload een bestaande lesvoorbereiding"-stap op /les-maken. Hergebruikt
 * het bestaande upload-component — na een geslaagde extractie schakelt de
 * wizard door naar het gewone lesformulier (LessonForm), al vooraf ingevuld
 * met wat de AI uit het document haalde, klaar om te controleren en aan te
 * vullen. Er bestaat geen apart "activiteit toevoegen"-formulier meer: elke
 * invoerroute (wizard, deze upload) komt uit bij dezelfde createLesson-opslag.
 */
export function ActivityUploadStep({
  onCancel,
  onExtracted,
}: {
  onCancel: () => void;
  onExtracted: (outcome: ActivityImportOutcome) => void;
}) {
  function handleExtracted(jobId: string, result: ActivityImportResult) {
    const values = mapExtractedActivityToLessonInput(result.activity, result.plaatjePraatjeSuggestion);
    onExtracted({
      values,
      flaggedEmptyFields: computeFlaggedEmptyFields(values),
      lowConfidenceFields: computeLowConfidenceFields(result.activity),
      unplacedContent: result.unplacedContent,
      jobId,
    });
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
        description="PDF, Word (.docx), PowerPoint (.pptx), OpenDocument (.odt), tekst/markdown, of een foto van een papieren lesbrief — we zetten het automatisch om naar een ingevuld lesformulier, klaar om te controleren en aan te vullen."
      />
    </div>
  );
}
