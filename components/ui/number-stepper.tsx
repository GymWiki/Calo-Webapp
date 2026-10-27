"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Numeriek veld met grote −/+ knoppen (≥ 44 px) voor touch. 16 px tekst en
 * `inputMode="decimal"`: iOS zoomt dan niet in en toont het cijfertoetsenbord.
 * Alleen een geldig getal wordt doorgegeven; tijdens het typen blijft de ruwe tekst staan.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  label,
  unit,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  label: string;
  unit?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const format = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <button
        type="button"
        aria-label={`${label} verlagen`}
        onClick={() => onChange(clamp(value - step))}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <div className="relative min-w-0 flex-1">
        <input
          type="text"
          inputMode="decimal"
          aria-label={label}
          value={draft ?? format(value)}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setDraft(event.target.value);
            const parsed = Number(event.target.value.replace(",", "."));
            if (event.target.value.trim() !== "" && Number.isFinite(parsed)) onChange(clamp(parsed));
          }}
          onBlur={() => setDraft(null)}
          className="h-11 w-full rounded-lg border bg-background px-3 text-center text-base tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        {unit && <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>}
      </div>
      <button
        type="button"
        aria-label={`${label} verhogen`}
        onClick={() => onChange(clamp(value + step))}
        className="flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
