"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { SHEET_TAP_PX, decideSheetSnap, type SheetSnap } from "@/components/canvas-3d/mobile/mobile-logic";

/**
 * Onderste drawer voor telefoons met drie standen: dicht, half, vol. Slepen aan de
 * handle (Pointer Events, geen bibliotheek), tik op de handle wisselt half/vol, tik
 * buiten sluit, Esc sluit. Eén drawer tegelijk (de aanroeper rendert er maar één).
 * Staat BINNEN het canvasgebied (tussen de vaste bovenbalk en de vaste onderwerkbalk): de werkbalk blijft zichtbaar en de hoogtes zijn
 * percentages van dat gebied, dus de balken schuiven nooit en het sheet kan er niet achter vallen.
 * Wordt alleen gemonteerd als hij open is, dus elke keer begint hij in de halve stand.
 */
export function BottomSheet({
  title,
  onClose,
  children,
  peek = false,
  onInset,
  flush = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Compacte drawer zonder donkere achtergrond: het canvas erboven blijft zichtbaar en bruikbaar (rotatie). */
  peek?: boolean;
  /** Meldt de hoogte (px) van het sheet (0 bij sluiten): de camera schuift het beeld mee omhoog. */
  onInset?: (px: number) => void;
  /** De inhoud beheert zijn eigen scrollen (kop vast, lijst scrolt): het sheet zelf scrolt dan niet. */
  flush?: boolean;
}) {
  // Materiaal/Item/Kamer openen over het hele canvasgebied (meer zien); de rotatie-drawer (peek) blijft compact.
  const [snap, setSnap] = useState<SheetSnap>(peek ? "half" : "full");
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; dy: number; pointerId: number } | null>(null);

  useEffect(() => {
    const element = sheetRef.current;
    if (!element || !onInset || peek || typeof ResizeObserver === "undefined") return;
    // Alleen een half sheet schuift het beeld omhoog; een sheet over het hele gebied heeft daar niets aan.
    if (snap !== "half") {
      onInset(0);
      return;
    }
    const observer = new ResizeObserver(() => onInset(element.getBoundingClientRect().height));
    observer.observe(element);
    return () => {
      observer.disconnect();
      onInset(0);
    };
  }, [onInset, peek, snap]);

  // Eénmalig bij openen (NIET opnieuw bij elke render): anders steelt het sheet de focus van het zoekveld en klapt het toetsenbord meteen weer in.
  useEffect(() => {
    sheetRef.current?.focus({ preventScroll: true });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startY: event.clientY, dy: 0, pointerId: event.pointerId };
    if (sheetRef.current) sheetRef.current.style.transition = "none";
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.dy = event.clientY - drag.startY;
    // Alleen visueel meebewegen; de stand wordt pas bij loslaten bepaald.
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${Math.max(drag.dy, -48)}px)`;
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (sheetRef.current) {
      sheetRef.current.style.transition = "";
      sheetRef.current.style.transform = "";
    }
    const decision = decideSheetSnap(snap, Math.abs(drag.dy) < SHEET_TAP_PX ? 0 : drag.dy);
    if (decision === "close") onClose();
    else setSnap(decision);
  }

  return (
    <div className={cn("absolute inset-0 z-40", peek && "pointer-events-none")} data-testid="bottom-sheet-laag">
      {!peek && <div className="absolute inset-0 bg-black/30" onPointerDown={onClose} aria-hidden="true" />}
      <div
        ref={sheetRef}
        role="dialog"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          "animate-sheet-up absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t bg-background shadow-2xl outline-none transition-[height,transform] duration-200 ease-out",
          peek && "pointer-events-auto",
        )}
        style={{
          height:
            snap === "half"
              ? peek
                ? "min(42%, 22rem)"
                : "min(62%, 36rem)"
              : "calc(100% - 0.5rem)",
        }}
      >
        <div
          className="touch-none select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="flex justify-center pt-2 pb-1" aria-hidden="true">
            <span className="h-1.5 w-12 rounded-full bg-muted-foreground/40" />
          </div>
          <div className="flex items-center justify-between px-4 pb-2">
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
        </div>
        <div className={cn("min-h-0 flex-1 px-4 pb-4", flush ? "flex flex-col overflow-hidden" : "overflow-y-auto overscroll-contain")}>{children}</div>
      </div>
    </div>
  );
}
