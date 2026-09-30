"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, FileUp, NotebookPen, Video, type LucideIcon } from "lucide-react";

import { cancelVideoImportJob, findDanglingVideoImportJob } from "@/actions/videoImport";
import { cn } from "@/lib/utils";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VideoImportUploadCard } from "@/components/video-import/VideoImportUploadCard";
import { YoutubeLinkImportCard } from "@/components/video-import/YoutubeLinkImportCard";
import { mapExtractedActivityToLessonInput, computeFlaggedEmptyFields } from "@/lib/ai/extractedActivityMapping";
import type { UsedKnowledgeChunk } from "@/lib/ai/knowledgeUsageLogging";
import type { VideoImportProcessedResult } from "@/lib/ai/videoImportPolling";
import type { VideoSourceType } from "@/lib/ai/videoImportProcessor";
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
  const [danglingJob, setDanglingJob] = useState<{ jobId: string; sourceType: VideoSourceType } | null>(null);
  const [resumeJobId, setResumeJobId] = useState<string | undefined>(undefined);
  // Welke invoerkaart actief is binnen "upload-video" (DEEL1-eis: YouTube-
  // link als TWEEDE optie NAAST bestandsupload, niet erin plaats van).
  const [uploadSubTab, setUploadSubTab] = useState<"file" | "youtube">("file");

  useEffect(() => {
    if (skipChoice) return;
    findDanglingVideoImportJob().then((result) => {
      if (result) setDanglingJob(result);
    });
  }, [skipChoice]);

  function handleVideoProcessed(result: VideoImportProcessedResult) {
    if (result.activity) {
      const values = mapExtractedActivityToLessonInput(result.activity);
      setUploadedValues(values);
      setUploadedFlaggedFields(computeFlaggedEmptyFields(values));
    } else {
      // Geen bruikbare transcriptie (stille video, of geen ondertiteling bij
      // een YouTube-link) — tekstvelden blijven leeg, formulier valt terug
      // op initialValues. Een voorgesteld/handmatig frame blijft wel
      // bruikbaar via de reviewstap (VideoFrameReviewBanner toont zelf een
      // upload-aanbod als er nog geen frame is).
      setUploadedValues(null);
      setUploadedFlaggedFields(undefined);
    }
    setUploadedReferenceJobId(result.jobId);
    setDanglingJob(null);
    setResumeJobId(undefined);
    setMode("form");
  }

  if (mode === "choice") {
    return (
      <div className="space-y-4">
        {danglingJob && (
          <div className="flex flex-col gap-2 rounded-xl border border-amber-400/60 bg-amber-50 p-4 text-sm dark:bg-amber-950/20 sm:flex-row sm:items-center sm:justify-between">
            <p>Je hebt een nog niet afgeronde video-verwerking staan.</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                onClick={() => {
                  setUploadSubTab(danglingJob.sourceType === "upload" ? "file" : "youtube");
                  setResumeJobId(danglingJob.jobId);
                  setMode("upload-video");
                }}
              >
                Doorgaan
              </button>
              <button
                type="button"
                className="rounded-md border px-3 py-1.5 text-xs font-medium"
                onClick={() => {
                  void cancelVideoImportJob(danglingJob.jobId);
                  setDanglingJob(null);
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
        {resumeJobId ? (
          // Een hervatte job weet zelf al welke kaart erbij hoort
          // (uploadSubTab is al gezet vóór setMode hierboven) — geen tabs
          // tonen tijdens het hervatten, dat zou verwarrend suggereren dat
          // er nog gekozen kan worden.
          uploadSubTab === "file" ? (
            <VideoImportUploadCard onProcessed={handleVideoProcessed} resumeJobId={resumeJobId} />
          ) : (
            <YoutubeLinkImportCard onProcessed={handleVideoProcessed} resumeJobId={resumeJobId} />
          )
        ) : (
          <Tabs value={uploadSubTab} onValueChange={(value) => setUploadSubTab(value as "file" | "youtube")}>
            <TabsList className="grid w-full grid-cols-2 sm:w-auto">
              <TabsTrigger value="file">Bestand uploaden</TabsTrigger>
              <TabsTrigger value="youtube">YouTube-link plakken</TabsTrigger>
            </TabsList>
            <TabsContent value="file" className="mt-4">
              <VideoImportUploadCard onProcessed={handleVideoProcessed} />
            </TabsContent>
            <TabsContent value="youtube" className="mt-4">
              <YoutubeLinkImportCard onProcessed={handleVideoProcessed} />
            </TabsContent>
          </Tabs>
        )}
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
