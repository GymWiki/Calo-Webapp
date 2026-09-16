"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldErrors } from "react-hook-form";
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

// Nederlandse labels voor de foutmelding bij een mislukte submit — dezelfde
// velden als createLessonInputSchema's requiredText()-velden in
// types/lesson.ts, zodat de toast exact noemt wat er nog ontbreekt i.p.v.
// stilzwijgend niets te doen (wat vóór deze fix gebeurde: form.handleSubmit
// riep onSubmit simpelweg niet aan bij een mislukte validatie, en nergens
// werd formState.errors getoond).
const REQUIRED_FIELD_LABELS: Partial<Record<keyof CreateLessonFormInput, string>> = {
  title: "Titel",
  lessonDate: "Datum",
  groupName: "Groep/klas",
  learningLine: "Leerlijn",
  movementProblem: "Bewegingsprobleem",
  goals: "Doelen",
  arrangement: "Arrangement",
  deelnemersRegels: "Deelnemers & regels",
  plaatjePraatje: "Plaatje & praatje",
  aandachtspunten: "Aandachtspunten",
};

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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const isSavingDraftRef = useRef(false);
  // Een nieuwere wijziging kwam binnen terwijl er al een save liep — na
  // afloop van die save meteen nóg één keer opslaan met de dan actuele
  // waarden, in plaats van de tussentijdse wijziging te laten verdwijnen.
  const pendingSaveRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pas na een paar keer op rij mislukken een zichtbare foutmelding tonen —
  // één incidentele mislukking (bijv. een kort netwerkhikje) hoeft de
  // gebruiker niet te storen zolang de eerstvolgende save wél lukt.
  const consecutiveFailuresRef = useRef(0);
  const FAILURE_TOAST_THRESHOLD = 3;

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
  // (status 'draft'). Eén save tegelijk — als er een nieuwere wijziging
  // binnenkomt terwijl er al een save loopt, wordt die niet parallel
  // verstuurd (dat zou op dezelfde rij kunnen botsen) maar gemarkeerd als
  // "nog een keer opslaan zodra de huidige save klaar is", steeds met de op
  // dat moment actuele formulierwaarden — nooit een verouderde snapshot.
  async function performSave() {
    isSavingDraftRef.current = true;
    setSaveStatus("saving");
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
        consecutiveFailuresRef.current += 1;
        console.error(
          `Concept autosave mislukt (poging ${consecutiveFailuresRef.current} op rij):`,
          result.error,
        );
        if (consecutiveFailuresRef.current >= FAILURE_TOAST_THRESHOLD) {
          setSaveStatus("error");
          toast.error(
            "Concept opslaan lukt herhaaldelijk niet — controleer je internetverbinding. Je wijzigingen blijven zichtbaar in dit scherm.",
          );
        } else {
          setSaveStatus("idle");
        }
        return;
      }
      consecutiveFailuresRef.current = 0;
      setActivityId(result.activityId);
      setSaveStatus("saved");
    } finally {
      isSavingDraftRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        void performSave();
      }
    }
  }

  // Gedebouncet: pas ~1,3s na de laatste wijziging daadwerkelijk opslaan, in
  // plaats van bij elke afzonderlijke veldwissel een eigen request te sturen
  // — voorkomt de stortvloed aan (deels overlappende) autosave-requests die
  // ontstond wanneer iemand snel meerdere velden achter elkaar invult.
  function scheduleAutosave() {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (isSavingDraftRef.current) {
        pendingSaveRef.current = true;
        return;
      }
      void performSave();
    }, 1300);
  }

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

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
    try {
      const result = await createLesson(payload, diagram, stashedGenerated !== null, activityId);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Activiteit opgeslagen!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      // Nooit stil falen: een onverwachte fout (netwerk, server) moet
      // altijd zichtbaar zijn i.p.v. dat de knop simpelweg niets doet.
      toast.error("Er is iets misgegaan bij het opslaan. Probeer het opnieuw.");
    }
  }

  // Aangeroepen door react-hook-form zodra handleSubmit's zod-validatie
  // mislukt — vóór deze fix gebeurde hier helemaal niets zichtbaars (geen
  // toast, geen laadstatus, geen gemarkeerd veld), want ActivityWizardPage
  // gebruikt losse value/onChange-props i.p.v. <FormField>/<FormMessage>,
  // dus er was nergens een plek waar formState.errors landde.
  function onInvalid(errors: FieldErrors<CreateLessonFormInput>) {
    const missingLabels = Object.keys(errors)
      .map((key) => REQUIRED_FIELD_LABELS[key as keyof CreateLessonFormInput])
      .filter((label): label is string => Boolean(label));

    toast.error(
      missingLabels.length > 0
        ? `Nog niet alles is ingevuld: ${missingLabels.join(", ")}. De ontbrekende velden zijn gemarkeerd.`
        : "Controleer de gemarkeerde velden — niet alles is ingevuld.",
    );
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

  // Leeg tot de eerste mislukte submit-poging (RHF's standaard "onSubmit"-
  // mode), daarna live bijgewerkt terwijl de gebruiker de ontbrekende
  // velden invult. Samengevoegd met flaggedEmptyFields (de AI-import-hint,
  // die al vóór een submit-poging zichtbaar is): zo krijgt ELK verplicht
  // veld een zichtbare markering zodra het leeg is — niet alleen de velden
  // die de AI-upload toevallig niet kon invullen.
  const formErrors = form.formState.errors;
  function isFieldFlagged(field: RequiredLessonFormField, value: string) {
    return Boolean((flaggedEmptyFields?.has(field) && !value) || formErrors[field]);
  }

  return (
    <Form {...form}>
      {/* pb-28/md:pb-24: dezelfde marge als de activiteit-detailpagina
          gebruikt boven haar identieke vaste actiebalk (bottom-16/md:bottom-0)
          — dit formulier miste die tot nu toe, waardoor het laatste veld
          direct onder de balk zat. Padding van de scrollende pagina zelf,
          geen vaste minimumhoogte, dus geen leeg gat bij weinig content. */}
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-5 pb-28 md:space-y-6 md:pb-24">
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
          titleFlagged={isFieldFlagged("title", title)}
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
          learningLineFlagged={isFieldFlagged("learningLine", learningLine)}
          movementTheme={movementTheme}
          onMovementThemeChange={(value) => form.setValue("movementTheme", value)}
          movementThemeFlagged={isFieldFlagged("movementTheme", movementTheme)}
          groupName={groupName}
          onGroupNameChange={(value) => form.setValue("groupName", value)}
          groupNameFlagged={isFieldFlagged("groupName", groupName)}
          activityDate={lessonDate}
          onActivityDateChange={(value) => form.setValue("lessonDate", value)}
          activityDateFlagged={Boolean(formErrors.lessonDate)}
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
          goalsFlagged={isFieldFlagged("goals", goals)}
          movementProblem={movementProblem}
          onMovementProblemChange={(value) => form.setValue("movementProblem", value)}
          movementProblemFlagged={isFieldFlagged("movementProblem", movementProblem)}
          learningOutcomes={learningOutcomes}
          onLearningOutcomesChange={setLearningOutcomes}
          deelnemersRegels={deelnemersRegels}
          onDeelnemersRegelsChange={(value) => form.setValue("deelnemersRegels", value)}
          deelnemersRegelsFlagged={isFieldFlagged("deelnemersRegels", deelnemersRegels)}
          plaatjePraatje={plaatjePraatje}
          onPlaatjePraatjeChange={(value) => form.setValue("plaatjePraatje", value)}
          plaatjePraatjeFlagged={isFieldFlagged("plaatjePraatje", plaatjePraatje)}
          aandachtspunten={aandachtspunten}
          onAandachtspuntenChange={(value) => form.setValue("aandachtspunten", value)}
          aandachtspuntenFlagged={isFieldFlagged("aandachtspunten", aandachtspunten)}
          regels={rules}
          onRegelsChange={setRules}
          arrangement={arrangement}
          onArrangementChange={(value) => form.setValue("arrangement", value)}
          arrangementFlagged={isFieldFlagged("arrangement", arrangement)}
          baseMaterials={baseMaterials}
          onBaseMaterialsChange={setBaseMaterials}
          ruleMaterials={ruleMaterials}
          onRuleMaterialsChange={setRuleMaterials}
          diagramImageUrl={diagram?.imageDataUrl ?? null}
          onDiagramExport={(data, imageDataUrl) => setDiagram({ data, imageDataUrl })}
          didacticItems={didacticItems}
          onDidacticItemsChange={setDidacticItems}
          onCommit={scheduleAutosave}
          saveStatus={saveStatus}
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
