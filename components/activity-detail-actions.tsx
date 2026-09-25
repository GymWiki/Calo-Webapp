"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";

import { toggleSavedActivity } from "@/actions/activity";
import { AddToPlanningButton } from "@/components/planning/AddToPlanningButton";
import { ShareActivityButton } from "@/components/ShareActivityButton";
import { Button } from "@/components/ui/button";
import { useOptimisticAction } from "@/lib/hooks/useOptimisticAction";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/activity";
import type { PlanningClass } from "@/types/planning";

export function ActivityDetailActions({
  activity,
  initiallySaved,
  classes,
  variant = "sidebar",
  className,
}: {
  activity: Activity;
  initiallySaved: boolean;
  classes: PlanningClass[];
  /** "sidebar": full-width knoppen met label, gestapeld (desktop-zijbalk).
   *  "icons": compacte rij icoon-knoppen (mobiel/tablet, bij de titel). */
  variant?: "sidebar" | "icons";
  className?: string;
}) {
  const activityId = activity.id;
  const {
    value: saved,
    run: toggleSave,
    isPending: pending,
  } = useOptimisticAction(initiallySaved, () => toggleSavedActivity(activityId));

  if (variant === "icons") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-pressed={saved}
          aria-label={saved ? "Opgeslagen" : "Bewaren"}
          title={saved ? "Opgeslagen" : "Bewaren"}
          disabled={pending}
          onClick={() => toggleSave(!saved)}
        >
          {saved ? (
            <BookmarkCheck className="size-4 text-primary" />
          ) : (
            <Bookmark className="size-4" />
          )}
        </Button>
        <AddToPlanningButton activityId={activityId} classes={classes} iconOnly />
        <ShareActivityButton title={activity.titel} iconOnly />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        aria-pressed={saved}
        disabled={pending}
        onClick={() => toggleSave(!saved)}
      >
        {saved ? (
          <BookmarkCheck className="size-4 text-primary" />
        ) : (
          <Bookmark className="size-4" />
        )}
        {saved ? "Opgeslagen" : "Bewaren"}
      </Button>
      <AddToPlanningButton
        activityId={activityId}
        classes={classes}
        className="w-full justify-start"
      />
      <ShareActivityButton title={activity.titel} className="w-full justify-start" />
    </div>
  );
}
