"use client";

import { Camera, Cone, LayoutGrid, Redo2, SlidersHorizontal, Home, Undo2, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { MobilePanel } from "@/components/canvas-3d/mobile/mobile-logic";

type ToolbarButton = {
  id: string;
  label: string;
  /** Korte zichtbare tekst onder het icoon (past op 375 px breed); `label` blijft de toegankelijke naam. */
  short?: string;
  icon: LucideIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

/**
 * Vaste, compacte werkbalk onderaan (telefoon en tablet): grote iconen met labels, minimaal
 * 44×44 px per knop, safe-area onder de home-balk. Bij weinig hoogte (telefoon landscape)
 * verdwijnen de labels.
 */
export function MobileToolbar({
  panel,
  onPanel,
  hasSelection,
  drawMode,
  onToggleDraw,
  cameraMenuOpen,
  onToggleCameraMenu,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  compact,
}: {
  panel: MobilePanel;
  onPanel: (panel: MobilePanel) => void;
  hasSelection: boolean;
  drawMode: boolean;
  onToggleDraw: () => void;
  cameraMenuOpen: boolean;
  onToggleCameraMenu: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Alleen iconen (weinig schermhoogte). */
  compact: boolean;
}) {
  const buttons: ToolbarButton[] = [
    { id: "bibliotheek", label: "Bibliotheek", short: "Materiaal", icon: LayoutGrid, active: panel === "materiaal", onClick: () => onPanel(panel === "materiaal" ? null : "materiaal") },
    { id: "item", label: "Item", icon: SlidersHorizontal, active: panel === "item", disabled: !hasSelection, onClick: () => onPanel(panel === "item" ? null : "item") },
    { id: "omgeving", label: "Kamer", icon: Home, active: panel === "kamer", onClick: () => onPanel(panel === "kamer" ? null : "kamer") },
    { id: "veld", label: "Veld", icon: Cone, active: drawMode, onClick: onToggleDraw },
    { id: "camera", label: "Camera", icon: Camera, active: cameraMenuOpen, onClick: onToggleCameraMenu },
    { id: "undo", label: "Ongedaan maken", short: "Ongedaan", icon: Undo2, disabled: !canUndo, onClick: onUndo },
    { id: "redo", label: "Opnieuw", icon: Redo2, disabled: !canRedo, onClick: onRedo },
  ];

  return (
    <nav
      aria-label="Editor-werkbalk"
      className="flex shrink-0 items-stretch gap-0.5 border-t bg-card px-1 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
    >
      {buttons.map((button) => {
        const Icon = button.icon;
        return (
          <button
            key={button.id}
            type="button"
            aria-label={button.label}
            aria-pressed={button.id === "undo" || button.id === "redo" ? undefined : button.active}
            disabled={button.disabled}
            onClick={button.onClick}
            data-testid={`toolbar-${button.id}`}
            className={cn(
              "flex min-w-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] leading-none font-medium transition-colors duration-150 ease-brand focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:opacity-40",
              compact ? "min-h-11" : "min-h-14",
              button.active ? "bg-primary/15 text-primary" : "text-foreground hover:bg-accent",
            )}
          >
            <Icon className="size-6" aria-hidden="true" />
            {!compact && <span>{button.short ?? button.label}</span>}
          </button>
        );
      })}
    </nav>
  );
}
