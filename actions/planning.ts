"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { generateLessonDates } from "@/lib/planningSchedule";
import {
  createClassInputSchema,
  updateClassInputSchema,
  createYearPlanBlockInputSchema,
  updateYearPlanBlockInputSchema,
  updatePlannedLessonInputSchema,
  type CreateClassInput,
  type UpdateClassInput,
  type CreateYearPlanBlockInput,
  type UpdateYearPlanBlockInput,
  type UpdatePlannedLessonInput,
  type LessonSlot,
} from "@/types/planning";

type ActionResult = { error: string } | { success: true };
type CreateClassResult = { error: string } | { success: true; classId: string };

const GENERIC_ERROR = "Opslaan is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const OVERLAP_ERROR = "Deze periode overlapt met een bestaand blok in de jaarplanning.";
const GENERATE_WEEKS = 12;

function logPlanningError(context: string, error: unknown) {
  console.error(`planning/${context}:`, error);
}

async function getAuthedSupabase() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/**
 * Bulk-inserteert de komende `weeks` weken lesmomenten voor een klas, op
 * basis van de vaste weekmomenten. `upsert` met `ignoreDuplicates` maakt dit
 * idempotent (dankzij de unique(class_id, lesson_date, start_time)-
 * constraint in de migratie) — zowel bij het aanmaken van een klas als bij
 * de handmatige "Genereer volgende 12 weken"-actie kan dit veilig opnieuw
 * worden aangeroepen zonder duplicaten of een harde fout op een reeds
 * bestaand lesmoment.
 */
async function insertGeneratedLessons(
  supabase: Awaited<ReturnType<typeof createClient>>,
  classId: string,
  userId: string,
  lessonSlots: LessonSlot[],
  from: Date,
) {
  const dates = generateLessonDates(lessonSlots, from, GENERATE_WEEKS);
  if (dates.length === 0) return;

  const rows = dates.map((d) => ({
    class_id: classId,
    user_id: userId,
    lesson_date: d.lessonDate,
    start_time: d.startTime,
    duration_minutes: d.durationMinutes,
  }));

  const { error } = await supabase
    .from("geplande_lessen")
    .upsert(rows, { onConflict: "class_id,lesson_date,start_time", ignoreDuplicates: true });

  if (error) {
    logPlanningError("insertGeneratedLessons", error);
    throw new Error(GENERIC_ERROR);
  }
}

export async function createClass(input: CreateClassInput): Promise<CreateClassResult> {
  const parsed = createClassInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data, error } = await supabase
    .from("klassen")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      doelgroep: parsed.data.doelgroep,
      lesson_slots: parsed.data.lessonSlots,
    })
    .select("id")
    .single();

  if (error || !data) {
    logPlanningError("createClass", error);
    return { error: "Klas aanmaken is mislukt. Probeer het opnieuw." };
  }

  try {
    await insertGeneratedLessons(supabase, data.id, user.id, parsed.data.lessonSlots, new Date());
  } catch {
    // De klas zelf is al aangemaakt; de "Genereer volgende 12 weken"-knop op
    // de klas-pagina biedt een directe, veilige (idempotente) manier om dit
    // alsnog te doen als de generatie hier onverhoopt faalt.
  }

  revalidatePath("/profiel/planning");
  return { success: true, classId: data.id };
}

