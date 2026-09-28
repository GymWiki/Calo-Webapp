import { cookies } from "next/headers";
import { LessonEntriesList } from "@/components/planning/LessonEntriesList";
import { getAllActivities, getSavedActivities, getTeamActivities } from "@/lib/services/activities";
import { getClassLessonsForMonth } from "@/lib/services/planning";
import { getTeamLibraryItemsByActivity, getTeamTags } from "@/lib/services/teamLibrary";
import { createClient } from "@/utils/supabase/server";
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
  teamId,
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
  /** Actief team van de gebruiker (null = geen team) — voedt het
   * "Teambibliotheek"-tabblad in AddActivitiesToLessonSheet, zie de brief. */
  teamId: string | null;
}) {
  const supabase = createClient(await cookies());

  const [entries, savedActivities, libraryActivities, teamActivities, teamItemsByActivity, allTeamTags] =
    await Promise.all([
      getClassLessonsForMonth(userId, classId, monthStart, monthEnd, holidayRegion),
      getSavedActivities(userId),
      getAllActivities(),
      teamId ? getTeamActivities(teamId) : Promise.resolve([]),
      teamId ? getTeamLibraryItemsByActivity(supabase, teamId) : Promise.resolve(new Map()),
      teamId ? getTeamTags(supabase, teamId) : Promise.resolve([]),
    ]);

  const teamEntries = teamActivities
    .map((activity) => {
      const item = teamItemsByActivity.get(activity.id);
      return item ? { activity, item } : null;
    })
    .filter((entry) => entry !== null);

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
      teamEntries={teamEntries}
      allTeamTags={allTeamTags}
    />
  );
}
