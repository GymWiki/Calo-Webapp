import Link from "next/link";
import { CalendarDays, PartyPopper } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { WeekLessonEntry } from "@/types/planning";

/**
 * Dashboard-widget "planning van vandaag" — naar het voorbeeld van
 * ContributionStatusCard (Card-gebaseerd, geen eigen client-state nodig).
 * De hele kaart linkt naar het weekrooster op /profiel/planning — de
 * huidige week bevat per definitie vandaag, dus een aparte week-param is
 * niet nodig.
 */
export function TodaysPlanningCard({
  lessons,
  holidayName,
  hasClasses,
}: {
  lessons: WeekLessonEntry[];
  holidayName: string | null;
  hasClasses: boolean;
}) {
  const active = lessons.filter((lesson) => lesson.status !== "vervallen");
  const withActivity = active.filter((lesson) => lesson.activities.length > 0).length;

  return (
    <Link href="/profiel/planning" className="block">
      <Card className="animate-fade-up transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md">
        <CardContent className="flex items-start gap-3 py-5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-line-blue/10 text-line-blue">
            <CalendarDays className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Planning van vandaag</p>

            {!hasClasses ? (
              <p className="mt-0.5 text-sm text-muted-foreground">Nog geen klassen — begin met plannen.</p>
            ) : holidayName ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <PartyPopper className="size-4 shrink-0" aria-hidden="true" />
                Het is vakantie ({holidayName}).
              </p>
            ) : active.length === 0 ? (
              <p className="mt-0.5 text-sm text-muted-foreground">Geen lessen gepland vandaag.</p>
            ) : (
              <>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {withActivity}/{active.length}{" "}
                  {active.length === 1 ? "les van vandaag heeft" : "lessen van vandaag hebben"} een activiteit.
                </p>
                <ul className="mt-2 space-y-1">
                  {active.map((lesson) => (
                    <li key={`${lesson.classId}-${lesson.startTime}`} className="truncate text-sm">
                      <span className="font-medium">{lesson.className}</span>{" "}
                      <span className="text-muted-foreground">
                        — {lesson.activities.length > 0 ? `${lesson.activities.length} activiteit(en)` : "Nog leeg"}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
