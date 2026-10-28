"use client";

import { useEffect, useRef, useState } from "react";
import { ClipboardCopy, FileDown, FileJson, FileUp } from "lucide-react";

export type JsonAction = "download" | "copy" | "open";

const ITEMS: { action: JsonAction; label: string; hint: string; icon: typeof FileDown }[] = [
  { action: "download", label: "JSON downloaden", hint: "Bestand met de hele plattegrond", icon: FileDown },
  { action: "copy", label: "JSON kopiëren", hint: "Naar het klembord, bijvoorbeeld voor Supabase", icon: ClipboardCopy },
  { action: "open", label: "JSON openen…", hint: "Een plattegrond-bestand inladen (of sleep het hierheen)", icon: FileUp },
];

/** Desktop-menu "JSON" in de bovenbalk: downloaden, kopiëren en openen. Op mobiel staan dezelfde acties in het ⋯-menu. */
export function PlattegrondJsonMenu({ onAction }: { onAction: (action: JsonAction) => void }) {
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
        aria-label="JSON: downloaden, kopiëren of openen"
        title="Plattegrond als JSON"
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
      >
        <FileJson className="size-4" aria-hidden="true" />
        <span className="hidden md:inline">JSON</span>
      </button>
      {open && (
        <div role="menu" aria-label="Plattegrond als JSON" className="absolute top-full right-0 z-50 mt-1 w-72 rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl">
          {ITEMS.map(({ action, label, hint, icon: Icon }) => (
            <button
              key={action}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onAction(action);
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none pointer-coarse:min-h-11"
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
