import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";

import { AddClassButton } from "@/components/planning/AddClassButton";
import { ClassCard } from "@/components/planning/ClassCard";
import { HolidayRegionHint } from "@/components/planning/HolidayRegionHint";
import { MonthCalendar } from "@/components/planning/MonthCalendar";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getMonthRange } from "@/lib/planningSchedule";
import { getAllActivities } from "@/lib/services/activities";
import { getClassesForUser, getPlannedLessonsForMonth, getSchoolHolidays } from "@/lib/services/planning";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function resolveMonth(raw: string | undefined): string {
  if (raw && MONTH_PATTERN.test(raw)) return raw;
  return new Date().toISOString().slice(0, 7);
}

export default async function ProfielPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ maand?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { maand } = await searchParams;
  const month = resolveMonth(maand);
  const { start, end } = getMonthRange(month);
  const today = new Date().toISOString().slice(0, 10);

  const [classes, lessons, activities] = await Promise.all([
    getClassesForUser(profile.id),
    getPlannedLessonsForMonth(profile.id, start, end),
    getAllActivities(),
  ]);

  const holidays = profile.holiday_region
    ? await getSchoolHolidays(profile.holiday_region, start, end)
    : [];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-6xl">
      <PageHeader
        eyebrow="Profiel"
        title="Planning"
        description="Klassen en een maandkalender met geplande lesmomenten."
        action={<AddClassButton />}
      />

      {classes.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nog geen klassen"
          description="Maak een klas aan met vaste weekmomenten om te beginnen met plannen."
          action={<AddClassButton />}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((klas) => (
              <ClassCard key={klas.id} klas={klas} />
            ))}
          </div>

          {!profile.holiday_region && <HolidayRegionHint />}

          <MonthCalendar month={month} lessons={lessons} holidays={holidays} activities={activities} today={today} />
        </>
      )}
    </main>
  );
}
