"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { updatePlannedLesson } from "@/actions/planning";
import { Button } from "@/components/ui/button";
import { ActivityPickerSheet } from "@/components/planning/ActivityPickerSheet";
import { DayLessonSheet } from "@/components/planning/DayLessonSheet";
import { getMonthGridDays, getNextMonth, getPreviousMonth } from "@/lib/planningSchedule";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/activity";
import type { PlannedLessonWithContext, SchoolHoliday } from "@/types/planning";

const WEEKDAY_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
// Handgerolde swipe-drempel: geen bestaand swipe-patroon in deze codebase om
// te hergebruiken. 50px horizontale beweging telt als een maandwissel-swipe,
// een verticale drift van meer dan 60px wordt genegeerd zodat verticaal
// scrollen op mobiel niet per ongeluk een maandwissel triggert.
const SWIPE_THRESHOLD_X = 50;
const SWIPE_MAX_DRIFT_Y = 60;

function holidayForDate(holidays: SchoolHoliday[], date: string): SchoolHoliday | null {
  return holidays.find((holiday) => date >= holiday.start_date && date <= holiday.end_date) ?? null;
}

/**
 * Gedeelde maandkalender voor alle klassen van de gebruiker samen — geen
 * per-klas route meer (zie het planbestand voor deze rework). Chevron- en
 * swipe-navigatie doen een `router.push` met een nieuwe `?maand=`-param
 * (server-rendered per wissel), dag-chips openen DayLessonSheet, en het
 * kiezen/wijzigen van een activiteit gebeurt via de bestaande
 * ActivityPickerSheet — als sibling-sheet i.p.v. genest in DayLessonSheet.
 */
export function MonthCalendar({
  month,
  lessons,
  holidays,
  activities,
  today,
}: {
  month: string;
  lessons: PlannedLessonWithContext[];
  holidays: SchoolHoliday[];
  activities: Activity[];
  today: string;
}) {
  const router = useRouter();
  const days = getMonthGridDays(month);
  const [selectedLesson, setSelectedLesson] = useState<PlannedLessonWithContext | null>(null);
  const [pickerLesson, setPickerLesson] = useState<PlannedLessonWithContext | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  function goToMonth(nextMonth: string) {
    router.push(`/profiel/planning?maand=${nextMonth}`);
  }

  function handleTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: React.TouchEvent) {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_X || Math.abs(deltaY) > SWIPE_MAX_DRIFT_Y) return;

    goToMonth(deltaX > 0 ? getPreviousMonth(month) : getNextMonth(month));
  }

  function handlePickActivity(lesson: PlannedLessonWithContext) {
    setSelectedLesson(null);
    setPickerLesson(lesson);
  }

  async function handleActivitySelected(activity: Activity) {
    const lesson = pickerLesson;
    if (!lesson) return;
    setPickerLesson(null);

    const result = await updatePlannedLesson({ id: lesson.id, activityId: activity.id });
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    toast.success("Activiteit gekoppeld.");
    router.refresh();
  }

  const lessonsByDate = new Map<string, PlannedLessonWithContext[]>();
  for (const lesson of lessons) {
    const forDate = lessonsByDate.get(lesson.lesson_date) ?? [];
    forDate.push(lesson);
    lessonsByDate.set(lesson.lesson_date, forDate);
  }

  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border bg-card shadow-brand-sm">
      <div className="flex items-center justify-between gap-2 border-b p-4">
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

      <div className="grid grid-cols-7 gap-px border-b bg-border text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_SHORT.map((label) => (
          <div key={label} className="bg-card py-2">
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px bg-border" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {days.map((day) => {
          const dayLessons = lessonsByDate.get(day.date) ?? [];
          const holiday = holidayForDate(holidays, day.date);
          const isToday = day.date === today;
          const isFirstHolidayDay = holiday?.start_date === day.date;

          return (
            <div
              key={day.date}
              className={cn(
                "relative flex min-h-[88px] flex-col gap-1 bg-card p-1.5 sm:min-h-[104px] sm:p-2",
                !day.inCurrentMonth && "opacity-40",
                holiday && "bg-amber-500/10",
              )}
            >
              <span
                className={cn(
                  "flex size-6 items-center justify-center rounded-full text-xs",
                  isToday && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {Number(day.date.slice(8, 10))}
              </span>

              {isFirstHolidayDay && (
                <span className="truncate text-[10px] font-medium text-amber-700 dark:text-amber-400">
                  {holiday.name}
                </span>
              )}

              <div className="flex flex-1 flex-col gap-1 overflow-hidden">
                {dayLessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setSelectedLesson(lesson)}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors duration-150 ease-brand",
                      lesson.activity_id
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "bg-muted text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {lesson.class_name}
                    {lesson.activity_id ? ` · ${lesson.activityTitel}` : " · Nog te bepalen"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <DayLessonSheet
        lesson={selectedLesson}
        onOpenChange={(open) => !open && setSelectedLesson(null)}
        onPickActivity={handlePickActivity}
      />

      <ActivityPickerSheet
        open={pickerLesson !== null}
        onOpenChange={(open) => !open && setPickerLesson(null)}
        activities={activities}
        defaultLeerlijn={null}
        onSelect={handleActivitySelected}
      />
    </div>
  );
}
