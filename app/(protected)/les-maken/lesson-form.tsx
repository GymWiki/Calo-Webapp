"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { createLesson, saveLessonDraft } from "@/actions/lesson";
import { AiLescoachSheet } from "@/components/AiLescoachSheet";
import { DidacticsForm } from "@/components/DidacticsForm";
import { EditableList } from "@/components/editable-list";
import { InlineEditText } from "@/components/inline-edit-text";
import { KnowledgeSourceHint } from "@/components/KnowledgeSourceHint";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AI_GENERATED_LESSON_SOURCES_STORAGE_KEY,
  AI_GENERATED_LESSON_STORAGE_KEY,
  type GeneratedLessonWithIds,
} from "@/types/ai";
import type { KnowledgeSourceSummary } from "@/lib/ai/knowledgeRetrieval";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { getCategoryForLearningLine, LEARNING_LINE_CATEGORIES } from "@/lib/constants/learningLines";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN } from "@/types/activity";
import {
  EMPTY_GAME_DIMENSIONS,
  GAME_CATEGORIES,
  createLessonDefaultValues,
  createLessonInputSchema,
  type CreateLessonFormInput,
  type CreateLessonInput,
  type DidacticItem,
} from "@/types/lesson";
import { cn } from "@/lib/utils";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";
import type { RequiredLessonFormField } from "./activity-upload-step";
import { DiagramEditorCard } from "./diagram-editor-card";

// Amber highlight voor velden die de "Upload een bestaande activiteit"-AI
// leeg liet ondanks een geslaagde extractie (zie activity-upload-step.tsx's
// computeFlaggedEmptyFields) — zodat de gebruiker bij het reviewen meteen
// ziet welke velden extra aandacht nodig hebben, i.p.v. een onopvallend leeg
// invoerveld dat net zo goed "hier hoort niks" kan betekenen.
const IMPORT_FLAG_CLASS = "border-amber-400 ring-1 ring-amber-300/70 focus-visible:ring-amber-400";

function ImportFlagHint() {
  return (
    <p className="mt-1 text-xs font-medium text-amber-600">
      Kon niet automatisch worden ingevuld — controleer dit veld.
    </p>
  );
}

const SELECT_CLASS =
  "border-input flex h-10 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

// Zichtbare, niet-blokkerende voortgang i.p.v. een stappenteller — telt de
// zeven secties die hieronder ook zo genummerd/gegroepeerd zijn.
const SECTION_COUNT = 7;

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

