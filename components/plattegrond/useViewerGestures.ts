"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, RefObject } from "react";

import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
  currentPolarDeg,
  dragBy,
  orbitBy,
  panBy,
  tiltTo,
  wheelZoom,
  zoomBy,
  type ViewState,
} from "@/components/plattegrond/viewer-camera";

// Bediening van de alleen-lezen plattegrond-viewer, zonder knoppen:
//   muis     slepen = draaien en kantelen · rechts slepen (of Shift+slepen) = verschuiven · wiel = zoomen · dubbelklik = terug
//   aanraken één tik = "bewegen aanzetten" (zo blijft scrollen over de pagina werkend); daarna één vinger = draaien en kantelen,
//            twee vingers = knijpen om te zoomen en verschuiven, dubbeltik = terug; een tik buiten de tekening zet scrollen weer aan
//   toetsen  pijltjes draaien en kantelen · + / − zoomen · 0 of Home = terug
// De wiel-zoom laat het wiel los zodra de uiterste zoom is bereikt, zodat de pagina daarna gewoon verder scrolt.

const TAP_MAX_MOVE_PX = 8;
const TAP_MAX_MS = 350;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_DISTANCE_PX = 32;
const KEY_ROTATE_DEG = 15;
const KEY_TILT_DEG = 8;

type Point = { x: number; y: number };
type Gesture = { mode: "orbit" | "pan" | "pinch" | "tap"; startX: number; startY: number; startAt: number; moved: boolean; distance: number; mid: Point };

export type PointerKind = "mouse" | "touch";

