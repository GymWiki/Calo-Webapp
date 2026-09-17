"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { KnowledgeSourceHint } from "@/components/KnowledgeSourceHint";
import { Label } from "@/components/ui/label";
import type { LessonGeneratorAccess } from "@/lib/ai/lessonGeneratorAccess";
import { LEARNING_LINE_CATEGORIES } from "@/lib/constants/learningLines";
import { SPORT_TOPIC_CATEGORIES } from "@/lib/constants/sportTopics";
import { cn } from "@/lib/utils";
import {
  AI_GENERATED_LESSON_CHUNKS_STORAGE_KEY,
  AI_GENERATED_LESSON_SOURCES_STORAGE_KEY,
  AI_GENERATED_LESSON_STORAGE_KEY,
} from "@/types/ai";

const SELECT_CLASS =
  "border-input mt-1.5 flex h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

// Zelfde visuele stijl als de doelgroep-chips in activity-wizard-page.tsx
// (DOELGROEP_CHIP_CLASS) — bewust hier lokaal herhaald i.p.v. geïmporteerd,
// want die constante is niet geëxporteerd vanuit dat bestand.
const CHIP_CLASS =
  "rounded-full border px-3 py-1.5 text-left text-sm outline-none transition-[color,box-shadow,background-color,transform] duration-150 ease-brand focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 active:scale-[0.98]";

const STEP_LABELS = ["Leerlijn", "Onderwerp", "Leeruitkomst", "Doelgroep", "Genereren"] as const;
type Step = 1 | 2 | 3 | 4 | 5;

const ANDERS_OPTIE = "__anders__";

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        CHIP_CLASS,
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Opstap-wizard voor de AI Activiteiten Generator, ingebed op /les-maken.
 * Schrijft het resultaat naar dezelfde sessionStorage-sleutel als voorheen
 * (AI_GENERATED_LESSON_STORAGE_KEY) — LessonForm's bestaande lazy
 * useState-initializer pikt dat vanzelf op zodra `onGenerated` de ouder
 * naar de formulier-weergave laat schakelen, zonder dat LessonForm zelf
 * hoefde te veranderen.
 *
 * Uitgebreid met onderwerp/sport + leerlijn-specifieke leeruitkomst-selectie
 * (zie de brief "Verbeter de AI-activiteitengenerator"): zonder een concreet
 * decor (sport) en een sturende leeruitkomst bleef de AI hangen in een vage,
 * algemene opzet i.p.v. één uitvoerbare activiteit.
 */
