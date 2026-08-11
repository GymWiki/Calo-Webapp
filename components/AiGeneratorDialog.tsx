"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AI_GENERATED_LESSON_STORAGE_KEY } from "@/types/ai";
import { BASISDOCUMENT_LEERLIJNEN, GAME_CATEGORIES } from "@/types/lesson";

const SELECT_CLASS =
  "border-input mt-1.5 flex h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function AiGeneratorDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [learningLine, setLearningLine] = useState("");
  const [targetGroup, setTargetGroup] = useState("");
  const [gameCategory, setGameCategory] = useState("");

  async function handleGenerate() {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learningLine,
          targetGroup,
          gameCategory: gameCategory || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok || "error" in data) {
        toast.error(data.error ?? "Genereren van de lesvoorbereiding is mislukt.");
        return;
      }

      sessionStorage.setItem(
        AI_GENERATED_LESSON_STORAGE_KEY,
        JSON.stringify(data.lesson),
      );
      setOpen(false);
      router.push("/les-maken");
    } catch {
      toast.error("Genereren van de lesvoorbereiding is mislukt. Probeer het opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex w-full flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-5 text-left shadow-brand-sm transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md",
          )}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold">Genereer een les op maat met AI</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Kies een leerlijn en doelgroep, en de AI Activiteiten Generator
              bouwt een kant-en-klare lesvoorbereiding.
            </p>
          </div>
          <span className="mt-auto text-sm font-medium text-primary group-hover:underline">
            Genereren →
          </span>
        </button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            AI Activiteiten Generator
          </DialogTitle>
          <DialogDescription>
            Op basis van de Kennisbank stelt de AI een volledige
            lesvoorbereiding voor, die je direct kunt aanpassen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="ai-gen-learning-line">Leerlijn</Label>
            <select
              id="ai-gen-learning-line"
              className={SELECT_CLASS}
              value={learningLine}
              onChange={(event) => setLearningLine(event.target.value)}
            >
              <option value="">Kies een leerlijn</option>
              {BASISDOCUMENT_LEERLIJNEN.map((line) => (
                <option key={line} value={line}>
                  {line}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="ai-gen-target-group">Doelgroep</Label>
            <Input
              id="ai-gen-target-group"
              className="mt-1.5"
              value={targetGroup}
              onChange={(event) => setTargetGroup(event.target.value)}
              placeholder="Bijv. Groep 7/8"
            />
          </div>

          <div>
            <Label htmlFor="ai-gen-game-category">
              Spelcategorie (optioneel)
            </Label>
            <select
              id="ai-gen-game-category"
              className={SELECT_CLASS}
              value={gameCategory}
              onChange={(event) => setGameCategory(event.target.value)}
            >
              <option value="">Laat de AI kiezen</option>
              {GAME_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !learningLine || !targetGroup}
            className="w-full sm:w-auto"
          >
            <Sparkles className="size-4" />
            {isGenerating ? "Bezig met genereren..." : "Genereer lesvoorbereiding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
