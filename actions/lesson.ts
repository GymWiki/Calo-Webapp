"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { checkActivityQuality, type ActivityQualityCheckInput } from "@/lib/ai/activityQualityCheck";
import { logKnowledgeUsage, type UsedKnowledgeChunk } from "@/lib/ai/knowledgeUsageLogging";
import { resolveSlug } from "@/lib/services/activitySlug";
import {
  createLessonInputSchema,
  type CreateLessonFormInput,
  type CreateLessonInput,
} from "@/types/lesson";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";

// Vertaalt een wizard-activiteit naar de generieke vorm die
// checkActivityQuality verwacht (zie lib/ai/activityQualityCheck.ts) — de
// wizard heeft geen eigen categorie-enum of loopt/lukt/leeft-tekstvelden
// (vervangen door de leerlijn/bewegingsthema-koppeling en de 3L's-analyse
// als losse didactic_items), dus "beschrijving" wordt hier samengesteld uit
// de velden die samen daadwerkelijk beschrijven hoe de activiteit verloopt.
function toQualityCheckInput(values: CreateLessonInput): ActivityQualityCheckInput {
  return {
    titel: values.title,
    leerlijn: values.learningLine,
    doel: values.goals,
    beschrijving: [values.arrangement, values.deelnemersRegels, values.plaatjePraatje, values.aandachtspunten]
      .filter(Boolean)
      .join("\n\n"),
    categorie: values.movementTheme || values.learningLine,
    beginsituatie: values.movementProblem,
    veld: values.arrangement,
    materiaal: [...values.baseMaterials, ...values.ruleMaterials],
    regels: values.rules,
  };
}

type ActionResult = { error: string } | { success: true };
type SaveDraftResult = { error: string } | { success: true; activityId: string };
type CreateLessonResult =
  | { error: string }
  | { success: true; status: "approved" }
  | { success: true; status: "rejected"; reason: string };

const GENERIC_ERROR = "Activiteit opslaan is mislukt. Probeer het opnieuw.";

// Logt de daadwerkelijke Postgres/Supabase-foutdetails server-side (zichtbaar
// in de Vercel function logs) vóórdat de generieke, gebruiksvriendelijke
// melding teruggaat — zonder dit was een fout als de vroegere "invalid input
// syntax for type date" onmogelijk te onderscheiden van elke andere
// mislukte opslag vanuit de UI alleen.
function logActivitiesRowError(context: "createLesson" | "saveLessonDraft", error: unknown) {
  console.error(`${context}: opslaan naar activiteiten mislukt —`, error);
}

