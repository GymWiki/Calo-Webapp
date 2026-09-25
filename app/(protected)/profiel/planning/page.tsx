import { redirect } from "next/navigation";
import { CalendarRange } from "lucide-react";

import { AddClassButton } from "@/components/planning/AddClassButton";
import { ClassCard } from "@/components/planning/ClassCard";
import { HolidayRegionHint } from "@/components/planning/HolidayRegionHint";
import { WeekSchedule } from "@/components/planning/WeekSchedule";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getWeekRange, getWeekStart } from "@/lib/planningSchedule";
import { getClassesForUser, getSchoolHolidays, getWeekLessons } from "@/lib/services/planning";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function resolveWeekStart(raw: string | undefined): string {
  const today = new Date().toISOString().slice(0, 10);
  return getWeekStart(raw && DATE_PATTERN.test(raw) ? raw : today);
}

export default async function ProfielPlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { week } = await searchParams;
  const weekStart = resolveWeekStart(week);
  const { end: weekEnd } = getWeekRange(weekStart);
  const today = new Date().toISOString().slice(0, 10);

  const [classes, entries] = await Promise.all([
    getClassesForUser(profile.id),
    getWeekLessons(profile.id, weekStart, weekEnd, profile.holiday_region),
  ]);

  const holidays = profile.holiday_region ? await getSchoolHolidays(profile.holiday_region, weekStart, weekEnd) : [];

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6 sm:px-8 sm:py-10 lg:max-w-6xl">
      <PageHeader
        eyebrow="Profiel"
        title="Planning"
        description="Klassen en een weekrooster met geplande lesmomenten."
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

          <WeekSchedule weekStart={weekStart} entries={entries} holidays={holidays} today={today} />
        </>
      )}
    </main>
  );
}
