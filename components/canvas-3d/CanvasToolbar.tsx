"use client";

import { Cable, Cone, Grid3x3, Home, Layers, MousePointer2, ZoomIn, ZoomOut, Move3d, RotateCcw, ShieldAlert, ShieldOff, SlidersHorizontal, Eye, EyeOff, PanelTopClose, PanelBottomClose } from "lucide-react";

import type { CameraMode } from "@/components/canvas-3d/CameraRig";
import { Button } from "@/components/ui/button";
import type { SnapGridSize } from "@/components/canvas-3d/floorplan3d-geometry";
import { type ToolbarPosition } from "@/lib/editor-ui/layoutPrefs";
import { cn } from "@/lib/utils";

const GRID_STEPS: SnapGridSize[] = [0, 0.1, 0.5];

/**
 * Zwevende werkbalk op het canvas (desktop): camerastanden, raster en botsing zijn altijd in beeld, nooit afhankelijk van scrollen in
 * het rechterpaneel. Het zijpaneel houdt dezelfde bediening als tweede plek; beide sturen dezelfde state aan (geen dubbele logica).
 * Positie (onder, boven, verborgen) is instelbaar en wordt onthouden; "Reset indeling" zet alles terug.
 */
export function CanvasToolbar({
  position,
  onPosition,
  onResetLayout,
  cameraMode,
  onCameraMode,
  onResetCamera,
  onZoom,
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
  cameraMode: CameraMode;
  onCameraMode: (mode: CameraMode) => void;
  onResetCamera: () => void;
  /** Zoomknoppen: factor > 1 = inzoomen. */
  onZoom: (factor: number) => void;
  /** Actieve tool: selecteren (standaard), veld afzetten of touw spannen. */
  tool: "selecteren" | "veld" | "touw";
  onTool: (tool: "selecteren" | "veld" | "touw") => void;
  snapGrid: SnapGridSize;
  onSnapGrid: (size: SnapGridSize) => void;
  collisionOn: boolean;
  onToggleCollision: () => void;
}) {
  const edge = position === "top" ? "top-3" : "bottom-3";
  if (position === "hidden") {
    return (
      <div className="pointer-events-none absolute right-3 bottom-3 z-10">
        <Button type="button" size="sm" variant="outline" className="pointer-events-auto bg-card/95 shadow-md" data-testid="werkbalk-tonen" onClick={() => onPosition("bottom")} title="Werkbalk tonen">
          <Eye className="size-4" aria-hidden="true" /> Werkbalk
        </Button>
      </div>
    );
  }
  const nextGrid = GRID_STEPS[(GRID_STEPS.indexOf(snapGrid) + 1) % GRID_STEPS.length];
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 z-10 flex justify-center px-3", edge)}>
      <div role="toolbar" aria-label="Canvaswerkbalk" data-testid="canvas-werkbalk" className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-xl border bg-card/95 p-1 shadow-lg ring-1 ring-black/5 backdrop-blur-sm">
        <div role="group" aria-label="Gereedschap" className="flex items-center gap-1">
          <ToolButton label="Selecteren" title="Selecteren en slepen (Esc)" pressed={tool === "selecteren"} testid="werkbalk-selecteren" onClick={() => onTool("selecteren")}>
            <MousePointer2 className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Veld" title="Veld afzetten met pionnen" pressed={tool === "veld"} testid="werkbalk-veld" onClick={() => onTool("veld")}>
            <Cone className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Touw" title="Een touw, lint of net spannen tussen twee objecten" pressed={tool === "touw"} testid="werkbalk-touw" onClick={() => onTool("touw")}>
            <Cable className="size-4" aria-hidden="true" />
          </ToolButton>
        </div>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden="true" />
        <div role="group" aria-label="Camera" className="flex items-center gap-1">
          <ToolButton label="Standaard" title="Schuine 3D-weergave" pressed={cameraMode === "angled"} testid="werkbalk-camera-standaard" onClick={() => onCameraMode("angled")}>
            <Layers className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Boven" title="Bovenaanzicht" pressed={cameraMode === "top"} testid="werkbalk-camera-boven" onClick={() => onCameraMode("top")}>
            <Home className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Vrij" title="Vrij draaien" pressed={cameraMode === "free"} testid="werkbalk-camera-vrij" onClick={() => onCameraMode("free")}>
            <Move3d className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Uitzoomen" title="Uitzoomen (ook: scrollen)" iconOnly testid="werkbalk-zoom-uit" onClick={() => onZoom(1 / 1.25)}>
            <ZoomOut className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Inzoomen" title="Inzoomen (ook: scrollen)" iconOnly testid="werkbalk-zoom-in" onClick={() => onZoom(1.25)}>
            <ZoomIn className="size-4" aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Reset" title="Camera terug naar het midden" testid="werkbalk-camera-reset" onClick={onResetCamera}>
            <RotateCcw className="size-4" aria-hidden="true" />
          </ToolButton>
        </div>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden="true" />
        <ToolButton
          label={snapGrid === 0 ? "Raster uit" : `Raster ${snapGrid} m`}
          title="Raster: klik voor de volgende stap (uit, 0,1 m, 0,5 m)"
          pressed={snapGrid !== 0}
          testid="werkbalk-raster"
          onClick={() => onSnapGrid(nextGrid)}
        >
          <Grid3x3 className="size-4" aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={collisionOn ? "Botsing: waarschuwen" : "Botsing: negeren"}
          title="Botsing: waarschuwen of negeren (Alt tijdens slepen zet botsing en snappen tijdelijk uit)"
          pressed={collisionOn}
          testid="werkbalk-botsing"
          onClick={onToggleCollision}
        >
          {collisionOn ? <ShieldAlert className="size-4" aria-hidden="true" /> : <ShieldOff className="size-4" aria-hidden="true" />}
        </ToolButton>
        <span className="mx-0.5 h-6 w-px bg-border" aria-hidden="true" />
        <ToolButton label="Werkbalk verbergen" title="Werkbalk verbergen" iconOnly testid="werkbalk-verbergen" onClick={() => onPosition("hidden")}>
          <EyeOff className="size-4" aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={position === "bottom" ? "Werkbalk naar boven" : "Werkbalk naar onder"}
          title={position === "bottom" ? "Werkbalk naar boven verplaatsen" : "Werkbalk naar onder verplaatsen"}
          iconOnly
          testid="werkbalk-positie"
          onClick={() => onPosition(position === "bottom" ? "top" : "bottom")}
        >
          {position === "bottom" ? <PanelTopClose className="size-4" aria-hidden="true" /> : <PanelBottomClose className="size-4" aria-hidden="true" />}
        </ToolButton>
        <ToolButton label="Reset indeling" title="Reset indeling: werkbalk terug naar de standaardplek" iconOnly testid="werkbalk-reset-indeling" onClick={onResetLayout}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
        </ToolButton>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  title,
  pressed,
  iconOnly = false,
  testid,
  onClick,
  children,
}: {
  label: string;
  title: string;
  pressed?: boolean;
  iconOnly?: boolean;
  testid: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant={pressed ? "default" : "ghost"}
      aria-label={label}
      aria-pressed={pressed}
      title={title}
      data-testid={testid}
      onClick={onClick}
      className="h-9 gap-1.5 px-2.5"
    >
      {children}
      {!iconOnly && <span className="hidden text-xs xl:inline">{label}</span>}
    </Button>
  );
}

