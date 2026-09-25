"use client";

import Link from "next/link";
import { Bookmark, BookmarkCheck, Copy } from "lucide-react";

import { toggleSavedActivity } from "@/actions/activity";
import { AddToPlanningButton } from "@/components/planning/AddToPlanningButton";
import { ActivityPdfButton } from "@/components/pdf/ActivityPdfButton";
import { Button } from "@/components/ui/button";
import { useOptimisticAction } from "@/lib/hooks/useOptimisticAction";
import type { Activity } from "@/types/activity";
import type { PlanningClass } from "@/types/planning";

export function ActivityDetailActions({
  activity,
  initiallySaved,
  classes,
}: {
  activity: Activity;
  initiallySaved: boolean;
  classes: PlanningClass[];
}) {
  const activityId = activity.id;
  const {
    value: saved,
    run: toggleSave,
    isPending: pending,
  } = useOptimisticAction(initiallySaved, () => toggleSavedActivity(activityId));

  return (
    // Eén vaste onderbalk, op elke breedte — geen aparte desktop-variant.
    // bottom-[calc(4rem+env(safe-area-inset-bottom))] op mobiel om boven de
    // bottom-navigatie te blijven (die is md:hidden en zelf ook
    // safe-area-bewust, zie components/app-layout.tsx), md:bottom-0 daarna
    // — op mobiel reserveert de nav er al onder al de veilige zone, dus
    // deze balk heeft daar zelf geen extra pb voor nodig; op desktop, waar
    // 'm wél de echte schermrand raakt, wel.
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex gap-2 border-t bg-card p-2.5 shadow-brand-lg md:bottom-0 md:pb-[calc(0.625rem+env(safe-area-inset-bottom))]">
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
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
      <Button asChild size="sm" className="flex-[1.4]">
        <Link href={`/les-maken?vanuit=${activityId}`}>
          <Copy className="size-4" />
          <span className="hidden sm:inline">Kopieer &amp; bewerk</span>
          <span className="sm:hidden">Kopiëren</span>
        </Link>
      </Button>
      <ActivityPdfButton activity={activity} className="flex-1" size="sm" />
      <AddToPlanningButton activityId={activityId} classes={classes} className="flex-1" size="sm" />
    </div>
  );
}
