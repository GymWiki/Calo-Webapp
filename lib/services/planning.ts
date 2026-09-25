import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { addDays, generateLessonDatesInRange, getWeekRange } from "@/lib/planningSchedule";
import type {
  PlanningClass,
  PlannedLessonStatus,
  LessonActivity,
  LessonSlot,
  ClassLessonEntry,
  WeekLessonEntry,
  PlannedLessonForActivity,
  HolidayRegion,
  SchoolHoliday,
} from "@/types/planning";

type ServerSupabase = Awaited<ReturnType<typeof getServerClient>>;

const CLASS_SELECT = "id, user_id, name, doelgroep, lesson_slots, created_at";
const LESSON_SELECT = "id, class_id, user_id, lesson_date, start_time, status, notes, created_at";

type LessonRow = {
  id: string;
  class_id: string;
  user_id: string;
  lesson_date: string;
  start_time: string;
  status: PlannedLessonStatus;
  notes: string | null;
  created_at: string;
};

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
 * Gekoppelde activiteiten per lesmoment, gegroepeerd op `lesson_id` en op
 * `position` gesorteerd — gedeeld door getClassLessonsForMonth/
 * getWeekLessons. Twee stappen (i.p.v. een embedded select op
 * geplande_lessen zelf), zelfde reden als elders in dit bestand:
 * `activiteiten` heeft eigen RLS die hier los van moet blijven werken.
 */
async function fetchLessonActivities(
  supabase: ServerSupabase,
  lessonIds: string[],
): Promise<Map<string, LessonActivity[]>> {
  const map = new Map<string, LessonActivity[]>();
  if (lessonIds.length === 0) return map;

  const { data, error } = await supabase
    .from("les_activiteiten")
    .select("id, lesson_id, activity_id, position, activiteiten(titel, leerlijn)")
    .in("lesson_id", lessonIds)
    .order("position", { ascending: true })
    .returns<
      { id: string; lesson_id: string; activity_id: string; position: number; activiteiten: { titel: string; leerlijn: string | null } | null }[]
    >();

  if (error) {
    throw new Error(`Kon gekoppelde activiteiten niet ophalen: ${error.message}`);
  }

  for (const row of data ?? []) {
    const list = map.get(row.lesson_id) ?? [];
    list.push({
      id: row.id,
      activityId: row.activity_id,
      position: row.position,
      titel: row.activiteiten?.titel ?? "Onbekende activiteit",
      leerlijn: row.activiteiten?.leerlijn ?? null,
    });
    map.set(row.lesson_id, list);
  }

  return map;
}

/**
 * Vakantienaam per kalenderdag binnen [rangeStart, rangeEnd], voor de
 * gekozen regio — server-side vast onderdeel van elke ClassLessonEntry/
 * WeekLessonEntry i.p.v. een aparte client-side lookup (zoals de vorige,
 * inmiddels vervangen MonthCalendar dat deed).
 */
async function buildHolidayNameByDate(
  region: HolidayRegion,
  rangeStart: string,
  rangeEnd: string,
): Promise<Map<string, string>> {
  const holidays = await getSchoolHolidays(region, rangeStart, rangeEnd);
  const map = new Map<string, string>();

  for (const holiday of holidays) {
    const from = holiday.start_date > rangeStart ? holiday.start_date : rangeStart;
    const to = holiday.end_date < rangeEnd ? holiday.end_date : rangeEnd;
    for (let date = from; date <= to; date = addDays(date, 1)) {
      map.set(date, holiday.name);
    }
  }

  return map;
}

// Duur van een lesmoment waarvoor geen virtuele occurrence (meer) bestaat —
// bijv. een geplande_lessen-rij die is aangemaakt vóórdat de weekmomenten
// van de klas bewerkt werden. Zoekt de oorspronkelijke lesson_slot op
// (weekday + starttijd); valt terug op 45 minuten als die combinatie niet
// meer voorkomt, puur om altijd een zinnig getal te tonen.
function findSlotDuration(lessonSlots: LessonSlot[], lessonDate: string, startTime: string): number {
  const isoWeekday = new Date(`${lessonDate}T00:00:00Z`).getUTCDay() || 7;
  const slot = lessonSlots.find((s) => s.weekday === isoWeekday && s.startTime === startTime);
  return slot?.durationMinutes ?? 45;
}

