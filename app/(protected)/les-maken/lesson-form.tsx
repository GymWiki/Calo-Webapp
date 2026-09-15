"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { createLesson, saveLessonDraft } from "@/actions/lesson";
import { ActivityWizardPage } from "@/components/activity-wizard-page";
import { KnowledgeSourceHint } from "@/components/KnowledgeSourceHint";
import { Form } from "@/components/ui/form";
import { BEWEGINGSTHEMAS } from "@/lib/constants/learningLines";
import { applyDoelgroepToggle } from "@/types/activity";
import {
  AI_GENERATED_LESSON_SOURCES_STORAGE_KEY,
  AI_GENERATED_LESSON_STORAGE_KEY,
  type GeneratedLessonWithIds,
} from "@/types/ai";
import type { KnowledgeSourceSummary } from "@/lib/ai/knowledgeRetrieval";
import {
  createLessonDefaultValues,
  createLessonInputSchema,
  type CreateLessonFormInput,
  type CreateLessonInput,
  type DidacticItem,
} from "@/types/lesson";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";
import type { RequiredLessonFormField } from "./activity-upload-step";

// Zichtbare, niet-blokkerende voortgang i.p.v. een stappenteller — telt de
// zeven secties die ActivityWizardPage ook zo groepeert.
const SECTION_COUNT = 7;

