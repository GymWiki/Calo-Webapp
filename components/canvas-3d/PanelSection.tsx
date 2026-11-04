"use client";

import { useId } from "react";
import { ChevronDown, Info } from "lucide-react";

import { cn } from "@/lib/utils";

/** Open/dicht-staat van paneelsecties (id + standaard); `useEditorUiPrefs` onthoudt dit in localStorage. */
export type PanelSections = { isOpen: (id: string, defaultOpen: boolean) => boolean; toggle: (id: string, defaultOpen: boolean) => void };

/** Altijd-open fallback voor panelen zonder opgeslagen staat. */
export const ALWAYS_OPEN: PanelSections = { isOpen: () => true, toggle: () => undefined };

/**
 * Inklapbare sectie met vaste kop (accordeon): de kop blijft staan, alleen de inhoud klapt in of uit. Optioneel een info-icoon met uitleg
 * in een tooltip i.p.v. een lange alinea.
 */
export function PanelSection({
  id,
  title,
  defaultOpen = false,
  sections,
  info,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  sections: PanelSections;
  info?: string;
  children: React.ReactNode;
}) {
  const bodyId = useId();
  const open = sections.isOpen(id, defaultOpen);
  return (
    <section data-testid={`sectie-${id}`}>
      <div className="flex items-center gap-1 border-b">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          data-testid={`sectie-kop-${id}`}
          onClick={() => sections.toggle(id, defaultOpen)}
          className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-md py-2 text-left text-xs font-semibold tracking-wide text-muted-foreground uppercase hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span className="truncate">{title}</span>
          <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </button>
        {info && (
          <span role="img" aria-label={info} title={info} className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground">
            <Info className="size-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div id={bodyId} hidden={!open} className="pt-3 pb-1">
        {children}
      </div>
    </section>
  );
}
