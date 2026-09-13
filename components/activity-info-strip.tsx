import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type InfoStripItem = {
  icon: LucideIcon;
  label: string;
};

/**
 * Compacte rij praktische info-items direct onder de titel (brief: "geen
 * grote cards, kleine rustige info-items"). Toont ALLEEN items waarvoor
 * daadwerkelijk data bestaat — de aanroeper filtert lege velden er al uit
 * vóórdat deze component ze krijgt, dus hier wordt nooit iets verzonnen of
 * een placeholder getoond.
 */
export function ActivityInfoStrip({ items, className }: { items: InfoStripItem[]; className?: string }) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map(({ icon: Icon, label }, index) => (
        <span
          key={index}
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Icon className="size-4 shrink-0 text-primary/80" aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}
