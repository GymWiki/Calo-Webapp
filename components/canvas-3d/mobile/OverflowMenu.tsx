"use client";

import { useEffect, useRef, useState } from "react";
import { FilePlus2, HelpCircle, MoreVertical, FolderOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { QUALITY_SETTINGS, type QualitySetting } from "@/components/canvas-3d/mobile/mobile-logic";
import type { EditorSettings } from "@/components/canvas-3d/mobile/useEditorSettings";

const QUALITY_LABELS: Record<QualitySetting, string> = { auto: "Auto", hoog: "Hoog", laag: "Laag" };

/**
 * "⋯"-menu in de bovenbalk met de secundaire acties: Mijn plattegronden, kwaliteit
 * (Auto/Hoog/Laag), bibliotheekgedrag en de uitleg van de gebaren.
 */
export function OverflowMenu({
  settings,
  onSettings,
  onOpenList,
  onNewPlan,
  onShowHelp,
}: {
  settings: EditorSettings;
  onSettings: (patch: Partial<EditorSettings>) => void;
  /** Zonder (gastmodus: geen opgeslagen plattegronden) verdwijnt "Mijn plattegronden" uit het menu. */
  onOpenList?: () => void;
  /** Alleen gastmodus: "Nieuwe plattegrond" (wist de lokale kladversie). */
  onNewPlan?: () => void;
  onShowHelp: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Meer acties"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-lg hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <MoreVertical className="size-5" aria-hidden="true" />
      </button>
      {open && (
        <div role="menu" aria-label="Meer acties" className="absolute top-full right-0 z-50 mt-1 w-72 rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl">
          {onOpenList && (
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onOpenList();
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <FolderOpen className="size-4" aria-hidden="true" /> Mijn plattegronden
          </button>
          )}
          {onNewPlan && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onNewPlan();
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <FilePlus2 className="size-4" aria-hidden="true" /> Nieuwe plattegrond
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onShowHelp();
            }}
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <HelpCircle className="size-4" aria-hidden="true" /> Uitleg gebaren
          </button>

          <div className="mt-1 border-t px-2 pt-2">
            <p id="quality-label" className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Kwaliteit
            </p>
            <div role="radiogroup" aria-labelledby="quality-label" className="grid grid-cols-3 gap-1">
              {QUALITY_SETTINGS.map((quality) => (
                <button
                  key={quality}
                  type="button"
                  role="radio"
                  aria-checked={settings.quality === quality}
                  onClick={() => onSettings({ quality })}
                  className={cn(
                    "min-h-11 rounded-lg border text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    settings.quality === quality ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                >
                  {QUALITY_LABELS[quality]}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Auto schakelt zelf terug als de editor traag wordt.</p>
          </div>

          <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t px-2 pt-2 text-sm">
            <span>Bibliotheek sluit na plaatsen</span>
            <input
              type="checkbox"
              role="switch"
              checked={settings.closeLibraryAfterPlace}
              onChange={(event) => onSettings({ closeLibraryAfterPlace: event.target.checked })}
              className="size-5 accent-[var(--primary)]"
            />
          </label>
        </div>
      )}
    </div>
  );
}
