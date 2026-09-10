"use client";

import { useState } from "react";
import Link from "next/link";
import { FileUp, Lock, NotebookPen, Sparkles, type LucideIcon } from "lucide-react";

import type { LessonGeneratorAccess } from "@/lib/ai/lessonGeneratorAccess";
import { cn } from "@/lib/utils";
import type { CreateLessonFormInput } from "@/types/lesson";
import { ActivityUploadStep } from "./activity-upload-step";
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
 * Orchestrates /les-maken's three states: the choice between AI-generated
 * and handmatig, the AI wizard, and the (shared, unmodified) LessonForm.
 * `skipChoice` — set when the page already has an active les-concept
 * (activiteit-prefill via ?vanuit, of a tab deep-link like
 * /les-maken?tab=voorbereiding) — goes straight to the form, per the brief's
 * "wanneer er nog geen actieve les-concept gekozen is" condition.
 */
export function LesMakenFlow({
  authorName,
  initialValues,
  initialTab,
  activeSourceCount,
  lessonGeneratorAccess,
  skipChoice,
}: {
  authorName: string;
  initialValues?: Partial<CreateLessonFormInput>;
  initialTab?: TabValue;
  activeSourceCount?: number;
  lessonGeneratorAccess: LessonGeneratorAccess;
  skipChoice: boolean;
}) {
  const [mode, setMode] = useState<Mode>(skipChoice ? "form" : "choice");

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
          title="Genereer een les op maat met AI"
          description="Kies een leerlijn en doelgroep. De AI stelt een volledige lesvoorbereiding samen op basis van de Kennisbank."
          caption={aiCaption}
          actionLabel={isNotSubscriber ? "Upgrade →" : locked ? "Niet beschikbaar" : "Genereren →"}
          accent="primary"
          onClick={locked ? undefined : () => setMode("ai-wizard")}
          href={isNotSubscriber ? "/pro" : undefined}
          disabled={locked && !isNotSubscriber}
        />
        <ChoiceCard
          icon={NotebookPen}
          title="Zelf een les samenstellen"
          description="Bouw je les vanaf nul op met de plattegrond-tekenaar, 3 L'en en lesblokken."
          actionLabel="Beginnen →"
          accent="neutral"
          onClick={() => setMode("form")}
        />
        <ChoiceCard
          icon={FileUp}
          title="Activiteit uploaden uit bestand"
          description="Heb je al een lesvoorbereiding? Upload het bestand en we zetten het automatisch om naar een GymWiki-activiteit."
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
    return <ActivityUploadStep onCancel={() => setMode("choice")} />;
  }

  return (
    <LessonForm
      authorName={authorName}
      initialValues={initialValues}
      initialTab={initialTab}
      activeSourceCount={activeSourceCount}
    />
  );
}
