"use client";

import { useEffect, useRef, useState } from "react";
import { Cable, ChevronUp, Cone, EyeOff, Grid3x3, ListRestart, LocateFixed, MousePointer2, PanelBottomClose, PanelTopClose, ShieldAlert, ShieldOff } from "lucide-react";

import type { SnapGridSize } from "@/components/canvas-3d/floorplan3d-geometry";
import { type ToolbarPosition } from "@/lib/editor-ui/layoutPrefs";
import { cn } from "@/lib/utils";

const GRID_STEPS: { size: Exclude<SnapGridSize, 0>; label: string }[] = [
  { size: 0.1, label: "0,1 m" },
  { size: 0.5, label: "0,5 m" },
];

/**
 * Zwevende werkbalk onderin het canvas (desktop): één rij met alleen iconen (tooltip + aria-label).
 * Groepen: gereedschappen (Selecteren, Veld, Touw) | schakelaars (Raster met stap-menu, Botsing) | werkbalkinstellingen
 * (verbergen, boven/onder, indeling herstellen) | Camera herstellen. De camera zelf is altijd vrij: slepen draait, scrollen zoomt.
 * Positie (onder, boven, verborgen) wordt onthouden (lib/editor-ui/layoutPrefs.ts).
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
  collisionOn,
  onToggleCollision,
}: {
  position: ToolbarPosition;
  onPosition: (position: ToolbarPosition) => void;
  onResetLayout: () => void;
  onResetCamera: () => void;
  /** Actieve tool: selecteren (standaard), veld afzetten of touw spannen. */
  tool: "selecteren" | "veld" | "touw";
  onTool: (tool: "selecteren" | "veld" | "touw") => void;
  snapGrid: SnapGridSize;
  onSnapGrid: (size: SnapGridSize) => void;
  collisionOn: boolean;
  onToggleCollision: () => void;
}) {
  const [gridMenu, setGridMenu] = useState(false);
  const lastStep = useRef<Exclude<SnapGridSize, 0>>(0.1);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (snapGrid !== 0) lastStep.current = snapGrid;
  }, [snapGrid]);

  // Stap-menu sluit bij een klik ernaast of Escape.
  useEffect(() => {
    if (!gridMenu) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !rowRef.current?.contains(event.target as Node)) setGridMenu(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [gridMenu]);

  const edge = position === "top" ? "top-3" : "bottom-3";
  if (position === "hidden") {
    return (
      <div className="pointer-events-none absolute right-3 bottom-3 z-10">
        <IconButton label="Werkbalk tonen" testid="werkbalk-tonen" onClick={() => onPosition("bottom")} className="pointer-events-auto border bg-card/95 shadow-md">
          <EyeOff className="size-5 rotate-180" aria-hidden="true" />
        </IconButton>
      </div>
    );
  }

  // Pijltjestoetsen binnen de werkbalk: Links/Rechts (en Home/End) verplaatst de focus tussen de knoppen.
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const items = Array.from(rowRef.current?.querySelectorAll<HTMLButtonElement>("button[data-toolbar-item]:not(:disabled)") ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (items.length === 0 || index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + items.length) % items.length;
    items[next].focus();
  }

  const gridLabel = snapGrid === 0 ? "Raster uit" : `Raster aan (${GRID_STEPS.find((step) => step.size === snapGrid)?.label ?? snapGrid})`;
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 z-10 flex justify-center px-3", edge)}>
      <div
        ref={rowRef}
        role="toolbar"
        aria-label="Canvaswerkbalk"
        data-testid="canvas-werkbalk"
        onKeyDown={onKeyDown}
        className="pointer-events-auto relative flex flex-nowrap items-center gap-0.5 rounded-xl border bg-card/95 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-sm"
      >
        <IconButton label="Selecteren (Esc)" testid="werkbalk-selecteren" pressed={tool === "selecteren"} onClick={() => onTool("selecteren")}>
          <MousePointer2 className="size-5" aria-hidden="true" />
        </IconButton>
        <IconButton label="Veld afzetten met pionnen" testid="werkbalk-veld" pressed={tool === "veld"} onClick={() => onTool("veld")}>
          <Cone className="size-5" aria-hidden="true" />
        </IconButton>
        <IconButton label="Touw, lint of net spannen tussen twee objecten" testid="werkbalk-touw" pressed={tool === "touw"} onClick={() => onTool("touw")}>
          <Cable className="size-5" aria-hidden="true" />
        </IconButton>
        <Separator />
        <div className="relative flex items-center">
          <IconButton label={`${gridLabel}: klik om te wisselen`} testid="werkbalk-raster" pressed={snapGrid !== 0} onClick={() => onSnapGrid(snapGrid === 0 ? lastStep.current : 0)} className="rounded-r-none">
            <Grid3x3 className="size-5" aria-hidden="true" />
          </IconButton>
          <button
            type="button"
            data-toolbar-item
            data-testid="werkbalk-raster-stap"
            aria-label="Rasterstap kiezen"
            aria-haspopup="menu"
            aria-expanded={gridMenu}
            title="Rasterstap kiezen"
            onClick={() => setGridMenu((open) => !open)}
            className="flex h-10 w-5 items-center justify-center rounded-r-lg text-muted-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ChevronUp className="size-3.5" aria-hidden="true" />
          </button>
          {gridMenu && (
            <div role="menu" aria-label="Rasterstap" data-testid="raster-stap-menu" className={cn("absolute left-0 z-20 flex flex-col gap-0.5 rounded-lg border bg-card p-1 shadow-lg", position === "top" ? "top-full mt-2" : "bottom-full mb-2")}>
              {GRID_STEPS.map((step) => (
                <button
                  key={step.size}
                  type="button"
                  role="menuitemradio"
                  aria-checked={snapGrid === step.size}
                  data-testid={`raster-stap-${step.size}`}
                  onClick={() => {
                    onSnapGrid(step.size);
                    setGridMenu(false);
                  }}
                  className={cn("h-9 rounded-md px-3 text-left text-sm hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none", snapGrid === step.size && "bg-primary/15 font-medium text-primary")}
                >
                  {step.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <IconButton
          label={collisionOn ? "Botsing: waarschuwen (klik om te negeren). Alt tijdens slepen zet botsing en snappen tijdelijk uit" : "Botsing: negeren (klik om te waarschuwen)"}
          testid="werkbalk-botsing"
          pressed={collisionOn}
          onClick={onToggleCollision}
        >
          {collisionOn ? <ShieldAlert className="size-5" aria-hidden="true" /> : <ShieldOff className="size-5" aria-hidden="true" />}
        </IconButton>
        <Separator />
        <IconButton label="Werkbalk verbergen" testid="werkbalk-verbergen" onClick={() => onPosition("hidden")}>
          <EyeOff className="size-5" aria-hidden="true" />
        </IconButton>
        <IconButton
          label={position === "bottom" ? "Werkbalk naar boven verplaatsen" : "Werkbalk naar onderen verplaatsen"}
          testid="werkbalk-positie"
          onClick={() => onPosition(position === "bottom" ? "top" : "bottom")}
        >
          {position === "bottom" ? <PanelTopClose className="size-5" aria-hidden="true" /> : <PanelBottomClose className="size-5" aria-hidden="true" />}
        </IconButton>
        <IconButton label="Werkbalkpositie herstellen (onderin)" testid="werkbalk-reset-indeling" onClick={onResetLayout}>
          <ListRestart className="size-5" aria-hidden="true" />
        </IconButton>
        <Separator />
        <IconButton label="Camera herstellen (ook: dubbelklik op een leeg stuk)" testid="werkbalk-camera-reset" onClick={onResetCamera}>
          <LocateFixed className="size-5" aria-hidden="true" />
        </IconButton>
      </div>
    </div>
  );
}

function Separator() {
  return <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />;
}

function IconButton({
  label,
  pressed,
  testid,
  onClick,
  className,
  children,
}: {
  label: string;
  pressed?: boolean;
  testid: string;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-toolbar-item
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      data-testid={testid}
      onClick={onClick}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 ease-brand hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:opacity-40",
        pressed ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
