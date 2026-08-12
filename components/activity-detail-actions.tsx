"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck, Copy } from "lucide-react";
import { toast } from "sonner";

import { toggleSavedActivity } from "@/actions/activity";
import { showLevelUpToast } from "@/components/gamification/level-up-toast";
import { PaywallModal } from "@/components/PaywallModal";
import { Button } from "@/components/ui/button";

const PAYWALL_MESSAGE =
  "Kopieer & bewerk is een Pro-feature. Upgrade naar Pro of zet je Level-korting in!";

export function ActivityDetailActions({
  activityId,
  initiallySaved,
  isPro,
  xp,
}: {
  activityId: string;
  initiallySaved: boolean;
  isPro: boolean;
  xp: number;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, startTransition] = useTransition();
  const [paywallOpen, setPaywallOpen] = useState(false);

  function handleToggleSave() {
    const next = !saved;
    setSaved(next); // optimistic

    startTransition(async () => {
      const result = await toggleSavedActivity(activityId);
      if ("error" in result) {
        setSaved(!next); // revert
        toast.error(result.error);
        return;
      }
      if (result.levelUp) {
        showLevelUpToast(result.levelUp);
      }
    });
  }

  function handleCopyClick(event: React.MouseEvent) {
    if (!isPro) {
      event.preventDefault();
      setPaywallOpen(true);
      return;
    }
    router.push(`/les-maken?vanuit=${activityId}`);
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
        <Link href={`/les-maken?vanuit=${activityId}`} onClick={handleCopyClick}>
          <Copy className="size-4" />
          Kopieer & bewerk
        </Link>
      </Button>
      <PaywallModal
        open={paywallOpen}
        onOpenChange={setPaywallOpen}
        message={PAYWALL_MESSAGE}
        xp={xp}
      />
    </div>
  );
}
