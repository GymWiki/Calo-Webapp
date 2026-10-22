import { WeekSchedule } from "@/components/planning/WeekSchedule";
import { getSchoolHolidays, getWeekLessons } from "@/lib/services/planning";
import type { HolidayRegion } from "@/types/planning";

/**
 * Server Component die de weekrooster-data ophaalt (lesmomenten + eventuele
 * schoolvakanties) — apart van page.tsx zodat de pagina 'm in een eigen
 * `<Suspense>` kan wrappen: de klassenkaarten (een snellere, enkele query)
 * renderen dan instant, alleen het rooster zelf wacht (achter een skeleton).
 */
export async function WeekScheduleSection({
  userId,
  weekStart,
  weekEnd,
  today,
  holidayRegion,
}: {
  userId: string;
  weekStart: string;
  weekEnd: string;
  today: string;
  holidayRegion: HolidayRegion | null;
}) {
  const [entries, holidays] = await Promise.all([
    getWeekLessons(userId, weekStart, weekEnd, holidayRegion),
    holidayRegion ? getSchoolHolidays(holidayRegion, weekStart, weekEnd) : Promise.resolve([]),
  ]);

  return <WeekSchedule weekStart={weekStart} entries={entries} holidays={holidays} today={today} />;
}
