"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { addActivityToPlanning, getOpenPlannedDatesForClass } from "@/actions/planning";
import { MiniMonthPicker } from "@/components/planning/MiniMonthPicker";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getMonthRange } from "@/lib/planningSchedule";
import { DOELGROEP_LABELS } from "@/types/activity";
import type { PlanningClass } from "@/types/planning";

const TODAY = new Date().toISOString().slice(0, 10);
const CURRENT_MONTH = TODAY.slice(0, 7);

/**
 * Klas -> datum-flow — apart van AddToPlanningSheet en geremount bij elke
 * open-toggle (zie de `key` op de aanroep hieronder), zodat de stap-state
 * altijd vers begint i.p.v. via een useEffect-reset (zelfde afweging als
 * ClassFormDialog.tsx).
 */
function AddToPlanningSheetBody({
  activityId,
  classes,
  onDone,
}: {
  activityId: string;
  classes: PlanningClass[];
  onDone: (month: string) => void;
}) {
  const [selectedClass, setSelectedClass] = useState<PlanningClass | null>(null);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [markedDates, setMarkedDates] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Haalt op welke datums voor de gekozen klas al een "nog te bepalen"-
  // lesmoment hebben (voor de stipjes in MiniMonthPicker) — telkens opnieuw
  // zodra de klas of zichtbare maand wisselt.
  useEffect(() => {
    if (!selectedClass) return;

    let cancelled = false;
    const { start, end } = getMonthRange(month);

    async function loadOpenDates() {
      const rows = await getOpenPlannedDatesForClass(selectedClass!.id, start, end);
      if (cancelled) return;
      setMarkedDates(
        new Set(rows.filter((row) => row.status === "nog_te_bepalen").map((row) => row.lessonDate)),
      );
    }

    loadOpenDates();
    return () => {
      cancelled = true;
    };
  }, [selectedClass, month]);

  async function handleConfirm() {
    if (!selectedClass || !selectedDate) return;
    setIsSubmitting(true);
    const result = await addActivityToPlanning({
      activityId,
      classId: selectedClass.id,
      lessonDate: selectedDate,
    });
    setIsSubmitting(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    onDone(result.month);
  }

  if (!selectedClass) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Toevoegen aan planning</SheetTitle>
          <SheetDescription>Kies de klas waarvoor je deze activiteit inplant.</SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 pb-4">
          {classes.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Je hebt nog geen klassen. Maak er eerst één aan op de Planning-pagina.
            </p>
          ) : (
            classes.map((klas) => (
              <button
                key={klas.id}
                type="button"
                onClick={() => setSelectedClass(klas)}
                className="flex w-full flex-col items-start gap-0.5 rounded-lg border bg-background p-3 text-left transition-colors duration-150 ease-brand hover:bg-accent active:scale-[0.99]"
              >
                <span className="text-sm font-medium">{klas.name}</span>
                <span className="text-xs text-muted-foreground">{DOELGROEP_LABELS[klas.doelgroep]}</span>
              </button>
            ))
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>Kies een datum</SheetTitle>
        <SheetDescription>
          Voor {selectedClass.name} — datums met een stipje hebben al een lesmoment dat nog te bepalen is.
        </SheetDescription>
      </SheetHeader>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4">
        <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setSelectedClass(null)}>
          <ChevronLeft className="size-4" />
          Andere klas
        </Button>
        <MiniMonthPicker
          month={month}
          onMonthChange={setMonth}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          markedDates={markedDates}
          today={TODAY}
        />
        <Button type="button" disabled={!selectedDate || isSubmitting} onClick={handleConfirm}>
          {isSubmitting ? "Toevoegen…" : "Toevoegen aan planning"}
        </Button>
      </div>
    </>
  );
}

/**
 * "Toevoegen aan planning"-flow vanaf de activiteit-detailpagina: klas
 * kiezen -> datum kiezen -> koppelt/maakt een geplande_lessen-rij (zie
 * actions/planning.ts's addActivityToPlanning). Bevestiging via een
 * sonner-toast met een actieknop naar de kalendermaand van de nieuwe
 * koppeling.
 */
export function AddToPlanningSheet({
  open,
  onOpenChange,
  activityId,
  classes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activityId: string;
  classes: PlanningClass[];
}) {
  const router = useRouter();

  function handleDone(month: string) {
    onOpenChange(false);
    toast.success("Toegevoegd aan de planning.", {
      action: {
        label: "Bekijk planning",
        onClick: () => router.push(`/profiel/planning?maand=${month}`),
      },
    });
    router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {open && <AddToPlanningSheetBody key="open" activityId={activityId} classes={classes} onDone={handleDone} />}
      </SheetContent>
    </Sheet>
  );
}
