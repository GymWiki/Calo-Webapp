"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createYearPlanBlock, updateYearPlanBlock, deleteYearPlanBlock } from "@/actions/planning";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_FIELD_CLASS } from "@/components/planning/planning-ui";
import { LEARNING_LINE_CATEGORIES } from "@/lib/constants/learningLines";
import type { YearPlanBlock } from "@/types/planning";

export type YearPlanBlockDialogState =
  | { mode: "create"; startDate: string }
  | { mode: "edit"; block: YearPlanBlock };

/**
 * Formuliervelden — apart van YearPlanBlockDialog zodat elke keer openen
 * (zie de `key` op de aanroep in YearPlanBlockDialog) een verse instantie
 * krijgt die zijn state met een lazy useState-initializer uit `state`
 * opbouwt, i.p.v. een useEffect-reset (zie ClassFormDialog.tsx voor
 * dezelfde afweging — react-hooks/set-state-in-effect).
 */
function YearPlanBlockFields({
  classId,
  state,
  onOpenChange,
}: {
  classId: string;
  state: YearPlanBlockDialogState;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = state.mode === "edit";
  const [leerlijn, setLeerlijn] = useState(state.mode === "edit" ? state.block.leerlijn : "");
  const [startDate, setStartDate] = useState(
    state.mode === "edit" ? state.block.start_date : state.startDate,
  );
  const [endDate, setEndDate] = useState(
    state.mode === "edit" ? state.block.end_date : state.startDate,
  );
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result =
        state.mode === "edit"
          ? await updateYearPlanBlock({ id: state.block.id, classId, leerlijn, startDate, endDate })
          : await createYearPlanBlock({ classId, leerlijn, startDate, endDate });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(isEdit ? "Jaarplanning bijgewerkt." : "Leerlijn toegevoegd aan de jaarplanning.");
      onOpenChange(false);
      router.refresh();
    });
  }

  function handleDelete() {
    if (state.mode !== "edit") return;
    if (!window.confirm(`"${state.block.leerlijn}" verwijderen uit de jaarplanning?`)) return;
    startDeleteTransition(async () => {
      const result = await deleteYearPlanBlock(state.block.id, classId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Blok verwijderd.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Jaarplanning-blok bewerken" : "Leerlijn toevoegen"}</DialogTitle>
        <DialogDescription>
          Welke leerlijn krijgt deze klas, en van welke tot welke datum?
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="block-leerlijn">Leerlijn</Label>
          <select
            id="block-leerlijn"
            value={leerlijn}
            onChange={(event) => setLeerlijn(event.target.value)}
            className={SELECT_FIELD_CLASS}
            required
          >
            <option value="" disabled>
              Kies een leerlijn
            </option>
            {LEARNING_LINE_CATEGORIES.map(({ category, lines }) => (
              <optgroup key={category} label={category}>
                {lines.map((line) => (
                  <option key={line} value={line}>
                    {line}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="block-start">Startdatum</Label>
            <Input
              id="block-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="block-end">Einddatum</Label>
            <Input
              id="block-end"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              min={startDate || undefined}
              required
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {isEdit ? (
            <Button
              type="button"
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              Verwijderen
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Opslaan…" : "Opslaan"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
}

/**
 * Toevoegen/bewerken van één jaarplanning-blok — klik op een lege week in
 * YearPlanTimeline opent dit in "create"-modus (startdatum vooringevuld op
 * die week), klik op een bestaand blok opent "edit"-modus (+ verwijderen).
 * Overlap wordt niet client-side gevalideerd — de exclude-constraint in de
 * database (zie supabase/migrations/planning_feature.sql) is de bron van
 * waarheid, createYearPlanBlock/updateYearPlanBlock zetten de resulterende
 * Postgres-foutcode al om in de vriendelijke OVERLAP_ERROR-tekst.
 */
export function YearPlanBlockDialog({
  open,
  onOpenChange,
  classId,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  state: YearPlanBlockDialogState | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {state && (
          <YearPlanBlockFields
            key={open ? "open" : "closed"}
            classId={classId}
            state={state}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
