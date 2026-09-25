"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteClass } from "@/actions/planning";
import { Button } from "@/components/ui/button";
import { ClassFormDialog } from "@/components/planning/ClassFormDialog";
import { DOELGROEP_LABELS } from "@/types/activity";
import { WEEKDAY_LABELS, type PlanningClass } from "@/types/planning";

export function ClassCard({ klas }: { klas: PlanningClass }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleDelete() {
    if (!window.confirm(`"${klas.name}" verwijderen? De bijbehorende planning wordt ook verwijderd.`)) {
      return;
    }
    startDeleteTransition(async () => {
      const result = await deleteClass(klas.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Klas verwijderd.");
      router.refresh();
    });
  }

  const slotSummary = klas.lesson_slots
    .map((slot) => `${WEEKDAY_LABELS[slot.weekday]} ${slot.startTime}`)
    .join(" · ");

  return (
    <div className="group flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-brand-sm transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{klas.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{DOELGROEP_LABELS[klas.doelgroep]}</p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`${klas.name} bewerken`}
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`${klas.name} verwijderen`}
            disabled={isDeleting}
            onClick={handleDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{slotSummary || "Nog geen weekmoment"}</span>
      </div>

      <ClassFormDialog open={editOpen} onOpenChange={setEditOpen} existingClass={klas} />
    </div>
  );
}
