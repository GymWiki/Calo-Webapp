"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Link2Off } from "lucide-react";

import { updatePlannedLesson } from "@/actions/planning";
import { Button } from "@/components/ui/button";
import { SELECT_FIELD_CLASS } from "@/components/planning/planning-ui";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useOptimisticAction } from "@/lib/hooks/useOptimisticAction";
import {
  PLANNED_LESSON_STATUSES,
  PLANNED_LESSON_STATUS_LABELS,
  type PlannedLessonStatus,
  type PlannedLessonWithContext,
} from "@/types/planning";

function formatLessonDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/**
 * Body — apart van DayLessonSheet en geremount per lesmoment (zie de `key`
 * op de aanroep hieronder), zodat de status-optimistic-state altijd vers uit
 * de props van het net geopende lesmoment start i.p.v. via een
 * useEffect-reset (zelfde afweging als ClassFormDialog.tsx's
 * react-hooks/set-state-in-effect-vermijding).
 */
function DayLessonSheetBody({
  lesson,
  onPickActivity,
}: {
  lesson: PlannedLessonWithContext;
  onPickActivity: () => void;
}) {
  const router = useRouter();

  const {
    value: status,
    run: runStatus,
    isPending: statusPending,
  } = useOptimisticAction(lesson.status, (next: PlannedLessonStatus) => updatePlannedLesson({ id: lesson.id, status: next }), {
    onSuccess: () => router.refresh(),
  });

  const { run: runUnlink, isPending: unlinkPending } = useOptimisticAction(
    false,
    () => updatePlannedLesson({ id: lesson.id, activityId: null, status: "nog_te_bepalen" }),
    { onSuccess: () => router.refresh() },
  );

  return (
    <>
      <SheetHeader>
        <SheetTitle>{lesson.class_name}</SheetTitle>
        <SheetDescription className="flex items-center gap-1.5 capitalize">
          <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
          {formatLessonDate(lesson.lesson_date)} · {lesson.start_time.slice(0, 5)}
        </SheetDescription>
      </SheetHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
        <div className="space-y-1.5">
          <label htmlFor="lesson-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="lesson-status"
            value={status}
            onChange={(event) => runStatus(event.target.value as PlannedLessonStatus)}
            disabled={statusPending}
            className={SELECT_FIELD_CLASS}
          >
            {PLANNED_LESSON_STATUSES.map((value) => (
              <option key={value} value={value}>
                {PLANNED_LESSON_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {lesson.activity_id ? (
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <p className="text-sm font-medium">{lesson.activityTitel}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onPickActivity}>
                Wijzig
              </Button>
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/activiteit/${lesson.activity_id}`}>Bekijken</Link>
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground hover:text-destructive"
              disabled={unlinkPending}
              onClick={() => runUnlink(true)}
            >
              <Link2Off className="size-4" />
              Ontkoppelen
            </Button>
          </div>
        ) : (
          <Button type="button" onClick={onPickActivity}>
            Kies activiteit
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * Compacte preview/bewerk-sheet voor één lesmoment (dag-chip-klik in
 * MonthCalendar) — status wijzigen, gekoppelde activiteit bekijken/wijzigen/
 * ontkoppelen, of (nog niet gekoppeld) een activiteit kiezen.
 * `onPickActivity` sluit deze sheet niet zelf — dat doet de aanroeper
 * (MonthCalendar), die daarna ActivityPickerSheet opent; twee tegelijk open
 * Radix-Sheets stapelen niet betrouwbaar genoeg om hier zelf te nesten.
 */
export function DayLessonSheet({
  lesson,
  onOpenChange,
  onPickActivity,
}: {
  lesson: PlannedLessonWithContext | null;
  onOpenChange: (open: boolean) => void;
  onPickActivity: (lesson: PlannedLessonWithContext) => void;
}) {
  return (
    <Sheet open={lesson !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {lesson && (
          <DayLessonSheetBody key={lesson.id} lesson={lesson} onPickActivity={() => onPickActivity(lesson)} />
        )}
      </SheetContent>
    </Sheet>
  );
}
