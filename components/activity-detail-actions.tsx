"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Copy } from "lucide-react";
import { toast } from "sonner";

import { toggleSavedActivity } from "@/actions/activity";
import { ActivityPdfButton } from "@/components/ActivityPdfButton";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/types/activity";

export function ActivityDetailActions({
  activity,
  initiallySaved,
}: {
  activity: Activity;
  initiallySaved: boolean;
}) {
  const activityId = activity.id;
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();

  function handleToggleSave() {
    const next = !saved;
    setSaved(next); // optimistic

    startTransition(async () => {
      const result = await toggleSavedActivity(activityId);
      if ("error" in result) {
        setSaved(!next); // revert
        toast.error(result.error);
      }
    });
  }

  return (
    // Eén vaste onderbalk, op elke breedte — geen aparte desktop-variant.
    // bottom-16 op mobiel om boven de bottom-navigatie te blijven (die is
    // md:hidden, zie components/app-layout.tsx), md:bottom-0 daarna.
    <div className="fixed inset-x-0 bottom-16 z-40 flex gap-2 border-t bg-card p-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] shadow-brand-lg md:bottom-0">
      <Button
        variant="outline"
        size="sm"
        className="flex-1"
        aria-pressed={saved}
        disabled={pending}
        onClick={handleToggleSave}
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
    </div>
  );
}
