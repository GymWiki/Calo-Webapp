"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  createLessonInputSchema,
  type CreateLessonInput,
} from "@/types/lesson";
import type { DiagramData } from "@/components/canvas/gym-canvas-types";

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Les opslaan is mislukt. Probeer het opnieuw.";

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

    return { success: true };
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

  return { success: true };
}
