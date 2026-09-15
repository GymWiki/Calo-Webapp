"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  createLessonInputSchema,
  type CreateLessonFormInput,
  type CreateLessonInput,
} from "@/types/lesson";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";

type ActionResult = { error: string } | { success: true };
type SaveDraftResult = { error: string } | { success: true; activityId: string };

const GENERIC_ERROR = "Activiteit opslaan is mislukt. Probeer het opnieuw.";

// Gedeeld tussen createLesson (insert/update, gevalideerd) en saveLessonDraft
// (insert/update, ongevalideerd) — dezelfde kolommen, alleen `status` en of
// de invoer eerst door het schema moet verschilt.
function toActivitiesRow(values: CreateLessonInput | CreateLessonFormInput) {
  return {
    titel: values.title,
    activity_date: values.lessonDate,
    group_name: values.groupName,
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
    deelnemers_regels: values.deelnemersRegels,
    plaatje_praatje: values.plaatjePraatje,
    aandachtspunten: values.aandachtspunten,
  };
}

/**
 * Slaat een via de wizard samengestelde activiteit op — rechtstreeks in de
 * `activiteiten`-tabel (voorheen een aparte "lessons"-tabel; zie
 * supabase/migrations/consolidate_lessons_into_activiteiten.sql). Bewust
 * GEEN AI-kwaliteitscheck (checkActivityQuality/find_similar_own_activities,
 * zie actions/activity-submission.ts): dat gold nooit voor wizard-lessen —
 * die konden nooit "afgekeurd" worden — en dat gedrag blijft zo na de
 * consolidatie. Status staat dus altijd meteen op 'approved'.
 *
 * `activityId` is gezet wanneer de inline-editor onderweg al een concept had
 * opgeslagen (zie saveLessonDraft) — dan wordt diezelfde rij afgerond i.p.v.
 * een tweede, dubbele rij aan te maken.
 */
export async function createLesson(
  input: CreateLessonInput,
  diagram: { data: DiagramData; imageDataUrl: string } | null = null,
  isAiGenerated = false,
  activityId: string | null = null,
): Promise<ActionResult> {
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

  const row = {
    ...toActivitiesRow(values),
    diagram_data: diagram?.data ?? null,
    diagram_image_url: diagram?.imageDataUrl ?? null,
    is_ai_generated: isAiGenerated,
    status: "approved" as const,
    taalcode: "nl",
  };

  const { error } = activityId
    ? await supabase
        .from("activiteiten")
        .update(row)
        .eq("id", activityId)
        .eq("author_id", user.id)
    : await supabase.from("activiteiten").insert({ ...row, author_id: user.id });

  if (error) {
    return { error: GENERIC_ERROR };
  }

  return { success: true };
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
    diagram_data: diagram?.data ?? null,
    diagram_image_url: diagram?.imageDataUrl ?? null,
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
