import { LessonEntriesList } from "@/components/planning/LessonEntriesList";
import { getAllActivities, getSavedActivities } from "@/lib/services/activities";
import { getClassLessonsForMonth } from "@/lib/services/planning";
import type { HolidayRegion, PlanningClass } from "@/types/planning";

/**
 * Server Component die de zware, meervoudige data-fetch doet (lesmomenten +
 * opgeslagen/bibliotheek-activiteiten) — bewust een APARTE async component
 * i.p.v. top-level awaits in page.tsx, zodat de pagina 'm in een eigen
 * `<Suspense>` kan wrappen: de header/maandnavigatie in page.tsx/
 * ClassLessonList renderen dan instant, alleen dit stuk wacht (achter een
 * skeleton) op de databron.
 */
export async function ClassLessonEntriesSection({
  userId,
  classId,
  klas,
  monthStart,
  monthEnd,
  month,
  today,
  holidayRegion,
  hasFullLibraryAccess,
}: {
  userId: string;
  classId: string;
  klas: PlanningClass;
  monthStart: string;
  monthEnd: string;
  month: string;
  today: string;
  holidayRegion: HolidayRegion | null;
  hasFullLibraryAccess: boolean;
}) {
  const [entries, savedActivities, libraryActivities] = await Promise.all([
    getClassLessonsForMonth(userId, classId, monthStart, monthEnd, holidayRegion),
    getSavedActivities(userId),
    getAllActivities(),
  ]);

  return (
    <LessonEntriesList
      klas={klas}
      month={month}
      entries={entries}
      today={today}
      savedActivities={savedActivities}
      libraryActivities={libraryActivities}
      hasFullLibraryAccess={hasFullLibraryAccess}
      currentUserId={userId}
    />
  );
}
