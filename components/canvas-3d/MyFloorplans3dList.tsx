"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Floorplan3dSummary } from "@/types/floorplan3d";

/**
 * "Mijn 3D-plattegronden" — openen/hernoemen/verwijderen (zie Stap 4.9).
 * Puur presentatie; de server-acties zelf leven in
 * Floorplan3dEditor.tsx (actions/floorplans3d.ts).
 */
export function MyFloorplans3dList({
  floorplans,
  activeId,
  onOpen,
  onRename,
  onDelete,
  onCreateNew,
}: {
  floorplans: Floorplan3dSummary[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onRename: (id: string, naam: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onCreateNew: () => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  function startEditing(fp: Floorplan3dSummary) {
    setEditingId(fp.id);
    setEditingValue(fp.naam);
  }

  function commitEditing() {
    if (editingId && editingValue.trim()) {
      void onRename(editingId, editingValue.trim());
    }
    setEditingId(null);
  }

  return (
    <div className="space-y-3">
      <Button type="button" variant="outline" className="w-full" onClick={onCreateNew}>
        <Plus className="size-4" />
        Nieuwe 3D-plattegrond
      </Button>

      {floorplans.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nog geen 3D-plattegronden opgeslagen.</p>
      ) : (
        <ul className="space-y-1.5">
          {floorplans.map((fp) => (
            <li
              key={fp.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border p-2",
                fp.id === activeId && "border-primary bg-primary/5",
              )}
            >
              {editingId === fp.id ? (
                <>
                  <Input
                    autoFocus
                    value={editingValue}
                    onChange={(event) => setEditingValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") commitEditing();
                      if (event.key === "Escape") setEditingId(null);
                    }}
                    className="h-8 flex-1"
                  />
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={commitEditing}>
                    <Check className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => setEditingId(null)}>
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onOpen(fp.id)}
                    className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
                  >
                    {fp.naam}
                  </button>
                  <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => startEditing(fp)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive"
                    onClick={() => void onDelete(fp.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
