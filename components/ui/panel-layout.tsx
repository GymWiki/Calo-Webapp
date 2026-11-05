"use client";

import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Paneelindeling "vaste kop, scrollende lijst": de kop (tabs, zoekbalk, filters) is een vast onderdeel van de indeling en scrolt nooit weg;
 * alleen de lijst eronder scrolt (één dunne scrollbalk, `overscroll-behavior: contain`, stabiele gutter zodat de inhoud niet verspringt).
 * Zodra de lijst gescrold is krijgt de kop een subtiele onderrand en schaduw. De ouder moet een flex-kolom met een vaste hoogte zijn
 * (of dit component `flex-1 min-h-0` laten vullen); het paneel zelf scrolt dus nooit. Gebruik dit voor elk paneel met kop en lijst.
 */
export function PanelLayout({
  header,
  children,
  bodyRef,
  className,
  headerClassName,
  bodyClassName,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  /** Voor scrollen naar boven of naar een sectie (bijv. na zoeken of het openen van een categorie). */
  bodyRef?: React.Ref<HTMLDivElement>;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const next = event.currentTarget.scrollTop > 1;
    setScrolled((previous) => (previous === next ? previous : next));
  }, []);
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)} data-testid="paneel-layout">
      <div
        data-testid="paneel-kop"
        className={cn("relative z-20 shrink-0 border-b border-transparent transition-shadow duration-150", scrolled && "border-border shadow-[0_2px_6px_-2px_rgba(0,0,0,0.12)]", headerClassName)}
      >
        {header}
      </div>
      <div
        ref={bodyRef}
        onScroll={onScroll}
        data-testid="paneel-lijst"
        className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] [scrollbar-width:thin]", bodyClassName)}
      >
        {children}
      </div>
    </div>
  );
}
