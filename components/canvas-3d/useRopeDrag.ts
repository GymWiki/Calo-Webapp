"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { toast } from "sonner";

import type { AnchorView } from "@/components/canvas-3d/AnchorMarkers";
import type { RopeKind } from "@/components/canvas-3d/anchors";
import type { DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import type { Vec3 } from "@/components/canvas-3d/orientation";
import { anchorAt, anchorWorld, createRope, ropeLength } from "@/components/canvas-3d/rope";
import {
  ROPE_MOVE_THRESHOLD_M,
  formatLength,
  itemsNear,
  moveRopeWhole,
  nearestSnap,
  resolveDrop,
  validateRope,
  type Drop,
  type Room,
  type WholeMove,
} from "@/components/canvas-3d/rope-drag";
import type { Floorplan3dSnapshot } from "@/components/canvas-3d/useFloorplan3dHistory";
import { haptic } from "@/lib/haptics";
import { endItemId, type Floorplan3dItem, type Rope, type RopeEnd } from "@/types/floorplan3d";

// Het sleepmodel voor touwen, linten en netten — één duidelijke state-machine:
//   pointerdown op een eindpunt-handle / op een object (touw spannen) / op het touw zelf  → `begin…`  (pointer vastgezet, camera uit)
//   pointermove                                                                            → preview bijwerken (ook de lengte, anchors die oplichten)
//   pointerup                                                                              → ÉÉN commit naar de scene (één undo-stap) of een melding
//   pointercancel / Escape / venster verliest focus                                        → annuleren, niets verandert
// Elke uitgang ruimt de drag-state op; er is geen pad dat alleen een preview achterlaat. Een bestaand eindpunt wordt NIET meer opnieuw
// afgeleid uit het oude uiteinde: wat wordt losgelaten ({ item, anchor } of { free }) is de opgeslagen waarheid.

export type RopeDragEnv = {
  items: readonly Floorplan3dItem[];
  ropes: readonly Rope[];
  lookup: DimsLookup;
  room: Room;
  /** De scene zoals die nu is (voor de undo-stap). */
  getSnapshot: () => Floorplan3dSnapshot;
  pushHistory: (snapshot: Floorplan3dSnapshot) => void;
  setRopes: (updater: (previous: Rope[]) => Rope[]) => void;
  /** Na elke commit: autosave plannen. */
  onCommitted: (ropeId: string) => void;
  undo: () => void;
  createId: () => string;
};

type Common = { snapshot: Floorplan3dSnapshot; pointerTarget: Element | null; pointerId: number | null; shift: boolean };
type EndDrag = Common & {
  type: "end";
  /** Bestaand touw waarvan een uiteinde wordt verplaatst; `null` = een nieuw touw. */
  ropeId: string | null;
  kind: RopeKind;
  fixed: RopeEnd;
  fixedWorld: Vec3;
  moving: "a" | "b";
  cursor: Vec3;
  hoveredId: string | null;
  drop: Drop | null;
  invalid: string | null;
  /** De laatste geldige plek van het losse uiteinde: blijft getoond als de cursor ergens ongeldig is. */
  lastValid: Vec3;
};
type WholeDrag = Common & {
  type: "whole";
  ropeId: string;
  kind: RopeKind;
  startA: Vec3;
  startB: Vec3;
  grab: { x: number; z: number };
  cursor: Vec3;
  /** Pas een echte sleepbeweging (meer dan de drempel) verplaatst het touw; een tik selecteert alleen. */
  started: boolean;
  result: WholeMove | null;
};
type Drag = EndDrag | WholeDrag;

export type RopeDragView = {
  mode: "end" | "whole";
  /** Het echte touw is tijdens het slepen even weg; de preview toont de nieuwe stand. */
  hiddenRopeId: string | null;
  targetId: string | null;
  preview: { from: Vec3; to: Vec3; label: string; invalid: boolean } | null;
  anchorViews: Record<string, AnchorView>;
};

const sameWorld = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function useRopeDrag(env: RopeDragEnv) {
  const envRef = useRef(env);
  useEffect(() => {
    envRef.current = env;
  });
  const dragRef = useRef<Drag | null>(null);
  const moveStampRef = useRef(0);
  const [view, setView] = useState<RopeDragView | null>(null);
  const [active, setActive] = useState(false);

  const clear = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.pointerTarget && drag.pointerId !== null) {
      try {
        drag.pointerTarget.releasePointerCapture?.(drag.pointerId);
      } catch {
        // al losgelaten
      }
    }
    setView(null);
    setActive(false);
  }, []);

  /** Annuleren (Escape, pointercancel, focusverlies): niets verandert; eventueel met een korte melding. */
  const cancel = useCallback(
    (message?: string) => {
      if (!dragRef.current) return;
      clear();
      if (message) toast.info(message);
    },
    [clear],
  );

  // --- weergave bijwerken --------------------------------------------------------------------------------------------

  const publish = useCallback((drag: Drag) => {
    const e = envRef.current;
    const views: Record<string, AnchorView> = {};
    if (drag.type === "end") {
      const fixedItem = endItemId(drag.fixed);
      if (fixedItem) views[fixedItem] = { highlightId: "anchor" in drag.fixed ? (drag.fixed.anchor ?? null) : null, labels: false };
      for (const id of itemsNear(e.items, e.lookup, drag.cursor)) views[id] ??= { highlightId: null, labels: false };
      const targetId = drag.drop && drag.drop.ok && drag.drop.via === "anchor" ? drag.drop.itemId : null;
      if (targetId) views[targetId] = { highlightId: (drag.drop as Extract<Drop, { ok: true }>).anchorId, labels: false };
      const to = drag.drop && drag.drop.ok && !drag.invalid ? drag.drop.world : drag.lastValid;
      const length = ropeLength(drag.fixedWorld, to);
      setView({
        mode: "end",
        hiddenRopeId: drag.ropeId,
        targetId,
        preview: { from: drag.fixedWorld, to, label: drag.invalid ?? formatLength(length), invalid: Boolean(drag.invalid) },
        anchorViews: views,
      });
      return;
    }
    if (!drag.started || !drag.result) {
      setView(null);
      return;
    }
    const r = drag.result;
    for (const point of [r.worldA, r.worldB]) for (const id of itemsNear(e.items, e.lookup, point)) views[id] ??= { highlightId: null, labels: false };
    for (const end of [r.a, r.b]) {
      const id = endItemId(end);
      if (id && "anchor" in end) views[id] = { highlightId: end.anchor ?? null, labels: false };
    }
    setView({
      mode: "whole",
      hiddenRopeId: drag.ropeId,
      targetId: null,
      preview: { from: r.worldA, to: r.worldB, label: formatLength(ropeLength(r.worldA, r.worldB)), invalid: false },
      anchorViews: views,
    });
  }, []);

  const recompute = useCallback(
    (drag: Drag) => {
      const e = envRef.current;
      if (drag.type === "end") {
        const drop = resolveDrop({
          cursor: drag.cursor,
          hoveredItemId: drag.hoveredId,
          items: e.items,
          lookup: e.lookup,
          room: e.room,
          kind: drag.kind,
          otherEnd: drag.fixed,
          otherWorld: drag.fixedWorld,
          snap: !drag.shift,
        });
        drag.drop = drop;
        drag.invalid = drop.ok ? validateRope(drag.fixedWorld, drop.world, drag.kind, e.room) : drop.reason;
        if (drop.ok && !drag.invalid) drag.lastValid = drop.world;
      } else if (drag.started) {
        drag.result = moveRopeWhole({
          rope: e.ropes.find((rope) => rope.id === drag.ropeId) as Rope,
          items: e.items,
          lookup: e.lookup,
          room: e.room,
          delta: { x: drag.cursor[0] - drag.grab.x, z: drag.cursor[2] - drag.grab.z },
          startA: drag.startA,
          startB: drag.startB,
          snap: !drag.shift,
        });
      }
      publish(drag);
    },
    [publish],
  );

  // --- starten -----------------------------------------------------------------------------------------------------------

  const capture = (drag: Common, event: ThreeEvent<PointerEvent>) => {
    const target = event.nativeEvent.target as Element | null;
    drag.pointerTarget = target;
    drag.pointerId = event.nativeEvent.pointerId;
    try {
      target?.setPointerCapture?.(event.nativeEvent.pointerId);
    } catch {
      // niet ondersteund: de window-listeners vangen het op
    }
    drag.shift = event.nativeEvent.shiftKey;
  };

  /** "Touw spannen": pointerdown op een object start een nieuw touw vanaf zijn bevestigingspunt. */
  const beginNew = useCallback(
    (itemId: string, point: Vec3, event: ThreeEvent<PointerEvent>, kind: RopeKind = "touw") => {
      const e = envRef.current;
      const item = e.items.find((candidate) => candidate.id === itemId);
      if (!item) return;
      const fixed = anchorAt(item, point, e.lookup, kind);
      const fixedWorld = anchorWorld(fixed, e.items, e.lookup, kind);
      if (!fixedWorld) return;
      const drag: EndDrag = {
        type: "end", ropeId: null, kind, fixed, fixedWorld, moving: "b", cursor: point, hoveredId: null, drop: null, invalid: null, lastValid: fixedWorld,
        snapshot: e.getSnapshot(), pointerTarget: null, pointerId: null, shift: false,
      };
      capture(drag, event);
      dragRef.current = drag;
      setActive(true);
      recompute(drag);
    },
    [recompute],
  );

  /** Pointerdown op een oranje eindpunt-handle van het geselecteerde touw: dat uiteinde wordt versleept. */
  const beginEnd = useCallback(
    (ropeId: string, moving: "a" | "b", event: ThreeEvent<PointerEvent>) => {
      const e = envRef.current;
      const rope = e.ropes.find((candidate) => candidate.id === ropeId);
      if (!rope) return;
      const kind = rope.kind ?? "touw";
      const fixed = moving === "a" ? rope.b : rope.a;
      const fixedWorld = anchorWorld(fixed, e.items, e.lookup, kind);
      const start = anchorWorld(rope[moving], e.items, e.lookup, kind);
      if (!fixedWorld || !start) return;
      const drag: EndDrag = {
        type: "end", ropeId, kind, fixed, fixedWorld, moving, cursor: start, hoveredId: null, drop: null, invalid: null, lastValid: start,
        snapshot: e.getSnapshot(), pointerTarget: null, pointerId: null, shift: false,
      };
      capture(drag, event);
      dragRef.current = drag;
      setActive(true);
      recompute(drag);
    },
    [recompute],
  );

  /** Pointerdown op het touw zelf of op zijn middelste handle: bij een echte sleepbeweging verschuift het hele touw. */
  const beginWhole = useCallback((ropeId: string, event: ThreeEvent<PointerEvent>) => {
    const e = envRef.current;
    const rope = e.ropes.find((candidate) => candidate.id === ropeId);
    if (!rope) return;
    const kind = rope.kind ?? "touw";
    const a = anchorWorld(rope.a, e.items, e.lookup, kind);
    const b = anchorWorld(rope.b, e.items, e.lookup, kind);
    if (!a || !b) return;
    const drag: WholeDrag = {
      type: "whole", ropeId, kind, startA: a, startB: b, grab: { x: event.point.x, z: event.point.z }, cursor: [event.point.x, event.point.y, event.point.z],
      started: false, result: null, snapshot: e.getSnapshot(), pointerTarget: null, pointerId: null, shift: false,
    };
    capture(drag, event);
    dragRef.current = drag;
    setActive(true);
  }, []);

  // --- bewegen -----------------------------------------------------------------------------------------------------------

  const update = useCallback(
    (cursor: Vec3, hoveredId: string | null, shift: boolean) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.cursor = cursor;
      drag.shift = shift;
      if (drag.type === "end") drag.hoveredId = hoveredId;
      else if (!drag.started && Math.hypot(cursor[0] - drag.grab.x, cursor[2] - drag.grab.z) >= ROPE_MOVE_THRESHOLD_M) drag.started = true;
      recompute(drag);
    },
    [recompute],
  );

  const moveOnItem = useCallback(
    (id: string, event: ThreeEvent<PointerEvent>) => {
      if (!dragRef.current) return;
      moveStampRef.current = event.nativeEvent.timeStamp;
      update([event.point.x, event.point.y, event.point.z], id, event.nativeEvent.shiftKey);
    },
    [update],
  );

  /** Cursor op de vloer. Geeft `true` als de drag dit event heeft afgehandeld. */
  const moveOnFloor = useCallback(
    (event: ThreeEvent<PointerEvent>): boolean => {
      const drag = dragRef.current;
      if (!drag) return false;
      // Hetzelfde pointer-event is al door een object afgehandeld (het ligt voor de vloer): de objectcursor wint.
      if (moveStampRef.current === event.nativeEvent.timeStamp) return true;
      update([event.point.x, drag.type === "end" ? drag.fixedWorld[1] : drag.cursor[1], event.point.z], null, event.nativeEvent.shiftKey);
      return true;
    },
    [update],
  );

  // --- loslaten ----------------------------------------------------------------------------------------------------------

  /** Legt het resultaat van de drag vast als één actie (één undo-stap), of meldt waarom het niet kan. */
  const commit = useCallback(() => {
    const drag = dragRef.current;
    if (!drag) return;
    const e = envRef.current;
    clear();

    if (drag.type === "whole") {
      if (!drag.started || !drag.result) return; // alleen een tik: het touw is geselecteerd, niets verplaatst
      const result = drag.result;
      if (sameWorld(result.worldA, drag.startA) < 1e-6 && sameWorld(result.worldB, drag.startB) < 1e-6 && !result.anchored) return;
      e.pushHistory(drag.snapshot);
      e.setRopes((previous) => previous.map((rope) => (rope.id === drag.ropeId ? { ...rope, a: result.a, b: result.b } : rope)));
      haptic(10);
      e.onCommitted(drag.ropeId);
      if (result.detached) toast("Touw losgemaakt van de objecten", { action: { label: "Ongedaan maken", onClick: () => e.undo() }, duration: 6000 });
      else if (result.anchored) toast.success("Touw vastgemaakt aan de bevestigingspunten");
      return;
    }

    const drop = drag.drop;
    if (!drop || !drop.ok) {
      toast.error(drop ? drop.reason : "Geen geldig punt");
      return;
    }
    if (drag.invalid) {
      toast.error(`Geen geldig punt: ${drag.invalid.charAt(0).toLowerCase()}${drag.invalid.slice(1)}`);
      return;
    }
    e.pushHistory(drag.snapshot);
    let id = drag.ropeId;
    if (drag.ropeId) {
      e.setRopes((previous) => previous.map((rope) => (rope.id === drag.ropeId ? { ...rope, [drag.moving]: drop.end } : rope)));
    } else {
      id = e.createId();
      const created = createRope(id, drag.fixed, drop.end, drag.kind);
      e.setRopes((previous) => [...previous, created]);
    }
    haptic(10);
    e.onCommitted(id as string);
  }, [clear]);

  const upOnItem = useCallback(
    (id: string, event: ThreeEvent<PointerEvent>) => {
      if (!dragRef.current) return;
      event.stopPropagation();
      update([event.point.x, event.point.y, event.point.z], id, event.nativeEvent.shiftKey);
      commit();
    },
    [update, commit],
  );

  /** Loslaten op de vloer. Geeft `true` als de drag dit heeft afgehandeld. */
  const upOnFloor = useCallback((): boolean => {
    if (!dragRef.current) return false;
    commit();
    return true;
  }, [commit]);

  // --- vangnetten: elke uitgang ruimt op ----------------------------------------------------------------------------------
  useEffect(() => {
    if (!active) return;
    // Loslaten ergens waar geen object of vloer het event pakt (wand, het touw zelf, buiten het canvas): met de laatst bekende cursor committen.
    const onUp = () => window.setTimeout(() => dragRef.current && commit(), 0);
    const onCancel = () => cancel("Slepen onderbroken");
    const onShift = (event: KeyboardEvent) => {
      if (event.key !== "Shift" || !dragRef.current) return;
      dragRef.current.shift = event.type === "keydown";
      recompute(dragRef.current);
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("blur", onCancel);
    window.addEventListener("keydown", onShift);
    window.addEventListener("keyup", onShift);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("blur", onCancel);
      window.removeEventListener("keydown", onShift);
      window.removeEventListener("keyup", onShift);
    };
  }, [active, commit, cancel, recompute]);

  useEffect(() => () => clear(), [clear]);

  return { view, active, activeRef: dragRef, beginNew, beginEnd, beginWhole, moveOnItem, moveOnFloor, upOnItem, upOnFloor, cancel, nearestSnap };
}
