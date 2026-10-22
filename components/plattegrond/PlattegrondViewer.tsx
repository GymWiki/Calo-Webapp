"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ArrowLeftRight, Box, Loader2, Maximize2, Minus, Plus, RotateCcw, RotateCw, ScanLine } from "lucide-react";

import { getFloorplan3dViewData } from "@/actions/floorplans3d";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  DEFAULT_VIEW,
  ZOOM_STEP,
  canZoomIn,
  canZoomOut,
  dragBy,
  resetView,
  rotateStep,
  withPreset,
  zoomBy,
  type ViewPreset,
  type ViewState,
} from "@/components/plattegrond/viewer-camera";
import type { Floorplan3dData, Floorplan3dItem } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

// three/@react-three/fiber (+ de GLB-loader) zitten ALLEEN in deze dynamic
// chunk — de activiteitpagina zelf laadt dat pas zodra de viewer in beeld
// komt (zie `inView` hieronder), nooit in de eerste JS.
const ViewerCanvas = dynamic(() => import("@/components/plattegrond/ViewerCanvas"), { ssr: false });

/** Graden per pixel slepen. */
const DRAG_DEG_PER_PX = 0.3;
/** Verticale beweging mag een touch-gebaar niet naar draaien trekken: dat is paginascroll. */
const TOUCH_DRAG_THRESHOLD_PX = 8;

type ViewerData = { data: Floorplan3dData; models: MaterialModel[] };

type CommonProps = {
  mode?: "compact" | "fullscreen";
  /** Statische preview: placeholder tijdens het laden en fallback bij een fout / zonder WebGL. */
  previewUrl?: string | null;
  /** Naam van de plattegrond — voor de alt-tekst en het dialoogtitel. */
  title?: string;
  className?: string;
};

export type PlattegrondViewerProps = CommonProps &
  (
    | { data: Floorplan3dData; models: MaterialModel[]; plattegrondId?: string }
    | { plattegrondId: string; data?: undefined; models?: undefined }
  );

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

class CanvasErrorBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** true zodra het element (bijna) in beeld is — daarna blijft het true. */
function useSeenInViewport(ref: React.RefObject<HTMLElement | null>): boolean {
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, seen]);
  return seen;
}

function ControlButton({
  label,
  onClick,
  disabled,
  pressed,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "default" : "secondary"}
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-viewer-control
      className={cn("bg-card/95 text-foreground shadow-brand-sm backdrop-blur hover:bg-card", pressed && "bg-primary text-primary-foreground hover:bg-primary", className)}
    >
      {children}
    </Button>
  );
}

