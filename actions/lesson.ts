"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { awardXp, XP_REWARDS, type LevelUpEvent } from "@/lib/gamification";
import { getUserPermissions } from "@/lib/permissions";
import {
  createLessonInputSchema,
  type CreateLessonInput,
} from "@/types/lesson";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";

type ActionResult =
  | { error: string; paywall?: true }
  | { success: true; levelUp?: LevelUpEvent };

const GENERIC_ERROR = "Les opslaan is mislukt. Probeer het opnieuw.";
const MAX_LESSONS_ERROR =
  "Je hebt het maximum van 3 opgeslagen lessen voor gratis accounts bereikt. Upgrade naar Pro voor onbeperkt lessen opslaan.";

export async function createLesson(
  input: CreateLessonInput,
  diagram: { data: DiagramData; imageDataUrl: string } | null = null,
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

  const { data: profile } = await supabase
    .from("users")
    .select("plan_type")
    .eq("id", user.id)
    .single();
  const { maxSavedLessons } = getUserPermissions(profile);

  if (Number.isFinite(maxSavedLessons)) {
    const { count } = await supabase
      .from("lessons")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user.id);

    if ((count ?? 0) >= maxSavedLessons) {
      return { error: MAX_LESSONS_ERROR, paywall: true };
    }
  }

  try {
    const { data: lesson, error: lessonError } = await supabase
      .from("lessons")
      .insert({
        author_id: user.id,
        title: values.title,
        lesson_date: values.lessonDate,
        group_name: values.groupName,
        learning_line: values.learningLine,
        movement_problem: values.movementProblem,
        movement_theme: values.movementTheme,
        base_materials: values.baseMaterials,
        rule_materials: values.ruleMaterials,
        min_participants: values.minParticipants ?? null,
        participants_bench: values.participantsBench ?? null,
        rules: values.rules,
        goals: values.goals,
        diagram_data: diagram?.data ?? null,
        diagram_image_url: diagram?.imageDataUrl ?? null,
        game_category: values.gameCategory || null,
        game_dimensions: values.gameDimensions,
        tactical_questions: values.tacticalQuestions,
      })
      .select("id")
      .single();

    if (lessonError || !lesson) {
      return { error: GENERIC_ERROR };
    }

    const { error: didacticsError } = await supabase
      .from("lesson_didactics")
      .insert({
        lesson_id: lesson.id,
        items: values.didacticItems,
      });

    const { error: blocksError } = await supabase.from("lesson_blocks").insert([
      { lesson_id: lesson.id, block_type: "arrangement", content: values.arrangement },
      {
        lesson_id: lesson.id,
        block_type: "deelnemers_regels",
        content: values.deelnemersRegels,
      },
      {
        lesson_id: lesson.id,
        block_type: "plaatje_praatje",
        content: values.plaatjePraatje,
      },
      {
        lesson_id: lesson.id,
        block_type: "aandachtspunten",
        content: values.aandachtspunten,
      },
    ]);

    if (didacticsError || blocksError) {
      // Roll back the partially-created lesson (cascades to any rows
      // that did get inserted above).
      await supabase.from("lessons").delete().eq("id", lesson.id);
      return { error: GENERIC_ERROR };
    }

    const { levelUp } = await awardXp(supabase, user.id, XP_REWARDS.lessonCreated);
    return levelUp ? { success: true, levelUp } : { success: true };
  } catch {
    return { error: GENERIC_ERROR };
  }
}

export async function setLessonPublic(
  lessonId: string,
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

  // Alleen bij de false->true overgang beloond met XP — anders zou
  // heen-en-weer schakelen in ShareLessonButton oneindig XP opleveren.
  const { data: existing } = await supabase
    .from("lessons")
    .select("is_public")
    .eq("id", lessonId)
    .eq("author_id", user.id)
    .maybeSingle();
  const wasAlreadyPublic = existing?.is_public ?? true;

  // RLS ("Eigenaren kunnen eigen lessen beheren") is the actual
  // enforcement — a lesson the caller doesn't own simply won't match and
  // nothing is updated.
  const { error } = await supabase
    .from("lessons")
    .update({ is_public: isPublic })
    .eq("id", lessonId)
    .eq("author_id", user.id);

  if (error) {
    return {
      error: isPublic
        ? "Les openbaar maken is mislukt. Probeer het opnieuw."
        : "Les privé maken is mislukt. Probeer het opnieuw.",
    };
  }

  if (isPublic && !wasAlreadyPublic) {
    const { levelUp } = await awardXp(supabase, user.id, XP_REWARDS.lessonShared);
    return levelUp ? { success: true, levelUp } : { success: true };
  }

  return { success: true };
}
