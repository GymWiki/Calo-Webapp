"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { useSwipeNavigation } from "@/lib/hooks/useSwipeNavigation";
import { getNextMonth, getPreviousMonth } from "@/lib/planningSchedule";
import type { PlanningClass } from "@/types/planning";

/**
 * Klas-detailpagina's instant-renderende schaal: maandnavigatie (chevrons +
 * swipe) — heeft geen lesmoment-data nodig, dus rendert altijd meteen, ook
 * terwijl `children` (de eigenlijke lesmomenten-lijst, zie
 * ClassLessonEntriesSection.tsx) nog achter zijn eigen Suspense-boundary op
 * data wacht. Dit is de instant-navigatie-fix: voorheen blokkeerde de hele
 * pagina — inclusief deze balk — op de volledige data-fetch.
 */
export function ClassLessonList({
  klas,
  month,
  children,
}: {
  klas: PlanningClass;
  month: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function goToMonth(nextMonth: string) {
    router.push(`/profiel/planning/${klas.id}?maand=${nextMonth}`);
  }

  const swipeHandlers = useSwipeNavigation({
    onSwipeLeft: () => goToMonth(getNextMonth(month)),
    onSwipeRight: () => goToMonth(getPreviousMonth(month)),
  });

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
        ) : (
          children
        )}
      </div>
    </div>
  );
}
