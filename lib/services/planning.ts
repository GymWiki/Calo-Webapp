import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { generateLessonDatesInRange, getMonthRange } from "@/lib/planningSchedule";
import type {
  PlanningClass,
  PlannedLesson,
  PlannedLessonWithContext,
  PlannedLessonForActivity,
  HolidayRegion,
  SchoolHoliday,
} from "@/types/planning";

type ServerSupabase = Awaited<ReturnType<typeof getServerClient>>;

const CLASS_SELECT = "id, user_id, name, doelgroep, lesson_slots, created_at";
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

/**
 * Vult ontbrekende `geplande_lessen`-rijen aan voor een datumbereik, op
 * basis van de vaste weekmomenten van elke klas — "on the fly" generatie
 * zodra een maand bekeken wordt (i.p.v. een aparte "genereer"-knop). Een
 * upsert met `ignoreDuplicates` op de bestaande `(class_id, lesson_date,
 * start_time)`-unique-constraint maakt dit idempotent: een maand opnieuw
 * bekijken genereert nooit duplicaten. Best-effort (logt, gooit niet) —
 * een generatiefout mag het tonen van al bestaande lessen niet blokkeren.
 */
async function ensureLessonsGeneratedForMonth(
  supabase: ServerSupabase,
  userId: string,
  classes: PlanningClass[],
  rangeStart: string,
  rangeEnd: string,
) {
  const rows = classes.flatMap((klas) => {
    if (klas.lesson_slots.length === 0) return [];
    return generateLessonDatesInRange(klas.lesson_slots, rangeStart, rangeEnd).map((occurrence) => ({
      class_id: klas.id,
      user_id: userId,
      lesson_date: occurrence.lessonDate,
      start_time: occurrence.startTime,
      duration_minutes: occurrence.durationMinutes,
    }));
  });

  if (rows.length === 0) return;

  const { error } = await supabase
    .from("geplande_lessen")
    .upsert(rows, { onConflict: "class_id,lesson_date,start_time", ignoreDuplicates: true });

  if (error) {
    console.error("ensureLessonsGeneratedForMonth:", error);
  }
}

/**
 * Geplande lessen van ALLE klassen van de gebruiker binnen [monthStart,
 * monthEnd], verrijkt met klasnaam en (indien gekoppeld) activiteit-titel —
 * de databron voor MonthCalendar, die klassen door elkaar toont. Genereert
 * eerst ontbrekende lessen voor deze periode (zie ensureLessonsGeneratedForMonth),
 * haalt dan op. Twee stappen voor de activiteit-titels (i.p.v. een embedded
 * select), zelfde patroon als getSavedActivities in lib/services/
 * activities.ts: `activiteiten` heeft eigen RLS ("openbaar of eigen") die
 * hier los van moet blijven werken.
 */
export async function getPlannedLessonsForMonth(
  userId: string,
  monthStart: string,
  monthEnd: string,
): Promise<PlannedLessonWithContext[]> {
  const supabase = await getServerClient();
  const classes = await getClassesForUser(userId);

  if (classes.length === 0) return [];

  await ensureLessonsGeneratedForMonth(supabase, userId, classes, monthStart, monthEnd);

  const classIds = classes.map((klas) => klas.id);
  const { data: lessons, error } = await supabase
    .from("geplande_lessen")
    .select(PLANNED_LESSON_SELECT)
    .in("class_id", classIds)
    .gte("lesson_date", monthStart)
    .lte("lesson_date", monthEnd)
    .order("lesson_date", { ascending: true })
    .order("start_time", { ascending: true })
    .returns<PlannedLesson[]>();

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

  const nameByClassId = new Map(classes.map((klas) => [klas.id, klas.name]));

  return rows.map((row) => ({
    ...row,
    class_name: nameByClassId.get(row.class_id) ?? "Onbekende klas",
    activityTitel: row.activity_id ? (titleById.get(row.activity_id) ?? null) : null,
  }));
}

/**
 * Voor de dashboard-widget "planning van vandaag" — genereert (indien nodig)
 * de huidige maand en filtert tot vandaag, zodat het widget nooit leeg is
 * puur omdat de gebruiker deze maand de Planning-pagina nog niet heeft
 * geopend.
 */
export async function getTodaysPlannedLessons(userId: string): Promise<PlannedLessonWithContext[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { start, end } = getMonthRange(today.slice(0, 7));
  const monthLessons = await getPlannedLessonsForMonth(userId, start, end);
  return monthLessons.filter((lesson) => lesson.lesson_date === today);
}

/**
 * Schoolvakanties voor een regio die (gedeeltelijk) binnen [monthStart,
 * monthEnd] vallen — voor de vakantie-tinting in MonthCalendar.
 */
export async function getSchoolHolidays(
  region: HolidayRegion,
  monthStart: string,
  monthEnd: string,
): Promise<SchoolHoliday[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("school_holidays")
    .select("id, region, name, start_date, end_date, school_year")
    .eq("region", region)
    .lte("start_date", monthEnd)
    .gte("end_date", monthStart)
    .order("start_date", { ascending: true })
    .returns<SchoolHoliday[]>();

  if (error) {
    throw new Error(`Kon schoolvakanties niet ophalen: ${error.message}`);
  }

  return data ?? [];
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
