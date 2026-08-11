"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORY_STYLES } from "@/lib/didactics-styles";
import { cn } from "@/lib/utils";
import {
  DIDACTIC_CATEGORY_LABELS,
  DIDACTIC_CATEGORY_SUBTITLES,
  DIDACTIC_SUBTHEMES,
  type DidacticCategory,
  type DidacticItem,
} from "@/types/lesson";

function createId() {
  return `d-${Math.random().toString(36).slice(2, 10)}`;
}

export function DidacticsAddToList({
  category,
  items,
  onAdd,
  onUpdate,
  onRemove,
}: {
  category: DidacticCategory;
  items: DidacticItem[];
  onAdd: (item: DidacticItem) => void;
  onUpdate: (item: DidacticItem) => void;
  onRemove: (id: string) => void;
}) {
  const [subTheme, setSubTheme] = useState("");
  const [observation, setObservation] = useState("");
  const [action, setAction] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const style = CATEGORY_STYLES[category];
  const canSubmit = observation.trim().length > 0 && action.trim().length > 0;

  function resetForm() {
    setSubTheme("");
    setObservation("");
    setAction("");
    setEditingId(null);
  }

  function handleSubmit() {
    if (!canSubmit) return;

    const item: DidacticItem = {
      id: editingId ?? createId(),
      category,
      subTheme: subTheme || null,
      observation: observation.trim(),
      action: action.trim(),
    };

    if (editingId) {
      onUpdate(item);
    } else {
      onAdd(item);
    }
    resetForm();
  }

  function handleEdit(item: DidacticItem) {
    setEditingId(item.id);
    setSubTheme(item.subTheme ?? "");
    setObservation(item.observation);
    setAction(item.action);
  }

  function handleRemove(id: string) {
    onRemove(id);
    if (editingId === id) resetForm();
  }

  return (
    <div className={cn("rounded-2xl border", style.border)}>
      <div className={cn("rounded-t-2xl px-4 py-3", style.header)}>
        <p className="font-semibold">
          {style.emoji} {DIDACTIC_CATEGORY_LABELS[category]}
        </p>
        <p className="text-xs opacity-80">
          {DIDACTIC_CATEGORY_SUBTITLES[category]}
        </p>
      </div>

      <div className="space-y-4 p-4">
        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="animate-fade-up flex items-start justify-between gap-2 rounded-lg border bg-card p-3"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  {item.subTheme && (
                    <Badge variant="secondary" className="mb-0.5">
                      #{item.subTheme}
                    </Badge>
                  )}
                  <p className="text-sm break-words">
                    <span className="font-medium">Zie:</span> {item.observation}
                  </p>
                  <p className="text-sm break-words">
                    <span className="font-medium">Doe:</span> {item.action}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Bewerken"
                    onClick={() => handleEdit(item)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Verwijderen"
                    onClick={() => handleRemove(item.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <div>
            <Label htmlFor={`${category}-subtheme`}>Subthema (optioneel)</Label>
            <select
              id={`${category}-subtheme`}
              value={subTheme}
              onChange={(event) => setSubTheme(event.target.value)}
              className="border-input mt-1.5 flex h-11 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <option value="">Geen subthema</option>
              {DIDACTIC_SUBTHEMES[category].map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor={`${category}-observation`}>
              Wat zie je? (observatie)
            </Label>
            <Textarea
              id={`${category}-observation`}
              className="mt-1.5"
              value={observation}
              onChange={(event) => setObservation(event.target.value)}
              placeholder="Bijv. Leerlingen snappen de wisselafspraak niet"
            />
          </div>

          <div>
            <Label htmlFor={`${category}-action`}>
              Wat doe je? (interventie)
            </Label>
            <Textarea
              id={`${category}-action`}
              className="mt-1.5"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              placeholder="Bijv. Wisselstop invoeren en visueel voordoen"
            />
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              className="flex-1"
              onClick={handleSubmit}
              disabled={!canSubmit}
            >
              {editingId ? (
                <>
                  <Check className="size-4" />
                  Wijziging opslaan
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Toevoegen aan lijst
                </>
              )}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" size="icon" onClick={resetForm}>
                <X className="size-4" />
                <span className="sr-only">Annuleren</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