export async function updateClass(input: UpdateClassInput): Promise<ActionResult> {
  const parsed = updateClassInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase
    .from("klassen")
    .update({
      name: parsed.data.name,
      doelgroep: parsed.data.doelgroep,
      lesson_slots: parsed.data.lessonSlots,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    logPlanningError("updateClass", error);
    return { error: "Klas bijwerken is mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/profiel/planning");
  revalidatePath(`/profiel/planning/${parsed.data.id}`);
  return { success: true };
}

export async function deleteClass(classId: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase.from("klassen").delete().eq("id", classId).eq("user_id", user.id);

  if (error) {
    logPlanningError("deleteClass", error);
    return { error: "Klas verwijderen is mislukt. Probeer het opnieuw." };
  }

  revalidatePath("/profiel/planning");
  return { success: true };
}

/**
 * Handmatige "Genereer volgende 12 weken"-actie — verlengt de weekplanning
 * vanaf vandaag. Idempotent (zie insertGeneratedLessons), dus veilig
 * meerdere keren te klikken.
 */
export async function generateUpcomingLessons(classId: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { data: klas, error: klasError } = await supabase
    .from("klassen")
    .select("id, lesson_slots")
    .eq("id", classId)
    .eq("user_id", user.id)
    .maybeSingle()
    .returns<{ id: string; lesson_slots: LessonSlot[] }>();

  if (klasError || !klas) {
    logPlanningError("generateUpcomingLessons", klasError);
    return { error: GENERIC_ERROR };
  }

  try {
    await insertGeneratedLessons(supabase, classId, user.id, klas.lesson_slots, new Date());
  } catch {
    return { error: GENERIC_ERROR };
  }

  revalidatePath(`/profiel/planning/${classId}`);
  return { success: true };
}

export async function createYearPlanBlock(input: CreateYearPlanBlockInput): Promise<ActionResult> {
  const parsed = createYearPlanBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase.from("jaarplanning_blokken").insert({
    class_id: parsed.data.classId,
    user_id: user.id,
    leerlijn: parsed.data.leerlijn,
    start_date: parsed.data.startDate,
    end_date: parsed.data.endDate,
  });

  if (error) {
    logPlanningError("createYearPlanBlock", error);
    if (error.code === "23P01") return { error: OVERLAP_ERROR };
    return { error: GENERIC_ERROR };
  }

  revalidatePath(`/profiel/planning/${parsed.data.classId}`);
  return { success: true };
}

export async function updateYearPlanBlock(input: UpdateYearPlanBlockInput): Promise<ActionResult> {
  const parsed = updateYearPlanBlockInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase
    .from("jaarplanning_blokken")
    .update({
      leerlijn: parsed.data.leerlijn,
      start_date: parsed.data.startDate,
      end_date: parsed.data.endDate,
    })
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    logPlanningError("updateYearPlanBlock", error);
    if (error.code === "23P01") return { error: OVERLAP_ERROR };
    return { error: GENERIC_ERROR };
  }

  revalidatePath(`/profiel/planning/${parsed.data.classId}`);
  return { success: true };
}

export async function deleteYearPlanBlock(blockId: string, classId: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase
    .from("jaarplanning_blokken")
    .delete()
    .eq("id", blockId)
    .eq("user_id", user.id);

  if (error) {
    logPlanningError("deleteYearPlanBlock", error);
    return { error: "Blok verwijderen is mislukt. Probeer het opnieuw." };
  }

  revalidatePath(`/profiel/planning/${classId}`);
  return { success: true };
}

export async function updatePlannedLesson(
  input: UpdatePlannedLessonInput,
  classId: string,
): Promise<ActionResult> {
  const parsed = updatePlannedLessonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const update: Record<string, unknown> = {};
  if (parsed.data.activityId !== undefined) update.activity_id = parsed.data.activityId;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;

  const { error } = await supabase
    .from("geplande_lessen")
    .update(update)
    .eq("id", parsed.data.id)
    .eq("user_id", user.id);

  if (error) {
    logPlanningError("updatePlannedLesson", error);
    return { error: GENERIC_ERROR };
  }

  revalidatePath(`/profiel/planning/${classId}`);
  // De private activiteit-detailpagina is een cookies()-afhankelijke,
  // dynamisch gerenderde route (net als elders in dit codebase nooit expliciet
  // gerevalideerd, zie actions/lesson.ts — alleen de publieke
  // /activiteiten/[slug]-pagina's krijgen dat) — bij een nieuwe koppeling
  // revalideren we hem alsnog expliciet zodat de "Gepland voor..."-banner
  // direct up-to-date is bij de eerstvolgende bezoek.
  if (parsed.data.activityId) {
    revalidatePath(`/activiteit/${parsed.data.activityId}`);
  }
  return { success: true };
}