export function AiLessonWizard({
  activeSourceCount,
  lessonGeneratorAccess,
  leeruitkomstenByLeerlijn,
  popularMaterials,
  onCancel,
  onGenerated,
}: {
  activeSourceCount?: number;
  lessonGeneratorAccess: LessonGeneratorAccess;
  /** Leerlijn -> lijst van vaste, selecteerbare leeruitkomsten (zie
   * supabase/migrations/leerlijn_leeruitkomsten.sql). */
  leeruitkomstenByLeerlijn: Record<string, string[]>;
  /** Veelgebruikte materialen (canvas-gebruik) voor de optionele "Beschikbaar
   * materiaal"-checklist — zie lib/services/materials.ts. */
  popularMaterials: string[];
  onCancel: () => void;
  onGenerated: () => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [learningLine, setLearningLine] = useState("");
  const [topic, setTopic] = useState("");
  const [selectedOutcomes, setSelectedOutcomes] = useState<string[]>([]);
  const [customOutcome, setCustomOutcome] = useState("");
  const [targetGroup, setTargetGroup] = useState("");
  const [minParticipants, setMinParticipants] = useState("");
  const [participantsBench, setParticipantsBench] = useState("");
  const [location, setLocation] = useState<"binnen" | "buiten" | "">("");
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const availableOutcomes = leeruitkomstenByLeerlijn[learningLine] ?? [];
  const usesCustomOutcome = selectedOutcomes.includes(ANDERS_OPTIE);
  const learningOutcomes = [
    ...selectedOutcomes.filter((outcome) => outcome !== ANDERS_OPTIE),
    ...(usesCustomOutcome && customOutcome.trim() ? [customOutcome.trim()] : []),
  ];

  function handleLearningLineChange(value: string) {
    setLearningLine(value);
    // Een leeruitkomst-selectie uit een ANDERE leerlijn heeft hier geen
    // betekenis meer — voorkomt dat een oude keuze onzichtbaar blijft
    // meetellen na het wisselen van leerlijn.
    setSelectedOutcomes([]);
    setCustomOutcome("");
  }

  async function handleGenerate() {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          learningLine,
          targetGroup,
          topic,
          learningOutcomes,
          minParticipants: minParticipants.trim() ? Number(minParticipants) : undefined,
          participantsBench: participantsBench.trim() ? Number(participantsBench) : undefined,
          location: location || undefined,
          availableMaterials: selectedMaterials,
        }),
      });
      const data = await response.json();

      if (!response.ok || "error" in data) {
        toast.error(data.error ?? "Genereren van de activiteit is mislukt.");
        return;
      }

      sessionStorage.setItem(
        AI_GENERATED_LESSON_STORAGE_KEY,
        JSON.stringify(data.lesson),
      );
      if (data.sources) {
        sessionStorage.setItem(
          AI_GENERATED_LESSON_SOURCES_STORAGE_KEY,
          JSON.stringify(data.sources),
        );
      }
      if (data.usedKnowledgeChunks) {
        sessionStorage.setItem(
          AI_GENERATED_LESSON_CHUNKS_STORAGE_KEY,
          JSON.stringify(data.usedKnowledgeChunks),
        );
      }
      onGenerated();
    } catch {
      toast.error("Genereren van de activiteit is mislukt. Probeer het opnieuw.");
    } finally {
      setIsGenerating(false);
    }
  }

  const canProceed =
    (step !== 1 || Boolean(learningLine)) &&
    (step !== 2 || Boolean(topic)) &&
    (step !== 3 || learningOutcomes.length > 0) &&
    (step !== 4 || Boolean(targetGroup.trim()));

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
          Stap {step} van {STEP_LABELS.length} · {STEP_LABELS[step - 1]}
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
            Op basis van de Kennisbank stelt de AI één concrete, uitvoerbare activiteit voor.
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
            onChange={(event) => handleLearningLineChange(event.target.value)}
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
          <Label htmlFor="ai-wizard-topic">Onderwerp/sport</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Het concrete decor waarbinnen de leerlijn wordt beoefend — geeft de AI spelregels,
            materialen en context om op te bouwen.
          </p>
          <select
            id="ai-wizard-topic"
            className={SELECT_CLASS}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
          >
            <option value="" disabled>
              Kies een onderwerp/sport
            </option>
            {SPORT_TOPIC_CATEGORIES.map(({ category, topics }) => (
              <optgroup key={category} label={category}>
                {topics.map((sportTopic) => (
                  <option key={sportTopic} value={sportTopic}>
                    {sportTopic}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div>
            <Label>Leeruitkomst(en)</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Kies één of meer concrete leeruitkomsten — deze sturen de hele activiteit.
            </p>
          </div>
          {availableOutcomes.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {availableOutcomes.map((outcome) => (
                <Chip
                  key={outcome}
                  active={selectedOutcomes.includes(outcome)}
                  onClick={() => setSelectedOutcomes((prev) => toggleInList(prev, outcome))}
                >
                  {outcome}
                </Chip>
              ))}
              <Chip
                active={usesCustomOutcome}
                onClick={() => setSelectedOutcomes((prev) => toggleInList(prev, ANDERS_OPTIE))}
              >
                Anders, namelijk...
              </Chip>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Voor deze leerlijn zijn nog geen vaste leeruitkomsten vastgelegd — vul hieronder je
              eigen leeruitkomst in.
            </p>
          )}
          {(usesCustomOutcome || availableOutcomes.length === 0) && (
            <Input
              value={customOutcome}
              onChange={(event) => setCustomOutcome(event.target.value)}
              placeholder="Bijv. Op tijd naar het volgende honk rennen"
              autoFocus
            />
          )}
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ai-wizard-min-participants">In het veld (optioneel)</Label>
              <Input
                id="ai-wizard-min-participants"
                type="number"
                min={1}
                className="mt-1.5"
                value={minParticipants}
                onChange={(event) => setMinParticipants(event.target.value)}
                placeholder="Aantal"
              />
            </div>
            <div>
              <Label htmlFor="ai-wizard-participants-bench">Op de bank (optioneel)</Label>
              <Input
                id="ai-wizard-participants-bench"
                type="number"
                min={0}
                className="mt-1.5"
                value={participantsBench}
                onChange={(event) => setParticipantsBench(event.target.value)}
                placeholder="Aantal"
              />
            </div>
          </div>

          <div>
            <Label>Binnen of buiten (optioneel)</Label>
            <div className="mt-1.5 flex gap-1.5">
              <Chip active={location === "binnen"} onClick={() => setLocation((prev) => (prev === "binnen" ? "" : "binnen"))}>
                Binnen (gymzaal)
              </Chip>
              <Chip active={location === "buiten"} onClick={() => setLocation((prev) => (prev === "buiten" ? "" : "buiten"))}>
                Buiten
              </Chip>
            </div>
          </div>

          {popularMaterials.length > 0 && (
            <div>
              <Label>Beschikbaar materiaal (optioneel)</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Zonder selectie mag de AI zelf materiaal kiezen; met een selectie blijft ze
                daarbinnen.
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {popularMaterials.map((material) => (
                  <Chip
                    key={material}
                    active={selectedMaterials.includes(material)}
                    onClick={() => setSelectedMaterials((prev) => toggleInList(prev, material))}
                  >
                    {material}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {step === 5 && (
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
                Onderwerp/sport
              </dt>
              <dd className="mt-0.5 font-medium">{topic}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Leeruitkomst(en)
              </dt>
              <dd className="mt-0.5 font-medium">{learningOutcomes.join("; ")}</dd>
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
          {activeSourceCount === 0 && (
            <p className="text-xs font-medium text-destructive">
              Selecteer minstens één bron in de kennisbank — voeg een artikel toe of zet een
              Standaardbibliotheek-pakket aan voordat je genereert.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {lessonGeneratorAccess.remaining} van {lessonGeneratorAccess.limit} lesgeneraties
            deze maand over.
          </p>
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

        {step < 5 ? (
          <Button
            type="button"
            onClick={() => setStep((prev) => (prev + 1) as Step)}
            disabled={!canProceed}
          >
            Volgende
            <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !lessonGeneratorAccess.allowed || activeSourceCount === 0}
          >
            <Sparkles className="size-4" />
            {isGenerating ? "Bezig met genereren..." : "Genereer activiteit"}
          </Button>
        )}
      </div>
    </div>
  );
}