/**
 * Merget de virtuele lesmomenten van een klas (afgeleid uit lesson_slots)
 * met de echte geplande_lessen-rijen in het bereik — een lesmoment bestaat
 * dus altijd in de teruggegeven lijst, ongeacht of er al een rij voor is.
 * Een echte rij zonder bijbehorende virtuele occurrence (weekmomenten
 * inmiddels gewijzigd) blijft ook zichtbaar i.p.v. te verdwijnen — gebruikers
 * data (notities/activiteiten) mag nooit stil verloren gaan.
 */
function buildClassLessonEntries(
  klas: PlanningClass,
  rangeStart: string,
  rangeEnd: string,
  realRows: LessonRow[],
  activitiesByLessonId: Map<string, LessonActivity[]>,
  holidayNameByDate: Map<string, string>,
): ClassLessonEntry[] {
  const occurrences =
    klas.lesson_slots.length > 0 ? generateLessonDatesInRange(klas.lesson_slots, rangeStart, rangeEnd) : [];

  const entries = new Map<string, ClassLessonEntry>();

  for (const occurrence of occurrences) {
    const key = `${occurrence.lessonDate}|${occurrence.startTime}`;
    entries.set(key, {
      date: occurrence.lessonDate,
      startTime: occurrence.startTime,
      durationMinutes: occurrence.durationMinutes,
      lessonId: null,
      status: "gepland",
      notes: null,
      activities: [],
      holidayName: holidayNameByDate.get(occurrence.lessonDate) ?? null,
    });
  }

  for (const real of realRows) {
    // Postgres' `time`-kolom komt via PostgREST terug als "HH:MM:SS"
    // (seconden inbegrepen), terwijl lesson_slots/virtuele occurrences
    // altijd "HH:MM" zijn (zie types/planning.ts's lessonSlotSchema) — zonder
    // normaliseren zou de merge-key hieronder nooit matchen en zou elk echt
    // lesmoment als een dubbele, losse rij naast zijn virtuele tegenhanger
    // verschijnen.
    const startTime = real.start_time.slice(0, 5);
    const key = `${real.lesson_date}|${startTime}`;
    const virtual = entries.get(key);
    entries.set(key, {
      date: real.lesson_date,
      startTime,
      durationMinutes: virtual?.durationMinutes ?? findSlotDuration(klas.lesson_slots, real.lesson_date, startTime),
      lessonId: real.id,
      status: real.status,
      notes: real.notes,
      activities: activitiesByLessonId.get(real.id) ?? [],
      holidayName: virtual?.holidayName ?? holidayNameByDate.get(real.lesson_date) ?? null,
    });
  }

  return [...entries.values()].sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
}

/**
 * Klas-detailpagina's databron: alle lesmomenten (virtueel + echt gemerged)
 * van één klas binnen [monthStart, monthEnd], chronologisch.
 */
export async function getClassLessonsForMonth(
  userId: string,
  classId: string,
  monthStart: string,
  monthEnd: string,
  holidayRegion: HolidayRegion | null,
): Promise<ClassLessonEntry[]> {
  const supabase = await getServerClient();
  const klas = await getClassById(classId);
  if (!klas || klas.user_id !== userId) return [];

  const { data: lessons, error } = await supabase
    .from("geplande_lessen")
    .select(LESSON_SELECT)
    .eq("class_id", classId)
    .gte("lesson_date", monthStart)
    .lte("lesson_date", monthEnd)
    .returns<LessonRow[]>();

  if (error) {
    throw new Error(`Kon lesmomenten niet ophalen: ${error.message}`);
  }

  const lessonRows = lessons ?? [];
  const activitiesByLessonId = await fetchLessonActivities(supabase, lessonRows.map((row) => row.id));
  const holidayNameByDate = holidayRegion ? await buildHolidayNameByDate(holidayRegion, monthStart, monthEnd) : new Map<string, string>();

  return buildClassLessonEntries(klas, monthStart, monthEnd, lessonRows, activitiesByLessonId, holidayNameByDate);
}

/**
 * Weekrooster-databron: lesmomenten van ALLE klassen van de gebruiker samen
 * binnen [weekStart, weekEnd], chronologisch — de databron voor
 * WeekSchedule.
 */