// LessonForm is de "mode=edit"-aanroeper van components/activity-wizard-page.tsx
// (dezelfde component die de wizard-activiteit-detailpagina in "mode=view"
// gebruikt) — dit bestand regelt alleen nog de formulierstaat (react-hook-form
// + de losse array-velden), auto-save en de uiteindelijke submit; de hele
// lay-out/styling komt uit die gedeelde component.
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
  /** Welke tab standaard open staat — gebruikt door de "Zaal-Plattegrond
   * Tekenen"-snelkoppeling op het dashboard. */
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

  function toggleDoelgroep(waarde: number) {
    form.setValue("doelgroep", applyDoelgroepToggle(form.getValues("doelgroep"), waarde));
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

  // Watched values — ActivityWizardPage is een "domme" weergavecomponent die
  // gewone value/onChange-props verwacht, geen react-hook-form Controllers.
  const title = form.watch("title");
  const learningLine = form.watch("learningLine");
  const movementTheme = form.watch("movementTheme");
  const groupName = form.watch("groupName");
  const lessonDate = form.watch("lessonDate");
  const doelgroep = form.watch("doelgroep");
  const minParticipants = form.watch("minParticipants") as number | undefined;
  const participantsBench = form.watch("participantsBench") as number | undefined;
  const goals = form.watch("goals");
  const movementProblem = form.watch("movementProblem");
  const arrangement = form.watch("arrangement");
  const deelnemersRegels = form.watch("deelnemersRegels");
  const plaatjePraatje = form.watch("plaatjePraatje");
  const aandachtspunten = form.watch("aandachtspunten");

  const sectionsComplete = {
    doel: goals.trim().length > 0,
    beginsituatie: movementProblem.trim().length > 0 || doelgroep.length > 0,
    leeruitkomsten: learningOutcomes.some((item) => item.trim().length > 0),
    beschrijving:
      deelnemersRegels.trim().length > 0 ||
      plaatjePraatje.trim().length > 0 ||
      aandachtspunten.trim().length > 0,
    materiaal: arrangement.trim().length > 0 || baseMaterials.length > 0 || ruleMaterials.length > 0,
    leerhulp: didacticItems.length > 0,
  };
  const filledCount =
    (title.trim().length > 0 ? 1 : 0) +
    Object.values(sectionsComplete).filter(Boolean).length;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 md:space-y-6">
        {activeSourceCount !== undefined && (
          <div className="flex justify-end">
            <KnowledgeSourceHint count={activeSourceCount} />
          </div>
        )}

        <ActivityWizardPage
          mode="edit"
          defaultTab={initialScrollTarget}
          title={title}
          onTitleChange={(value) => form.setValue("title", value)}
          titleFlagged={flaggedEmptyFields?.has("title") && !title}
          learningLine={learningLine}
          onLearningLineChange={(value) => {
            form.setValue("learningLine", value);
            // Bewegingsthema hoort BIJ de leerlijn (zie BEWEGINGSTHEMAS) — bij
            // een nieuwe leerlijn een thema uit de vorige leerlijn laten staan
            // zou de twee weer los van elkaar laten drijven.
            const themeOptions = BEWEGINGSTHEMAS[value] ?? [];
            if (!themeOptions.includes(movementTheme)) {
              form.setValue("movementTheme", themeOptions.length > 0 ? "" : value);
            }
          }}
          learningLineFlagged={flaggedEmptyFields?.has("learningLine") && !learningLine}
          movementTheme={movementTheme}
          onMovementThemeChange={(value) => form.setValue("movementTheme", value)}
          movementThemeFlagged={flaggedEmptyFields?.has("movementTheme") && !movementTheme}
          groupName={groupName}
          onGroupNameChange={(value) => form.setValue("groupName", value)}
          groupNameFlagged={flaggedEmptyFields?.has("groupName") && !groupName}
          activityDate={lessonDate}
          onActivityDateChange={(value) => form.setValue("lessonDate", value)}
          authorName={authorName}
          doelgroep={doelgroep}
          onToggleDoelgroep={toggleDoelgroep}
          minParticipants={minParticipants ?? null}
          onMinParticipantsChange={(value) => form.setValue("minParticipants", value)}
          participantsBench={participantsBench ?? null}
          onParticipantsBenchChange={(value) => form.setValue("participantsBench", value)}
          isPublic={false}
          isOwnActivity
          goals={goals}
          onGoalsChange={(value) => form.setValue("goals", value)}
          goalsFlagged={flaggedEmptyFields?.has("goals") && !goals}
          movementProblem={movementProblem}
          onMovementProblemChange={(value) => form.setValue("movementProblem", value)}
          movementProblemFlagged={flaggedEmptyFields?.has("movementProblem") && !movementProblem}
          learningOutcomes={learningOutcomes}
          onLearningOutcomesChange={setLearningOutcomes}
          deelnemersRegels={deelnemersRegels}
          onDeelnemersRegelsChange={(value) => form.setValue("deelnemersRegels", value)}
          deelnemersRegelsFlagged={flaggedEmptyFields?.has("deelnemersRegels") && !deelnemersRegels}
          plaatjePraatje={plaatjePraatje}
          onPlaatjePraatjeChange={(value) => form.setValue("plaatjePraatje", value)}
          plaatjePraatjeFlagged={flaggedEmptyFields?.has("plaatjePraatje") && !plaatjePraatje}
          aandachtspunten={aandachtspunten}
          onAandachtspuntenChange={(value) => form.setValue("aandachtspunten", value)}
          aandachtspuntenFlagged={flaggedEmptyFields?.has("aandachtspunten") && !aandachtspunten}
          regels={rules}
          onRegelsChange={setRules}
          arrangement={arrangement}
          onArrangementChange={(value) => form.setValue("arrangement", value)}
          arrangementFlagged={flaggedEmptyFields?.has("arrangement") && !arrangement}
          baseMaterials={baseMaterials}
          onBaseMaterialsChange={setBaseMaterials}
          ruleMaterials={ruleMaterials}
          onRuleMaterialsChange={setRuleMaterials}
          diagramImageUrl={diagram?.imageDataUrl ?? null}
          onDiagramExport={(data, imageDataUrl) => setDiagram({ data, imageDataUrl })}
          didacticItems={didacticItems}
          onDidacticItemsChange={setDidacticItems}
          onCommit={() => void autosaveDraft()}
          analyzePayload={{
            title,
            learningLine: learningLine || undefined,
            movementProblem: movementProblem || undefined,
            movementTheme: movementTheme || undefined,
            goals: goals || undefined,
            didacticItems,
          }}
          isSubmitting={form.formState.isSubmitting}
          filledCount={filledCount}
          sectionCount={SECTION_COUNT}
        />
      </form>
    </Form>
  );
}
