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
import { createClient } from "@/utils/supabase/client";
import { applyDoelgroepToggle } from "@/types/activity";
import type { AnalyzeLessonInput, DidacticSuggestion, LescoachSuggestion } from "@/types/ai";
import type { UsedKnowledgeChunk } from "@/lib/ai/knowledgeUsageLogging";
import {
  createLessonDefaultValues,
  createLessonInputSchema,
  REQUIRED_LESSON_FIELDS,
  type CreateLessonFormInput,
  type CreateLessonInput,
  type DidacticItem,
} from "@/types/lesson";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";
import type { RequiredLessonFormField } from "./activity-upload-step";

// Zelfde smalle sleuteltype als components/activity-wizard-page.tsx afleidt
// uit dezelfde REQUIRED_LESSON_FIELDS-import — hier lokaal herhaald i.p.v.
// geëxporteerd vanuit die component, want dit bestand kent het al via zijn
// eigen import van dezelfde const.
type RequiredFieldKey = (typeof REQUIRED_LESSON_FIELDS)[number]["field"];

function createId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

// AI Lescoach kostenbeheersing (zie de brief "Herontwerp de AI-
// activiteitengenerator naar AI Lescoach", Deel 2): een harde cooldown na
// elke aanroep, ALS EXTRA laag boven de "alleen beschikbaar bij een
// daadwerkelijke wijziging"-gate hieronder — voorkomt dat een snelle
// dubbelklik direct twee AI-aanroepen (en dus twee keer kosten) veroorzaakt.
const LESCOACH_COOLDOWN_SECONDS = 20;

