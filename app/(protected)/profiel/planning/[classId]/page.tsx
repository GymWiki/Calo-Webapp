import { notFound, redirect } from "next/navigation";

import { BackButton } from "@/components/BackButton";
import { ClassLessonList } from "@/components/planning/ClassLessonList";
import { PageHeader } from "@/components/page-header";
import { getMonthRange } from "@/lib/planningSchedule";
import { getUserPermissions } from "@/lib/permissions";
import { getAllActivities, getSavedActivities } from "@/lib/services/activities";
import { getClassById, getClassLessonsForMonth } from "@/lib/services/planning";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { DOELGROEP_LABELS } from "@/types/activity";
import { WEEKDAY_LABELS } from "@/types/planning";

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

function resolveMonth(raw: string | undefined): string {
  if (raw && MONTH_PATTERN.test(raw)) return raw;
  return new Date().toISOString().slice(0, 7);
}

export default async function ProfielPlanningClassPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<{ maand?: string }>;
}) {
  const profile = await getCurrentUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const { classId } = await params;
  const klas = await getClassById(classId);

  if (!klas || klas.user_id !== profile.id) {
    notFound();
  }

  const { maand } = await searchParams;
  const month = resolveMonth(maand);
  const { start, end } = getMonthRange(month);
  const today = new Date().toISOString().slice(0, 10);

  const [entries, savedActivities, libraryActivities] = await Promise.all([
    getClassLessonsForMonth(profile.id, classId, start, end, profile.holiday_region),
    getSavedActivities(profile.id),
    getAllActivities(),
  ]);

  const { hasFullLibraryAccess } = getUserPermissions(profile);
  const slotSummary = klas.lesson_slots
    .map((slot) => `${WEEKDAY_LABELS[slot.weekday]} ${slot.startTime}`)
    .join(" · ");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <BackButton fallbackHref="/profiel/planning" fallbackLabel="Planning" className="-ml-2" />

      <PageHeader
        eyebrow={DOELGROEP_LABELS[klas.doelgroep]}
        title={klas.name}
        description={slotSummary || "Nog geen weekmoment ingesteld."}
      />

      <ClassLessonList
        klas={klas}
        month={month}
        entries={entries}
        today={today}
        savedActivities={savedActivities}
        libraryActivities={libraryActivities}
        hasFullLibraryAccess={hasFullLibraryAccess}
        currentUserId={profile.id}
      />
    </main>
  );
}