// Gedeeld tussen createLesson (insert/update, gevalideerd) en saveLessonDraft
// (insert/update, ongevalideerd) — dezelfde kolommen, alleen `status` en of
// de invoer eerst door het schema moet verschilt.
function toActivitiesRow(values: CreateLessonInput | CreateLessonFormInput) {
  return {
    // Legacy kolom uit de oorspronkelijke Firestore-import (de ~203
    // basis-bibliotheekactiviteiten, author_id null) — nergens meer
    // gelezen in de app (bron wordt nu bepaald via lib/activity-source.ts,
    // op author_id/is_public), maar hier expliciet false zetten i.p.v. op
    // de kolomdefault te leunen: elke rij die via createLesson/
    // saveLessonDraft wordt aangemaakt of bijgewerkt heeft altijd een
    // author_id (hieronder gezet bij insert, of al gezet — de
    // .eq("author_id", user.id)-filter bij een update garandeert dat), is
    // dus per definitie nooit een gymwiki-basisrij.
    in_gymwiki: false,
    titel: values.title,
    // `activity_date` is een Postgres `date`-kolom — een lege string (de
    // waarde zolang dit veld nog niet is ingevuld, wat bij een concept vaak
    // lang zo blijft) is daar geen geldige waarde en liet vrijwel elke
    // autosave van een net gestart concept mislukken met een Postgres-
    // typefout ("invalid input syntax for type date"). createLesson's eigen
    // schema dwingt hier al een niet-lege string af, dus dit `|| null`
    // verandert daar niets — alleen saveLessonDraft (bewust ongevalideerd)
    // kon deze lege string ooit doorsturen.
    activity_date: values.lessonDate || null,
    leerlijn: values.learningLine,
    doelgroep: values.doelgroep,
    movement_problem: values.movementProblem,
    // Bewegingsthema is een verfijning binnen de leerlijn (zie
    // lib/constants/learningLines.ts) — valt terug op de leerlijn zelf
    // wanneer er voor die leerlijn geen thema-select is (dus geen los,
    // onafhankelijk vrij tekstveld meer). Geen game_category/game_dimensions/
    // tactical_questions meer: dat Engelstalige "Game-Based Pedagogy"-model
    // is vervangen door deze leerlijn/bewegingsthema-koppeling. De kolommen
    // zelf blijven ongewijzigd staan (niet in dit object opgenomen = niet
    // overschreven bij een update) zodat bestaande activiteiten hun oude
    // data read-only behouden.
    beweegthema: values.movementTheme || values.learningLine,
    base_materials: values.baseMaterials,
    rule_materials: values.ruleMaterials,
    min_participants: values.minParticipants ? Number(values.minParticipants) : null,
    participants_bench: values.participantsBench ? Number(values.participantsBench) : null,
    regels: values.rules,
    doel: values.goals,
    learning_outcomes: values.learningOutcomes,
    didactic_items: values.didacticItems,
    arrangement: values.arrangement,
    beschrijving: values.beschrijving,
    deelnemers_regels: values.deelnemersRegels,
    plaatje_praatje: values.plaatjePraatje,
    aandachtspunten: values.aandachtspunten,
  };
}

/**
 * Slaat een via de wizard samengestelde activiteit op — rechtstreeks in de
 * `activiteiten`-tabel (voorheen een aparte "lessons"-tabel; zie
 * supabase/migrations/consolidate_lessons_into_activiteiten.sql).
 *
 * `isPublic` is de expliciete "Delen in de gedeelde bibliotheek"-toggle uit
 * het formulier (zie components/activity-wizard-page.tsx) — bij true
 * doorloopt de activiteit dezelfde AI-kwaliteitscheck/duplicaatdetectie als
 * de oorspronkelijke eenvoudige-activiteit-flow (checkActivityQuality, zie
 * actions/activity-submission.ts), en wordt ze bij goedkeuring publiek +
 * meetellend voor de maandelijkse bijdrage (is_public/public_since, zie de
 * trigger in consolidate_lessons_into_activiteiten.sql). Bij false wordt
 * helemaal geen check uitgevoerd (niet nodig — de activiteit komt toch niet
 * in de gedeelde bibliotheek) en blijft de rij altijd alleen-eigen-gebruik.
 * Een afkeuring is geen fout: de activiteit blijft gewoon opgeslagen (zichtbaar
 * in "Mijn activiteiten" met de reden), alleen niet publiek gemaakt.
 *
 * `activityId` is gezet wanneer de inline-editor onderweg al een concept had
 * opgeslagen (zie saveLessonDraft) — dan wordt diezelfde rij afgerond i.p.v.
 * een tweede, dubbele rij aan te maken. Zonder statusfilter (in tegenstelling
 * tot saveLessonDraft's `.eq("status","draft")`): dit dekt zowel een concept
 * afronden als een reeds opgeslagen eigen activiteit opnieuw bewerken (zie
 * les-maken/page.tsx's resumingOwnActivity).
 */