// Volledige momentopname van alle door AI Lescoach analyseerbare secties —
// gebruikt zowel om te bepalen of de activiteit daadwerkelijk gewijzigd is
// sinds de vorige analyse (cooldown-gate) als om bij een vervolg-aanroep
// alleen de gewijzigde secties mee te sturen (zie buildAnalyzePayload
// hieronder).
type LescoachContentSnapshot = {
  goals?: string;
  learningOutcomes: string[];
  deelnemersRegels?: string;
  plaatjePraatje?: string;
  aandachtspunten?: string;
  rules: string[];
  arrangement?: string;
  baseMaterials: string[];
  ruleMaterials: string[];
  didacticItems: DidacticItem[];
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
  initialDiagram,
  isEditingSavedActivity,
  initialScrollTarget,
  activeSourceCount,
  flaggedEmptyFields,
  initialUsedKnowledgeSources,
}: {
  authorName: string;
  initialValues?: Partial<CreateLessonFormInput>;
  /** Gezet wanneer dit formulier een eerder opgeslagen concept hervat — dan
   * werkt auto-save/opslaan diezelfde rij bij i.p.v. een nieuwe aan te maken. */
  initialActivityId?: string;
  /** Zaadt de lokale `diagram`-state met een al bestaand arrangement (zie
   * les-maken/page.tsx) — zonder dit zou het hervatten van een activiteit
   * met een al opgeslagen plattegrond die leeg tonen, en zou een
   * eerstvolgende autosave 'm stilzwijgend wissen (zie het commentaar bij
   * diagram_data in actions/lesson.ts). */
  initialDiagram?: { data: DiagramData; imageDataUrl: string } | null;
  /** True wanneer initialActivityId een AL opgeslagen (niet-concept)
   * activiteit is: saveLessonDraft werkt alleen status='draft'-rijen bij, dus
   * concept-autosave zou hier stilzwijgend niets doen — beter helemaal uit,
   * met "Activiteit opslaan" als enige, expliciete manier om op te slaan. */
  isEditingSavedActivity?: boolean;
  /** Welke tab standaard open staat — gebruikt door de "Zaal-Plattegrond
   * Tekenen"-snelkoppeling op het dashboard. */
  initialScrollTarget?: "materiaal" | "leerhulp";
  activeSourceCount?: number;
  flaggedEmptyFields?: Set<RequiredLessonFormField>;
  /** Al eerder gelogde "Gebruikte bronnen" (activity_knowledge_usage) voor
   * deze activiteit — alleen relevant bij het hervatten van een bestaand
   * concept/activiteit (zie les-maken/page.tsx). Wordt samengevoegd met de
   * live chunks van een net-in-déze-sessie uitgevoerde AI-generatie
   * hieronder. */
  initialUsedKnowledgeSources?: UsedKnowledgeChunk[];
}) {
  const router = useRouter();

  const [baseMaterials, setBaseMaterials] = useState<string[]>(
    initialValues?.baseMaterials ?? [],
  );
  const [ruleMaterials, setRuleMaterials] = useState<string[]>(
    initialValues?.ruleMaterials ?? [],
  );
  const [rules, setRules] = useState<string[]>(initialValues?.rules ?? []);
  const [learningOutcomes, setLearningOutcomes] = useState<string[]>(
    initialValues?.learningOutcomes ?? [],
  );
  const [didacticItems, setDidacticItems] = useState<DidacticItem[]>(
    initialValues?.didacticItems ?? [],
  );
  const [diagram, setDiagram] = useState<{
    data: DiagramData;
    imageDataUrl: string;
  } | null>(() => initialDiagram ?? null);
  // Publieke Storage-URL van de laatst geüploade canvas-PNG (zie
  // handleDiagramSave) — blijft `null` totdat de gebruiker deze sessie
  // daadwerkelijk een arrangement opslaat, zodat een save vóór dat moment
  // de bestaande `afbeelding`-kolom van een hervatte activiteit niet
  // overschrijft (zie actions/lesson.ts's afbeeldingUrl-parameter).
  const [afbeeldingUrl, setAfbeeldingUrl] = useState<string | null>(null);

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
    },
  });

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
      const result = await saveLessonDraft(payload, diagram, false, activityId, afbeeldingUrl ?? undefined);
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

  // Zet de net geëxporteerde canvas-afbeelding (data-URL, zie GymCanvas.tsx's
  // exportDiagram) om naar een permanente Supabase Storage-URL — rechtstreeks
  // vanuit de browser (buiten Vercel om, zelfde architectuurkeuze als de
  // activity-imports-upload in activity_import_jobs.sql), op een stabiel pad
  // per activiteit (upsert:true) zodat elke nieuwe versie de vorige gewoon
  // vervangt. De bestandsextensie/contentType worden van het ECHTE
  // blob.type afgeleid i.p.v. ".png" aan te nemen: exportDiagram vraagt WebP
  // aan, maar een browser zonder WebP-canvas-encode-ondersteuning valt
  // stilzwijgend op PNG terug, dus dit moet met beide uitkomsten correct
  // omgaan. Geeft `null` terug bij een fout — de aanroeper laat in dat geval
  // simpelweg de bestaande `afbeelding` ongemoeid.
  async function uploadDiagramImage(
    imageDataUrl: string,
    forActivityId: string,
  ): Promise<string | null> {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;

      const blob = await (await fetch(imageDataUrl)).blob();
      const extension = blob.type === "image/webp" ? "webp" : "png";
      const path = `${user.id}/${forActivityId}.${extension}`;
      const { error } = await supabase.storage
        .from("activiteit-afbeeldingen")
        .upload(path, blob, { upsert: true, contentType: blob.type || "image/png" });
      if (error) {
        console.error("Plattegrond-afbeelding uploaden mislukt:", error);
        return null;
      }

      const { data } = supabase.storage.from("activiteit-afbeeldingen").getPublicUrl(path);
      // Cache-buster: hetzelfde pad wordt bij elke wijziging overschreven
      // (upsert), dus zonder query-param zou een CDN/browsercache de vorige
      // afbeelding kunnen blijven tonen na een update.
      return `${data.publicUrl}?v=${Date.now()}`;
    } catch (error) {
      console.error("Plattegrond-afbeelding uploaden mislukt:", error);
      return null;
    }
  }

  // Aangeroepen zodra de volledig-scherm canvas-editor sluit (zie
  // activity-wizard-page.tsx's FullscreenDiagramEditor-gebruik): slaat de
  // tekening direct op (niet via de gedebouncete scheduleAutosave — dat zou
  // een net-gesloten plattegrond soms pas na de eerstvolgende veldwijziging
  // écht opslaan) én genereert/vervangt de activiteit-hoofdafbeelding. Een
  // activityId is nodig vóór de upload kan beginnen (stabiel Storage-pad),
  // dus zonder concept wordt die eerst aangemaakt.
  async function handleDiagramSave(data: DiagramData, imageDataUrl: string) {
    setDiagram({ data, imageDataUrl });

    if (isEditingSavedActivity) {
      // Geen conceptrij om bij te werken (saveLessonDraft raakt alleen
      // status='draft'-rijen aan) — "Activiteit opslaan" blijft de enige
      // manier om dit daadwerkelijk vast te leggen. De afbeelding kan wel
      // alvast geüpload worden (activityId ligt al vast), zodat de URL
      // klaarstaat zodra de gebruiker opslaat.
      if (activityId) {
        const uploadedUrl = await uploadDiagramImage(imageDataUrl, activityId);
        if (uploadedUrl) setAfbeeldingUrl(uploadedUrl);
      }
      return;
    }

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

      let currentActivityId = activityId;
      if (!currentActivityId) {
        const created = await saveLessonDraft(payload, { data, imageDataUrl }, false, null);
        if ("error" in created) {
          toast.error("Plattegrond opslaan is mislukt. Probeer het opnieuw.");
          return;
        }
        currentActivityId = created.activityId;
        setActivityId(currentActivityId);
      }

      const uploadedUrl = await uploadDiagramImage(imageDataUrl, currentActivityId);
      if (uploadedUrl) setAfbeeldingUrl(uploadedUrl);

      const result = await saveLessonDraft(
        payload,
        { data, imageDataUrl },
        false,
        currentActivityId,
        uploadedUrl ?? undefined,
      );
      if ("error" in result) {
        consecutiveFailuresRef.current += 1;
        setSaveStatus(consecutiveFailuresRef.current >= FAILURE_TOAST_THRESHOLD ? "error" : "idle");
        toast.error("Plattegrond opslaan is mislukt. Probeer het opnieuw.");
        return;
      }
      consecutiveFailuresRef.current = 0;
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
    if (isEditingSavedActivity) return;
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

  // Vóór de "Terug"-knop daadwerkelijk navigeert (zie BackButton via
  // activity-wizard-page.tsx's onBeforeBack): een nog niet weggeschreven
  // debounced wijziging direct opslaan i.p.v. te laten verlopen, zodat er
  // niets verloren gaat wanneer de gebruiker meteen wegnavigeert na een
  // laatste veldwijziging. Wacht daarna op elke lopende/gequeuede save —
  // zowel performSave (tekstvelden) als handleDiagramSave (plattegrond)
  // zetten isSavingDraftRef/pendingSaveRef, dus polling op die refs dekt
  // beide save-paden zonder een aparte promise-keten te hoeven bijhouden.
  async function flushAutosave() {
    if (isEditingSavedActivity) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
      if (isSavingDraftRef.current) {
        pendingSaveRef.current = true;
      } else {
        void performSave();
      }
    }
    while (isSavingDraftRef.current || pendingSaveRef.current) {
      await new Promise((resolve) => setTimeout(resolve, 100));
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

    try {
      const result = await createLesson(
        payload,
        diagram,
        false,
        activityId,
        values.isPublic,
        afbeeldingUrl ?? undefined,
      );

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (result.status === "rejected") {
        // Geen fout: de activiteit staat gewoon opgeslagen (zichtbaar in
        // "Mijn activiteiten" met de reden), alleen niet publiek gemaakt.
        toast.error(`Niet gedeeld: ${result.reason} Je activiteit is wel opgeslagen.`);
      } else {
        toast.success(
          values.isPublic ? "Activiteit opgeslagen en gedeeld!" : "Activiteit opgeslagen.",
        );
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      // Nooit stil falen: een onverwachte fout (netwerk, server) moet
      // altijd zichtbaar zijn i.p.v. dat de knop simpelweg niets doet.
      toast.error("Er is iets misgegaan bij het opslaan. Probeer het opnieuw.");
    }
  }

  // Watched values — ActivityWizardPage is een "domme" weergavecomponent die
  // gewone value/onChange-props verwacht, geen react-hook-form Controllers.
  const title = form.watch("title");
  const learningLine = form.watch("learningLine");
  const movementTheme = form.watch("movementTheme");
  const lessonDate = form.watch("lessonDate");
  const doelgroep = form.watch("doelgroep");
  const isPublicToggle = form.watch("isPublic");
  const minParticipants = form.watch("minParticipants") as number | undefined;
  const participantsBench = form.watch("participantsBench") as number | undefined;
  const goals = form.watch("goals");
  const movementProblem = form.watch("movementProblem");
  const arrangement = form.watch("arrangement");
  const deelnemersRegels = form.watch("deelnemersRegels");
  const plaatjePraatje = form.watch("plaatjePraatje");
  const aandachtspunten = form.watch("aandachtspunten");

  // Live, bij elke wijziging herberekend (niet pas na een mislukte
  // submit-poging) — dezelfde REQUIRED_LESSON_FIELDS-bron als de
  // voortgangskaart en de foutmelding hieronder gebruiken, zodat een
  // gebruiker al tijdens het invullen ziet wat nog verplicht is, i.p.v. dat
  // pas te ontdekken bij "Activiteit opslaan".
  const requiredFieldValues: Record<RequiredFieldKey, string> = {
    title,
    learningLine,
    lessonDate,
    goals,
    movementProblem,
    deelnemersRegels,
    plaatjePraatje,
    aandachtspunten,
    arrangement,
  };
  const missingFields = REQUIRED_LESSON_FIELDS.filter(
    ({ field }) => requiredFieldValues[field].trim().length === 0,
  ).map(({ field }) => field);
  const missingFieldSet = new Set(missingFields);

  // Combineert de live verplichte-veldencontrole hierboven met
  // flaggedEmptyFields (de AI-import-hint voor bijv. movementTheme, dat geen
  // save-blokkerend verplicht veld is maar wel een "AI kon dit niet
  // invullen"-controle verdient) — zo krijgt elk veld waar de gebruiker nu
  // iets aan moet doen dezelfde subtiele amber-markering.
  function isFieldFlagged(field: RequiredLessonFormField | RequiredFieldKey): boolean {
    return (
      Boolean(flaggedEmptyFields?.has(field as RequiredLessonFormField)) ||
      missingFieldSet.has(field as RequiredFieldKey)
    );
  }

  // Bij een mislukte submit-poging: alle ontbrekende velden zijn al zichtbaar
  // gemarkeerd via isFieldFlagged hierboven — dit voegt alleen een specifieke
  // toast toe en laat ActivityWizardPage naar het EERSTE ontbrekende veld
  // springen (tab wisselen + scrollen + focussen), zie jumpToFieldTrigger.
  const jumpRequestIdRef = useRef(0);
  const [jumpToFieldTrigger, setJumpToFieldTrigger] = useState<{
    field: RequiredFieldKey;
    requestId: number;
  } | null>(null);

  function onInvalid() {
    if (missingFields.length === 0) {
      toast.error("Controleer de gemarkeerde velden — niet alles is ingevuld.");
      return;
    }
    const missingLabels = missingFields.map(
      (field) => REQUIRED_LESSON_FIELDS.find((entry) => entry.field === field)?.label ?? field,
    );
    toast.error(
      `Vul eerst '${missingLabels[0]}' in om op te slaan. Nog niet ingevuld: ${missingLabels.join(", ")}.`,
    );
    jumpRequestIdRef.current += 1;
    setJumpToFieldTrigger({ field: missingFields[0], requestId: jumpRequestIdRef.current });
  }

  // --------------------------------------------------------------------------
  // AI Lescoach: analyseert de HUIDIGE staat van dit formulier en geeft
  // per-sectie suggesties terug — geen nieuwe activiteit. Zie de brief
  // "Herontwerp de AI-activiteitengenerator naar AI Lescoach".
  // --------------------------------------------------------------------------

  const [lescoachSuggestions, setLescoachSuggestions] = useState<LescoachSuggestion[]>([]);
  const [lescoachDidacticSuggestions, setLescoachDidacticSuggestions] = useState<
    DidacticSuggestion[]
  >([]);
  const [isRunningLescoach, setIsRunningLescoach] = useState(false);
  const [lescoachCooldownSecondsLeft, setLescoachCooldownSecondsLeft] = useState(0);
  const lescoachCooldownUntilRef = useRef<number | null>(null);
  // De volledige inhoud zoals ze stond bij de LAATSTE analyse — null zolang
  // nog niet geanalyseerd. Gebruikt zowel om te bepalen of er sindsdien
  // daadwerkelijk iets gewijzigd is (de knop-gate) als om bij een vervolg-
  // aanroep alleen de gewijzigde secties mee te sturen (kostenbeheersing).
  const lastAnalyzedContentRef = useRef<LescoachContentSnapshot | null>(null);
  // Compacte samenvatting van eerder gegeven suggestietypes (max. de laatste
  // 20) — meegestuurd bij een vervolg-aanroep zodat de AI niet zomaar exact
  // dezelfde suggestie herhaalt, zonder de volledige eerdere suggestieteksten
  // opnieuw te moeten meesturen.
  const previousSuggestionTypesRef = useRef<{ section: LescoachSuggestion["section"]; type: string }[]>(
    [],
  );

  function buildContentSnapshot(): LescoachContentSnapshot {
    return {
      goals: goals || undefined,
      learningOutcomes,
      deelnemersRegels: deelnemersRegels || undefined,
      plaatjePraatje: plaatjePraatje || undefined,
      aandachtspunten: aandachtspunten || undefined,
      rules,
      arrangement: arrangement || undefined,
      baseMaterials,
      ruleMaterials,
      didacticItems,
    };
  }

  const currentLescoachSnapshot = buildContentSnapshot();
  const hasAnalyzedBefore = lastAnalyzedContentRef.current !== null;
  const lescoachContentChanged =
    !hasAnalyzedBefore ||
    JSON.stringify(currentLescoachSnapshot) !== JSON.stringify(lastAnalyzedContentRef.current);
  // De gebruiker moet de activiteit-inhoud (Doel, Beginsituatie, Deelnemers
  // & Regels, Plaatje & Praatje, Aandachtspunten, Veldopstelling — de
  // REQUIRED_LESSON_FIELDS-entries met een sectie, dus niet de pure
  // metadata zoals titel/leerlijn/datum) eerst zelf voldoende hebben
  // ingevuld voordat de AI Lescoach iets heeft om over te adviseren.
  const missingContentFields = REQUIRED_LESSON_FIELDS.filter(
    ({ field, section }) => section !== null && missingFieldSet.has(field),
  );
  const hasMinimumContent = missingContentFields.length === 0;
  const canRunLescoach =
    hasMinimumContent &&
    !isRunningLescoach &&
    lescoachCooldownSecondsLeft === 0 &&
    lescoachContentChanged;
  const lescoachButtonLabel = !hasMinimumContent
    ? "Vul eerst de activiteit verder in"
    : lescoachCooldownSecondsLeft > 0
      ? `Opnieuw raadplegen over ${lescoachCooldownSecondsLeft}s`
      : hasAnalyzedBefore && !lescoachContentChanged
        ? "Geen wijzigingen sinds laatste analyse"
        : "AI Lescoach raadplegen";

  // Tikt elke seconde de cooldown-aftelling terug — event-gedreven (een
  // interval-callback), geen synchrone setState tijdens het effect zelf.
  useEffect(() => {
    const interval = setInterval(() => {
      const until = lescoachCooldownUntilRef.current;
      if (!until) {
        setLescoachCooldownSecondsLeft(0);
        return;
      }
      const secondsLeft = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLescoachCooldownSecondsLeft(secondsLeft);
      if (secondsLeft === 0) lescoachCooldownUntilRef.current = null;
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Kostenbeheersing: bij de EERSTE aanroep gaat de volledige inhoud mee; bij
  // een vervolg-aanroep alleen de secties die daadwerkelijk gewijzigd zijn
  // sinds de vorige analyse (de "identiteitsvelden" — nodig voor consistente
  // Kennisbank-retrieval — gaan wél altijd mee, die zijn klein) + een
  // samenvatting van eerder gegeven suggestietypes i.p.v. de volledige
  // eerdere suggesties.
  function buildAnalyzePayload(currentContent: LescoachContentSnapshot): AnalyzeLessonInput {
    const identity = {
      title: title || undefined,
      learningLine: learningLine || undefined,
      movementTheme: movementTheme || undefined,
      movementProblem: movementProblem || undefined,
      doelgroep,
      minParticipants,
      participantsBench,
      activityId: activityId ?? undefined,
    };

    const previous = lastAnalyzedContentRef.current;
    if (!previous) {
      return { ...identity, ...currentContent };
    }

    const changed: Record<string, unknown> = {};
    (Object.keys(currentContent) as (keyof LescoachContentSnapshot)[]).forEach((key) => {
      if (JSON.stringify(currentContent[key]) !== JSON.stringify(previous[key])) {
        changed[key] = currentContent[key];
      }
    });

    return {
      ...identity,
      ...changed,
      isFollowUp: true,
      previousSuggestionTypes: previousSuggestionTypesRef.current,
    };
  }

  async function runLescoachAnalysis() {
    setIsRunningLescoach(true);
    try {
      const currentContent = buildContentSnapshot();
      const response = await fetch("/api/ai/analyze-lesson", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildAnalyzePayload(currentContent)),
      });
      const data = await response.json();

      if (!response.ok || "error" in data) {
        toast.error(data.error ?? "AI Lescoach-analyse is mislukt.");
        return;
      }

      const newSuggestions: LescoachSuggestion[] = (
        (data.suggestions ?? []) as Omit<LescoachSuggestion, "id">[]
      ).map((suggestion) => ({ ...suggestion, id: createId("s") }));
      const newDidacticSuggestions: DidacticSuggestion[] = (
        (data.didacticSuggestions ?? []) as Omit<DidacticSuggestion, "id">[]
      ).map((suggestion) => ({ ...suggestion, id: createId("d") }));

      setLescoachSuggestions((prev) => [...prev, ...newSuggestions]);
      setLescoachDidacticSuggestions((prev) => [...prev, ...newDidacticSuggestions]);

      lastAnalyzedContentRef.current = currentContent;
      previousSuggestionTypesRef.current = [
        ...previousSuggestionTypesRef.current,
        ...newSuggestions.map((suggestion) => ({ section: suggestion.section, type: suggestion.type })),
      ].slice(-20);
      lescoachCooldownUntilRef.current = Date.now() + LESCOACH_COOLDOWN_SECONDS * 1000;
      setLescoachCooldownSecondsLeft(LESCOACH_COOLDOWN_SECONDS);

      const totalNew = newSuggestions.length + newDidacticSuggestions.length;
      toast.success(
        totalNew === 0
          ? "Geen nieuwe suggesties — deze onderdelen zien er al goed uit."
          : `${totalNew} nieuwe suggestie${totalNew === 1 ? "" : "s"} van de AI Lescoach.`,
      );
    } catch {
      toast.error("AI Lescoach-analyse is mislukt. Controleer je verbinding.");
    } finally {
      setIsRunningLescoach(false);
    }
  }

  // Tekstsecties: "Toepassen" VERVANGT de huidige waarde. Lijstsecties:
  // "Toepassen" VOEGT het voorstel TOE als nieuw item — zie
  // types/ai.ts (LESCOACH_LIST_SECTIONS).
  function applyLescoachSuggestion(suggestion: LescoachSuggestion) {
    switch (suggestion.section) {
      case "goals":
        form.setValue("goals", suggestion.suggestion);
        break;
      case "movementProblem":
        form.setValue("movementProblem", suggestion.suggestion);
        break;
      case "deelnemersRegels":
        form.setValue("deelnemersRegels", suggestion.suggestion);
        break;
      case "plaatjePraatje":
        form.setValue("plaatjePraatje", suggestion.suggestion);
        break;
      case "aandachtspunten":
        form.setValue("aandachtspunten", suggestion.suggestion);
        break;
      case "arrangement":
        form.setValue("arrangement", suggestion.suggestion);
        break;
      case "learningOutcomes":
        setLearningOutcomes((prev) => [...prev, suggestion.suggestion]);
        break;
      case "rules":
        setRules((prev) => [...prev, suggestion.suggestion]);
        break;
      case "baseMaterials":
        setBaseMaterials((prev) => [...prev, suggestion.suggestion]);
        break;
      case "ruleMaterials":
        setRuleMaterials((prev) => [...prev, suggestion.suggestion]);
        break;
    }
    setLescoachSuggestions((prev) => prev.filter((entry) => entry.id !== suggestion.id));
    scheduleAutosave();
    toast.success("Suggestie toegepast.");
  }

  function dismissLescoachSuggestion(id: string) {
    setLescoachSuggestions((prev) => prev.filter((entry) => entry.id !== id));
  }

  // Leerhulp-variant: altijd een AANVULLING (nieuw los item), nooit een
  // vervanging van bestaande items — zie de brief.
  function applyDidacticSuggestion(suggestion: DidacticSuggestion) {
    setDidacticItems((prev) => [
      ...prev,
      {
        id: createId("d"),
        category: suggestion.category,
        subTheme: null,
        observation: suggestion.observation,
        action: suggestion.action,
      },
    ]);
    setLescoachDidacticSuggestions((prev) => prev.filter((entry) => entry.id !== suggestion.id));
    scheduleAutosave();
    toast.success("Leerhulp-variant toegevoegd.");
  }

  function dismissDidacticSuggestion(id: string) {
    setLescoachDidacticSuggestions((prev) => prev.filter((entry) => entry.id !== id));
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
          titleFlagged={isFieldFlagged("title")}
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
          learningLineFlagged={isFieldFlagged("learningLine")}
          movementTheme={movementTheme}
          onMovementThemeChange={(value) => form.setValue("movementTheme", value)}
          movementThemeFlagged={isFieldFlagged("movementTheme")}
          activityDate={lessonDate}
          onActivityDateChange={(value) => form.setValue("lessonDate", value)}
          activityDateFlagged={isFieldFlagged("lessonDate")}
          authorName={authorName}
          doelgroep={doelgroep}
          onToggleDoelgroep={toggleDoelgroep}
          minParticipants={minParticipants ?? null}
          onMinParticipantsChange={(value) => form.setValue("minParticipants", value)}
          participantsBench={participantsBench ?? null}
          onParticipantsBenchChange={(value) => form.setValue("participantsBench", value)}
          isPublic={false}
          isOwnActivity
          publishToggle={isPublicToggle}
          onPublishToggleChange={(value) => {
            form.setValue("isPublic", value);
            scheduleAutosave();
          }}
          goals={goals}
          onGoalsChange={(value) => form.setValue("goals", value)}
          goalsFlagged={isFieldFlagged("goals")}
          movementProblem={movementProblem}
          onMovementProblemChange={(value) => form.setValue("movementProblem", value)}
          movementProblemFlagged={isFieldFlagged("movementProblem")}
          learningOutcomes={learningOutcomes}
          onLearningOutcomesChange={setLearningOutcomes}
          deelnemersRegels={deelnemersRegels}
          onDeelnemersRegelsChange={(value) => form.setValue("deelnemersRegels", value)}
          deelnemersRegelsFlagged={isFieldFlagged("deelnemersRegels")}
          plaatjePraatje={plaatjePraatje}
          onPlaatjePraatjeChange={(value) => form.setValue("plaatjePraatje", value)}
          plaatjePraatjeFlagged={isFieldFlagged("plaatjePraatje")}
          aandachtspunten={aandachtspunten}
          onAandachtspuntenChange={(value) => form.setValue("aandachtspunten", value)}
          aandachtspuntenFlagged={isFieldFlagged("aandachtspunten")}
          regels={rules}
          onRegelsChange={setRules}
          arrangement={arrangement}
          onArrangementChange={(value) => form.setValue("arrangement", value)}
          arrangementFlagged={isFieldFlagged("arrangement")}
          baseMaterials={baseMaterials}
          onBaseMaterialsChange={setBaseMaterials}
          ruleMaterials={ruleMaterials}
          onRuleMaterialsChange={setRuleMaterials}
          diagramData={diagram?.data ?? null}
          diagramImageUrl={diagram?.imageDataUrl ?? null}
          onDiagramExport={(data, imageDataUrl) => void handleDiagramSave(data, imageDataUrl)}
          didacticItems={didacticItems}
          onDidacticItemsChange={setDidacticItems}
          onCommit={scheduleAutosave}
          saveStatus={saveStatus}
          usedKnowledgeSources={initialUsedKnowledgeSources ?? []}
          lescoachSuggestions={lescoachSuggestions}
          onApplyLescoachSuggestion={applyLescoachSuggestion}
          onDismissLescoachSuggestion={dismissLescoachSuggestion}
          lescoachDidacticSuggestions={lescoachDidacticSuggestions}
          onApplyDidacticSuggestion={applyDidacticSuggestion}
          onDismissDidacticSuggestion={dismissDidacticSuggestion}
          onRunLescoach={() => void runLescoachAnalysis()}
          isRunningLescoach={isRunningLescoach}
          canRunLescoach={canRunLescoach}
          lescoachButtonLabel={lescoachButtonLabel}
          isSubmitting={form.formState.isSubmitting}
          missingFields={missingFields}
          jumpToFieldTrigger={jumpToFieldTrigger}
          onBeforeBack={flushAutosave}
        />
      </form>
    </Form>
  );
}