export async function getWeekLessons(
  userId: string,
  weekStart: string,
  weekEnd: string,
  holidayRegion: HolidayRegion | null,
): Promise<WeekLessonEntry[]> {
  const supabase = await getServerClient();
  const classes = await getClassesForUser(userId);
  if (classes.length === 0) return [];

  const classIds = classes.map((klas) => klas.id);
  const { data: lessons, error } = await supabase
    .from("geplande_lessen")
    .select(LESSON_SELECT)
    .in("class_id", classIds)
    .gte("lesson_date", weekStart)
    .lte("lesson_date", weekEnd)
    .returns<LessonRow[]>();

  if (error) {
    throw new Error(`Kon lesmomenten niet ophalen: ${error.message}`);
  }

  const lessonRows = lessons ?? [];
  const activitiesByLessonId = await fetchLessonActivities(supabase, lessonRows.map((row) => row.id));
  const holidayNameByDate = holidayRegion ? await buildHolidayNameByDate(holidayRegion, weekStart, weekEnd) : new Map<string, string>();

  const entries: WeekLessonEntry[] = [];
  for (const klas of classes) {
    const realForClass = lessonRows.filter((row) => row.class_id === klas.id);
    const classEntries = buildClassLessonEntries(klas, weekStart, weekEnd, realForClass, activitiesByLessonId, holidayNameByDate);
    for (const entry of classEntries) {
      entries.push({ ...entry, classId: klas.id, className: klas.name, doelgroep: klas.doelgroep });
    }
  }

  entries.sort((a, b) => (a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date)));
  return entries;
}

/**
 * Voor de dashboard-widget "planning van vandaag" — bouwt op getWeekLessons
 * voort (de week die vandaag bevat) en filtert tot vandaag, zodat het
 * widget altijd consistent is met het weekrooster.
 */
export async function getTodaysPlannedLessons(
  userId: string,
  holidayRegion: HolidayRegion | null,
): Promise<WeekLessonEntry[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { start, end } = getWeekRange(today);
  const weekLessons = await getWeekLessons(userId, start, end, holidayRegion);
  return weekLessons.filter((lesson) => lesson.date === today);
}

/**
 * Schoolvakanties voor een regio die (gedeeltelijk) binnen [rangeStart,
 * rangeEnd] vallen.
 */
export async function getSchoolHolidays(
  region: HolidayRegion,
  rangeStart: string,
  rangeEnd: string,
): Promise<SchoolHoliday[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("school_holidays")
    .select("id, region, name, start_date, end_date, school_year")
    .eq("region", region)
    .lte("start_date", rangeEnd)
    .gte("end_date", rangeStart)
    .order("start_date", { ascending: true })
    .returns<SchoolHoliday[]>();

  if (error) {
    throw new Error(`Kon schoolvakanties niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Voor de tweerichtingskoppeling op de activiteit-detailpagina: "Gepland
 * voor Groep 5A op 12 oktober". Vertrekt vanuit `les_activiteiten` (i.p.v.
 * een kolom op geplande_lessen zelf, sinds de meerdere-activiteiten-
 * rework) — RLS op les_activiteiten (owner-scoped) filtert dit al tot de
 * eigen rijen van de ingelogde gebruiker.
 */
export async function getPlannedLessonsForActivity(
  activityId: string,
): Promise<PlannedLessonForActivity[]> {
  const supabase = await getServerClient();

  const { data, error } = await supabase
    .from("les_activiteiten")
    .select("geplande_lessen(id, class_id, lesson_date, start_time, klassen(name))")
    .eq("activity_id", activityId)
    .returns<
      { geplande_lessen: { id: string; class_id: string; lesson_date: string; start_time: string; klassen: { name: string } | null } | null }[]
    >();

  if (error) {
    throw new Error(`Kon planning voor activiteit niet ophalen: ${error.message}`);
  }

  return (data ?? [])
    .map((row) => row.geplande_lessen)
    .filter((lesson): lesson is NonNullable<typeof lesson> => lesson !== null)
    .map((lesson) => ({
      id: lesson.id,
      class_id: lesson.class_id,
      class_name: lesson.klassen?.name ?? "Onbekende klas",
      lesson_date: lesson.lesson_date,
      // Genormaliseerd naar "HH:MM" (Postgres' `time`-kolom komt anders als
      // "HH:MM:SS" terug) — moet exact overeenkomen met de "les-<date>-
      // <startTime>"-DOM-id die LessonContainer zet, voor PlannedForBanner's
      // scroll-naar-lesmoment-link.
      start_time: lesson.start_time.slice(0, 5),
    }))
    .sort((a, b) => a.lesson_date.localeCompare(b.lesson_date));
}
