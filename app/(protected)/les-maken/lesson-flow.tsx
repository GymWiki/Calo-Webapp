"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileUp, NotebookPen, Video, type LucideIcon } from "lucide-react";

import { cancelVideoImportJob, findDanglingVideoImportJob } from "@/actions/videoImport";
import { cn } from "@/lib/utils";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";
import { VideoImportUploadCard, type VideoImportProcessedResult } from "@/components/video-import/VideoImportUploadCard";
import { mapExtractedActivityToLessonInput, computeFlaggedEmptyFields } from "@/lib/ai/extractedActivityMapping";
import type { UsedKnowledgeChunk } from "@/lib/ai/knowledgeUsageLogging";
import type { CreateLessonFormInput } from "@/types/lesson";
import { ActivityUploadStep, type RequiredLessonFormField } from "./activity-upload-step";
import { LessonForm } from "./lesson-form";

type TabValue = "context" | "organisatie" | "didactiek" | "voorbereiding";
type Mode = "choice" | "form" | "upload-activity" | "upload-video";

function ChoiceCard({
  icon: Icon,
  title,
  description,
  caption,
  actionLabel,
  accent,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  caption?: string;
  actionLabel: string;
  accent: "primary" | "neutral";
  onClick?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-full",
          accent === "primary" ? "bg-primary/10 text-primary" : "bg-muted text-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        {caption && <p className="mt-2 text-xs font-medium text-muted-foreground">{caption}</p>}
      </div>
      <span className="mt-auto text-sm font-medium text-primary group-hover:underline">
        {actionLabel}
      </span>
    </>
  );

  const className = cn(
    "group flex flex-col gap-3 rounded-2xl border p-6 text-left shadow-brand-sm transition-transform duration-200 ease-brand",
    disabled ? "opacity-70" : "hover:-translate-y-0.5 hover:shadow-brand-md",
    accent === "primary" ? "border-primary/40 bg-primary/5" : "bg-card",
  );

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}

/**
 * Orchestrates /les-maken's states: the choice screen, the (shared,
 * unmodified) LessonForm, and uploading an existing lesvoorbereiding. This
 * is the ONE place to create new content — there used to also be a
 * separate, standalone "Activiteit toevoegen" flow (its own page, plus
 * cards on the dashboard and here) creating individual library
 * activiteiten through its own storage path. That's removed: every
 * remaining way to add content (this wizard and uploading a file) now goes
 * through the same `createLesson` action, which writes straight into
 * `activiteiten` (see
 * supabase/migrations/consolidate_lessons_into_activiteiten.sql), so an
 * activiteit only counts toward the monthly contribution requirement once,
 * regardless of how it was created.
 * `skipChoice` — set when the page already has an active activiteit-concept
 * (activiteit-prefill via ?vanuit, of a tab deep-link like
 * /les-maken?tab=voorbereiding) — goes straight to the form, per the brief's
 * "wanneer er nog geen actieve les-concept gekozen is" condition.
 */
