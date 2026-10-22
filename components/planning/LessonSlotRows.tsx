"use client";

import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_FIELD_CLASS } from "@/components/planning/planning-ui";
import { WEEKDAY_LABELS, type LessonSlot } from "@/types/planning";

const DEFAULT_SLOT: LessonSlot = { weekday: 3, startTime: "09:00", durationMinutes: 45 };

/**
 * Rij-per-weekmoment invoer voor een klas — zelfde rij/toevoegen/verwijderen-
 * patroon als components/editable-list.tsx (EditableList), maar met een
 * gestructureerde rij (dag + tijd + duur) i.p.v. losse strings, want een
 * lesson_slot is geen vrije tekst.
 */
export function LessonSlotRows({
  slots,
  onChange,
}: {
  slots: LessonSlot[];
  onChange: (slots: LessonSlot[]) => void;
}) {
  function updateSlot(index: number, patch: Partial<LessonSlot>) {
    onChange(slots.map((slot, i) => (i === index ? { ...slot, ...patch } : slot)));
  }

  function removeSlot(index: number) {
    onChange(slots.filter((_, i) => i !== index));
  }

  function addSlot() {
    onChange([...slots, DEFAULT_SLOT]);
  }

  return (
    <div className="space-y-2">
      <Label>Vaste weekmomenten</Label>

      {slots.length === 0 && (
        <p className="text-sm text-muted-foreground italic">
          Nog geen weekmoment toegevoegd.
        </p>
      )}

      {slots.length > 0 && (
        <ul className="space-y-2">
          {slots.map((slot, index) => (
            <li key={index} className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
              <select
                value={slot.weekday}
                onChange={(event) => updateSlot(index, { weekday: Number(event.target.value) })}
                className={SELECT_FIELD_CLASS}
                aria-label={`Dag van weekmoment ${index + 1}`}
              >
                {Object.entries(WEEKDAY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Input
                type="time"
                value={slot.startTime}
                onChange={(event) => updateSlot(index, { startTime: event.target.value })}
                className="w-32 shrink-0"
                aria-label={`Starttijd van weekmoment ${index + 1}`}
              />
              <Input
                type="number"
                min={5}
                max={240}
                step={5}
                value={slot.durationMinutes}
                onChange={(event) =>
                  updateSlot(index, { durationMinutes: Number(event.target.value) })
                }
                className="w-24 shrink-0"
                aria-label={`Duur in minuten van weekmoment ${index + 1}`}
              />
              <span className="text-sm whitespace-nowrap text-muted-foreground">min</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeSlot(index)}
                aria-label={`Verwijder weekmoment ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addSlot}>
        <Plus className="size-4" />
        Voeg weekmoment toe
      </Button>
    </div>
  );
}
