"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { WeekLessonBlock } from "@/components/planning/WeekLessonBlock";
import { Button } from "@/components/ui/button";
import { useSwipeNavigation } from "@/lib/hooks/useSwipeNavigation";
import { addDays, getISOWeekNumber, getNextWeek, getPreviousWeek } from "@/lib/planningSchedule";
import { cn } from "@/lib/utils";
import type { SchoolHoliday, WeekLessonEntry } from "@/types/planning";

const WEEKDAY_LABELS_FULL = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];

function holidayForDate(holidays: SchoolHoliday[], date: string): SchoolHoliday | null {
  return holidays.find((holiday) => date >= holiday.start_date && date <= holiday.end_date) ?? null;
}

function formatDayShort(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

/**
 * Weekrooster op /profiel/planning — vervangt de vorige maandkalender.
 * Weeknavigatie (chevrons + swipe), mobiel verticaal gestapeld, desktop
 * kolommen per dag (`lg:grid`). `holidays` komt los van `entries` binnen
 * (i.p.v. alleen de per-lesmoment holidayName te gebruiken) zodat een
 * volledig lesloze vakantiedag ook een banner krijgt.
 */
export function WeekSchedule({
  weekStart,
  entries,
  holidays,
  today,
}: {
  weekStart: string;
  entries: WeekLessonEntry[];
  holidays: SchoolHoliday[];
  today: string;
}) {
  const router = useRouter();

  function goToWeek(nextWeekStart: string) {
    router.push(`/profiel/planning?week=${nextWeekStart}`);
  }

  const swipeHandlers = useSwipeNavigation({
    onSwipeLeft: () => goToWeek(getNextWeek(weekStart)),
    onSwipeRight: () => goToWeek(getPreviousWeek(weekStart)),
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const entriesByDate = new Map<string, WeekLessonEntry[]>();
  for (const entry of entries) {
    const list = entriesByDate.get(entry.date) ?? [];
    list.push(entry);
    entriesByDate.set(entry.date, list);
  }

  // Weekend alleen tonen als er die dag daadwerkelijk lessen zijn — de
  // meeste klassen hebben doordeweekse weekmomenten, permanent twee lege
  // dagen tonen is ruimteverspilling.
  const visibleDays = days.filter((date, index) => index < 5 || (entriesByDate.get(date)?.length ?? 0) > 0);

  const weekNumber = getISOWeekNumber(weekStart);
  const rangeLabel = `${formatDayShort(days[0])} – ${formatDayShort(days[6])}`;

  return (
    <div className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b p-4">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => goToWeek(getPreviousWeek(weekStart))}
          aria-label="Vorige week"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-semibold">
          Week {weekNumber} · {rangeLabel}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => goToWeek(getNextWeek(weekStart))}
          aria-label="Volgende week"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div
        className="flex flex-col gap-3 p-3 lg:grid lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))] lg:items-start lg:gap-2"
        onTouchStart={swipeHandlers.onTouchStart}
        onTouchEnd={swipeHandlers.onTouchEnd}
      >
        {visibleDays.map((date) => {
          const dayEntries = (entriesByDate.get(date) ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime));
          const holiday = holidayForDate(holidays, date);
          const isToday = date === today;
          const weekdayIndex = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;

          return (
            <div
              key={date}
              className={cn(
                "rounded-xl border p-2.5",
                isToday && "border-primary/50 bg-primary/5",
                holiday && "bg-amber-500/5",
              )}
            >
              <p className={cn("text-sm font-semibold", isToday && "text-primary")}>
                {WEEKDAY_LABELS_FULL[weekdayIndex - 1]}{" "}
                <span className="font-normal text-muted-foreground">{formatDayShort(date)}</span>
              </p>

              {holiday && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">{holiday.name}</p>}

              <div className="mt-2 space-y-1.5">
                {dayEntries.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Geen lessen</p>
                ) : (
                  dayEntries.map((entry) => (
                    <WeekLessonBlock key={`${entry.classId}-${entry.date}-${entry.startTime}`} entry={entry} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
