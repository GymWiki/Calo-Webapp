"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getUserPermissions } from "@/lib/permissions";
import {
  createClassInputSchema,
  updateClassInputSchema,
  cancelLessonInputSchema,
  restoreLessonInputSchema,
  updateLessonNotesInputSchema,
  addActivitiesToLessonInputSchema,
  removeActivityFromLessonInputSchema,
  reorderLessonActivitiesInputSchema,
  addActivityToPlanningInputSchema,
  type CreateClassInput,
  type UpdateClassInput,
  type CancelLessonInput,
  type RestoreLessonInput,
  type UpdateLessonNotesInput,
  type AddActivitiesToLessonInput,
  type RemoveActivityFromLessonInput,
  type ReorderLessonActivitiesInput,
  type AddActivityToPlanningInput,
  type LessonSlot,
  type PlannedLessonStatus,
} from "@/types/planning";

type ActionResult = { error: string } | { success: true };
type CreateClassResult = { error: string } | { success: true; classId: string };
type AddActivityToPlanningResult = { error: string } | { success: true; month: string };

const GENERIC_ERROR = "Opslaan is mislukt. Probeer het opnieuw.";
const NOT_LOGGED_IN_ERROR = "Je bent niet ingelogd.";
const LOCKED_ACTIVITY_ERROR = "Eén of meer activiteiten zijn alleen beschikbaar met een betaald abonnement.";
const DEFAULT_START_TIME = "09:00";

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
 * Zoekt de geplande_lessen-rij voor (classId, lessonDate, startTime) op, of
 * maakt hem aan (status default 'gepland') — een lesmoment is tot dit punt
 * puur virtueel (zie lib/services/planning.ts), en krijgt pas een echte rij
 * zodra er iets aan gekoppeld wordt. Idempotente upsert (zelfde primitief
 * als de vorige ensureLessonsGeneratedForMonth), zodat twee gelijktijdige
 * aanroepen nooit een duplicaat of raceconditie opleveren.
 */
async function getOrCreateLessonId(
  supabase: SupabaseClient,
  userId: string,
  classId: string,
  lessonDate: string,
  startTime: string,
): Promise<{ id: string } | { error: string }> {
  const { error: upsertError } = await supabase.from("geplande_lessen").upsert(
    { class_id: classId, user_id: userId, lesson_date: lessonDate, start_time: startTime },
    { onConflict: "class_id,lesson_date,start_time", ignoreDuplicates: true },
  );

  if (upsertError) {
    logPlanningError("getOrCreateLessonId:upsert", upsertError);
    return { error: GENERIC_ERROR };
  }

  const { data, error } = await supabase
    .from("geplande_lessen")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", userId)
    .eq("lesson_date", lessonDate)
    .eq("start_time", startTime)
    .maybeSingle();

  if (error || !data) {
    logPlanningError("getOrCreateLessonId:select", error);
    return { error: GENERIC_ERROR };
  }

  return { id: data.id };
}

