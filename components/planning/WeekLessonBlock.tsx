import Link from "next/link";

import { cn } from "@/lib/utils";
import { DOELGROEP_LABELS } from "@/types/activity";
import type { WeekLessonEntry } from "@/types/planning";

/**
 * Compact lesblok binnen WeekSchedule — tijd/klasnaam/doelgroep +
 * activiteiten-aantal (of "Nog leeg" als waarschuwing). Klik navigeert naar
 * de klas-detailpagina, gescrold naar dit lesmoment (zie ClassLessonList's
 * hash-scroll, dezelfde `les-<date>-<startTime>`-DOM-id als LessonContainer
 * zichzelf geeft).
 */
export function WeekLessonBlock({ entry }: { entry: WeekLessonEntry }) {
  const activityCount = entry.activities.length;
  const isCancelled = entry.status === "vervallen";
  const isEmpty = !isCancelled && activityCount === 0;

  return (
    <Link
      href={`/profiel/planning/${entry.classId}?maand=${entry.date.slice(0, 7)}#les-${entry.date}-${entry.startTime}`}
      className={cn(
        "block rounded-lg border px-2.5 py-2 text-xs transition-colors duration-150 ease-brand hover:bg-accent",
        isCancelled && "border-dashed opacity-60",
        isEmpty && "border-amber-400/60 bg-amber-500/5",
        !isCancelled && !isEmpty && "border-input bg-background",
      )}
    >
      <p className="font-medium">
        {entry.startTime.slice(0, 5)} · {entry.className}
      </p>
      <p className="text-muted-foreground">{DOELGROEP_LABELS[entry.doelgroep]}</p>
      <p className={cn("mt-0.5", isEmpty && "font-medium text-amber-700 dark:text-amber-400")}>
        {isCancelled
          ? "Vervallen"
          : isEmpty
            ? "Nog leeg"
            : `${activityCount} ${activityCount === 1 ? "activiteit" : "activiteiten"}`}
      </p>
    </Link>
  );
}
