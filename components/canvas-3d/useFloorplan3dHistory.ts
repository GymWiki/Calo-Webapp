"use client";

import { useCallback, useRef, useState } from "react";
import type { ConeField, Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";

export type Floorplan3dSnapshot = { room: Floorplan3dRoom; items: Floorplan3dItem[]; coneFields: ConeField[] };

const MAX_HISTORY = 50;

/**
 * Undo/redo (Ctrl+Z / Ctrl+Shift+Z) voor de 3D-editor — een simpele
 * snapshot-stack (max 50 stappen, zie Stap 4.8), geen diff/patch-formaat.
 * Elke muterende actie in Floorplan3dEditor.tsx roept `push(voorgaande
 * staat)` aan VÓÓR de wijziging zelf wordt toegepast, zodat undo altijd
 * teruggaat naar de staat van vóór die actie. `canUndo`/`canRedo` zijn
 * bewust losse useState-booleans (niet .length van de ref tijdens render
 * gelezen) — react-hooks/refs staat geen ref-read toe buiten een effect/
 * event-handler, dus de "kan dit nog?"-vlag moet expliciet staat zijn.
 */
export function useFloorplan3dHistory() {
  const undoStack = useRef<Floorplan3dSnapshot[]>([]);
  const redoStack = useRef<Floorplan3dSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const push = useCallback((snapshot: Floorplan3dSnapshot) => {
    undoStack.current.push(snapshot);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback((current: Floorplan3dSnapshot): Floorplan3dSnapshot | null => {
    const previous = undoStack.current.pop();
    if (!previous) return null;
    redoStack.current.push(current);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
    return previous;
  }, []);

  const redo = useCallback((current: Floorplan3dSnapshot): Floorplan3dSnapshot | null => {
    const next = redoStack.current.pop();
    if (!next) return null;
    undoStack.current.push(current);
    setCanRedo(redoStack.current.length > 0);
    setCanUndo(true);
    return next;
  }, []);

  return { push, undo, redo, canUndo, canRedo };
}
