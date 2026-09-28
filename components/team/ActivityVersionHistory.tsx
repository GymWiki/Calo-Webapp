"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, History, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { restoreActivityVersion } from "@/actions/teamLibrary";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ActivityVersionSummary } from "@/types/teamLibrary";

function formatTimestamp(value: string): string {
  const date = new Date(value);
  return `${date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}, ${date.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}`;
}

/** "Vorige versies" — inklapbare lijst met een herstelknop per versie (zie updateTeamActivity's optimistic locking). */
export function ActivityVersionHistory({
  activityId,
  versions,
}: {
  activityId: string;
  versions: ActivityVersionSummary[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (versions.length === 0) return null;

  function handleRestore(versionId: string, version: number) {
    if (!window.confirm(`Versie ${version} herstellen? De huidige inhoud wordt vervangen (blijft zelf ook bewaard als versie).`)) {
      return;
    }
    setRestoringId(versionId);
    startTransition(async () => {
      const result = await restoreActivityVersion(activityId, versionId);
      setRestoringId(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if ("conflict" in result) {
        toast.error(
          `${result.changedByName ?? "Iemand anders"} heeft deze activiteit intussen ook gewijzigd — laad de pagina opnieuw en probeer het nogmaals.`,
        );
        return;
      }
      toast.success(`Versie ${version} hersteld.`);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 p-3 text-left text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden="true" />
          Vorige versies ({versions.length})
        </span>
        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="divide-y border-t">
          {versions.map((version) => (
            <li key={version.id} className="flex items-center justify-between gap-3 p-3 text-sm">
              <span className="text-muted-foreground">
                Versie {version.version} — {version.changedByName ?? "onbekend"} ·{" "}
                {formatTimestamp(version.changedAt)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending}
                onClick={() => handleRestore(version.id, version.version)}
              >
                {isPending && restoringId === version.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : null}
                Herstellen
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
