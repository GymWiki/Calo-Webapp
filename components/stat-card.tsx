import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ACCENTS = {
  cone: "bg-primary/10 text-primary",
  blue: "bg-line-blue/10 text-line-blue",
  yellow: "bg-court-yellow/20 text-court-yellow",
  success: "bg-success/10 text-success",
} as const;

export function StatCard({
  icon: Icon,
  label,
  value,
  meta,
  accent = "cone",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  meta?: string;
  accent?: keyof typeof ACCENTS;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 shadow-brand-sm transition-transform duration-200 ease-brand hover:-translate-y-0.5 hover:shadow-brand-md",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
          {label}
        </p>
        <div
          className={cn(
            "flex size-8 items-center justify-center rounded-full",
            ACCENTS[accent],
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </div>
      </div>
      <p className="mt-3 font-display text-4xl leading-none tracking-tight tabular-nums">
        {value}
      </p>
      {meta && <p className="mt-2 text-xs text-muted-foreground">{meta}</p>}
    </div>
  );
}
