"use client";

import { useState } from "react";
import { CalendarPlus } from "lucide-react";

import { AddToPlanningSheet } from "@/components/planning/AddToPlanningSheet";
import { Button } from "@/components/ui/button";
import type { PlanningClass } from "@/types/planning";

export function AddToPlanningButton({
  activityId,
  classes,
  className,
  size,
  iconOnly = false,
}: {
  activityId: string;
  classes: PlanningClass[];
  className?: string;
  size?: "default" | "sm";
  /** Compacte iconen-rij (bijv. mobiel bij de titel) — geen zichtbaar
   *  label, wel een aria-label/title zodat de actie herkenbaar blijft. */
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={iconOnly ? "icon" : size}
        className={className}
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? "Toevoegen aan planning" : undefined}
        title={iconOnly ? "Toevoegen aan planning" : undefined}
      >
        <CalendarPlus className="size-4" />
        {!iconOnly && (
          <>
            <span className="hidden sm:inline">Toevoegen aan planning</span>
            <span className="sm:hidden">Planning</span>
          </>
        )}
      </Button>
      <AddToPlanningSheet open={open} onOpenChange={setOpen} activityId={activityId} classes={classes} />
    </>
  );
}
