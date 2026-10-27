"use client";

import { cn } from "@/lib/utils";
import { sportLabel } from "@/lib/constants/libraryTaxonomy";
import type { SportCount } from "@/lib/library/search";

/**
 * Sportfilter als horizontaal scrollbare chips. Meerdere tegelijk te kiezen
 * (of-filter); "Alle" wist de selectie. Per chip het aantal resultaten bij de
 * huidige zoekopdracht.
 */
export function SportFilter({
  total,
  sports,
  selected,
  onChange,
}: {
  total: number;
  sports: SportCount[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((entry) => entry !== id) : [...selected, id]);
  }

  return (
    <div
      role="group"
      aria-label="Filter op sport"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]"
    >
      <Chip active={selected.length === 0} onClick={() => onChange([])}>
        Alle <Count>{total}</Count>
      </Chip>
      {sports.map((sport) => (
        <Chip key={sport.id} active={selected.includes(sport.id)} onClick={() => toggle(sport.id)}>
          {sport.label} <Count>{sport.count}</Count>
        </Chip>
      ))}
      {/* Gekozen sporten zonder resultaat bij deze zoekopdracht blijven zichtbaar, zodat je ze kunt uitzetten. */}
      {selected
        .filter((id) => !sports.some((sport) => sport.id === id))
        .map((id) => (
          <Chip key={id} active onClick={() => toggle(id)}>
            {sportLabel(id)} <Count>0</Count>
          </Chip>
        ))}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap pointer-coarse:min-h-11 pointer-coarse:px-4 pointer-coarse:text-sm transition-colors duration-150 ease-brand focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function Count({ children }: { children: React.ReactNode }) {
  return <span className="tabular-nums opacity-70">{children}</span>;
}