function EditorSection({
  title,
  description,
  complete,
  sectionRef,
  children,
}: {
  title: string;
  description?: string;
  complete?: boolean;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  return (
    <Card ref={sectionRef} className="scroll-mt-20">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {complete && (
            <span className="flex items-center gap-1 text-xs font-medium text-success">
              <Check className="size-3.5" aria-hidden="true" />
              Ingevuld
            </span>
          )}
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function LessonForm({
  authorName,
  initialValues,
  initialActivityId,
  initialScrollTarget,
  activeSourceCount,
  flaggedEmptyFields,
}: {
  authorName: string;
  initialValues?: Partial<CreateLessonFormInput>;
  /** Gezet wanneer dit formulier een eerder opgeslagen concept hervat — dan
   * werkt auto-save/opslaan diezelfde rij bij i.p.v. een nieuwe aan te maken. */
  initialActivityId?: string;
  /** Springt na het laden naar deze sectie — gebruikt door de
   * "Zaal-Plattegrond Tekenen"-snelkoppeling op het dashboard, die nog
   * steeds direct bij de plattegrondtekenaar (nu onderdeel van "Materiaal")
   * wil uitkomen. */
  initialScrollTarget?: "materiaal" | "leerhulp";
  activeSourceCount?: number;
  flaggedEmptyFields?: Set<RequiredLessonFormField>;
}) {
  const router = useRouter();

  // Picks up a lesson stashed by the AI Activiteiten Generator wizard
  // (written to sessionStorage by AiLessonWizard before LesMakenFlow
  // switches to this component). Read once, synchronously, as part of the
  // initial render via lazy useState initializers below — not in an
  // effect — so there's no post-mount setState cascade; a fresh mount of
  // this component is the only time this matters, and every initializer
  // here runs once per mount regardless.
  const [stashedGenerated] = useState<GeneratedLessonWithIds | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(AI_GENERATED_LESSON_STORAGE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(AI_GENERATED_LESSON_STORAGE_KEY);
    try {
      return JSON.parse(raw) as GeneratedLessonWithIds;
    } catch {
      return null;
    }
  });

  // Bron-attributie (Stap 7: "Gebaseerd op: ...") bij de zojuist opgehaalde
  // stashedGenerated — apart gestasht, zie AI_GENERATED_LESSON_SOURCES_STORAGE_KEY.
  const [generatedSources] = useState<KnowledgeSourceSummary[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = sessionStorage.getItem(AI_GENERATED_LESSON_SOURCES_STORAGE_KEY);
    if (!raw) return [];
    sessionStorage.removeItem(AI_GENERATED_LESSON_SOURCES_STORAGE_KEY);
    try {
      return JSON.parse(raw) as KnowledgeSourceSummary[];
    } catch {
      return [];
    }
  });

  const [baseMaterials, setBaseMaterials] = useState<string[]>(
    stashedGenerated?.baseMaterials ?? initialValues?.baseMaterials ?? [],
  );
  const [ruleMaterials, setRuleMaterials] = useState<string[]>(
    stashedGenerated?.ruleMaterials ?? initialValues?.ruleMaterials ?? [],
  );
  const [rules, setRules] = useState<string[]>(
    stashedGenerated?.rules ?? initialValues?.rules ?? [],
  );
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>(
    initialValues?.learningOutcomes ?? [],
  );
  const [didacticItems, setDidacticItems] = useState<DidacticItem[]>(
    stashedGenerated?.didacticItems ?? initialValues?.didacticItems ?? [],
  );
  const [tacticalQuestions, setTacticalQuestions] = useState<string[]>(
    stashedGenerated?.tacticalQuestions ?? initialValues?.tacticalQuestions ?? [],
  );
  const [diagram, setDiagram] = useState<{
    data: DiagramData;
    imageDataUrl: string;
  } | null>(null);

  // Concept-rij die auto-save aanmaakt/bijwerkt (zie saveLessonDraft) — als
  // dit formulier een bestaand concept hervat, is dat meteen die rij.
  const [activityId, setActivityId] = useState<string | null>(initialActivityId ?? null);
  const isSavingDraftRef = useRef(false);

  const form = useForm<CreateLessonFormInput, unknown, CreateLessonInput>({
    resolver: zodResolver(createLessonInputSchema),
    defaultValues: {
      ...createLessonDefaultValues,
      ...initialValues,
      ...(stashedGenerated
        ? {
            title: stashedGenerated.title,
            learningLine: stashedGenerated.learningLine,
            movementProblem: stashedGenerated.movementProblem,
            movementTheme: stashedGenerated.movementTheme,
            groupName: stashedGenerated.groupName || "",
            doelgroep: stashedGenerated.doelgroep ?? [],
            goals: stashedGenerated.goals,
            gameCategory: stashedGenerated.gameCategory || "",
            gameDimensions: {
              ...EMPTY_GAME_DIMENSIONS,
              ...stashedGenerated.gameDimensions,
            },
            arrangement: stashedGenerated.arrangement || "",
            deelnemersRegels: stashedGenerated.deelnemersRegels || "",
            plaatjePraatje: stashedGenerated.plaatjePraatje || "",
            aandachtspunten: stashedGenerated.aandachtspunten || "",
          }
        : {}),
    },
  });

  // Side-effect only (no setState) — safe in an effect. Fires once if a
  // generated lesson was picked up above.
  useEffect(() => {
    if (stashedGenerated) {
      const sourcesText =
        generatedSources.length > 0
          ? ` Gebaseerd op: ${generatedSources
              .map((source) => `${source.label} (${source.count})`)
              .join(", ")}.`
          : "";
      toast.success(
        `AI-gegenereerde activiteit geladen — controleer en vul aan.${sourcesText}`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const materiaalSectionRef = useRef<HTMLDivElement | null>(null);
  const leerhulpSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const target =
      initialScrollTarget === "materiaal"
        ? materiaalSectionRef.current
        : initialScrollTarget === "leerhulp"
          ? leerhulpSectionRef.current
          : null;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleDoelgroep(waarde: number) {
    const current = form.getValues("doelgroep");
    form.setValue(
      "doelgroep",
      current.includes(waarde)
        ? current.filter((v) => v !== waarde)
        : [...current, waarde],
    );
  }

  // Auto-save: slaat de huidige stand van het formulier op als concept
  // (status 'draft'), aangeroepen bij het verlaten van een veld — niet per
  // toetsaanslag. Stil bij succes (geen toast per veldwissel), zichtbaar bij
  // een fout, zodat de gebruiker weet dat de laatste wijziging mogelijk niet
  // bewaard is.
  async function autosaveDraft() {
    if (isSavingDraftRef.current) return;
    isSavingDraftRef.current = true;
    try {
      const values = form.getValues();
      const payload: CreateLessonFormInput = {
        ...values,
        baseMaterials,
        ruleMaterials,
        rules,
        learningOutcomes,
        didacticItems,
        tacticalQuestions,
      };
      const result = await saveLessonDraft(
        payload,
        diagram,
        stashedGenerated !== null,
        activityId,
      );
      if ("error" in result) {
        toast.error("Concept opslaan is niet gelukt — je wijzigingen blijven zichtbaar in dit scherm.");
        return;
      }
      setActivityId(result.activityId);
    } finally {
      isSavingDraftRef.current = false;
    }
  }

  async function onSubmit(values: CreateLessonInput) {
    const payload: CreateLessonInput = {
      ...values,
      baseMaterials,
      ruleMaterials,
      rules,
      learningOutcomes,
      didacticItems,
      tacticalQuestions,
    };

    // Herkomst is bepaald bij het openen van dit formulier (stashedGenerated
    // hierboven) en blijft vastliggen, ook als de velden hierna handmatig
    // zijn aangepast — telt daarom nooit mee voor de maandelijkse
    // bijdrage-eis zodra deze activiteit openbaar wordt gemaakt (zie
    // consolidate_lessons_into_activiteiten.sql).
    const result = await createLesson(payload, diagram, stashedGenerated !== null, activityId);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("Activiteit opgeslagen!");
    router.push("/dashboard");
    router.refresh();
  }

  // Watched values voor de leesweergave/voortgang — hetzelfde patroon als de
  // doelgroep-chips hierboven al gebruikten.
  const title = form.watch("title");
  const learningLine = form.watch("learningLine");
  const doelgroep = form.watch("doelgroep");
  const goals = form.watch("goals");
  const movementProblem = form.watch("movementProblem");
  const arrangement = form.watch("arrangement");
  const deelnemersRegels = form.watch("deelnemersRegels");
  const plaatjePraatje = form.watch("plaatjePraatje");
  const aandachtspunten = form.watch("aandachtspunten");
  const gameCategory = form.watch("gameCategory");

  const category = getCategoryForLearningLine(learningLine) ?? null;
  const doelgroepLabels = doelgroep.map((waarde) => DOELGROEP_LABELS[waarde]).filter(Boolean);

  const sectionsComplete = {
    doel: goals.trim().length > 0,
    beginsituatie: movementProblem.trim().length > 0 || doelgroep.length > 0,
    leeruitkomsten: learningOutcomes.some((item) => item.trim().length > 0),
    beschrijving:
      deelnemersRegels.trim().length > 0 ||
      plaatjePraatje.trim().length > 0 ||
      aandachtspunten.trim().length > 0,
    materiaal: arrangement.trim().length > 0 || baseMaterials.length > 0 || ruleMaterials.length > 0,
    leerhulp: didacticItems.length > 0 || gameCategory.trim().length > 0,
  };
  const filledCount =
    (title.trim().length > 0 ? 1 : 0) +
    Object.values(sectionsComplete).filter(Boolean).length;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-24">
        <div className="flex flex-col items-end gap-1.5">
          <AiLescoachSheet
            getPayload={() => ({
              title: form.getValues("title"),
              learningLine: form.getValues("learningLine"),
              movementProblem: form.getValues("movementProblem"),
              movementTheme: form.getValues("movementTheme"),
              goals: form.getValues("goals"),
              didacticItems,
              gameCategory: form.getValues("gameCategory"),
              gameDimensions: form.getValues("gameDimensions"),
              tacticalQuestions,
            })}
            onApplyImprovement={(item) => setDidacticItems((prev) => [...prev, item])}
          />
          {activeSourceCount !== undefined && (
            <KnowledgeSourceHint count={activeSourceCount} />
          )}
        </div>

        {/* Titel + compacte metadata — direct zichtbaar bovenaan, geen
            aparte stap. Zelfde visuele taal als de echte detailpagina:
            eyebrow/titel zonder kaart-omlijning (zie
            app/(protected)/activiteit/[id]/page.tsx). */}
        <div className="animate-fade-up space-y-3">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => {
              const flagged = flaggedEmptyFields?.has("title") && !field.value;
              return (
                <FormItem>
                  <FormControl>
                    <input
                      {...field}
                      placeholder="Titel van de activiteit"
                      className={cn(
                        "w-full border-none bg-transparent p-0 text-2xl font-bold tracking-tight break-words outline-none placeholder:font-normal placeholder:text-muted-foreground sm:text-3xl",
                        flagged && "text-amber-600",
                      )}
                      onBlur={() => {
                        field.onBlur();
                        void autosaveDraft();
                      }}
                    />
                  </FormControl>
                  {flagged ? (
                    <ImportFlagHint />
                  ) : (
                    !field.value && (
                      <p className="text-xs font-medium text-amber-600">Verplicht</p>
                    )
                  )}
                </FormItem>
              );
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <FormField
              control={form.control}
              name="learningLine"
              render={({ field }) => {
                const flagged = flaggedEmptyFields?.has("learningLine") && !field.value;
                return (
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn("size-2.5 shrink-0 rounded-[3px]", getCategoryColor(category).dot)}
                      aria-hidden="true"
                    />
                    <select
                      value={field.value}
                      onChange={(event) => {
                        field.onChange(event.target.value);
                        void autosaveDraft();
                      }}
                      className={cn(SELECT_CLASS, "h-9 w-auto", flagged && IMPORT_FLAG_CLASS)}
                    >
                      <option value="" disabled>
                        Kies een leerlijn
                      </option>
                      {LEARNING_LINE_CATEGORIES.map(({ category: cat, lines }) => (
                        <optgroup key={cat} label={cat}>
                          {lines.map((line) => (
                            <option key={line} value={line}>
                              {line}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                );
              }}
            />

            <FormField
              control={form.control}
              name="movementTheme"
              render={({ field }) => {
                const flagged = flaggedEmptyFields?.has("movementTheme") && !field.value;
                return (
                  <Input
                    {...field}
                    onBlur={() => {
                      field.onBlur();
                      void autosaveDraft();
                    }}
                    placeholder="Bewegingsthema"
                    className={cn("h-9 w-auto max-w-48", flagged && IMPORT_FLAG_CLASS)}
                  />
                );
              }}
            />

            <FormField
              control={form.control}
              name="groupName"
              render={({ field }) => {
                const flagged = flaggedEmptyFields?.has("groupName") && !field.value;
                return (
                  <Input
                    {...field}
                    onBlur={() => {
                      field.onBlur();
                      void autosaveDraft();
                    }}
                    placeholder="Groep/klas"
                    className={cn("h-9 w-auto max-w-40", flagged && IMPORT_FLAG_CLASS)}
                  />
                );
              }}
            />

            <FormField
              control={form.control}
              name="lessonDate"
              render={({ field }) => (
                <Input
                  type="date"
                  {...field}
                  onBlur={() => {
                    field.onBlur();
                    void autosaveDraft();
                  }}
                  className="h-9 w-auto"
                />
              )}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {DOELGROEP_WAARDEN.map((waarde) => {
              const active = doelgroep.includes(waarde);
              return (
                <button
                  key={waarde}
                  type="button"
                  onClick={() => {
                    toggleDoelgroep(waarde);
                    void autosaveDraft();
                  }}
                  className={
                    active
                      ? "rounded-full border border-primary bg-primary px-3 py-1.5 text-sm text-primary-foreground"
                      : "rounded-full border px-3 py-1.5 text-sm text-muted-foreground"
                  }
                >
                  {DOELGROEP_LABELS[waarde]}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-medium text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300 ease-brand"
                  style={{ width: `${(filledCount / SECTION_COUNT) * 100}%` }}
                />
              </div>
              {filledCount} van {SECTION_COUNT} secties ingevuld
            </div>
            <span>Auteur: {authorName}</span>
          </div>
        </div>

        {/* Doelstelling */}
        <EditorSection title="Doelstelling" complete={sectionsComplete.doel}>
          <FormField
            control={form.control}
            name="goals"
            render={({ field }) => {
              const flagged = flaggedEmptyFields?.has("goals") && !field.value;
              return (
                <InlineEditText
                  value={field.value}
                  onChange={field.onChange}
                  onCommit={() => {
                    field.onBlur();
                    void autosaveDraft();
                  }}
                  placeholder="Wat leren leerlingen met deze activiteit?"
                  required
                  flagged={flagged}
                  minRows={3}
                />
              );
            }}
          />
        </EditorSection>

        {/* Beginsituatie & Doelgroep */}
        <EditorSection
          title="Beginsituatie & Doelgroep"
          description="Voor wie is dit, en wat wordt verondersteld dat ze al kunnen?"
          complete={sectionsComplete.beginsituatie}
        >
          {doelgroepLabels.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Doelgroep: <span className="text-foreground">{doelgroepLabels.join(", ")}</span>
            </p>
          )}
          <FormField
            control={form.control}
            name="movementProblem"
            render={({ field }) => {
              const flagged = flaggedEmptyFields?.has("movementProblem") && !field.value;
              return (
                <InlineEditText
                  value={field.value}
                  onChange={field.onChange}
                  onCommit={() => {
                    field.onBlur();
                    void autosaveDraft();
                  }}
                  placeholder="Wat wordt verondersteld dat leerlingen al kunnen/hebben gedaan?"
                  required
                  flagged={flagged}
                />
              );
            }}
          />
        </EditorSection>

        {/* Leermogelijkheden / Leeruitkomsten */}
        <EditorSection title="Leermogelijkheden / Leeruitkomsten" complete={sectionsComplete.leeruitkomsten}>
          <EditableList
            items={learningOutcomes}
            onChange={setLearningOutcomes}
            onCommit={() => void autosaveDraft()}
            itemPlaceholder="Bijv. De leerling kan een bal onderhands overspelen"
            addLabel="Voeg leeruitkomst toe"
            emptyHint="Nog geen leeruitkomsten — voeg de eerste toe."
          />
        </EditorSection>

        {/* Beschrijving & uitvoering */}
        <EditorSection title="Beschrijving & uitvoering" complete={sectionsComplete.beschrijving}>
          <div>
            <SectionHeading>Deelnemers & Regels</SectionHeading>
            <FormField
              control={form.control}
              name="deelnemersRegels"
              render={({ field }) => {
                const flagged = flaggedEmptyFields?.has("deelnemersRegels") && !field.value;
                return (
                  <InlineEditText
                    value={field.value}
                    onChange={field.onChange}
                    onCommit={() => {
                      field.onBlur();
                      void autosaveDraft();
                    }}
                    placeholder="Rolinvulling: wie staat waar, wisselregels, scheidsrechters op de bank."
                    required
                    flagged={flagged}
                  />
                );
              }}
            />
          </div>
          <div>
            <SectionHeading>Plaatje & Praatje</SectionHeading>
            <FormField
              control={form.control}
              name="plaatjePraatje"
              render={({ field }) => {
                const flagged = flaggedEmptyFields?.has("plaatjePraatje") && !field.value;
                return (
                  <InlineEditText
                    value={field.value}
                    onChange={field.onChange}
                    onCommit={() => {
                      field.onBlur();
                      void autosaveDraft();
                    }}
                    placeholder="Hoe de instructie visueel getoond wordt, hoe doelen worden uitgelegd en de wisselafspraken."
                    required
                    flagged={flagged}
                  />
                );
              }}
            />
          </div>
          <div>
            <SectionHeading>Aandachtspunten</SectionHeading>
            <FormField
              control={form.control}
              name="aandachtspunten"
              render={({ field }) => {
                const flagged = flaggedEmptyFields?.has("aandachtspunten") && !field.value;
                return (
                  <InlineEditText
                    value={field.value}
                    onChange={field.onChange}
                    onCommit={() => {
                      field.onBlur();
                      void autosaveDraft();
                    }}
                    placeholder="Veiligheid, houding en tactiek."
                    required
                    flagged={flagged}
                  />
                );
              }}
            />
          </div>
          <div>
            <SectionHeading>Regels</SectionHeading>
            <EditableList
              items={rules}
              onChange={setRules}
              onCommit={() => void autosaveDraft()}
              itemPlaceholder="Bijv. Geen slingerworpen"
              addLabel="Voeg regel toe"
              emptyHint="Nog geen regels genoteerd."
            />
          </div>
        </EditorSection>

        {/* Materiaal (incl. plattegrond) */}
        <EditorSection
          title="Materiaal"
          complete={sectionsComplete.materiaal}
          sectionRef={materiaalSectionRef}
        >
          <div>
            <SectionHeading>Arrangement — veld & opstelling</SectionHeading>
            <FormField
              control={form.control}
              name="arrangement"
              render={({ field }) => {
                const flagged = flaggedEmptyFields?.has("arrangement") && !field.value;
                return (
                  <InlineEditText
                    value={field.value}
                    onChange={field.onChange}
                    onCommit={() => {
                      field.onBlur();
                      void autosaveDraft();
                    }}
                    placeholder="De fysieke opstelling en het speelveld."
                    required
                    flagged={flagged}
                  />
                );
              }}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <EditableList
              label="Basismateriaal"
              items={baseMaterials}
              onChange={setBaseMaterials}
              onCommit={() => void autosaveDraft()}
              itemPlaceholder="Bijv. 6 kleine matjes"
              addLabel="Voeg materiaal toe"
              emptyHint="Nog geen basismateriaal."
            />
            <EditableList
              label="Regelmateriaal"
              items={ruleMaterials}
              onChange={setRuleMaterials}
              onCommit={() => void autosaveDraft()}
              itemPlaceholder="Bijv. 4 foamballen"
              addLabel="Voeg materiaal toe"
              emptyHint="Nog geen regelmateriaal."
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="minParticipants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deelnemers in het veld</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={(field.value as number | undefined) ?? ""}
                      onBlur={() => {
                        field.onBlur();
                        void autosaveDraft();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="participantsBench"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deelnemers op de bank</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      value={(field.value as number | undefined) ?? ""}
                      onBlur={() => {
                        field.onBlur();
                        void autosaveDraft();
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <DiagramEditorCard
            onExport={(data, imageDataUrl) => {
              setDiagram({ data, imageDataUrl });
              void autosaveDraft();
            }}
          />
        </EditorSection>

        {/* Leerhulp: Game-Based Pedagogy + Didactische analyse (3 L'en) */}
        <EditorSection
          title="Leerhulp"
          description="Game-Based Pedagogy en de didactische analyse (Loopt 't? / Lukt 't? / Leeft 't?)."
          complete={sectionsComplete.leerhulp}
          sectionRef={leerhulpSectionRef}
        >
          <div>
            <SectionHeading>Spelcategorie</SectionHeading>
            <FormField
              control={form.control}
              name="gameCategory"
              render={({ field }) => (
                <select
                  value={field.value}
                  onChange={(event) => {
                    field.onChange(event.target.value);
                    void autosaveDraft();
                  }}
                  className={SELECT_CLASS}
                >
                  <option value="">Kies een spelcategorie</option>
                  {GAME_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            />
          </div>

          <div>
            <SectionHeading>Speldimensies (Game Dimensions)</SectionHeading>
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="gameDimensions.space"
                render={({ field }) => (
                  <div>
                    <Label className="text-xs font-normal text-muted-foreground">
                      Ruimte (Space)
                    </Label>
                    <Input
                      className="mt-1"
                      placeholder="Bijv. Half veld, drie zones"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        void autosaveDraft();
                      }}
                    />
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="gameDimensions.equipment"
                render={({ field }) => (
                  <div>
                    <Label className="text-xs font-normal text-muted-foreground">
                      Materiaal (Equipment)
                    </Label>
                    <Input
                      className="mt-1"
                      placeholder="Bijv. Grote, zachte bal"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        void autosaveDraft();
                      }}
                    />
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="gameDimensions.people"
                render={({ field }) => (
                  <div>
                    <Label className="text-xs font-normal text-muted-foreground">
                      Aantallen (People)
                    </Label>
                    <Input
                      className="mt-1"
                      placeholder="Bijv. 3 tegen 2"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        void autosaveDraft();
                      }}
                    />
                  </div>
                )}
              />
              <FormField
                control={form.control}
                name="gameDimensions.rules"
                render={({ field }) => (
                  <div>
                    <Label className="text-xs font-normal text-muted-foreground">
                      Regels (Rules)
                    </Label>
                    <Input
                      className="mt-1"
                      placeholder="Bijv. Alleen onderhands passen"
                      {...field}
                      onBlur={() => {
                        field.onBlur();
                        void autosaveDraft();
                      }}
                    />
                  </div>
                )}
              />
            </div>
          </div>

          <EditableList
            label="Tactische reflectievragen"
            items={tacticalQuestions}
            onChange={setTacticalQuestions}
            onCommit={() => void autosaveDraft()}
            itemPlaceholder="Bijv. Wanneer kies je voor een korte in plaats van lange pass?"
            addLabel="Voeg vraag toe"
            emptyHint="Nog geen tactische reflectievragen."
          />

          <div>
            <SectionHeading>{"Didactische analyse — Loopt 't? / Lukt 't? / Leeft 't?"}</SectionHeading>
            <DidacticsForm items={didacticItems} onChange={setDidacticItems} />
          </div>
        </EditorSection>

        {/* Vaste opslaan-balk — alle breedtes, safe-area-bewust (zelfde
            patroon als components/activity-detail-actions.tsx). */}
        <div className="fixed inset-x-0 bottom-16 z-40 flex items-center justify-between gap-3 border-t bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-brand-lg md:bottom-0">
          <p className="hidden text-sm text-muted-foreground sm:block">
            {filledCount} van {SECTION_COUNT} secties ingevuld
          </p>
          <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1 sm:flex-none">
            {form.formState.isSubmitting ? "Bezig met opslaan..." : "Activiteit opslaan"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
