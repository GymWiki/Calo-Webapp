"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Copy } from "lucide-react";
import { toast } from "sonner";

import { toggleSavedActivity } from "@/actions/activity";
import { Button } from "@/components/ui/button";

export function ActivityDetailActions({
  activityId,
  initiallySaved,
}: {
  activityId: string;
  initiallySaved: boolean;
}) {
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
    <div className="fixed inset-x-0 bottom-16 z-40 flex gap-2 border-t bg-card p-4 shadow-brand-lg md:static md:border-0 md:bg-transparent md:p-0 md:shadow-none">
      <Button
        variant="outline"
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
      <Button asChild className="flex-1">
        <Link href={`/les-maken?vanuit=${activityId}`}>
          <Copy className="size-4" />
          Kopieer & bewerk
        </Link>
      </Button>
    </div>
  );
}
