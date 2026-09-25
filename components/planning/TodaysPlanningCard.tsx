import Link from "next/link";
import { CalendarDays, PartyPopper } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { PlannedLessonWithContext } from "@/types/planning";

/**
 * Dashboard-widget "planning van vandaag" — naar het voorbeeld van
 * ContributionStatusCard (Card-gebaseerd, geen eigen client-state nodig).
 * De hele kaart is een link naar de maandkalender van de huidige maand
 * ("ingezoomd op vandaag" — MonthCalendar markeert vandaag zelf al visueel,
 * dus verder inzoomen dan de juiste maand openen is hier niet nodig).
 */
export function TodaysPlanningCard({
  lessons,
  holidayName,
  hasClasses,
  month,
}: {
  lessons: PlannedLessonWithContext[];
  holidayName: string | null;
  hasClasses: boolean;
  month: string;
}) {
  const withActivity = lessons.filter((lesson) => lesson.activity_id !== null).length;

  return (
    <Link href={`/profiel/planning?maand=${month}`} className="block">
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
            ) : lessons.length === 0 ? (
              <p className="mt-0.5 text-sm text-muted-foreground">Geen lessen gepland vandaag.</p>
            ) : (
              <>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {withActivity}/{lessons.length}{" "}
                  {lessons.length === 1 ? "les van vandaag heeft" : "lessen van vandaag hebben"} een activiteit.
                </p>
                <ul className="mt-2 space-y-1">
                  {lessons.map((lesson) => (
                    <li key={lesson.id} className="truncate text-sm">
                      <span className="font-medium">{lesson.class_name}</span>{" "}
                      <span className="text-muted-foreground">— {lesson.activityTitel ?? "Nog te bepalen"}</span>
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