export async function createLesson(
  input: CreateLessonInput,
  diagram: { data: DiagramData; imageDataUrl: string } | null = null,
  isAiGenerated = false,
  activityId: string | null = null,
  isPublic = true,
  /** Publieke Storage-URL van de automatisch uit het canvas gegenereerde
   * PNG (zie components/canvas/FullscreenDiagramEditor.tsx en
   * les-maken/lesson-form.tsx's handleDiagramSave). `undefined` (de
   * standaardwaarde) laat de bestaande `afbeelding`-kolom ongemoeid — alleen
   * wanneer de gebruiker deze sessie daadwerkelijk een arrangement heeft
   * opgeslagen, wordt hij hier expliciet meegegeven. */
  afbeeldingUrl?: string,
): Promise<CreateLessonResult> {
  const parsed = createLessonInputSchema.safeParse(input);

  if (!parsed.success) {
    return { error: "Controleer de ingevulde velden en probeer het opnieuw." };
  }

  const values = parsed.data;

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  let status: "approved" | "rejected" = "approved";
  let rejectionReason: string | null = null;
  let publicSince: string | null = null;
  let checkerUsedChunks: UsedKnowledgeChunk[] = [];
  // Alleen gezet bij een geslaagde check — undefined betekent hieronder
  // "niet overschrijven", zie de spread bij `row`. seoSummary/slug voeden
  // de publieke /activiteiten/[slug]-pagina (zie
  // supabase/migrations/activiteiten_public_seo.sql); slug blijft, eenmaal
  // gezet, voor altijd hetzelfde (resolveSlug), ook als de titel later
  // verandert — anders breekt een al gedeelde/geïndexeerde URL.
  let seoSummary: string | undefined;
  let slug: string | undefined;

  if (isPublic) {
    const quality = await checkActivityQuality(supabase, user.id, toQualityCheckInput(values));
    checkerUsedChunks = quality.usedKnowledgeChunks;
    if (quality.status === "rejected") {
      status = "rejected";
      rejectionReason = quality.reason;
    } else {
      publicSince = new Date().toISOString();
      seoSummary = quality.seoSummary;
      slug = await resolveSlug(supabase, activityId, values.title);
    }
  }

  const row = {
    ...toActivitiesRow(values),
    // Alleen overschrijven wanneer deze sessie daadwerkelijk een tekening
    // exporteerde — anders zou het hervatten van een al opgeslagen
    // activiteit zonder de plattegrond aan te raken de bestaande
    // diagram_data/diagram_image_url stilzwijgend op null zetten (de lokale
    // `diagram`-state in lesson-form.tsx begint immers leeg totdat de
    // gebruiker de canvas-editor daadwerkelijk opent).
    ...(diagram ? { diagram_data: diagram.data, diagram_image_url: diagram.imageDataUrl } : {}),
    ...(afbeeldingUrl !== undefined ? { afbeelding: afbeeldingUrl } : {}),
    is_ai_generated: isAiGenerated,
    status,
    rejection_reason: rejectionReason,
    // Alleen daadwerkelijk publiek bij een geslaagde check — bij een
    // afkeuring blijft de rij (met de gekozen isPublic-intentie) alsnog
    // alleen-eigen-gebruik totdat de gebruiker 'm aanpast en opnieuw indient.
    is_public: isPublic && status === "approved",
    public_since: publicSince,
    taalcode: "nl",
    ...(seoSummary !== undefined ? { seo_summary: seoSummary } : {}),
    ...(slug !== undefined ? { slug } : {}),
  };

  let resolvedActivityId = activityId;
  let error: unknown = null;

  if (activityId) {
    ({ error } = await supabase
      .from("activiteiten")
      .update(row)
      .eq("id", activityId)
      .eq("author_id", user.id));
  } else {
    const inserted = await supabase
      .from("activiteiten")
      .insert({ ...row, author_id: user.id })
      .select("id")
      .single();
    error = inserted.error;
    resolvedActivityId = inserted.data?.id ?? null;
  }

  if (error) {
    logActivitiesRowError("createLesson", error);
    return { error: GENERIC_ERROR };
  }

  // Brontracking (activity_knowledge_usage) — best-effort, pas mogelijk
  // zodra het activity-id vaststaat (bij een nieuwe rij dus pas na de
  // insert hierboven). Zie activityQualityCheck.ts (context='checker').
  if (resolvedActivityId) {
    await logKnowledgeUsage(supabase, resolvedActivityId, "checker", checkerUsedChunks);
  }

  return status === "rejected"
    ? { success: true, status: "rejected", reason: rejectionReason ?? GENERIC_ERROR }
    : { success: true, status: "approved" };
}

