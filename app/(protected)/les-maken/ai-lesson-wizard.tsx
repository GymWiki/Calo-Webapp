"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KnowledgeSourceHint } from "@/components/KnowledgeSourceHint";
import { PaywallModal } from "@/components/PaywallModal";
import { Label } from "@/components/ui/label";
import { LEARNING_LINE_CATEGORIES } from "@/lib/constants/learningLines";
import { cn } from "@/lib/utils";
import { AI_GENERATED_LESSON_STORAGE_KEY } from "@/types/ai";

const SELECT_CLASS =
  "border-input mt-1.5 flex h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const STEP_LABELS = ["Leerlijn", "Doelgroep", "Genereren"] as const;
type Step = 1 | 2 | 3;

/**
 * Opstap-wizard voor de AI Activiteiten Generator, ingebed op /les-maken.
 * Schrijft het resultaat naar dezelfde sessionStorage-sleutel als voorheen
 * (AI_GENERATED_LESSON_STORAGE_KEY) — LessonForm's bestaande lazy
 * useState-initializer pikt dat vanzelf op zodra `onGenerated` de ouder
 * naar de formulier-weergave laat schakelen, zonder dat LessonForm zelf
 * hoefde te veranderen.
 */
export function AiLessonWizard({
  activeSourceCount,
  xp,
  onCancel,
  onGenerated,
}: {
  activeSourceCount?: number;
  xp: number;
  onCancel: () => void;
  onGenerated: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [learningLine, setLearningLine] = useState("");
  const [targetGroup, setTargetGroup] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallMessage, setPaywallMessage] = useState("");

  async function handleGenerate() {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ learningLine, targetGroup }),
      });
      const data = await response.json();

      if (!response.ok || "error" in data) {
        if (response.status === 429) {
          setPaywallMessage(
            data.error ?? "Je hebt je gratis AI-generaties voor deze maand gebruikt.",
          );
          setPaywallOpen(true);
        } else {
          toast.error(data.error ?? "Genereren van de lesvoorbereiding is mislukt.");
        }
        return;
      }

      sessionStorage.setItem(
        AI_GENERATED_LESSON_STORAGE_KEY,
        JSON.stringify(data.lesson),
      );
      onGenerated();
    } catch {
      toast.error("Genereren van de lesvoorbereiding is mislukt. Probeer het opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="animate-fade-up space-y-6 rounded-2xl border bg-card p-5 shadow-brand-sm sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Terug
        </button>
        <p className="font-mono text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          Stap {step} van 3 · {STEP_LABELS[step - 1]}
        </p>
      </div>

      <div className="flex gap-1.5">
        {STEP_LABELS.map((label, index) => (
          <div
            key={label}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300 ease-brand",
              index <= step - 1 ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="font-semibold">AI Activiteiten Generator</p>
          <p className="text-sm text-muted-foreground">
            Op basis van de Kennisbank stelt de AI een volledige lesvoorbereiding voor.
          </p>
        </div>
      </div>

      {step === 1 && (
        <div>
          <Label htmlFor="ai-wizard-learning-line">Leerlijn</Label>
          <select
            id="ai-wizard-learning-line"
            className={SELECT_CLASS}
            value={learningLine}
            onChange={(event) => setLearningLine(event.target.value)}
          >
            <option value="" disabled>
              Kies een leerlijn
            </option>
            {LEARNING_LINE_CATEGORIES.map(({ category, lines }) => (
              <optgroup key={category} label={category}>
                {lines.map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {step === 2 && (
        <div>
          <Label htmlFor="ai-wizard-target-group">Doelgroep</Label>
          <Input
            id="ai-wizard-target-group"
            className="mt-1.5"
            value={targetGroup}
            onChange={(event) => setTargetGroup(event.target.value)}
            placeholder="Bijv. Groep 5/6 of Klas 2 VMBO"
            autoFocus
          />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-4 rounded-lg border bg-muted/40 p-4 text-sm">
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Leerlijn
              </dt>
              <dd className="mt-0.5 font-medium">{learningLine}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Doelgroep
              </dt>
              <dd className="mt-0.5 font-medium">{targetGroup}</dd>
            </div>
          </dl>
          {activeSourceCount !== undefined && (
            <KnowledgeSourceHint count={activeSourceCount} />
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStep((prev) => (prev - 1) as Step)}
          disabled={step === 1}
        >
          Vorige
        </Button>

        {step < 3 ? (
          <Button
            type="button"
            onClick={() => setStep((prev) => (prev + 1) as Step)}
            disabled={(step === 1 && !learningLine) || (step === 2 && !targetGroup.trim())}
          >
            Volgende
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button type="button" onClick={handleGenerate} disabled={isGenerating}>
            <Sparkles className="size-4" />
            {isGenerating ? "Bezig met genereren..." : "Genereer lesvoorbereiding"}
          </Button>
        )}
      </div>
      <PaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        message={paywallMessage}
        xp={xp}
      />
    </div>
  );
}
