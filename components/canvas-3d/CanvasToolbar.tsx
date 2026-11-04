"use client";

import { useEffect, useRef, useState } from "react";
import { Cable, ChevronUp, Cone, Eye, EyeOff, Grid3x3, ListRestart, LocateFixed, MoreHorizontal, MousePointer2, PanelBottomClose, PanelTopClose, Layers } from "lucide-react";

import type { SnapGridSize } from "@/components/canvas-3d/floorplan3d-geometry";
import { type ToolbarPosition } from "@/lib/editor-ui/layoutPrefs";
import { cn } from "@/lib/utils";

/** Niet-brekende spatie: getal en eenheid blijven altijd op één regel. */
const NBSP = " ";
const GRID_OPTIONS: { size: SnapGridSize; label: string }[] = [
  { size: 0, label: "Uit" },
  { size: 0.1, label: `0,1${NBSP}m` },
  { size: 0.5, label: `0,5${NBSP}m` },
];
const stepLabel = (size: SnapGridSize) => GRID_OPTIONS.find((option) => option.size === size)?.label ?? `${size}${NBSP}m`;

/**
 * Vaste werkbalk over de volle breedte van het canvasgebied (desktop en tablet landscape), onder of boven het canvas (het canvas
 * eindigt erboven, dus de zaal verdwijnt er nooit achter). Drie groepen: links de gereedschappen, midden de schakelaars (Raster, Stapelen),
 * rechts de overige knoppen en Camera herstellen. Labels verschijnen bij ≥ 1100 px werkbalkbreedte (container query), anders alleen
 * icoon met tooltip; onder 640 px verhuizen de werkbalkinstellingen naar "Meer". Kleur: oranje alleen voor het actieve gereedschap;
 * schakelaars zijn subtiel (aan = lichte rand en stip, uit = gedimd).
 */
