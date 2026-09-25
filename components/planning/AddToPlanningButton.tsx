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
}: {
  activityId: string;
  classes: PlanningClass[];
  className?: string;
  size?: "default" | "sm";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" size={size} className={className} onClick={() => setOpen(true)}>
        <CalendarPlus className="size-4" />
        <span className="hidden sm:inline">Toevoegen aan planning</span>
        <span className="sm:hidden">Planning</span>
      </Button>
      <AddToPlanningSheet open={open} onOpenChange={setOpen} activityId={activityId} classes={classes} />
    </>
  );
}
