import Link from "next/link";
import { CalendarClock } from "lucide-react";

import type { PlannedLessonForActivity } from "@/types/planning";

function formatPlannedDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
  });
}

/**
 * Tweerichtingskoppeling met de Planning-functie: toont op de (private)
 * activiteit-detailpagina waar/wanneer deze activiteit al aan een lesmoment
 * is gekoppeld. Server-renderbaar (geen client-state nodig) zodat hij in
 * beide render-branches van app/(protected)/activiteit/[id]/page.tsx
 * hergebruikt kan worden zonder een aparte client-boundary te introduceren.
 */
export function PlannedForBanner({
  plannedLessons,
}: {
  plannedLessons: PlannedLessonForActivity[];
}) {
  if (plannedLessons.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="text-foreground">
        {plannedLessons.map((lesson, index) => (
          <span key={lesson.id}>
            {index > 0 && ", "}
            Gepland voor{" "}
            <Link
              href={`/profiel/planning?maand=${lesson.lesson_date.slice(0, 7)}`}
              className="font-medium text-primary hover:underline"
            >
              {lesson.class_name}
            </Link>{" "}
            op {formatPlannedDate(lesson.lesson_date)}
          </span>
        ))}
      </p>
    </div>
  );
}