export function CanvasToolbar({
  position,
  onPosition,
  onResetLayout,
  onResetCamera,
  tool,
  onTool,
  snapGrid,
  onSnapGrid,
  stackingOn,
  onToggleStacking,
}: {
  position: Exclude<ToolbarPosition, "hidden">;
  onPosition: (position: ToolbarPosition) => void;
  onResetLayout: () => void;
  onResetCamera: () => void;
  tool: "selecteren" | "veld" | "touw";
  onTool: (tool: "selecteren" | "veld" | "touw") => void;
  snapGrid: SnapGridSize;
  onSnapGrid: (size: SnapGridSize) => void;
  stackingOn: boolean;
  onToggleStacking: () => void;
}) {
  const [gridMenu, setGridMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const lastStep = useRef<SnapGridSize>(0.1);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (snapGrid !== 0) lastStep.current = snapGrid;
  }, [snapGrid]);

  // Menu's sluiten bij een klik ernaast of Escape.
  useEffect(() => {
    if (!gridMenu && !moreMenu) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") {
          setGridMenu(false);
          setMoreMenu(false);
        }
      } else if (!(event.target as HTMLElement | null)?.closest("[data-toolbar-menu]")) {
        setGridMenu(false);
        setMoreMenu(false);
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [gridMenu, moreMenu]);

  // Pijltjestoetsen binnen de werkbalk: Links/Rechts (en Home/End) verplaatst de focus tussen de knoppen.
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    if ((event.target as HTMLElement).closest("[role=radiogroup]")) return; // het rastermenu regelt zijn eigen pijltjes
    const items = Array.from(rowRef.current?.querySelectorAll<HTMLButtonElement>("button[data-toolbar-item]:not(:disabled)") ?? []).filter((item) => item.offsetParent !== null);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (items.length === 0 || index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const index = GRID_OPTIONS.findIndex((option) => option.size === snapGrid);
    const next = GRID_OPTIONS[(index + (event.key === "ArrowRight" ? 1 : -1) + GRID_OPTIONS.length) % GRID_OPTIONS.length];
    onSnapGrid(next.size);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-step="${next.size}"]`)?.focus();
  }

  const edgeBorder = position === "top" ? "border-b" : "border-t";
  const menuSide = position === "top" ? "top-full mt-2" : "bottom-full mb-2";
  const gridOn = snapGrid !== 0;
  return (
    <div
      ref={rowRef}
      role="toolbar"
      aria-label="Canvaswerkbalk"
      data-testid="canvas-werkbalk"
      onKeyDown={onKeyDown}
      className={cn("@container relative z-10 w-full shrink-0 bg-card shadow-[0_-2px_10px_rgba(0,0,0,0.06)]", edgeBorder)}
    >
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-4 px-3">
        <div className="flex items-center gap-1">
          <Btn label="Selecteren" tip="Selecteren en slepen (Esc)" testid="werkbalk-selecteren" tone="tool" on={tool === "selecteren"} onClick={() => onTool("selecteren")}>
            <MousePointer2 className="size-5" aria-hidden="true" />
          </Btn>
          <Btn label="Veld" tip="Veld afzetten met pionnen" testid="werkbalk-veld" tone="tool" on={tool === "veld"} onClick={() => onTool("veld")}>
            <Cone className="size-5" aria-hidden="true" />
          </Btn>
          <Btn label="Touw" tip="Touw, lint of net spannen tussen twee objecten" testid="werkbalk-touw" tone="tool" on={tool === "touw"} onClick={() => onTool("touw")}>
            <Cable className="size-5" aria-hidden="true" />
          </Btn>
        </div>

        <div className="flex items-center gap-2">
          <Separator />
          <div className="relative flex items-center" data-toolbar-menu>
            <Btn
              label={gridOn ? `Raster ${stepLabel(snapGrid)}` : "Raster"}
              tip={gridOn ? `Raster: aan (${stepLabel(snapGrid)}). Klik om uit te zetten` : "Raster: uit. Klik om aan te zetten"}
              testid="werkbalk-raster"
              tone="switch"
              on={gridOn}
              onClick={() => onSnapGrid(gridOn ? 0 : lastStep.current)}
              className="rounded-r-none"
            >
              <Grid3x3 className="size-5" aria-hidden="true" />
            </Btn>
            <button
              type="button"
              data-toolbar-item
              data-testid="werkbalk-raster-stap"
              aria-label="Rasterstap kiezen"
              aria-haspopup="true"
              aria-expanded={gridMenu}
              title="Rasterstap kiezen"
              onClick={() => setGridMenu((open) => !open)}
              className="flex h-11 w-6 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <ChevronUp className={cn("size-4 transition-transform", position === "top" && "rotate-180")} aria-hidden="true" />
            </button>
            {gridMenu && (
              <div
                role="radiogroup"
                aria-label="Rasterstap"
                data-testid="raster-stap-menu"
                onKeyDown={onGridKeyDown}
                className={cn("absolute left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-xl border bg-card p-1 whitespace-nowrap shadow-lg", menuSide)}
              >
                {GRID_OPTIONS.map((option) => (
                  <button
                    key={option.size}
                    type="button"
                    role="radio"
                    aria-checked={snapGrid === option.size}
                    tabIndex={snapGrid === option.size ? 0 : -1}
                    data-step={option.size}
                    data-testid={`raster-stap-${option.size}`}
                    onClick={() => {
                      onSnapGrid(option.size);
                      setGridMenu(false);
                    }}
                    className={cn(
                      "h-10 min-w-14 rounded-lg px-3 text-sm font-medium whitespace-nowrap hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                      snapGrid === option.size ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Btn
            label="Stapelen"
            tip={
              stackingOn
                ? "Stapelen: aan (objecten komen boven op elkaar te staan). Klik om uit te zetten. Houd Alt ingedrukt tijdens het slepen om tijdelijk het omgekeerde te doen"
                : "Stapelen: uit (objecten kunnen in elkaar staan). Klik om aan te zetten"
            }
            testid="werkbalk-stapelen"
            tone="switch"
            on={stackingOn}
            onClick={onToggleStacking}
          >
            <Layers className="size-5" aria-hidden="true" />
          </Btn>
          <Separator />
        </div>

        <div className="flex items-center justify-end gap-1">
          <div className="hidden items-center gap-1 @[640px]:flex">
            <Btn label="Verbergen" tip="Werkbalk verbergen" testid="werkbalk-verbergen" onClick={() => onPosition("hidden")}>
              <EyeOff className="size-5" aria-hidden="true" />
            </Btn>
            <Btn
              label={position === "bottom" ? "Naar boven" : "Naar onder"}
              tip={position === "bottom" ? "Werkbalk naar boven verplaatsen" : "Werkbalk naar onderen verplaatsen"}
              testid="werkbalk-positie"
              onClick={() => onPosition(position === "bottom" ? "top" : "bottom")}
            >
              {position === "bottom" ? <PanelTopClose className="size-5" aria-hidden="true" /> : <PanelBottomClose className="size-5" aria-hidden="true" />}
            </Btn>
            <Btn label="Herstellen" tip="Werkbalkpositie herstellen (onderin)" testid="werkbalk-reset-indeling" onClick={onResetLayout}>
              <ListRestart className="size-5" aria-hidden="true" />
            </Btn>
            <Separator />
          </div>
          <div className="relative @[640px]:hidden" data-toolbar-menu>
            <Btn label="Meer" tip="Meer: werkbalk verbergen, verplaatsen of herstellen" testid="werkbalk-meer" onClick={() => setMoreMenu((open) => !open)} expanded={moreMenu}>
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </Btn>
            {moreMenu && (
              <div role="menu" aria-label="Meer" data-testid="werkbalk-meer-menu" className={cn("absolute right-0 z-20 flex w-60 flex-col gap-0.5 rounded-xl border bg-card p-1 shadow-lg", menuSide)}>
                {[
                  { id: "verbergen", label: "Werkbalk verbergen", icon: <EyeOff className="size-4" aria-hidden="true" />, run: () => onPosition("hidden") },
                  { id: "positie", label: position === "bottom" ? "Werkbalk naar boven" : "Werkbalk naar onder", icon: position === "bottom" ? <PanelTopClose className="size-4" aria-hidden="true" /> : <PanelBottomClose className="size-4" aria-hidden="true" />, run: () => onPosition(position === "bottom" ? "top" : "bottom") },
                  { id: "herstellen", label: "Werkbalkpositie herstellen", icon: <ListRestart className="size-4" aria-hidden="true" />, run: onResetLayout },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    data-testid={`werkbalk-meer-${item.id}`}
                    onClick={() => {
                      item.run();
                      setMoreMenu(false);
                    }}
                    className="flex h-10 items-center gap-2 rounded-lg px-3 text-left text-sm whitespace-nowrap hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Btn label="Camera herstellen" tip="Camera herstellen (ook: dubbelklik op een leeg stuk)" testid="werkbalk-camera-reset" onClick={onResetCamera}>
            <LocateFixed className="size-5" aria-hidden="true" />
          </Btn>
        </div>
      </div>
    </div>
  );
}

/** Klein zwevend knopje om een verborgen werkbalk terug te halen (in het canvasgebied). */
export function ToolbarShowButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="pointer-events-none absolute right-3 bottom-3 z-10">
      <button
        type="button"
        data-testid="werkbalk-tonen"
        aria-label="Werkbalk tonen"
        title="Werkbalk tonen"
        onClick={onClick}
        className="pointer-events-auto flex size-11 items-center justify-center rounded-xl border bg-card shadow-md hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Eye className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

function Separator() {
  return <span className="h-7 w-px shrink-0 bg-border" aria-hidden="true" />;
}

function Btn({
  label,
  tip,
  tone = "plain",
  on = false,
  expanded,
  testid,
  onClick,
  className,
  children,
}: {
  label: string;
  tip: string;
  /** tool = oranje als actief gereedschap; switch = subtiele aan/uit-instelling; plain = gewone actie. */
  tone?: "tool" | "switch" | "plain";
  on?: boolean;
  expanded?: boolean;
  testid: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-toolbar-item
      aria-label={tip}
      aria-pressed={tone === "plain" ? undefined : on}
      aria-expanded={expanded}
      title={tip}
      data-testid={testid}
      onClick={onClick}
      className={cn(
        "relative flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-brand hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95",
        tone === "tool" && (on ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-foreground"),
        tone === "switch" && (on ? "bg-primary/5 text-primary ring-1 ring-primary/30" : "text-muted-foreground opacity-70"),
        tone === "plain" && "text-foreground",
        className,
      )}
    >
      {children}
      <span className="hidden @[1100px]:inline">{label}</span>
      {tone === "switch" && on && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" aria-hidden="true" />}
    </button>
  );
}
