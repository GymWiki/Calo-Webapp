"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { Box, Loader2, Maximize2 } from "lucide-react";

import { getFloorplan3dViewData } from "@/actions/floorplans3d";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { dimsLookupFromModels } from "@/components/canvas-3d/floorplan3d-geometry";
import { computeFraming, framingFill, initialViewFor } from "@/components/plattegrond/viewer-framing";
import { useViewerGestures, type PointerKind } from "@/components/plattegrond/useViewerGestures";
import { CONTROLS_RESERVE_PX, azimuthDegOf, currentPolarDeg, polarDegOf, type ViewState } from "@/components/plattegrond/viewer-camera";
import type { Floorplan3dData, Floorplan3dItem } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

// three/@react-three/fiber (+ de GLB-loader) zitten ALLEEN in deze dynamic
// chunk — de activiteitpagina zelf laadt dat pas zodra de viewer in beeld
// komt (zie `inView` hieronder), nooit in de eerste JS.
const ViewerCanvas = dynamic(() => import("@/components/plattegrond/ViewerCanvas"), { ssr: false });

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

/** Korte uitleg onderin de tekening (geen knoppen): verdwijnt zodra je de tekening gebruikt. Op aanraken: eerst tikken om te bewegen. */
function InteractionHint({ pointerKind, active, interacted }: { pointerKind: PointerKind; active: boolean; interacted: boolean }) {
  const text =
    pointerKind === "touch"
      ? active
        ? interacted
          ? "Tik buiten de tekening om verder te scrollen"
          : "Sleep om te draaien · knijp om te zoomen · dubbeltik = terug"
        : "Tik om de tekening te bewegen"
      : "Sleep om te draaien · scroll om te zoomen · dubbelklik = terug";
  const hidden = pointerKind === "mouse" && interacted;
  return (
    <div className={cn("pointer-events-none absolute inset-x-2 bottom-2 flex justify-center transition-opacity duration-500", hidden ? "opacity-0" : "opacity-100")} aria-hidden="true">
      <span data-testid="viewer-hint" className="rounded-full bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-white shadow-brand-sm">
        {text}
      </span>
    </div>
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

  // Zoom op de inhoud: de begin-stand (en wat "Reset" herstelt) komt uit wat er echt staat, niet uit de hele zaal.
  // `room.view` ("auto" | "3d" | "top") is per plattegrond in te stellen in de editor.
  const lookup = useMemo(() => dimsLookupFromModels(resolved.models), [resolved.models]);
  const initialView = useMemo(
    () => initialViewFor({ items, fields, room, lookup, aspect: 1.7, mode: room.view }),
    [items, fields, room, lookup],
  );
  const [{ view, instant }, setViewState] = useState<{ view: ViewState; instant: boolean }>(() => ({ view: initialView, instant: false }));

  // Afmetingen van het kader: voor de kadrering-meting (data-framing-fill, gebruikt door de tests) — de camera zelf meet zijn eigen canvas.
  const [box, setBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = containerRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setBox({ width: element.clientWidth, height: element.clientHeight }));
    observer.observe(element);
    setBox({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);
  const framing = useMemo(() => {
    if (box.width === 0 || box.height === 0) return null;
    const aspect = box.width / Math.max(box.height * 0.5, box.height - CONTROLS_RESERVE_PX);
    return computeFraming({ items, fields, room, lookup, aspect, mode: view.preset, azimuthDeg: azimuthDegOf({ ...view, step: 0, offsetDeg: 0 }), polarDeg: polarDegOf(view.preset) });
  }, [box, items, fields, room, lookup, view]);
  const framingFillValue = framing && !framing.empty ? framingFill(framing) : null;
  // Hoeveel meter één schermpixel is (voor verschuiven met rechts slepen of twee vingers).
  const metersPerPx = framing ? framing.visibleWidthM / Math.max(box.width, 1) / view.zoom : 0.05;

  const apply = useCallback((update: (view: ViewState) => ViewState, immediately = false) => {
    setViewState((previous) => ({ view: update(previous.view), instant: immediately }));
  }, []);

  const onItemHover = useCallback(
    (item: Floorplan3dItem | null) => setHovered(item ? (modelBySlug(item.slug)?.naam ?? "Onbekend materiaal") : null),
    [modelBySlug],
  );
  const handleReady = useCallback(() => setReady(true), []);
  const handleError = useCallback(() => setFailed(true), []);

  // Bediening zonder knoppen: muis (slepen, wiel, dubbelklik) en aanraken (tik om te bewegen, vinger, knijpen, dubbeltik).
  const { handlers, active, pointerKind, interacted, touchAction } = useViewerGestures({
    containerRef,
    view,
    apply,
    initialView,
    metersPerPx,
    forceActive: mode === "fullscreen",
  });

  const showCanvas = inView && webgl === true && !failed && canvasActive;
  const showThumbnail = Boolean(previewUrl) && !thumbFailed && (!showCanvas || !ready);
  const unavailable = !failed && webgl === false;
  const noPreviewAtAll = !previewUrl || thumbFailed;

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={`Interactieve 3D-plattegrond: ${title}. Sleep om te draaien, scroll om te zoomen, dubbelklik om terug te gaan. Pijltjestoetsen draaien en kantelen, plus en min zoomen, nul zet terug.`}
      tabIndex={0}
      data-framing-fill={framingFillValue === null ? undefined : framingFillValue.toFixed(2)}
      data-framing-mode={view.preset}
      data-view-azimuth={Math.round(((azimuthDegOf(view) % 360) + 360) % 360)}
      data-view-polar={Math.round(currentPolarDeg(view))}
      data-view-zoom={view.zoom.toFixed(2)}
      data-view-pan={`${(view.panX ?? 0).toFixed(1)},${(view.panZ ?? 0).toFixed(1)}`}
      data-view-active={active ? "true" : "false"}
      {...handlers}
      // Aanraken: standaard scrolt de pagina; na een tik beweegt één vinger de tekening (zie useViewerGestures.ts).
      style={{ touchAction }}
      className={cn(
        "relative w-full cursor-grab overflow-hidden rounded-xl border bg-slate-50 select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:cursor-grabbing",
        active && pointerKind === "touch" && "ring-2 ring-primary/60",
        mode === "compact" ? "h-[320px] md:h-[480px]" : "h-full min-h-[320px] rounded-none border-0",
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
              ropes={resolved.data.ropes ?? []}
              models={resolved.models}
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

      {showCanvas && ready && <InteractionHint pointerKind={pointerKind} active={active} interacted={interacted} />}
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
          mode === "compact" ? "h-[320px] md:h-[480px]" : "h-full min-h-[320px]",
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
