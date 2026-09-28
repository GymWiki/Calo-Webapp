"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteTeamActivity, shareTeamActivityToGymWiki } from "@/actions/teamLibrary";
import { Button } from "@/components/ui/button";

/**
 * "Verwijderen"/"Delen met GymWiki"-knoppen voor een teamactiviteit (mode="view"
 * in components/activity-wizard-page.tsx) — eigen client-component omdat
 * ActivityWizardPage zelf geen team-specifieke server-actions/toast-state
 * hoort te kennen (zie de teamActivityActions-prop daar).
 */
export function TeamActivityViewActions({
  activityId,
  activityTitle,
  canDelete,
  canShare,
}: {
  activityId: string;
  activityTitle: string;
  canDelete: boolean;
  canShare: boolean;
}) {
  const router = useRouter();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isSharing, startShareTransition] = useTransition();

  function handleDelete() {
    if (
      !window.confirm(
        `"${activityTitle}" verwijderen uit de teambibliotheek? De activiteit blijft 30 dagen herstelbaar voor de teameigenaar.`,
      )
    ) {
      return;
    }
    startDeleteTransition(async () => {
      const result = await deleteTeamActivity(activityId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Activiteit verwijderd.");
      router.push("/zoeken");
      router.refresh();
    });
  }

  function handleShare() {
    startShareTransition(async () => {
      const result = await shareTeamActivityToGymWiki(activityId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if ("rejected" in result) {
        toast.error(`Niet gedeeld: ${result.reason}`);
        return;
      }
      toast.success("Gedeeld met alle GymWiki-gebruikers — het origineel blijft in de teambibliotheek staan.");
      router.refresh();
    });
  }

  return (
    <>
      {canShare && (
        <Button type="button" variant="outline" className="flex-1" disabled={isSharing} onClick={handleShare}>
          {isSharing ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
          Delen met GymWiki
        </Button>
      )}
      {canDelete && (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0 text-destructive hover:text-destructive"
          disabled={isDeleting}
          onClick={handleDelete}
          aria-label="Activiteit verwijderen"
          title="Activiteit verwijderen"
        >
          {isDeleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      )}
    </>
  );
}
