"use client";

import { ArrowLeft } from "lucide-react";

import { ActivityImportUploadCard } from "@/components/ActivityImportUploadCard";
import type { ExtractedActivity } from "@/lib/ai/activityImportExtraction";
import { AI_EXTRACTED_ACTIVITY_STORAGE_KEY } from "@/types/ai";

/**
 * "Activiteit uploaden uit bestand"-stap op /les-maken. Hergebruikt het
 * bestaande upload-component (ook gebruikt door add-activity-step.tsx) —
 * het verschil zit 'm puur in wat er met de extractie gebeurt: hier is er
 * geen lokaal formulier om te vullen, dus stasht dit naar sessionStorage en
 * schakelt de wizard door naar de "Activiteit toevoegen"-stap, waar
 * AddActivityStep het oppikt (zelfde handoff-patroon als AiLessonWizard ->
 * LessonForm). Voorheen navigeerde dit naar een aparte /activiteit-
 * toevoegen-route — nu onderdeel van dezelfde wizard, dus een simpele
 * mode-wissel i.p.v. een paginanavigatie.
 */
export function ActivityUploadStep({
  onCancel,
  onExtracted,
}: {
  onCancel: () => void;
  onExtracted: () => void;
}) {
  function handleExtracted(activity: ExtractedActivity) {
    sessionStorage.setItem(AI_EXTRACTED_ACTIVITY_STORAGE_KEY, JSON.stringify(activity));
    onExtracted();
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
        description="PDF, Word (.docx), PowerPoint (.pptx) of tekstbestand — we zetten het automatisch om naar een GymWiki-activiteit en sturen je door naar het activiteit-formulier, al ingevuld en klaar om te controleren."
      />
    </div>
  );
}