/**
 * Auto-save voor de inline-edit-activiteitseditor: slaat de huidige stand
 * van het formulier op als concept (status 'draft'), zonder de strikte
 * createLessonInputSchema-validatie — een concept mag onvolledig zijn. Wordt
 * aangeroepen bij het verlaten van een veld (onBlur), niet per toetsaanslag.
 * Zonder `activityId` wordt een nieuwe conceptrij aangemaakt en het nieuwe
 * id teruggegeven, zodat volgende auto-saves + het uiteindelijke "Activiteit
 * opslaan" (createLesson met dat activityId) dezelfde rij bijwerken i.p.v.
 * telkens een nieuwe conceptrij te maken.
 */
export async function saveLessonDraft(
  input: CreateLessonFormInput,
  diagram: { data: DiagramData; imageDataUrl: string } | null,
  isAiGenerated: boolean,
  activityId: string | null,
  /** Zie createLesson hierboven — zelfde "alleen zetten wanneer expliciet
   * meegegeven"-conventie. */
  afbeeldingUrl?: string,
): Promise<SaveDraftResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const row = {
    ...toActivitiesRow(input),
    // Nooit een titel-loze rij: een leeg concept is voor de "Mijn
    // activiteiten"-lijst niet identificeerbaar. Andere velden mogen leeg.
    titel: input.title || "Naamloos concept",
    // Zie de gelijknamige toelichting in createLesson hierboven.
    ...(diagram ? { diagram_data: diagram.data, diagram_image_url: diagram.imageDataUrl } : {}),
    ...(afbeeldingUrl !== undefined ? { afbeelding: afbeeldingUrl } : {}),
    is_ai_generated: isAiGenerated,
    status: "draft" as const,
    taalcode: "nl",
  };

  if (activityId) {
    const { error } = await supabase
      .from("activiteiten")
      .update(row)
      .eq("id", activityId)
      .eq("author_id", user.id)
      .eq("status", "draft");

    if (error) {
      logActivitiesRowError("saveLessonDraft", error);
      return { error: GENERIC_ERROR };
    }

    return { success: true, activityId };
  }

  const { data, error } = await supabase
    .from("activiteiten")
    .insert({ ...row, author_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    logActivitiesRowError("saveLessonDraft", error ?? "geen rij teruggekregen na insert");
    return { error: GENERIC_ERROR };
  }

  return { success: true, activityId: data.id };
}

/**
 * Maakt een activiteit openbaar (of weer privé) — het moment waarop dit
 * publiek gebeurt (`public_since`) bepaalt in welke kalendermaand de
 * bijdrage meetelt (zie consolidate_lessons_into_activiteiten.sql).
 */
export async function setLessonPublic(
  activityId: string,
  isPublic: boolean,
): Promise<ActionResult> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Je bent niet ingelogd." };
  }

  const { error } = await supabase
    .from("activiteiten")
    .update(
      isPublic
        ? { is_public: true, public_since: new Date().toISOString() }
        : { is_public: false },
    )
    .eq("id", activityId)
    .eq("author_id", user.id);

  if (error) {
    return {
      error: isPublic
        ? "Activiteit openbaar maken is mislukt. Probeer het opnieuw."
        : "Activiteit privé maken is mislukt. Probeer het opnieuw.",
    };
  }

  return { success: true };
}
