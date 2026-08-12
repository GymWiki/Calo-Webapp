"use client";

import { useState } from "react";
import { NotebookPen, Sparkles, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CreateLessonFormInput } from "@/types/lesson";
import { AiLessonWizard } from "./ai-lesson-wizard";
import { LessonForm } from "./lesson-form";

type TabValue = "context" | "organisatie" | "didactiek" | "voorbereiding";
type Mode = "choice" | "ai-wizard" | "form";

function ChoiceCard({
  icon: Icon,
  title,
  description,
  actionLabel,
  accent,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  accent: "primary" | "neutral";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex flex-col gap-3 rounded-2xl border p-6 text-left shadow-brand-sm transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md",
        accent === "primary" ? "border-primary/40 bg-primary/5" : "bg-card",
      )}
    >
      <div
        className={cn(
          "flex size-11 items-center justify-center rounded-full",
          accent === "primary"
            ? "bg-primary/10 text-primary"
            : "bg-muted text-foreground",
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="mt-auto text-sm font-medium text-primary group-hover:underline">
        {actionLabel}
      </span>
    </button>
  );
}

/**
 * Orchestrates /les-maken's three states: the choice between AI-generated
 * and handmatig, the AI wizard, and the (shared, unmodified) LessonForm.
 * `skipChoice` — set when the page already has an active les-concept
 * (activiteit-prefill via ?vanuit, or a tab deep-link like
 * /les-maken?tab=voorbereiding) — goes straight to the form, per the brief's
 * "wanneer er nog geen actieve les-concept gekozen is" condition.
 */
export function LesMakenFlow({
  authorName,
  initialValues,
  initialTab,
  activeSourceCount,
  skipChoice,
}: {
  authorName: string;
  initialValues?: Partial<CreateLessonFormInput>;
  initialTab?: TabValue;
  activeSourceCount?: number;
  skipChoice: boolean;
}) {
  const [mode, setMode] = useState<Mode>(skipChoice ? "form" : "choice");

  if (mode === "choice") {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceCard
          icon={Sparkles}
          title="Genereer een les op maat met AI"
          description="Kies een leerlijn en doelgroep. De AI stelt een volledige lesvoorbereiding samen op basis van de Kennisbank."
          actionLabel="Genereren →"
          accent="primary"
          onClick={() => setMode("ai-wizard")}
        />
        <ChoiceCard
          icon={NotebookPen}
          title="Zelf een les samenstellen"
          description="Bouw je les vanaf nul op met de plattegrond-tekenaar, 3 L'en en lesblokken."
          actionLabel="Beginnen →"
          accent="neutral"
          onClick={() => setMode("form")}
        />
      </div>
    );
  }

  if (mode === "ai-wizard") {
    return (
      <AiLessonWizard
        activeSourceCount={activeSourceCount}
        onCancel={() => setMode("choice")}
        onGenerated={() => setMode("form")}
      />
    );
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
