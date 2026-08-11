"use client";

import { useState } from "react";
import { Bot, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { matchDidacticCategory, type LescoachFeedback } from "@/types/ai";
import type { DidacticItem, GameDimensions } from "@/types/lesson";

export type AnalyzeLessonPayload = {
  title?: string;
  learningLine?: string;
  movementProblem?: string;
  movementTheme?: string;
  goals?: string;
  didacticItems?: DidacticItem[];
  gameCategory?: string;
  gameDimensions?: Partial<GameDimensions>;
  tacticalQuestions?: string[];
};

function createId() {
  return `d-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * AI Lescoach trigger + mobielvriendelijke bottom sheet. `getPayload` is
 * called fresh each time the sheet opens (not memoized) so it always sends
 * the form's live values — pass a closure that reads current state/form
 * values, not a snapshot captured at render time.
 */
export function AiLescoachSheet({
  getPayload,
  onApplyImprovement,
  triggerClassName,
  triggerVariant = "outline",
}: {
  getPayload: () => AnalyzeLessonPayload;
  onApplyImprovement?: (item: DidacticItem) => void;
  triggerClassName?: string;
  triggerVariant?: "outline" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<LescoachFeedback | null>(null);
  const [appliedIndexes, setAppliedIndexes] = useState<Set<number>>(new Set());

  async function runAnalysis() {
    setIsLoading(true);
    setFeedback(null);
    setAppliedIndexes(new Set());

    try {
      const response = await fetch("/api/ai/analyze-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(getPayload()),
      });
      const data = await response.json();

      if (!response.ok || "error" in data) {
        toast.error(data.error ?? "AI Lescoach-analyse is mislukt.");
        setOpen(false);
        return;
      }

      setFeedback(data.feedback);
    } catch {
      toast.error("AI Lescoach-analyse is mislukt. Controleer je verbinding.");
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen && !feedback && !isLoading) {
      runAnalysis();
    }
  }

  function handleApply(index: number) {
    if (!feedback || !onApplyImprovement) return;
    const improvement = feedback.improvements[index];
    const category = matchDidacticCategory(improvement.category) ?? "lukt_het";

    onApplyImprovement({
      id: createId(),
      category,
      subTheme: null,
      observation: "AI-suggestie",
      action: improvement.suggestion,
    });
    setAppliedIndexes((prev) => new Set(prev).add(index));
    toast.success("Suggestie toegevoegd aan de didactische analyse.");
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button type="button" variant={triggerVariant} className={triggerClassName}>
          <Bot className="size-4" />
          AI Lescoach raadplegen
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Bot className="size-5" />
            AI Lescoach
          </SheetTitle>
          <SheetDescription>
            Feedback op je lesvoorbereiding, gebaseerd op de Kennisbank.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto px-4">
          {isLoading && (
            <p className="text-sm text-muted-foreground">Bezig met analyseren...</p>
          )}

          {!isLoading && feedback && (
            <>
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
                  {feedback.score}
                </div>
                <p className="text-sm">{feedback.summary}</p>
              </div>

              {feedback.strengths.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Pluspunten</h3>
                  <ul className="space-y-1.5">
                    {feedback.strengths.map((strength, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        {strength}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.improvements.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold">Verbeterpunten</h3>
                  <ul className="space-y-2">
                    {feedback.improvements.map((improvement, index) => (
                      <li key={index} className="rounded-lg border p-3">
                        <Badge variant="secondary" className="mb-1.5">
                          {improvement.category}
                        </Badge>
                        <p className="text-sm">{improvement.suggestion}</p>
                        {onApplyImprovement && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-2"
                            disabled={appliedIndexes.has(index)}
                            onClick={() => handleApply(index)}
                          >
                            {appliedIndexes.has(index) ? (
                              <>
                                <Check className="size-3.5" />
                                Toegepast
                              </>
                            ) : (
                              <>
                                <Sparkles className="size-3.5" />
                                Pas automatisch toe
                              </>
                            )}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            onClick={runAnalysis}
            disabled={isLoading}
          >
            Opnieuw analyseren
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Server-Component-friendly wrapper: takes a plain (serializable) payload
 * instead of a getter function, for pages like /les/[id] where the lesson
 * data is already fetched server-side. No "Pas automatisch toe" — there's
 * nothing editable to apply it to on a read-only detail page yet.
 */
export function AiLescoachButton({
  payload,
  className,
}: {
  payload: AnalyzeLessonPayload;
  className?: string;
}) {
  return (
    <AiLescoachSheet getPayload={() => payload} triggerClassName={className} />
  );
}
