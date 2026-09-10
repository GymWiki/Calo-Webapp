"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteActivityDraft, submitActivityDraft } from "@/actions/activity-submission";
import { Button } from "@/components/ui/button";
import type { Activity } from "@/types/activity";

/**
 * Acties per concept: indienen (draait de AI-kwaliteitscheck en verandert
 * status naar approved/rejected — verdwijnt daardoor uit deze lijst na
 * router.refresh) of verwijderen. Geen bewerken-in-place in deze eerste
 * versie.
 */
export function ActivityDraftsList({ drafts }: { drafts: Activity[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSubmitDraft(id: string, title: string) {
    startTransition(async () => {
      const result = await submitActivityDraft(id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (result.status === "approved") {
        toast.success(`"${title}" ingediend en goedgekeurd!`);
      } else {
        toast.error(`"${title}" niet goedgekeurd: ${result.reason}`);
      }
      router.refresh();
    });
  }

  function handleDelete(id: string, title: string) {
    startTransition(async () => {
      const result = await deleteActivityDraft(id);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Concept "${title}" verwijderd.`);
      router.refresh();
    });
  }

  return (
    <ul className="space-y-2">
      {drafts.map((draft) => (
        <li
          key={draft.id}
          className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{draft.titel}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[draft.categorie, draft.leerlijn].filter(Boolean).join(" · ") ||
                "Geen categorie/leerlijn"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => handleDelete(draft.id, draft.titel)}
            >
              <Trash2 className="size-4" />
              Verwijderen
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={() => handleSubmitDraft(draft.id, draft.titel)}
            >
              <Send className="size-4" />
              Indienen
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
