"use client";

import { useState } from "react";
import Link from "next/link";
import { FileUp, Lock, NotebookPen, Sparkles, type LucideIcon } from "lucide-react";

import type { LessonGeneratorAccess } from "@/lib/ai/lessonGeneratorAccess";
import { cn } from "@/lib/utils";
import type { CreateLessonFormInput } from "@/types/lesson";
import { ActivityUploadStep, type RequiredLessonFormField } from "./activity-upload-step";
import { AiLessonWizard } from "./ai-lesson-wizard";
import { LessonForm } from "./lesson-form";

type TabValue = "context" | "organisatie" | "didactiek" | "voorbereiding";
type Mode = "choice" | "ai-wizard" | "form" | "upload-activity";

function ChoiceCard({
  icon: Icon,
  title,
  description,
  caption,
  actionLabel,
  accent,
  onClick,
  href,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  caption?: string;
  actionLabel: string;
  accent: "primary" | "neutral";
  onClick?: () => void;
  href?: string;
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

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}

/**
 * Orchestrates /les-maken's states: the choice screen, the AI wizard, the
 * (shared, unmodified) LessonForm, and uploading an existing
 * lesvoorbereiding. This is the ONE place to create new content — there
 * used to also be a separate, standalone "Activiteit toevoegen" flow (its
 * own page, plus cards on the dashboard and here) creating individual
 * library activiteiten through its own storage path. That's removed: every
 * remaining way to add content (this wizard, the AI generator, and
 * uploading a file) now goes through the same `createLesson` action, which
 * writes straight into `activiteiten` (see
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
  initialTab,
  activeSourceCount,
  lessonGeneratorAccess,
  skipChoice,
}: {
  authorName: string;
  initialValues?: Partial<CreateLessonFormInput>;
  /** Gezet wanneer initialValues een eigen, nog niet ingediend concept is —
   * zie les-maken/page.tsx. */
  initialActivityId?: string;
  initialTab?: TabValue;
  activeSourceCount?: number;
  lessonGeneratorAccess: LessonGeneratorAccess;
  skipChoice: boolean;
}) {
  const [mode, setMode] = useState<Mode>(skipChoice ? "form" : "choice");
  const [uploadedValues, setUploadedValues] = useState<Partial<CreateLessonFormInput> | null>(
    null,
  );
  const [uploadedFlaggedFields, setUploadedFlaggedFields] = useState<
    Set<RequiredLessonFormField> | undefined
  >(undefined);

  if (mode === "choice") {
    const locked = !lessonGeneratorAccess.allowed;
    const isNotSubscriber = lessonGeneratorAccess.reason === "not_subscriber";

    const aiCaption = isNotSubscriber
      ? "Vereist het betaalde abonnement (EUR 3,-/mnd)"
      : locked
        ? `Je ${lessonGeneratorAccess.limit} lesgeneraties voor deze maand zijn op — volgende maand weer beschikbaar.`
        : `${lessonGeneratorAccess.remaining} van ${lessonGeneratorAccess.limit} lesgeneraties deze maand over.`;

    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <ChoiceCard
          icon={isNotSubscriber ? Lock : Sparkles}
          title="Genereer een activiteit op maat met AI"
          description="Kies een leerlijn en doelgroep. De AI stelt een volledige activiteit samen op basis van de Kennisbank."
          caption={aiCaption}
          actionLabel={isNotSubscriber ? "Upgrade →" : locked ? "Niet beschikbaar" : "Genereren →"}
          accent="primary"
          onClick={locked ? undefined : () => setMode("ai-wizard")}
          href={isNotSubscriber ? "/pro" : undefined}
          disabled={locked && !isNotSubscriber}
        />
        <ChoiceCard
          icon={NotebookPen}
          title="Zelf een activiteit samenstellen"
          description="Bouw je activiteit vanaf nul op met de plattegrond-tekenaar, 3 L'en en lesblokken."
          actionLabel="Beginnen →"
          accent="neutral"
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
      </div>
    );
  }

  if (mode === "ai-wizard") {
    return (
      <AiLessonWizard
        activeSourceCount={activeSourceCount}
        lessonGeneratorAccess={lessonGeneratorAccess}
        onCancel={() => setMode("choice")}
        onGenerated={() => setMode("form")}
      />
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

  return (
    <LessonForm
      authorName={authorName}
      initialValues={uploadedValues ?? initialValues}
      // Een upload/AI-generatie start altijd een NIEUW concept — het
      // hervat-id geldt alleen als er geen upload heeft plaatsgevonden.
      initialActivityId={uploadedValues ? undefined : initialActivityId}
      initialScrollTarget={initialTab === "voorbereiding" ? "materiaal" : undefined}
      activeSourceCount={activeSourceCount}
      flaggedEmptyFields={uploadedValues ? uploadedFlaggedFields : undefined}
    />
  );
}
