"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import {
  createClassInputSchema,
  updateClassInputSchema,
  updatePlannedLessonInputSchema,
  addActivityToPlanningInputSchema,
  type CreateClassInput,
  type UpdateClassInput,
  type UpdatePlannedLessonInput,
  type AddActivityToPlanningInput,
  type LessonSlot,
  type PlannedLessonStatus,
} from "@/types/planning";

type ActionResult = { error: string } | { success: true };
type CreateClassResult = { error: string } | { success: true; classId: string };
type AddActivityToPlanningResult = { error: string } | { success: true; month: string };

const GENERIC_ERROR = "Opslaan is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const DEFAULT_SLOT = { startTime: "09:00", durationMinutes: 45 };

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

  // Geen eager generatie meer hier — geplande_lessen vult zichzelf zodra een
  // maand voor het eerst bekeken wordt (zie lib/services/planning.ts's
  // ensureLessonsGeneratedForMonth), dus deze klas hoeft niet vooraf een
  // vaste hoeveelheid weken te krijgen.
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
 * Koppelt/ontkoppelt een activiteit en/of wijzigt de status van een
 * lesmoment (dag-klik in MonthCalendar -> DayLessonSheet). Wordt een
 * `activityId` meegegeven zonder expliciete `status`, dan springt de status
 * automatisch naar "gepland" — het koppelen van een activiteit ÍS de
 * bevestiging dat de les gepland is, dus dat hoeft de gebruiker niet apart
 * nog een keer aan te geven. Ontkoppelen (`activityId: null`) zet de
 * aanroeper zelf expliciet terug naar "nog_te_bepalen" via de `status`-param
 * (zie DayLessonSheet.tsx).
 */
export async function updatePlannedLesson(input: UpdatePlannedLessonInput): Promise<ActionResult> {
  const parsed = updatePlannedLessonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const update: Record<string, unknown> = {};
  if (parsed.data.activityId !== undefined) update.activity_id = parsed.data.activityId;
  if (parsed.data.status !== undefined) {
    update.status = parsed.data.status;
  } else if (parsed.data.activityId) {
    update.status = "gepland" satisfies PlannedLessonStatus;
  }
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

  revalidatePath("/profiel/planning");
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

/**
 * "Toevoegen aan planning" vanaf de activiteit-detailpagina: koppelt aan een
 * al bestaand lesmoment op die datum voor die klas (ongeacht status), of
 * maakt er één aan met de eerste vaste weekmoment-tijd van de klas als
 * tijd/duur-fallback (de gebruiker koos hier bewust een datum die niet per
 * se met een bestaand weekmoment samenvalt, dus een sensibele default i.p.v.
 * een harde eis).
 */
export async function addActivityToPlanning(
  input: AddActivityToPlanningInput,
): Promise<AddActivityToPlanningResult> {
  const parsed = addActivityToPlanningInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { classId, lessonDate, activityId } = parsed.data;

  const { data: existing, error: existingError } = await supabase
    .from("geplande_lessen")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", user.id)
    .eq("lesson_date", lessonDate)
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    logPlanningError("addActivityToPlanning:lookup", existingError);
    return { error: GENERIC_ERROR };
  }

  if (existing) {
    const { error } = await supabase
      .from("geplande_lessen")
      .update({ activity_id: activityId, status: "gepland" satisfies PlannedLessonStatus })
      .eq("id", existing.id)
      .eq("user_id", user.id);

    if (error) {
      logPlanningError("addActivityToPlanning:update", error);
      return { error: GENERIC_ERROR };
    }
  } else {
    const { data: klas, error: klasError } = await supabase
      .from("klassen")
      .select("id, lesson_slots")
      .eq("id", classId)
      .eq("user_id", user.id)
      .maybeSingle()
      .returns<{ id: string; lesson_slots: LessonSlot[] }>();

    if (klasError || !klas) {
      logPlanningError("addActivityToPlanning:klas", klasError);
      return { error: GENERIC_ERROR };
    }

    const slot = klas.lesson_slots[0] ?? DEFAULT_SLOT;

    const { error } = await supabase.from("geplande_lessen").insert({
      class_id: classId,
      user_id: user.id,
      lesson_date: lessonDate,
      start_time: slot.startTime,
      duration_minutes: slot.durationMinutes,
      activity_id: activityId,
      status: "gepland" satisfies PlannedLessonStatus,
    });

    if (error) {
      logPlanningError("addActivityToPlanning:insert", error);
      return { error: GENERIC_ERROR };
    }
  }

  revalidatePath("/profiel/planning");
  revalidatePath(`/activiteit/${activityId}`);
  return { success: true, month: lessonDate.slice(0, 7) };
}

/**
 * Leesfunctie voor de mini-datumkiezer in AddToPlanningSheet — bewust in dit
 * `"use server"`-bestand (i.p.v. lib/services/planning.ts) omdat hij
 * rechtstreeks vanuit een client-component wordt aangeroepen zodra daar een
 * klas gekozen wordt; lib/services/* gebruikt cookies() en kan niet vanuit
 * de client geïmporteerd worden.
 */
export async function getOpenPlannedDatesForClass(
  classId: string,
  monthStart: string,
  monthEnd: string,
): Promise<{ lessonDate: string; status: PlannedLessonStatus }[]> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return [];

  const { data, error } = await supabase
    .from("geplande_lessen")
    .select("lesson_date, status")
    .eq("class_id", classId)
    .eq("user_id", user.id)
    .gte("lesson_date", monthStart)
    .lte("lesson_date", monthEnd)
    .returns<{ lesson_date: string; status: PlannedLessonStatus }[]>();

  if (error) {
    logPlanningError("getOpenPlannedDatesForClass", error);
    return [];
  }

  return (data ?? []).map((row) => ({ lessonDate: row.lesson_date, status: row.status }));
}
