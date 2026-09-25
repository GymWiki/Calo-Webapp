import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";

import { BackButton } from "@/components/BackButton";
import { ClassLessonEntriesSection } from "@/components/planning/ClassLessonEntriesSection";
import { ClassLessonList } from "@/components/planning/ClassLessonList";
import { LessonEntriesSkeleton } from "@/components/planning/LessonEntriesSkeleton";
import { PageHeader } from "@/components/page-header";
import { getMonthRange } from "@/lib/planningSchedule";
import { getUserPermissions } from "@/lib/permissions";
import { getClassById } from "@/lib/services/planning";
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

      {/* klas/profiel/maand komen hierboven al uit snelle, enkele-rij-
          queries — alleen de zwaardere lesmoment-/activiteiten-fetch
          (ClassLessonEntriesSection) wacht hier nog op, achter een eigen
          Suspense-boundary. Dit is de instant-navigatie-fix: de balk boven
          deze Suspense (BackButton/PageHeader/maandnavigatie in
          ClassLessonList) rendert altijd meteen. */}
      <ClassLessonList klas={klas} month={month}>
        <Suspense key={month} fallback={<LessonEntriesSkeleton />}>
          <ClassLessonEntriesSection
            userId={profile.id}
            classId={classId}
            klas={klas}
            monthStart={start}
            monthEnd={end}
            month={month}
            today={today}
            holidayRegion={profile.holiday_region}
            hasFullLibraryAccess={hasFullLibraryAccess}
          />
        </Suspense>
      </ClassLessonList>
    </main>
  );
}
