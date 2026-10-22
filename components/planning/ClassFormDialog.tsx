"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createClass, updateClass } from "@/actions/planning";
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
import { LessonSlotRows } from "@/components/planning/LessonSlotRows";
import { SELECT_FIELD_CLASS } from "@/components/planning/planning-ui";
import { DOELGROEP_LABELS, DOELGROEP_WAARDEN } from "@/types/activity";
import type { LessonSlot, PlanningClass } from "@/types/planning";

/**
 * Formuliervelden — apart van ClassFormDialog zodat elke keer openen een
 * verse instantie krijgt (via de `key` op de aanroep hieronder) die zijn
 * state met een lazy useState-initializer uit `existingClass` opbouwt.
 * Bewust GEEN useEffect-gebaseerde reset op `open`: dat triggert een
 * synchrone extra render direct na mount (react-hooks/set-state-in-effect),
 * het React-aanbevolen patroon is state resetten via een remount-key i.p.v.
 * een effect (zie https://react.dev/learn/you-might-not-need-an-effect).
 */
function ClassFormFields({
  existingClass,
  onOpenChange,
}: {
  existingClass?: PlanningClass | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const isEdit = existingClass != null;
  const [name, setName] = useState(existingClass?.name ?? "");
  const [doelgroep, setDoelgroep] = useState<number>(existingClass?.doelgroep ?? DOELGROEP_WAARDEN[0]);
  const [lessonSlots, setLessonSlots] = useState<LessonSlot[]>(existingClass?.lesson_slots ?? []);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      if (isEdit) {
        const result = await updateClass({ id: existingClass.id, name, doelgroep, lessonSlots });
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        toast.success("Klas bijgewerkt.");
        onOpenChange(false);
        router.refresh();
        return;
      }

      const result = await createClass({ name, doelgroep, lessonSlots });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Klas aangemaakt.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Klas bewerken" : "Klas toevoegen"}</DialogTitle>
        <DialogDescription>
          Naam, doelgroep en vaste weekmomenten — de weekmomenten bepalen wanneer
          lesmomenten automatisch verschijnen op de klaspagina en in het weekrooster.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="class-name">Naam</Label>
          <Input
            id="class-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Bijv. Groep 5A"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="class-doelgroep">Doelgroep</Label>
          <select
            id="class-doelgroep"
            value={doelgroep}
            onChange={(event) => setDoelgroep(Number(event.target.value))}
            className={SELECT_FIELD_CLASS}
          >
            {DOELGROEP_WAARDEN.map((waarde) => (
              <option key={waarde} value={waarde}>
                {DOELGROEP_LABELS[waarde]}
              </option>
            ))}
          </select>
        </div>

        <LessonSlotRows slots={lessonSlots} onChange={setLessonSlots} />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Opslaan…" : isEdit ? "Wijzigingen opslaan" : "Klas aanmaken"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/**
 * "Klas toevoegen"/bewerken-dialoog. Eén component voor beide gevallen
 * (zelfde patroon als ShareLessonButton.tsx's dialoog) — `existingClass`
 * bepaalt of createClass of updateClass wordt aangeroepen. De dialoog blijft
 * altijd gemount (i.p.v. conditioneel gerenderd) zodat de open/dicht-
 * animatie werkt; ClassFormFields wordt geremount bij elke open-toggle (zie
 * de `key` hieronder) zodat de velden vers uit `existingClass` starten.
 */
export function ClassFormDialog({
  open,
  onOpenChange,
  existingClass,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingClass?: PlanningClass | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ClassFormFields
          key={open ? "open" : "closed"}
          existingClass={existingClass}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
}
