"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

import { AddActivitiesToLessonSheet } from "@/components/planning/AddActivitiesToLessonSheet";
import { LessonContainer } from "@/components/planning/LessonContainer";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useSwipeNavigation } from "@/lib/hooks/useSwipeNavigation";
import { getNextMonth, getPreviousMonth } from "@/lib/planningSchedule";
import type { Activity } from "@/types/activity";
import type { ClassLessonEntry, PlanningClass } from "@/types/planning";

function entryDomId(date: string, startTime: string): string {
  return `les-${date}-${startTime}`;
}

/**
 * Klas-detailpagina's kern: maandnavigatie (chevrons + swipe) en een
 * chronologische lijst van lesmoment-containers voor die maand. Scrollt bij
 * mount/maandwissel naar het lesmoment uit de URL-hash (vanuit een klik op
 * een WeekLessonBlock), of anders naar de eerstvolgende les — beide
 * doelen delen dezelfde DOM-id (`les-<date>-<startTime>`) die
 * LessonContainer op zichzelf zet.
 */
export function ClassLessonList({
  klas,
  month,
  entries,
  today,
  savedActivities,
  libraryActivities,
  hasFullLibraryAccess,
  currentUserId,
}: {
  klas: PlanningClass;
  month: string;
  entries: ClassLessonEntry[];
  today: string;
  savedActivities: Activity[];
  libraryActivities: Activity[];
  hasFullLibraryAccess: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [addActivitiesEntry, setAddActivitiesEntry] = useState<ClassLessonEntry | null>(null);

  function goToMonth(nextMonth: string) {
    router.push(`/profiel/planning/${klas.id}?maand=${nextMonth}`);
  }

  const swipeHandlers = useSwipeNavigation({
    onSwipeLeft: () => goToMonth(getNextMonth(month)),
    onSwipeRight: () => goToMonth(getPreviousMonth(month)),
  });

  const nextEntryId = useMemo(() => {
    const next = entries.find((entry) => entry.date >= today);
    return next ? entryDomId(next.date, next.startTime) : null;
  }, [entries, today]);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const targetId = hash || nextEntryId;
    if (!targetId) return;
    document.getElementById(targetId)?.scrollIntoView({ behavior: hash ? "smooth" : "auto", block: "center" });
    // Alleen bij mount/maandwissel scrollen — niet bij elke re-render (bijv.
    // na het opslaan van een notitie zou anders steeds opnieuw gescrold
    // worden, en nextEntryId/entries wijzigen dan ook net licht).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 rounded-2xl border bg-card p-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => goToMonth(getPreviousMonth(month))}
          aria-label="Vorige maand"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-semibold capitalize">{monthLabel}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => goToMonth(getNextMonth(month))}
          aria-label="Volgende maand"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="space-y-3" {...swipeHandlers}>
        {klas.lesson_slots.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Nog geen weekmoment"
            description="Voeg een vast weekmoment toe aan deze klas om hier lesmomenten te zien."
          />
        ) : entries.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="Geen lesmomenten deze maand"
            description="Blader naar een andere maand."
          />
        ) : (
          entries.map((entry) => (
            <LessonContainer
              key={`${entry.date}-${entry.startTime}`}
              entry={entry}
              classId={klas.id}
              isPast={entry.date < today}
              isNext={entryDomId(entry.date, entry.startTime) === nextEntryId}
              onOpenAddActivities={setAddActivitiesEntry}
            />
          ))
        )}
      </div>

      <AddActivitiesToLessonSheet
        open={addActivitiesEntry !== null}
        onOpenChange={(open) => !open && setAddActivitiesEntry(null)}
        classId={klas.id}
        doelgroep={klas.doelgroep}
        entry={addActivitiesEntry}
        savedActivities={savedActivities}
        libraryActivities={libraryActivities}
        hasFullLibraryAccess={hasFullLibraryAccess}
        currentUserId={currentUserId}
      />
    </div>
  );
}
