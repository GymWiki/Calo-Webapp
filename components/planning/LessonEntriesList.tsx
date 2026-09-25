"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";

import { AddActivitiesToLessonSheet } from "@/components/planning/AddActivitiesToLessonSheet";
import { LessonContainer } from "@/components/planning/LessonContainer";
import { EmptyState } from "@/components/empty-state";
import type { Activity } from "@/types/activity";
import type { ClassLessonEntry, PlanningClass } from "@/types/planning";

function entryDomId(date: string, startTime: string): string {
  return `les-${date}-${startTime}`;
}

/**
 * De daadwerkelijke lesmomenten-lijst — apart van ClassLessonList (de
 * maandnavigatie-schaal eromheen) zodat alleen dit stuk achter een
 * Suspense-boundary kan wachten op data (zie
 * components/planning/ClassLessonEntriesSection.tsx, de Server Component
 * die dit met echte data vult): de maandnavigatiebalk zelf heeft geen
 * entries nodig en mag dus nooit op deze fetch wachten.
 */
export function LessonEntriesList({
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
  const [addActivitiesEntry, setAddActivitiesEntry] = useState<ClassLessonEntry | null>(null);

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

  if (entries.length === 0) {
    return (
      <EmptyState icon={CalendarClock} title="Geen lesmomenten deze maand" description="Blader naar een andere maand." />
    );
  }

  return (
    <>
      {entries.map((entry) => (
        <LessonContainer
          key={`${entry.date}-${entry.startTime}`}
          entry={entry}
          classId={klas.id}
          isPast={entry.date < today}
          isNext={entryDomId(entry.date, entry.startTime) === nextEntryId}
          onOpenAddActivities={setAddActivitiesEntry}
        />
      ))}

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
    </>
  );
}
