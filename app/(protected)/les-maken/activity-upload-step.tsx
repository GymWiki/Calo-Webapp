"use client";

import { ArrowLeft } from "lucide-react";

import { ActivityImportUploadCard } from "@/components/ActivityImportUploadCard";
import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import {
  computeFlaggedEmptyFields,
  mapExtractedActivityToLessonInput,
  type RequiredLessonFormField,
} from "@/lib/ai/extractedActivityMapping";
import type { CreateLessonFormInput } from "@/types/lesson";

export type { RequiredLessonFormField } from "@/lib/ai/extractedActivityMapping";

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
