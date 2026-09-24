import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getActiveLeerlijnForDate } from "@/lib/planningSchedule";
import type {
  PlanningClass,
  YearPlanBlock,
  PlannedLesson,
  PlannedLessonWithContext,
  PlannedLessonForActivity,
} from "@/types/planning";

const CLASS_SELECT = "id, user_id, name, doelgroep, lesson_slots, created_at";
const YEAR_PLAN_BLOCK_SELECT = "id, class_id, user_id, leerlijn, start_date, end_date, created_at";
const PLANNED_LESSON_SELECT =
  "id, class_id, user_id, lesson_date, start_time, duration_minutes, activity_id, status, notes, created_at";

async function getServerClient() {
  const cookieStore = await cookies();
  return createClient(cookieStore);
}

/**
 * Alle klassen van de ingelogde gebruiker, voor het klassenoverzicht op
 * /profiel/planning. RLS beperkt dit al tot eigen rijen; `userId` wordt
 * hier alsnog expliciet meegegeven (i.p.v. enkel op RLS te vertrouwen) zodat
 * de query-intentie leesbaar blijft, zelfde stijl als getOwnSubmissions in
 * lib/services/activities.ts.
 */
export async function getClassesForUser(userId: string): Promise<PlanningClass[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("klassen")
    .select(CLASS_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<PlanningClass[]>();

  if (error) {
    throw new Error(`Kon klassen niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

export async function getClassById(classId: string): Promise<PlanningClass | null> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("klassen")
    .select(CLASS_SELECT)
    .eq("id", classId)
    .maybeSingle()
    .returns<PlanningClass>();

  if (error) {
    throw new Error(`Kon klas niet ophalen: ${error.message}`);
  }

  return data;
}

export async function getYearPlanBlocks(classId: string): Promise<YearPlanBlock[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("jaarplanning_blokken")
    .select(YEAR_PLAN_BLOCK_SELECT)
    .eq("class_id", classId)
    .order("start_date", { ascending: true })
    .returns<YearPlanBlock[]>();

  if (error) {
    throw new Error(`Kon jaarplanning niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Geplande lessen voor een klas binnen een optioneel datumbereik, verrijkt
 * met de actieve leerlijn (afgeleid uit de jaarplanning-blokken) en de
 * titel van de gekoppelde activiteit — zodat WeekPlanningView geen losse
 * lookups per rij hoeft te doen. Twee stappen (lessen + activiteit-titels),
 * zelfde patroon als getSavedActivities in lib/services/activities.ts, i.p.v.
 * een embedded select: `activiteiten` heeft eigen RLS ("openbaar of eigen")
 * die hier los van moet blijven werken.
 */
export async function getPlannedLessons(
  classId: string,
  range?: { from?: string; to?: string },
): Promise<PlannedLessonWithContext[]> {
  const supabase = await getServerClient();

  let query = supabase
    .from("geplande_lessen")
    .select(PLANNED_LESSON_SELECT)
    .eq("class_id", classId)
    .order("lesson_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (range?.from) query = query.gte("lesson_date", range.from);
  if (range?.to) query = query.lte("lesson_date", range.to);

  const { data: lessons, error } = await query.returns<PlannedLesson[]>();

  if (error) {
    throw new Error(`Kon geplande lessen niet ophalen: ${error.message}`);
  }

  const rows = lessons ?? [];
  const activityIds = [...new Set(rows.map((row) => row.activity_id).filter((id): id is string => id !== null))];

  const titleById = new Map<string, string>();
  if (activityIds.length > 0) {
    const { data: activities, error: activitiesError } = await supabase
      .from("activiteiten")
      .select("id, titel")
      .in("id", activityIds);

    if (activitiesError) {
      throw new Error(`Kon gekoppelde activiteiten niet ophalen: ${activitiesError.message}`);
    }

    for (const activity of activities ?? []) {
      titleById.set(activity.id, activity.titel);
    }
  }

  const yearPlanBlocks = await getYearPlanBlocks(classId);

  return rows.map((row) => ({
    ...row,
    activeLeerlijn: getActiveLeerlijnForDate(yearPlanBlocks, row.lesson_date),
    activityTitel: row.activity_id ? (titleById.get(row.activity_id) ?? null) : null,
  }));
}

/**
 * Voor de tweerichtingskoppeling op de activiteit-detailpagina: "Gepland
 * voor Groep 5A op 12 oktober". Genest select op de FK naar `klassen` —
 * RLS op geplande_lessen (owner-scoped) filtert dit al tot de eigen rijen
 * van de ingelogde gebruiker.
 */
export async function getPlannedLessonsForActivity(
  activityId: string,
): Promise<PlannedLessonForActivity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("geplande_lessen")
    .select("id, class_id, lesson_date, start_time, klassen(name)")
    .eq("activity_id", activityId)
    .order("lesson_date", { ascending: true })
    .returns<
      { id: string; class_id: string; lesson_date: string; start_time: string; klassen: { name: string } | null }[]
    >();

  if (error) {
    throw new Error(`Kon planning voor activiteit niet ophalen: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    class_id: row.class_id,
    class_name: row.klassen?.name ?? "Onbekende klas",
    lesson_date: row.lesson_date,
    start_time: row.start_time,
  }));
}
