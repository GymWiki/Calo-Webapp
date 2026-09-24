"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { updatePlannedLesson } from "@/actions/planning";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityPickerSheet } from "@/components/planning/ActivityPickerSheet";
import { SELECT_FIELD_CLASS } from "@/components/planning/planning-ui";
import { useOptimisticAction } from "@/lib/hooks/useOptimisticAction";
import { getCategoryColor } from "@/lib/constants/categoryColors";
import { getCategoryForLearningLine } from "@/lib/constants/learningLines";
import { getWeekStart } from "@/lib/planningSchedule";
import { cn } from "@/lib/utils";
import {
  PLANNED_LESSON_STATUSES,
  PLANNED_LESSON_STATUS_LABELS,
  type PlannedLessonStatus,
  type PlannedLessonWithContext,
} from "@/types/planning";
import type { Activity } from "@/types/activity";

function formatWeekLabel(weekStart: string): string {
  const date = new Date(`${weekStart}T00:00:00Z`);
  return `Week van ${date.toLocaleDateString("nl-NL", { day: "numeric", month: "long" })}`;
}

function formatLessonDate(lessonDate: string): string {
  const date = new Date(`${lessonDate}T00:00:00Z`);
  return date.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

function formatTimeRange(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.slice(0, 5).split(":").map(Number);
  const endTotalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(endTotalMinutes / 60) % 24;
  const endMinutes = endTotalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}–${pad(endHours)}:${pad(endMinutes)}`;
}

function groupLessonsByWeek(lessons: PlannedLessonWithContext[]) {
  const groups = new Map<string, PlannedLessonWithContext[]>();
  for (const lesson of lessons) {
    const weekStart = getWeekStart(lesson.lesson_date);
    const list = groups.get(weekStart) ?? [];
    list.push(lesson);
    groups.set(weekStart, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function PlannedLessonRow({
  lesson,
  classId,
  doelgroep,
  activities,
  onLinked,
}: {
  lesson: PlannedLessonWithContext;
  classId: string;
  doelgroep: number;
  activities: Activity[];
  onLinked: (lessonId: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activityId, setActivityId] = useState(lesson.activity_id);
  const [activityTitel, setActivityTitel] = useState(lesson.activityTitel);

  const { value: status, run: runStatus, isPending: statusPending } = useOptimisticAction(
    lesson.status,
    (next: PlannedLessonStatus) => updatePlannedLesson({ id: lesson.id, status: next }, classId),
  );

  const color = getCategoryColor(getCategoryForLearningLine(lesson.activeLeerlijn ?? ""));

  async function handleSelectActivity(activity: Activity) {
    const previousId = activityId;
    const previousTitel = activityTitel;
    setActivityId(activity.id);
    setActivityTitel(activity.titel);
    setPickerOpen(false);

    const result = await updatePlannedLesson({ id: lesson.id, activityId: activity.id }, classId);
    if ("error" in result) {
      setActivityId(previousId);
      setActivityTitel(previousTitel);
      toast.error(result.error);
      return;
    }
    toast.success("Activiteit gekoppeld.");
    onLinked(lesson.id);
  }

  return (
    <li className={cn("rounded-lg border-l-4 border bg-card p-3", color.border)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {formatLessonDate(lesson.lesson_date)} · {formatTimeRange(lesson.start_time, lesson.duration_minutes)}
          </p>
          <p className={cn("text-xs", color.text)}>{lesson.activeLeerlijn ?? "Nog geen leerlijn toegewezen"}</p>
        </div>

        <select
          value={status}
          disabled={statusPending}
          onChange={(event) => runStatus(event.target.value as PlannedLessonStatus)}
          className={cn(SELECT_FIELD_CLASS, "h-9 w-auto shrink-0 text-xs")}
          aria-label="Status van dit lesmoment"
        >
          {PLANNED_LESSON_STATUSES.map((value) => (
            <option key={value} value={value}>
              {PLANNED_LESSON_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {activityId && activityTitel ? (
          <>
            <Link
              href={`/activiteit/${activityId}`}
              className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1.5 text-sm font-medium hover:bg-accent"
            >
              <CircleCheck className="size-4 text-emerald-600" aria-hidden="true" />
              {activityTitel}
            </Link>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPickerOpen(true)}>
              Wijzig
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              Kies activiteit
            </Button>
            {lesson.activeLeerlijn && (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link
                  href={`/les-maken?leerlijn=${encodeURIComponent(lesson.activeLeerlijn)}&doelgroep=${doelgroep}`}
                >
                  <Sparkles className="size-4" />
                  Nieuwe activiteit met AI Lescoach
                </Link>
              </Button>
            )}
          </>
        )}
      </div>

      <ActivityPickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        activities={activities}
        defaultLeerlijn={lesson.activeLeerlijn}
        onSelect={handleSelectActivity}
      />
    </li>
  );
}

/**
 * Weekplanning voor één klas — gegroepeerd per week, met een statusoverzicht
 * bovenaan. `initialLessons` komt server-side binnen (met activeLeerlijn/
 * activityTitel al afgeleid, zie lib/services/planning.ts's
 * getPlannedLessons); het gekoppeld-aantal in de statusbalk wordt lokaal
 * bijgehouden zodat het direct meetelt zodra een activiteit wordt gekozen,
 * zonder op een volledige page-refresh te wachten (Instant-reacting UI-
 * standaard, CLAUDE.md).
 */
export function WeekPlanningView({
  classId,
  doelgroep,
  initialLessons,
  activities,
}: {
  classId: string;
  doelgroep: number;
  initialLessons: PlannedLessonWithContext[];
  activities: Activity[];
}) {
  const [linkedIds, setLinkedIds] = useState(
    () => new Set(initialLessons.filter((l) => l.activity_id).map((l) => l.id)),
  );

  const weeks = useMemo(() => groupLessonsByWeek(initialLessons), [initialLessons]);
  const total = initialLessons.length;
  const linked = linkedIds.size;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Weekplanning</CardTitle>
        <p className="text-sm text-muted-foreground">
          {total === 0
            ? "Nog geen lesmomenten gegenereerd."
            : `${linked} van ${total} komende lessen heeft een activiteit gekoppeld.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {weeks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Geen lesmomenten in de komende periode — gebruik &quot;Genereer volgende 12 weken&quot;
            om verder te plannen.
          </p>
        )}

        {weeks.map(([weekStart, lessons]) => (
          <div key={weekStart} className="space-y-2">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {formatWeekLabel(weekStart)}
            </p>
            <ul className="space-y-2">
              {lessons.map((lesson) => (
                <PlannedLessonRow
                  key={lesson.id}
                  lesson={lesson}
                  classId={classId}
                  doelgroep={doelgroep}
                  activities={activities}
                  onLinked={(lessonId) => setLinkedIds((prev) => new Set(prev).add(lessonId))}
                />
              ))}
            </ul>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
