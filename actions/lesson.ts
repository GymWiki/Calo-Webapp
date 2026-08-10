"use server";

import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import {
  createLessonInputSchema,
  type CreateLessonInput,
} from "@/types/lesson";

type ActionResult = { error: string } | { success: true };

const GENERIC_ERROR = "Les opslaan is mislukt. Probeer het opnieuw.";

export async function createLesson(
  input: CreateLessonInput,
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
        lukt_het_zwak_see: values.luktHetZwakSee || null,
        lukt_het_zwak_do: values.luktHetZwakDo || null,
        loopt_het_see: values.looptHetSee || null,
        loopt_het_do: values.looptHetDo || null,
        leeft_het_see: values.leeftHetSee || null,
        leeft_het_do: values.leeftHetDo || null,
        lukt_het_goed_see: values.luktHetGoedSee || null,
        lukt_het_goed_do: values.luktHetGoedDo || null,
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
