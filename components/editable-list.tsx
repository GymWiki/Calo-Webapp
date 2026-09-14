"use client";

import { useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Rij-per-item lijst-invoer — elk item is een eigen, direct bewerkbaar
 * invoerveld (in tegenstelling tot DynamicTextList, dat items als
 * niet-bewerkbare chips toont en alleen toevoegen/verwijderen ondersteunt).
 * Voor velden waar de volgorde en de exacte bewoording van elk item ertoe
 * doen — leeruitkomsten, materiaallijsten, regels, leerhulp-tips — en die
 * als array moeten worden opgeslagen, nooit als aan-elkaar-geplakte tekst.
 */
export function EditableList({
  label,
  items,
  onChange,
  onCommit,
  itemPlaceholder,
  addLabel = "Voeg item toe",
  emptyHint,
}: {
  label?: string;
  items: string[];
  onChange: (items: string[]) => void;
  /** Optioneel: gevuld bij het verlaten van een regel of het verwijderen van
   * een item — gebruikt voor de concept-auto-save. */
  onCommit?: () => void;
  itemPlaceholder: string;
  addLabel?: string;
  emptyHint?: string;
}) {
  const lastInputRef = useRef<HTMLInputElement | null>(null);
  const shouldFocusLastRef = useRef(false);

  useEffect(() => {
    if (shouldFocusLastRef.current) {
      lastInputRef.current?.focus();
      shouldFocusLastRef.current = false;
    }
  }, [items.length]);

  function updateItem(index: number, value: string) {
    onChange(items.map((item, i) => (i === index ? value : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
    onCommit?.();
  }

  function addItem() {
    shouldFocusLastRef.current = true;
    onChange([...items, ""]);
  }

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}

      {items.length === 0 && emptyHint && (
        <p className="text-sm text-muted-foreground italic">{emptyHint}</p>
      )}

      {items.length > 0 && (
        <ul className="space-y-1.5">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-1.5">
              <Input
                ref={index === items.length - 1 ? lastInputRef : undefined}
                value={item}
                onChange={(event) => updateItem(index, event.target.value)}
                onBlur={onCommit}
                placeholder={itemPlaceholder}
                aria-label={`${label ?? "Item"} ${index + 1}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeItem(index)}
                aria-label={`Verwijder item ${index + 1}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button type="button" variant="outline" size="sm" onClick={addItem}>
        <Plus className="size-4" />
        {addLabel}
      </Button>
    </div>
  );
}
