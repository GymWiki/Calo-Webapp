"use client";

import { Copy, Lock, LockOpen, RotateCcw, RotateCw, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Zwevende contextbalk onderin het canvas voor het geselecteerde item (of veld):
 * roteren (±15° en +90°), dupliceren, vergrendelen, verwijderen en deselecteren.
 * Alles met de vinger; geen rechtermuisknop of toetsenbord nodig.
 */
export function SelectionBar({
  title,
  locked,
  canLock,
  onRotate,
  onDuplicate,
  onToggleLock,
  onDelete,
  onDeselect,
  compact = false,
}: {
  /** Telefoon in landscape: geen titelregel en geen labels (houdt het canvas zichtbaar). */
  compact?: boolean;
  title: string;
  locked: boolean;
  /** Velden kunnen niet worden vergrendeld. */
  canLock: boolean;
  onRotate: (deltaDeg: number) => void;
  onDuplicate: () => void;
  onToggleLock: () => void;
  onDelete: () => void;
  onDeselect: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center px-2">
      <div
        role="toolbar"
        aria-label={`Acties voor ${title}`}
        className="pointer-events-auto flex max-w-full flex-col gap-1 rounded-2xl border bg-card/95 p-1.5 shadow-lg backdrop-blur-sm"
      >
        {!compact && (
          <p className="truncate px-2 text-center text-xs font-medium text-muted-foreground">
            {locked && <Lock className="mr-1 inline size-3" aria-hidden="true" />}
            {title}
          </p>
        )}
        <div className="flex items-center justify-center gap-0.5 overflow-x-auto">
          <BarButton label="Links draaien (−15°)" disabled={locked} onClick={() => onRotate(-15)}>
            <RotateCcw className="size-5" aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>15°</span>
          </BarButton>
          <BarButton label="Rechts draaien (+15°)" disabled={locked} onClick={() => onRotate(15)}>
            <RotateCw className="size-5" aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>15°</span>
          </BarButton>
          <BarButton label="Kwartslag draaien (+90°)" disabled={locked} onClick={() => onRotate(90)}>
            <RotateCw className="size-5" aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>90°</span>
          </BarButton>
          <BarButton label="Dupliceren" onClick={onDuplicate}>
            <Copy className="size-5" aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>Kopie</span>
          </BarButton>
          {canLock && (
            <BarButton label={locked ? "Ontgrendelen" : "Vergrendelen"} pressed={locked} onClick={onToggleLock}>
              {locked ? <LockOpen className="size-5" aria-hidden="true" /> : <Lock className="size-5" aria-hidden="true" />}
              <span className={compact ? "sr-only" : undefined}>{locked ? "Los" : "Slot"}</span>
            </BarButton>
          )}
          <BarButton label="Verwijderen" danger disabled={locked} onClick={onDelete}>
            <Trash2 className="size-5" aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>Weg</span>
          </BarButton>
          <BarButton label="Klaar (deselecteren)" onClick={onDeselect}>
            <X className="size-5" aria-hidden="true" />
            <span className={compact ? "sr-only" : undefined}>Klaar</span>
          </BarButton>
        </div>
      </div>
    </div>
  );
}

function BarButton({
  label,
  onClick,
  disabled,
  danger,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 rounded-lg px-1.5 text-[10px] leading-none font-medium transition-colors duration-150 ease-brand focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:opacity-40",
        danger ? "text-destructive hover:bg-destructive/10" : "hover:bg-accent",
        pressed && "bg-primary/15 text-primary",
      )}
    >
      {children}
    </button>
  );
}