export function useViewerGestures({
  containerRef,
  view,
  apply,
  initialView,
  metersPerPx,
  forceActive = false,
}: {
  containerRef: RefObject<HTMLElement | null>;
  view: ViewState;
  apply: (update: (view: ViewState) => ViewState, immediately?: boolean) => void;
  /** De automatisch ingekaderde stand waar dubbelklik/dubbeltik naar terugkeert. */
  initialView: ViewState;
  /** Hoeveel meter één schermpixel is bij de huidige zoom (voor verschuiven). */
  metersPerPx: number;
  /** Volledig scherm: aanraken is altijd aan (er is geen pagina om naar te scrollen). */
  forceActive?: boolean;
}) {
  // Een apparaat met alleen aanraken (geen muis) begint met de aanraak-uitleg. De uitleg verschijnt pas na het laden van de canvas
  // (alleen in de browser), dus dit kan de server-HTML niet beïnvloeden.
  const [pointerKind, setPointerKind] = useState<PointerKind>(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches ? "touch" : "mouse",
  );
  const [touchActive, setTouchActive] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const active = forceActive || touchActive;

  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<Gesture | null>(null);
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null);
  const live = useRef({ view, initialView, metersPerPx, active });
  useEffect(() => {
    live.current = { view, initialView, metersPerPx, active };
  });

  const markInteracted = useCallback(() => setInteracted(true), []);
  const reset = useCallback(() => apply(() => live.current.initialView), [apply]);

  // Muiswiel: zoomen. Niet-passief zodat de pagina niet meescrolt; op de uiterste zoom laten we het wiel los.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const { view: current } = live.current;
      const lines = event.deltaMode === 1 ? 16 : 1;
      const delta = event.deltaY * lines * (event.ctrlKey ? 4 : 1);
      if (delta === 0) return;
      const atLimit = (delta < 0 && current.zoom >= ZOOM_MAX - 1e-6) || (delta > 0 && current.zoom <= ZOOM_MIN + 1e-6);
      if (atLimit) return;
      event.preventDefault();
      apply((v) => wheelZoom(v, delta), true);
      setInteracted(true);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [containerRef, apply]);

  // Aanraken uitzetten: een tik buiten de tekening, of Escape.
  useEffect(() => {
    if (!touchActive || forceActive) return;
    const element = containerRef.current;
    const onOutside = (event: PointerEvent) => {
      if (element && !element.contains(event.target as Node)) setTouchActive(false);
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setTouchActive(false);
    };
    document.addEventListener("pointerdown", onOutside, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [touchActive, forceActive, containerRef]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("[data-viewer-control]")) return;
      const kind: PointerKind = event.pointerType === "mouse" ? "mouse" : "touch";
      setPointerKind(kind);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const now = performance.now();

      if (kind === "mouse") {
        const pan = event.button === 2 || event.button === 1 || event.shiftKey;
        if (event.button > 2) return;
        gesture.current = { mode: pan ? "pan" : "orbit", startX: event.clientX, startY: event.clientY, startAt: now, moved: false, distance: 0, mid: { x: event.clientX, y: event.clientY } };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      if (!live.current.active) {
        gesture.current = { mode: "tap", startX: event.clientX, startY: event.clientY, startAt: now, moved: false, distance: 0, mid: { x: event.clientX, y: event.clientY } };
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);
      if (pointers.current.size >= 2) {
        const [a, b] = [...pointers.current.values()];
        gesture.current = { mode: "pinch", startX: 0, startY: 0, startAt: now, moved: true, distance: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      } else {
        gesture.current = { mode: "orbit", startX: event.clientX, startY: event.clientY, startAt: now, moved: false, distance: 0, mid: { x: event.clientX, y: event.clientY } };
      }
    },
    [],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const previous = pointers.current.get(event.pointerId);
      const current = gesture.current;
      if (!previous || !current) return;
      const point = { x: event.clientX, y: event.clientY };
      pointers.current.set(event.pointerId, point);

      if (current.mode === "tap") {
        if (Math.hypot(point.x - current.startX, point.y - current.startY) > TAP_MAX_MOVE_PX) current.moved = true;
        return;
      }
      if (current.mode === "pinch") {
        if (pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const factor = current.distance > 0 && distance > 0 ? distance / current.distance : 1;
        const dx = mid.x - current.mid.x;
        const dy = mid.y - current.mid.y;
        const mpp = live.current.metersPerPx;
        apply((v) => panBy(zoomBy(v, factor), dx, dy, mpp / factor), true);
        current.distance = distance;
        current.mid = mid;
        setInteracted(true);
        return;
      }
      const dx = point.x - previous.x;
      const dy = point.y - previous.y;
      if (!current.moved && Math.hypot(point.x - current.startX, point.y - current.startY) > TAP_MAX_MOVE_PX) current.moved = true;
      if (dx === 0 && dy === 0) return;
      if (current.mode === "pan") {
        const mpp = live.current.metersPerPx;
        apply((v) => panBy(v, dx, dy, mpp), true);
      } else apply((v) => orbitBy(v, dx, dy), true);
      setInteracted(true);
    },
    [apply],
  );

  const onPointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const current = gesture.current;
      const wasTap = Boolean(current && !current.moved && performance.now() - current.startAt < TAP_MAX_MS && current.mode !== "pinch");
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) gesture.current = null;
      else if (pointers.current.size === 1) {
        const [remaining] = [...pointers.current.values()];
        gesture.current = { mode: "orbit", startX: remaining.x, startY: remaining.y, startAt: performance.now(), moved: true, distance: 0, mid: remaining };
      }
      if (event.type === "pointercancel" || event.pointerType === "mouse" || !wasTap) return;

      // Aanraken: een tik zet bewegen aan; als het al aan staat is twee tikken vlak na elkaar "terug".
      if (!live.current.active) {
        setTouchActive(true);
        return;
      }
      const now = performance.now();
      const previousTap = lastTap.current;
      if (previousTap && now - previousTap.at < DOUBLE_TAP_MS && Math.hypot(event.clientX - previousTap.x, event.clientY - previousTap.y) < DOUBLE_TAP_DISTANCE_PX) {
        lastTap.current = null;
        reset();
        setInteracted(true);
      } else lastTap.current = { at: now, x: event.clientX, y: event.clientY };
    },
    [reset],
  );

  const onDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("[data-viewer-control]")) return;
      reset();
      markInteracted();
    },
    [reset, markInteracted],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("[data-viewer-control]")) return;
      const handlers: Record<string, () => void> = {
        // Pijl = dezelfde richting als slepen: naar rechts = de plattegrond draait naar rechts.
        ArrowLeft: () => apply((v) => dragBy(v, KEY_ROTATE_DEG)),
        ArrowRight: () => apply((v) => dragBy(v, -KEY_ROTATE_DEG)),
        ArrowUp: () => apply((v) => tiltTo(v, currentPolarDeg(v) + KEY_TILT_DEG)),
        ArrowDown: () => apply((v) => tiltTo(v, currentPolarDeg(v) - KEY_TILT_DEG)),
        "+": () => apply((v) => zoomBy(v, ZOOM_STEP)),
        "=": () => apply((v) => zoomBy(v, ZOOM_STEP)),
        "-": () => apply((v) => zoomBy(v, 1 / ZOOM_STEP)),
        "0": reset,
        Home: reset,
      };
      const handler = handlers[event.key];
      if (handler) {
        event.preventDefault();
        handler();
        markInteracted();
      }
    },
    [apply, reset, markInteracted],
  );

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onDoubleClick, onKeyDown, onContextMenu: (event: React.MouseEvent) => event.preventDefault() },
    active,
    pointerKind,
    interacted,
    /** touch-action: aan = één vinger beweegt de tekening (de pagina scrolt niet); uit = de pagina scrolt, een tik zet bewegen aan. */
    touchAction: active ? ("none" as const) : ("pan-y" as const),
  };
}
