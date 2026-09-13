"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  createLessonInputSchema,
  type CreateLessonInput,
} from "@/types/lesson";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Activiteit opslaan is mislukt. Probeer het opnieuw.";

/**
 * Slaat een via de wizard samengestelde activiteit op — rechtstreeks in de
 * `activiteiten`-tabel (voorheen een aparte "lessons"-tabel; zie
 * supabase/migrations/consolidate_lessons_into_activiteiten.sql). Bewust
 * GEEN AI-kwaliteitscheck (checkActivityQuality/find_similar_own_activities,
 * zie actions/activity-submission.ts): dat gold nooit voor wizard-lessen —
 * die konden nooit "afgekeurd" worden — en dat gedrag blijft zo na de
 * consolidatie. Status staat dus altijd meteen op 'approved'.
 */
export async function createLesson(
  input: CreateLessonInput,
  diagram: { data: DiagramData; imageDataUrl: string } | null = null,
  isAiGenerated = false,
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

  const { error } = await supabase.from("activiteiten").insert({
    author_id: user.id,
    titel: values.title,
    activity_date: values.lessonDate,
    group_name: values.groupName,
    leerlijn: values.learningLine,
    doelgroep: values.doelgroep,
    movement_problem: values.movementProblem,
    beweegthema: values.movementTheme,
    base_materials: values.baseMaterials,
    rule_materials: values.ruleMaterials,
    min_participants: values.minParticipants ?? null,
    participants_bench: values.participantsBench ?? null,
    regels: values.rules,
    doel: values.goals,
    didactic_items: values.didacticItems,
    game_category: values.gameCategory || null,
    game_dimensions: values.gameDimensions,
    tactical_questions: values.tacticalQuestions,
    arrangement: values.arrangement,
    deelnemers_regels: values.deelnemersRegels,
    plaatje_praatje: values.plaatjePraatje,
    aandachtspunten: values.aandachtspunten,
    diagram_data: diagram?.data ?? null,
    diagram_image_url: diagram?.imageDataUrl ?? null,
    is_ai_generated: isAiGenerated,
    status: "approved",
    taalcode: "nl",
  });

  if (error) {
    return { error: GENERIC_ERROR };
  }

  return { success: true };
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
