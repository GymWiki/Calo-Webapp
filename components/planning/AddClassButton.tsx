"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ClassFormDialog } from "@/components/planning/ClassFormDialog";

export function AddClassButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Klas toevoegen
      </Button>
      <ClassFormDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