function ViewerBody({
  resolved,
  mode,
  previewUrl,
  title,
  className,
  onFullscreen,
  canvasActive,
}: {
  resolved: ViewerData;
  mode: "compact" | "fullscreen";
  previewUrl: string | null;
  title: string;
  className?: string;
  onFullscreen?: () => void;
  /** false: de canvas is (even) uitgeschakeld — bv. omdat de volledig-scherm-weergave hem overneemt. */
  canvasActive: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useSeenInViewport(containerRef);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [{ view, instant }, setViewState] = useState<{ view: ViewState; instant: boolean }>({ view: DEFAULT_VIEW, instant: false });
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setWebgl(supportsWebGL()));
    return () => cancelAnimationFrame(frame);
  }, []);

  const modelBySlug = useMemo(() => {
    const bySlug = new Map(resolved.models.map((model) => [model.slug, model]));
    return (slug: string) => bySlug.get(slug);
  }, [resolved.models]);

  const room = resolved.data.room;
  const items = resolved.data.items;
  const fields = resolved.data.coneFields;

  const apply = useCallback((update: (view: ViewState) => ViewState, immediately = false) => {
    setViewState((previous) => ({ view: update(previous.view), instant: immediately }));
  }, []);

  const onItemHover = useCallback(
    (item: Floorplan3dItem | null) => setHovered(item ? (modelBySlug(item.slug)?.naam ?? "Onbekend materiaal") : null),
    [modelBySlug],
  );
  const handleReady = useCallback(() => setReady(true), []);
  const handleError = useCallback(() => setFailed(true), []);

  // --- Slepen (muis: direct; touch: alleen horizontaal) en pinch-zoom. ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startX: number; dragging: boolean; pinchDistance: number } | null>(null);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-viewer-control]")) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      gesture.current = { startX: event.clientX, dragging: event.pointerType === "mouse", pinchDistance: 0 };
      if (event.pointerType === "mouse") event.currentTarget.setPointerCapture(event.pointerId);
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = { startX: 0, dragging: false, pinchDistance: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !gesture.current) return;
    const current = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, current);

    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (gesture.current.pinchDistance > 0 && distance > 0) {
        const factor = distance / gesture.current.pinchDistance;
        apply((v) => zoomBy(v, factor), true);
      }
      gesture.current.pinchDistance = distance;
      return;
    }

    if (!gesture.current.dragging) {
      // Touch: pas draaien bij een duidelijk horizontale beweging; verticaal is paginascroll.
      if (Math.abs(current.x - gesture.current.startX) < TOUCH_DRAG_THRESHOLD_PX) return;
      gesture.current.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const dx = current.x - previous.x;
    if (dx !== 0) apply((v) => dragBy(v, dx * DRAG_DEG_PER_PX), true);
  }

  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    else if (pointers.current.size === 1) gesture.current = { startX: [...pointers.current.values()][0].x, dragging: false, pinchDistance: 0 };
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-viewer-control]")) return;
    const handlers: Record<string, () => void> = {
      ArrowLeft: () => apply((v) => rotateStep(v, -1)),
      ArrowRight: () => apply((v) => rotateStep(v, 1)),
      "+": () => apply((v) => zoomBy(v, ZOOM_STEP)),
      "=": () => apply((v) => zoomBy(v, ZOOM_STEP)),
      "-": () => apply((v) => zoomBy(v, 1 / ZOOM_STEP)),
      "0": () => apply(() => resetView()),
      Home: () => apply(() => resetView()),
    };
    const handler = handlers[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  }

  const setPreset = (preset: ViewPreset) => apply((v) => withPreset(v, preset));
  const showCanvas = inView && webgl === true && !failed && canvasActive;
  const showThumbnail = Boolean(previewUrl) && !thumbFailed && (!showCanvas || !ready);
  const unavailable = !failed && webgl === false;
  const noPreviewAtAll = !previewUrl || thumbFailed;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={`Interactieve 3D-plattegrond: ${title}. Pijltjes links en rechts draaien, plus en min zoomen, nul zet terug.`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      // pan-y: verticaal vegen scrolt de pagina; horizontaal slepen en
      // pinchen komen bij ons terecht. Het muiswiel wordt niet onderschept.
      style={{ touchAction: "pan-y" }}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-slate-50 select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        mode === "compact" ? "h-[280px] md:h-[400px]" : "h-full min-h-[320px] rounded-none border-0",
        className,
      )}
    >
      {showCanvas && (
        <div className={cn("absolute inset-0 transition-opacity duration-300", ready ? "opacity-100" : "opacity-0")}>
          <CanvasErrorBoundary onError={handleError}>
            <ViewerCanvas
              room={room}
              items={items}
              fields={fields}
              modelBySlug={modelBySlug}
              view={view}
              instant={instant}
              onReady={handleReady}
              onItemHover={onItemHover}
            />
          </CanvasErrorBoundary>
        </div>
      )}

      {showThumbnail && (
        <Image
          src={previewUrl as string}
          alt={`Voorbeeld van de 3D-plattegrond ${title}`}
          fill
          unoptimized
          sizes="(min-width: 1024px) 600px, 100vw"
          className="object-contain p-2"
          onError={() => setThumbFailed(true)}
        />
      )}

      {!ready && showCanvas && noPreviewAtAll && (
        <div className="absolute inset-0 flex items-center justify-center" role="status" aria-live="polite">
          <Skeleton className="absolute inset-0 rounded-none" />
          <span className="relative flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> 3D-plattegrond laden...
          </span>
        </div>
      )}

      {(unavailable || failed) && noPreviewAtAll && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
          <Box className="size-8" aria-hidden="true" />
          De 3D-weergave is op dit apparaat niet beschikbaar.
        </div>
      )}

      {hovered && (
        <div className="pointer-events-none absolute top-2 left-2 rounded-md bg-slate-900/90 px-2 py-1 text-xs text-white shadow" role="status">
          {hovered}
        </div>
      )}

      {onFullscreen && (
        <div className="absolute top-2 right-2" data-viewer-control>
          <ControlButton label="Volledig scherm" onClick={onFullscreen}>
            <Maximize2 className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Volledig scherm</span>
          </ControlButton>
        </div>
      )}

      {showCanvas && ready && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 flex flex-wrap items-center justify-between gap-1.5 sm:justify-center sm:gap-4">
          <div className="pointer-events-auto flex items-center gap-1.5" data-viewer-control>
            <ControlButton label="Draai naar links" onClick={() => apply((v) => rotateStep(v, -1))}>
              <RotateCcw className="size-4" aria-hidden="true" />
            </ControlButton>
            <ControlButton label="Draai naar rechts" onClick={() => apply((v) => rotateStep(v, 1))}>
              <RotateCw className="size-4" aria-hidden="true" />
            </ControlButton>
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5" data-viewer-control>
            <ControlButton label="Schuine 3D-weergave" pressed={view.preset === "3d"} onClick={() => setPreset("3d")}>
              <Box className="size-4" aria-hidden="true" /> 3D
            </ControlButton>
            <ControlButton label="Bovenaanzicht" pressed={view.preset === "top"} onClick={() => setPreset("top")}>
              <ScanLine className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Bovenaanzicht</span>
            </ControlButton>
            <ControlButton label="Weergave terugzetten" onClick={() => apply(() => resetView())}>
              <ArrowLeftRight className="size-4 rotate-90" aria-hidden="true" />
              <span className="hidden sm:inline">Reset</span>
            </ControlButton>
          </div>
          <div className="pointer-events-auto flex items-center gap-1.5" data-viewer-control>
            <ControlButton label="Uitzoomen" disabled={!canZoomOut(view)} onClick={() => apply((v) => zoomBy(v, 1 / ZOOM_STEP))}>
              <Minus className="size-4" aria-hidden="true" />
            </ControlButton>
            <ControlButton label="Inzoomen" disabled={!canZoomIn(view)} onClick={() => apply((v) => zoomBy(v, ZOOM_STEP))}>
              <Plus className="size-4" aria-hidden="true" />
            </ControlButton>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Alleen-lezen 3D-weergave van een plattegrond (bv. op de activiteitpagina).
 * Geef OF `data` + `models` mee (de server heeft ze al), OF alleen een
 * `plattegrondId` — dan worden ze via een server action opgehaald.
 *
 * `mode="compact"`: vaste hoogte, met een knop naar een volledig-scherm-
 * weergave (dezelfde bediening). Er is nooit meer dan één actieve canvas:
 * zodra het volledige scherm opent, geeft de compacte weergave zijn
 * WebGL-context vrij en toont hij weer de thumbnail.
 */
export function PlattegrondViewer(props: PlattegrondViewerProps) {
  const { mode = "compact", previewUrl = null, title = "Plattegrond", className } = props;
  const [fetched, setFetched] = useState<ViewerData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const plattegrondId = props.data ? null : props.plattegrondId;
  useEffect(() => {
    if (!plattegrondId) return;
    let cancelled = false;
    void getFloorplan3dViewData(plattegrondId).then((result) => {
      if (cancelled) return;
      if ("error" in result) setFetchError(true);
      else setFetched({ data: result.data, models: result.models });
    });
    return () => {
      cancelled = true;
    };
  }, [plattegrondId]);

  const resolved: ViewerData | null = props.data ? { data: props.data, models: props.models } : fetched;

  if (!resolved) {
    return (
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border",
          mode === "compact" ? "h-[280px] md:h-[400px]" : "h-full min-h-[320px]",
          className,
        )}
        role="status"
        aria-live="polite"
      >
        <Skeleton className="absolute inset-0 rounded-none" />
        <span className="relative flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
          {fetchError ? (
            "De plattegrond kon niet worden geladen."
          ) : (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> 3D-plattegrond laden...
            </>
          )}
        </span>
      </div>
    );
  }

  return (
    <>
      <ViewerBody
        resolved={resolved}
        mode={mode}
        previewUrl={previewUrl}
        title={title}
        className={className}
        onFullscreen={mode === "compact" ? () => setFullscreen(true) : undefined}
        canvasActive={!fullscreen}
      />
      {mode === "compact" && (
        <Dialog open={fullscreen} onOpenChange={setFullscreen}>
          <DialogContent className="h-[100dvh] max-h-none w-screen max-w-none gap-0 rounded-none p-0 sm:max-w-none">
            <DialogTitle className="sr-only">3D-plattegrond: {title}</DialogTitle>
            {fullscreen && (
              <ViewerBody
                resolved={resolved}
                mode="fullscreen"
                previewUrl={previewUrl}
                title={title}
                className="h-[100dvh]"
                canvasActive
              />
            )}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
