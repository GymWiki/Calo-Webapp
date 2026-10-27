"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Zijpaneel voor tablets (en telefoon in landscape): schuift over het canvas in en uit, niet
 * modaal — het canvas blijft bruikbaar, zodat je meerdere items kunt plaatsen terwijl de
 * bibliotheek open staat. Eén zijpaneel tegelijk (de aanroeper rendert er maar één).
 */
export function SidePanel({
  side,
  title,
  onClose,
  children,
}: {
  side: "left" | "right";
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <aside
      role="complementary"
      aria-label={title}
      className={cn(
        "absolute inset-y-0 z-30 flex w-[min(22rem,88%)] flex-col bg-card shadow-2xl",
        side === "left" ? "left-0 animate-slide-in-left border-r" : "right-0 animate-slide-in-right border-l",
      )}
    >
      <div className="flex items-center justify-between px-4 pt-2 pb-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          aria-label="Sluiten"
          onClick={onClose}
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </aside>
  );
}
