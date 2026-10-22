"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronUp, PartyPopper, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { cancelLesson, removeActivityFromLesson, reorderLessonActivities, restoreLesson, updateLessonNotes } from "@/actions/planning";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ClassLessonEntry } from "@/types/planning";

function formatLessonDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function lessonEntryDomId(entry: ClassLessonEntry): string {
  return `les-${entry.date}-${entry.startTime}`;
}

/**
 * Ingeklapte samenvatting voor een lesmoment in een schoolvakantie — nog
 * wel te openen, want een klas kan bewust toch lesgeven tijdens een
 * vakantieweek.
 */
function CollapsedHolidayContainer({ entry, onExpand }: { entry: ClassLessonEntry; onExpand: () => void }) {
  return (
    <button
      type="button"
      id={lessonEntryDomId(entry)}
      onClick={onExpand}
      className="flex w-full items-center gap-2.5 rounded-xl border border-dashed bg-amber-500/5 px-4 py-3 text-left text-sm transition-colors duration-150 ease-brand hover:bg-amber-500/10"
    >
      <PartyPopper className="size-4 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium capitalize">{formatLessonDate(entry.date)}</span>
        <span className="text-muted-foreground"> · {entry.holidayName}</span>
      </span>
      <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

/**
 * Eén lesmoment-container op de klas-detailpagina — datum/tijd, gekoppelde
 * activiteiten (verwijderen + herordenen), "+ Activiteit toevoegen", notitie
 * en de vervallen/gepland-toggle. Reorder/verwijderen gaan via
 * `useTransition` + `router.refresh()` (zelfde patroon als ClassCard's
 * verwijderknop) i.p.v. een handgerolde optimistic-array-swap — consistent
 * met hoe de rest van deze feature lijst-mutaties al afhandelt, en een
 * knop die meteen `disabled`/pending wordt is zelf al de directe
 * UI-reactie die de instant-reacting-standaard vraagt.
 */
export function LessonContainer({
  entry,
  classId,
  isPast,
  isNext,
  onOpenAddActivities,
}: {
  entry: ClassLessonEntry;
  classId: string;
  isPast: boolean;
  isNext: boolean;
  onOpenAddActivities: (entry: ClassLessonEntry) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [isPending, startTransition] = useTransition();

  if (entry.holidayName && !expanded) {
    return <CollapsedHolidayContainer entry={entry} onExpand={() => setExpanded(true)} />;
  }

  const isCancelled = entry.status === "vervallen";
  const notesDirty = notes !== (entry.notes ?? "");

  function runAction(action: () => Promise<{ error: string } | { success: true }>) {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleToggleCancelled() {
    const location = { classId, lessonDate: entry.date, startTime: entry.startTime };
    runAction(() => (isCancelled ? restoreLesson(location) : cancelLesson(location)));
  }

  function handleSaveNotes() {
    runAction(() =>
      updateLessonNotes({ classId, lessonDate: entry.date, startTime: entry.startTime, notes: notes.trim() || null }),
    );
  }

  function handleRemoveActivity(lessonActivityId: string) {
    runAction(() => removeActivityFromLesson({ lessonActivityId }));
  }

  function handleMoveActivity(index: number, direction: -1 | 1) {
    if (!entry.lessonId) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= entry.activities.length) return;

    const reordered = [...entry.activities];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    runAction(() =>
      reorderLessonActivities({
        lessonId: entry.lessonId as string,
        orderedLessonActivityIds: reordered.map((activity) => activity.id),
      }),
    );
  }

  return (
    <div
      id={lessonEntryDomId(entry)}
      className={cn(
        "space-y-3 rounded-xl border bg-card p-4 scroll-mt-24",
        isPast && "opacity-60",
        isNext && "border-primary/50 ring-1 ring-primary/20",
        isCancelled && "border-dashed",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold capitalize">{formatLessonDate(entry.date)}</p>
          <p className="text-xs text-muted-foreground">
            {entry.startTime.slice(0, 5)}
            {entry.holidayName && ` · ${entry.holidayName}`}
            {isCancelled && " · Vervallen"}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={handleToggleCancelled}>
          {isCancelled ? "Herstel lesmoment" : "Markeer als vervallen"}
        </Button>
      </div>

      <div className={cn("space-y-2", isCancelled && "opacity-60")}>
        {entry.activities.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">Nog geen activiteit gekoppeld.</p>
        ) : (
          <ul className="space-y-1.5">
            {entry.activities.map((activity, index) => (
              <li
                key={activity.id}
                className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
              >
                <Link href={`/activiteit/${activity.activityId}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium hover:underline">{activity.titel}</p>
                  <p className="truncate text-xs text-muted-foreground">{activity.leerlijn ?? "Geen leerlijn"}</p>
                </Link>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={isPending || index === 0}
                    onClick={() => handleMoveActivity(index, -1)}
                    aria-label="Naar boven"
                  >
                    <ChevronUp className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    disabled={isPending || index === entry.activities.length - 1}
                    onClick={() => handleMoveActivity(index, 1)}
                    aria-label="Naar beneden"
                  >
                    <ChevronDown className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    disabled={isPending}
                    onClick={() => handleRemoveActivity(activity.id)}
                    aria-label="Activiteit verwijderen"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button type="button" variant="outline" size="sm" onClick={() => onOpenAddActivities(entry)}>
          <Plus className="size-4" />
          Activiteit toevoegen
        </Button>
      </div>

      <div className="space-y-1.5">
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Notitie bij dit lesmoment..."
          className="min-h-16 text-sm"
        />
        {notesDirty && (
          <Button type="button" size="sm" disabled={isPending} onClick={handleSaveNotes}>
            Notitie opslaan
          </Button>
        )}
      </div>
    </div>
  );
}