export function LesMakenFlow({
  authorName,
  initialValues,
  initialActivityId,
  initialDiagram,
  isEditingSavedActivity,
  initialTab,
  activeSourceCount,
  skipChoice,
  initialUsedKnowledgeSources,
  hasActiveTeam,
  teamName,
  isEditingTeamActivity,
  initialVersion,
}: {
  authorName: string;
  initialValues?: Partial<CreateLessonFormInput>;
  /** Gezet wanneer initialValues een eigen, nog niet ingediend concept is —
   * zie les-maken/page.tsx. */
  initialActivityId?: string;
  /** Zie de gelijknamige prop op LessonForm — enkel gezet wanneer die eigen
   * activiteit al een opgeslagen arrangement had. */
  initialDiagram?: { data: DiagramData; imageDataUrl: string };
  /** Zie LessonForm's initialUsedKnowledgeSources — de al eerder gelogde
   * "Gebruikte bronnen" van de hervatte activiteit. */
  initialUsedKnowledgeSources?: UsedKnowledgeChunk[];
  /** True wanneer initialActivityId een AL opgeslagen (niet-concept)
   * activiteit is die bewerkt wordt — dan is er geen "concept" om
   * automatisch bij te werken (saveLessonDraft update alleen status='draft'-
   * rijen), dus de concept-autosave/statusindicator blijft uit; "Activiteit
   * opslaan" blijft de enige manier om de bewerking op te slaan. */
  isEditingSavedActivity?: boolean;
  initialTab?: TabValue;
  activeSourceCount?: number;
  skipChoice: boolean;
  /** Lid van een actief team — bepaalt of "Teambibliotheek" als bestemming
   * kiesbaar is (zie components/activity-wizard-page.tsx). */
  hasActiveTeam?: boolean;
  teamName?: string | null;
  /** Bewerkt een AL BESTAANDE teamactiviteit — dan gaat opslaan via
   * updateTeamActivity (optimistic locking), niet createLesson. Zie
   * lesson-form.tsx. */
  isEditingTeamActivity?: boolean;
  initialVersion?: number;
}) {
  const [mode, setMode] = useState<Mode>(skipChoice ? "form" : "choice");
  const [uploadedValues, setUploadedValues] = useState<Partial<CreateLessonFormInput> | null>(
    null,
  );
  const [uploadedFlaggedFields, setUploadedFlaggedFields] = useState<
    Set<RequiredLessonFormField> | undefined
  >(undefined);
  // "Activiteit uit video" (STAP7): job-id van een AI-voorgesteld
  // overzichtsframe, doorgegeven aan LessonForm zodra de video-verwerking
  // klaar is. Blijft null wanneer de video geen bruikbaar frame opleverde.
  const [uploadedReferenceJobId, setUploadedReferenceJobId] = useState<string | undefined>(
    undefined,
  );
  // Video-verwerking is kostbaarder dan het document-uploadpad (verbruikt
  // al een quotum-slot zodra transcriptie start) — een gesloten tab mag hier
  // dus niet stilzwijgend genegeerd worden, i.t.t. dat pad. Alleen gecheckt
  // op het keuzescherm van een verse sessie (niet bij skipChoice).
  const [danglingJobId, setDanglingJobId] = useState<string | null>(null);
  const [resumeJobId, setResumeJobId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (skipChoice) return;
    findDanglingVideoImportJob().then((result) => {
      if (result) setDanglingJobId(result.jobId);
    });
  }, [skipChoice]);

  function handleVideoProcessed(result: VideoImportProcessedResult) {
    if (result.activity) {
      const values = mapExtractedActivityToLessonInput(result.activity);
      setUploadedValues(values);
      setUploadedFlaggedFields(computeFlaggedEmptyFields(values));
    } else {
      // Geen bruikbare transcriptie (stille video) — tekstvelden blijven
      // leeg, formulier valt terug op initialValues. Het voorgestelde frame
      // (indien aanwezig) blijft wel bruikbaar.
      setUploadedValues(null);
      setUploadedFlaggedFields(undefined);
    }
    setUploadedReferenceJobId(result.hasProposedFrame ? result.jobId : undefined);
    setDanglingJobId(null);
    setResumeJobId(undefined);
    setMode("form");
  }

  if (mode === "choice") {
    return (
      <div className="space-y-4">
        {danglingJobId && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-400/60 bg-amber-50 p-4 text-sm dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
            <p>Je hebt een nog niet afgeronde video-verwerking staan.</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                onClick={() => {
                  setResumeJobId(danglingJobId);
                  setMode("upload-video");
                }}
              >
                Doorgaan
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
                onClick={() => {
                  void cancelVideoImportJob(danglingJobId);
                  setDanglingJobId(null);
                }}
              >
                Annuleren
              </button>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <ChoiceCard
            icon={NotebookPen}
            title="Zelf een activiteit samenstellen"
            description="Bouw je activiteit vanaf nul op met de plattegrond-tekenaar, 3 L'en en lesblokken."
            actionLabel="Beginnen →"
            accent="primary"
            onClick={() => setMode("form")}
          />
          <ChoiceCard
            icon={FileUp}
            title="Upload een bestaande activiteit"
            description="Heb je al een lesvoorbereiding? Upload het bestand en we zetten het automatisch om naar een ingevulde activiteit."
            actionLabel="Uploaden →"
            accent="neutral"
            onClick={() => setMode("upload-activity")}
          />
          <ChoiceCard
            icon={Video}
            title="Activiteit uit video"
            description="Upload een instructievideo — we halen de uitleg en een overzichtsframe van de opstelling automatisch uit de video."
            actionLabel="Uploaden →"
            accent="neutral"
            onClick={() => setMode("upload-video")}
          />
        </div>
      </div>
    );
  }

  if (mode === "upload-activity") {
    return (
      <ActivityUploadStep
        onCancel={() => setMode("choice")}
        onExtracted={(values, flaggedEmptyFields) => {
          setUploadedValues(values);
          setUploadedFlaggedFields(flaggedEmptyFields);
          setMode("form");
        }}
      />
    );
  }

  if (mode === "upload-video") {
    return (
      <div className="animate-fade-up space-y-4">
        <button
          type="button"
          onClick={() => setMode("choice")}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Terug
        </button>
        <VideoImportUploadCard onProcessed={handleVideoProcessed} resumeJobId={resumeJobId} />
      </div>
    );
  }

  return (
    <LessonForm
      authorName={authorName}
      initialValues={uploadedValues ?? initialValues}
      // Een upload start altijd een NIEUW concept — het hervat-id geldt
      // alleen als er geen upload heeft plaatsgevonden.
      initialActivityId={uploadedValues ? undefined : initialActivityId}
      initialDiagram={uploadedValues ? undefined : initialDiagram}
      isEditingSavedActivity={uploadedValues ? false : isEditingSavedActivity}
      initialScrollTarget={initialTab === "voorbereiding" ? "materiaal" : undefined}
      activeSourceCount={activeSourceCount}
      flaggedEmptyFields={uploadedValues ? uploadedFlaggedFields : undefined}
      initialUsedKnowledgeSources={uploadedValues ? undefined : initialUsedKnowledgeSources}
      hasActiveTeam={hasActiveTeam}
      teamName={teamName}
      isEditingTeamActivity={uploadedValues ? false : isEditingTeamActivity}
      initialVersion={initialVersion}
      initialReferenceJobId={uploadedReferenceJobId}
    />
  );
}
