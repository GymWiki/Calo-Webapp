"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getMonthGridDays, getNextMonth, getPreviousMonth } from "@/lib/planningSchedule";
import { cn } from "@/lib/utils";

const WEEKDAY_SHORT = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

/**
 * Compacte maand-grid voor de datumstap van AddToPlanningSheet — dezelfde
 * grid-berekening als de klas-detailpagina (getMonthGridDays), maar zonder
 * les-containers en met eigen prev/next zodat hij op zichzelf staat.
 * `markedDates` toont een stipje op datums met een al bestaand lesmoment
 * zonder gekoppelde activiteiten voor de gekozen klas.
 */
export function MiniMonthPicker({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  markedDates,
  today,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  markedDates: Set<string>;
  today: string;
}) {
  const days = getMonthGridDays(month);
  const monthLabel = new Date(`${month}-01T00:00:00Z`).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => onMonthChange(getPreviousMonth(month))}
          aria-label="Vorige maand"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-medium capitalize">{monthLabel}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={() => onMonthChange(getNextMonth(month))}
          aria-label="Volgende maand"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground">
        {WEEKDAY_SHORT.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = day.date === selectedDate;
          const isMarked = markedDates.has(day.date);
          const isToday = day.date === today;

          return (
            <button
              key={day.date}
              type="button"
              onClick={() => onSelectDate(day.date)}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md text-xs transition-colors duration-150 ease-brand hover:bg-accent",
                !day.inCurrentMonth && "text-muted-foreground/40",
                isToday && !isSelected && "font-semibold text-primary",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary",
              )}
            >
              {Number(day.date.slice(8, 10))}
              {isMarked && !isSelected && (
                <span
                  className="absolute bottom-0.5 size-1 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
