"use client";

import { Bookmark, BookmarkCheck, ThumbsUp } from "lucide-react";

import { toggleActivityLike, toggleSavedActivity } from "@/actions/activity";
import { AddToPlanningButton } from "@/components/planning/AddToPlanningButton";
import { ShareActivityButton } from "@/components/ShareActivityButton";
import { Button } from "@/components/ui/button";
import { useOptimisticAction } from "@/lib/hooks/useOptimisticAction";
import { cn } from "@/lib/utils";
import type { Activity } from "@/types/activity";
import type { PlanningClass } from "@/types/planning";

// Losstaand van de andere drie acties — heeft eigen optimistic state (de
// knop-status ÉN het aantal moeten allebei instant bijwerken) en wordt
// helemaal niet gerenderd voor de eigen activiteit van de gebruiker (zie
// ActivityDetailActions hieronder), dus makkelijker als eigen component dan
// er nog een vertakking in de andere knoppen-lus bij te bouwen.
function ActivityLikeButton({
  activityId,
  initiallyLiked,
  likeCount,
  variant,
}: {
  activityId: string;
  initiallyLiked: boolean;
  likeCount: number;
  variant: "sidebar" | "icons";
}) {
  const {
    value: liked,
    run: toggleLike,
    isPending,
  } = useOptimisticAction(initiallyLiked, () => toggleActivityLike(activityId));

  // Afgeleid van `liked` i.p.v. een los stukje state: useOptimisticAction
  // regelt de optimistic update/revert-bij-fout al voor `liked` zelf, dus
  // deze berekening erft die correctheid gratis mee (geen apart revert-pad
  // voor het aantal nodig).
  const displayedCount = likeCount + (liked ? 1 : 0) - (initiallyLiked ? 1 : 0);
  const label = liked ? "Werkte goed" : "Dit werkte goed";

  if (variant === "icons") {
    return (
      <div className="relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-pressed={liked}
          aria-label={label}
          title={label}
          disabled={isPending}
          onClick={() => toggleLike(!liked)}
        >
          <ThumbsUp className={cn("size-4", liked && "fill-current text-primary")} />
        </Button>
        {displayedCount > 0 && (
          <span
            className="pointer-events-none absolute -right-1 -bottom-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
            aria-hidden="true"
          >
            {displayedCount}
          </span>
        )}
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full justify-start"
      aria-pressed={liked}
      disabled={isPending}
      onClick={() => toggleLike(!liked)}
    >
      <ThumbsUp className={cn("size-4", liked && "fill-current text-primary")} />
      {label}
      {displayedCount > 0 && (
        <span className="ml-auto text-xs text-muted-foreground">{displayedCount}</span>
      )}
    </Button>
  );
}

export function ActivityDetailActions({
  activity,
  initiallySaved,
  initiallyLiked,
  isOwnActivity,
  classes,
  variant = "sidebar",
  className,
}: {
  activity: Activity;
  initiallySaved: boolean;
  /** Weggelaten voor de eigen activiteit — geen server-call/optimistic state
   *  nodig voor een knop die toch niet gerenderd wordt. */
  initiallyLiked?: boolean;
  /** Eigen activiteit: geen like-knop (zelf-like-preventie, ook
   *  server-side afgedwongen — zie actions/activity.ts). */
  isOwnActivity: boolean;
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
        {!isOwnActivity && (
          <ActivityLikeButton
            activityId={activityId}
            initiallyLiked={initiallyLiked ?? false}
            likeCount={activity.like_count}
            variant="icons"
          />
        )}
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
      {!isOwnActivity && (
        <ActivityLikeButton
          activityId={activityId}
          initiallyLiked={initiallyLiked ?? false}
          likeCount={activity.like_count}
          variant="sidebar"
        />
      )}
      <AddToPlanningButton
        activityId={activityId}
        classes={classes}
        className="w-full justify-start"
      />
      <ShareActivityButton title={activity.titel} className="w-full justify-start" />
    </div>
  );
}
