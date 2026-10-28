"use client";

import { useEffect, useRef, useState } from "react";
import { FileDown, ImageDown, Link2, Loader2, Share2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type GuestExportAction = "png-3d" | "png-top" | "pdf" | "link";

const ITEMS: { action: GuestExportAction; label: string; hint: string; icon: typeof ImageDown }[] = [
  { action: "png-3d", label: "Afbeelding (3D)", hint: "PNG van de 3D-weergave", icon: ImageDown },
  { action: "png-top", label: "Afbeelding (bovenaanzicht)", hint: "PNG van boven, handig voor een tekening", icon: ImageDown },
  { action: "pdf", label: "PDF met materiaallijst", hint: "Afbeeldingen en wat je klaar moet zetten", icon: FileDown },
  { action: "link", label: "Deelbare link kopiëren", hint: "Opent dezelfde plattegrond, zonder account", icon: Link2 },
];

/** "Delen & exporteren" voor gasten: PNG (3D en bovenaanzicht), PDF en een deelbare link. Volledig client-side. */
export function GuestExportMenu({
  onAction,
  busy,
  compact = false,
  disabled = false,
}: {
  onAction: (action: GuestExportAction) => void;
  busy: GuestExportAction | null;
  compact?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Delen en exporteren"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary font-medium text-primary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:opacity-50",
          compact ? "size-11" : "h-9 px-3 text-sm",
        )}
      >
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Share2 className={compact ? "size-5" : "size-4"} aria-hidden="true" />}
        {!compact && "Delen & exporteren"}
      </button>
      {open && (
        <div role="menu" aria-label="Delen en exporteren" className="absolute top-full right-0 z-50 mt-1 w-72 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl">
          {ITEMS.map(({ action, label, hint, icon: Icon }) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              disabled={busy !== null}
              onClick={() => {
                setOpen(false);
                onAction(action);
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-50 pointer-coarse:min-h-11"
            >
              <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