export async function cancelLesson(input: CancelLessonInput): Promise<ActionResult> {
  const parsed = cancelLessonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const lessonResult = await getOrCreateLessonId(
    supabase,
    user.id,
    parsed.data.classId,
    parsed.data.lessonDate,
    parsed.data.startTime,
  );
  if ("error" in lessonResult) return lessonResult;

  const { error } = await supabase
    .from("geplande_lessen")
    .update({ status: "vervallen" satisfies PlannedLessonStatus })
    .eq("id", lessonResult.id)
    .eq("user_id", user.id);

  if (error) {
    logPlanningError("cancelLesson", error);
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/profiel/planning");
  revalidatePath(`/profiel/planning/${parsed.data.classId}`);
  return { success: true };
}

export async function restoreLesson(input: RestoreLessonInput): Promise<ActionResult> {
  const parsed = restoreLessonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const lessonResult = await getOrCreateLessonId(
    supabase,
    user.id,
    parsed.data.classId,
    parsed.data.lessonDate,
    parsed.data.startTime,
  );
  if ("error" in lessonResult) return lessonResult;

  const { error } = await supabase
    .from("geplande_lessen")
    .update({ status: "gepland" satisfies PlannedLessonStatus })
    .eq("id", lessonResult.id)
    .eq("user_id", user.id);

  if (error) {
    logPlanningError("restoreLesson", error);
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/profiel/planning");
  revalidatePath(`/profiel/planning/${parsed.data.classId}`);
  return { success: true };
}

export async function updateLessonNotes(input: UpdateLessonNotesInput): Promise<ActionResult> {
  const parsed = updateLessonNotesInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const lessonResult = await getOrCreateLessonId(
    supabase,
    user.id,
    parsed.data.classId,
    parsed.data.lessonDate,
    parsed.data.startTime,
  );
  if ("error" in lessonResult) return lessonResult;

  const { error } = await supabase
    .from("geplande_lessen")
    .update({ notes: parsed.data.notes })
    .eq("id", lessonResult.id)
    .eq("user_id", user.id);

  if (error) {
    logPlanningError("updateLessonNotes", error);
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/profiel/planning");
  revalidatePath(`/profiel/planning/${parsed.data.classId}`);
  return { success: true };
}

/**
 * Koppelt één activiteit aan het einde van de volgorde van een lesmoment —
 * gedeeld door addActivitiesToLesson (meerdere tegelijk) en
 * addActivityToPlanning (de activiteit-detailpagina-flow, altijd één).
 * `upsert` met `ignoreDuplicates` op de (lesson_id, activity_id)-unique-
 * constraint maakt dubbel-toevoegen van dezelfde activiteit onschadelijk.
 */
async function appendActivityToLesson(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  activityId: string,
): Promise<ActionResult> {
  const { data: existingLinks, error: existingLinksError } = await supabase
    .from("les_activiteiten")
    .select("position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: false })
    .limit(1);

  if (existingLinksError) {
    logPlanningError("appendActivityToLesson:positions", existingLinksError);
    return { error: GENERIC_ERROR };
  }

  const nextPosition = (existingLinks?.[0]?.position ?? -1) + 1;

  const { error } = await supabase.from("les_activiteiten").upsert(
    { lesson_id: lessonId, activity_id: activityId, user_id: userId, position: nextPosition },
    { onConflict: "lesson_id,activity_id", ignoreDuplicates: true },
  );

  if (error) {
    logPlanningError("appendActivityToLesson:insert", error);
    return { error: GENERIC_ERROR };
  }

  return { success: true };
}

/**
 * Server-side betaalmuur-check: een gebruiker zonder volledige
 * bibliotheektoegang mag alleen eigen of opgeslagen activiteiten toevoegen
 * aan een lesmoment — nooit alleen op de client-filter in
 * AddActivitiesToLessonSheet vertrouwen, die is triviaal te omzeilen.
 */
async function assertActivitiesAllowed(
  supabase: SupabaseClient,
  userId: string,
  activityIds: string[],
): Promise<{ error: string } | { success: true }> {
  const { data: profile, error: profileError } = await supabase
    .from("users")
    .select("subscription_status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    logPlanningError("assertActivitiesAllowed:profile", profileError);
    return { error: GENERIC_ERROR };
  }

  const { hasFullLibraryAccess } = getUserPermissions(profile ?? undefined);
  if (hasFullLibraryAccess) return { success: true };

  const { data: activities, error: activitiesError } = await supabase
    .from("activiteiten")
    .select("id, author_id")
    .in("id", activityIds);

  if (activitiesError) {
    logPlanningError("assertActivitiesAllowed:activities", activitiesError);
    return { error: GENERIC_ERROR };
  }

  const { data: saved, error: savedError } = await supabase
    .from("opgeslagen_activiteiten")
    .select("activiteit_id")
    .eq("user_id", userId)
    .in("activiteit_id", activityIds);

  if (savedError) {
    logPlanningError("assertActivitiesAllowed:saved", savedError);
    return { error: GENERIC_ERROR };
  }

  const savedIds = new Set((saved ?? []).map((row) => row.activiteit_id));
  const blocked = (activities ?? []).some(
    (activity) => activity.author_id !== userId && !savedIds.has(activity.id),
  );

  if (blocked) {
    return { error: LOCKED_ACTIVITY_ERROR };
  }

  return { success: true };
}

export async function addActivitiesToLesson(input: AddActivitiesToLessonInput): Promise<ActionResult> {
  const parsed = addActivitiesToLessonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { classId, lessonDate, startTime, activityIds } = parsed.data;

  const allowed = await assertActivitiesAllowed(supabase, user.id, activityIds);
  if ("error" in allowed) return allowed;

  const lessonResult = await getOrCreateLessonId(supabase, user.id, classId, lessonDate, startTime);
  if ("error" in lessonResult) return lessonResult;

  const { data: existingLinks, error: existingLinksError } = await supabase
    .from("les_activiteiten")
    .select("position")
    .eq("lesson_id", lessonResult.id)
    .order("position", { ascending: false })
    .limit(1);

  if (existingLinksError) {
    logPlanningError("addActivitiesToLesson:positions", existingLinksError);
    return { error: GENERIC_ERROR };
  }

  let nextPosition = (existingLinks?.[0]?.position ?? -1) + 1;
  const rows = activityIds.map((activityId) => ({
    lesson_id: lessonResult.id,
    activity_id: activityId,
    user_id: user.id,
    position: nextPosition++,
  }));

  const { error } = await supabase
    .from("les_activiteiten")
    .upsert(rows, { onConflict: "lesson_id,activity_id", ignoreDuplicates: true });

  if (error) {
    logPlanningError("addActivitiesToLesson:insert", error);
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/profiel/planning");
  revalidatePath(`/profiel/planning/${classId}`);
  for (const activityId of activityIds) {
    revalidatePath(`/activiteit/${activityId}`);
  }
  return { success: true };
}

export async function removeActivityFromLesson(input: RemoveActivityFromLessonInput): Promise<ActionResult> {
  const parsed = removeActivityFromLessonInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { error } = await supabase
    .from("les_activiteiten")
    .delete()
    .eq("id", parsed.data.lessonActivityId)
    .eq("user_id", user.id);

  if (error) {
    logPlanningError("removeActivityFromLesson", error);
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/profiel/planning");
  return { success: true };
}

export async function reorderLessonActivities(input: ReorderLessonActivitiesInput): Promise<ActionResult> {
  const parsed = reorderLessonActivitiesInputSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }

  const { supabase, user } = await getAuthedSupabase();
  if (!user) return { error: NOT_LOGGED_IN_ERROR };

  const { lessonId, orderedLessonActivityIds } = parsed.data;

  const results = await Promise.all(
    orderedLessonActivityIds.map((id, index) =>
      supabase
        .from("les_activiteiten")
        .update({ position: index })
        .eq("id", id)
        .eq("lesson_id", lessonId)
        .eq("user_id", user.id),
    ),
  );

  const failed = results.find((result) => result.error);
  if (failed?.error) {
    logPlanningError("reorderLessonActivities", failed.error);
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/profiel/planning");
  return { success: true };
}

/**
 * "Toevoegen aan planning" vanaf de activiteit-detailpagina: koppelt aan het
 * vroegste bestaande lesmoment op die datum voor die klas, of maakt er één
 * aan met de eerste vaste weekmoment-tijd van de klas als tijd-fallback (de
 * gebruiker koos hier bewust een datum die niet per se met een bestaand
 * weekmoment samenvalt, dus een sensibele default i.p.v. een harde eis).
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

  const allowed = await assertActivitiesAllowed(supabase, user.id, [activityId]);
  if ("error" in allowed) return allowed;

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

  let lessonId: string;

  if (existing) {
    lessonId = existing.id;
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

    const startTime = klas.lesson_slots[0]?.startTime ?? DEFAULT_START_TIME;

    const { data: inserted, error: insertError } = await supabase
      .from("geplande_lessen")
      .insert({ class_id: classId, user_id: user.id, lesson_date: lessonDate, start_time: startTime })
      .select("id")
      .single();

    if (insertError || !inserted) {
      logPlanningError("addActivityToPlanning:insert", insertError);
      return { error: GENERIC_ERROR };
    }

    lessonId = inserted.id;
  }

  const linkResult = await appendActivityToLesson(supabase, user.id, lessonId, activityId);
  if ("error" in linkResult) return linkResult;

  revalidatePath("/profiel/planning");
  revalidatePath(`/profiel/planning/${classId}`);
  revalidatePath(`/activiteit/${activityId}`);
  return { success: true, month: lessonDate.slice(0, 7) };
}

/**
 * Leesfunctie voor de mini-datumkiezer in AddToPlanningSheet — bewust in dit
 * `"use server"`-bestand (i.p.v. lib/services/planning.ts) omdat hij
 * rechtstreeks vanuit een client-component wordt aangeroepen zodra daar een
 * klas gekozen wordt; lib/services/* gebruikt cookies() en kan niet vanuit
 * de client geïmporteerd worden. "Open" = een bestaand lesmoment zonder
 * gekoppelde activiteiten (i.p.v. de oude `activity_id is null`-check).
 */
export async function getOpenPlannedDatesForClass(
  classId: string,
  monthStart: string,
  monthEnd: string,
): Promise<{ lessonDate: string; status: PlannedLessonStatus }[]> {
  const { supabase, user } = await getAuthedSupabase();
  if (!user) return [];

  const { data: lessons, error } = await supabase
    .from("geplande_lessen")
    .select("id, lesson_date, status")
    .eq("class_id", classId)
    .eq("user_id", user.id)
    .gte("lesson_date", monthStart)
    .lte("lesson_date", monthEnd)
    .returns<{ id: string; lesson_date: string; status: PlannedLessonStatus }[]>();

  if (error) {
    logPlanningError("getOpenPlannedDatesForClass", error);
    return [];
  }

  const rows = lessons ?? [];
  if (rows.length === 0) return [];

  const { data: links, error: linksError } = await supabase
    .from("les_activiteiten")
    .select("lesson_id")
    .in(
      "lesson_id",
      rows.map((row) => row.id),
    );

  if (linksError) {
    logPlanningError("getOpenPlannedDatesForClass:links", linksError);
    return [];
  }

  const linkedLessonIds = new Set((links ?? []).map((row) => row.lesson_id));

  return rows
    .filter((row) => !linkedLessonIds.has(row.id))
    .map((row) => ({ lessonDate: row.lesson_date, status: row.status }));
}
