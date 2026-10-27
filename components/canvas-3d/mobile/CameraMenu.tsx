"use client";

import { Box, LocateFixed, ScanSearch, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import type { CameraMode } from "@/components/canvas-3d/CameraRig";

/**
 * Zwevend cameramenu op het canvas: Bovenaanzicht, 3D (vrij draaien), Schuin en Reset.
 * Alleen op telefoon/tablet; op desktop staan dezelfde keuzes in het Omgeving-paneel.
 */
export function CameraMenu({
  mode,
  onMode,
  onReset,
}: {
  mode: CameraMode;
  onMode: (mode: CameraMode) => void;
  onReset: () => void;
}) {
  const options: { id: CameraMode; label: string; icon: typeof Box }[] = [
    { id: "top", label: "Bovenaanzicht", icon: Square },
    { id: "free", label: "3D", icon: Box },
    { id: "angled", label: "Schuin", icon: ScanSearch },
  ];

  return (
    <div role="group" aria-label="Camera" className="absolute top-2 right-2 z-20 flex flex-col gap-1 rounded-xl border bg-card/95 p-1 shadow-lg backdrop-blur-sm">
      {options.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={mode === option.id}
            onClick={() => onMode(option.id)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              mode === option.id ? "bg-primary text-primary-foreground" : "hover:bg-accent",
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            {option.label}
          </button>
        );
      })}
      <button
        type="button"
        onClick={onReset}
        className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <LocateFixed className="size-5" aria-hidden="true" />
        Reset
      </button>
    </div>
  );
}
