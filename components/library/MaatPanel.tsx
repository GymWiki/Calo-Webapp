"use client";

import { Minus, Plus } from "lucide-react";

import { maatOptions } from "@/lib/library/families";
import { cn } from "@/lib/utils";
import type { MaterialModel } from "@/types/materialModel";

/** Minimaal 44 px op touch (pointer-coarse), 36 px met de muis. */
const TAP = "min-h-9 pointer-coarse:min-h-11";

const meters = (value: number) => value.toFixed(2).replace(".", ",");

/**
 * Itempaneel-sectie "Maat" voor een materiaal-familie: segmentknoppen (≤ 5 maten), een lijst (meer maten) of een stepper (opeenvolgende delen,
 * bijv. kastdelen) of kleurbolletjes (families waar de keuze een kleur is). Maten zonder model worden niet getoond. Toont de afmetingen van de gekozen maat. Wissel je de maat, dan
 * blijft het item op zijn plek (zie `editSelectedMaat` in de editor).
 */
export function MaatPanel({
  slug,
  models,
  disabled,
  count = 1,
  onChange,
}: {
  slug: string;
  models: MaterialModel[];
  disabled: boolean;
  /** Aantal geselecteerde items van deze familie (meervoudige selectie: de maat geldt voor allemaal). */
  count?: number;
  onChange: (maatId: string) => void;
}) {
  const menu = maatOptions(slug, models);
  if (!menu) return null;
  const { family, options } = menu;
  const available = options;
  const current = options.find((option) => option.current);
  const currentModel = current?.model ?? null;
  const index = available.findIndex((option) => option.current);

  return (
    <section aria-label="Maat" data-testid="maat-paneel" data-familie={family.id} className="space-y-2">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {family.maatTitel}
        {count > 1 && <span className="ml-1 font-normal normal-case">(voor {count} items)</span>}
      </p>

      {family.weergave === "stepper" ? (
        <div className="flex items-center gap-2" role="group" aria-label={family.maatTitel}>
          <button type="button" aria-label="Eén deel minder" disabled={disabled || index <= 0} onClick={() => onChange(available[index - 1].maat.id)} className={cn("flex w-11 items-center justify-center rounded-md border hover:bg-accent disabled:opacity-40", TAP)} data-testid="maat-min">
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <p className="min-w-0 flex-1 text-center text-sm font-medium" data-testid="maat-huidig" aria-live="polite">
            {current?.maat.label}
          </p>
          <button type="button" aria-label="Eén deel meer" disabled={disabled || index < 0 || index >= available.length - 1} onClick={() => onChange(available[index + 1].maat.id)} className={cn("flex w-11 items-center justify-center rounded-md border hover:bg-accent disabled:opacity-40", TAP)} data-testid="maat-plus">
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : family.weergave === "lijst" ? (
        <select
          aria-label={family.maatTitel}
          disabled={disabled}
          value={current?.maat.id ?? ""}
          onChange={(event) => onChange(event.target.value)}
          className={cn("w-full rounded-md border bg-background px-2 text-sm", TAP)}
          data-testid="maat-lijst"
        >
          {options.map((option) => (
            <option key={option.maat.id} value={option.maat.id}>
              {option.maat.label}
            </option>
          ))}
        </select>
      ) : family.weergave === "kleur" ? (
        <div role="group" aria-label={family.maatTitel} className="flex flex-wrap items-center gap-2">
          {options.map((option) => (
            <button
              key={option.maat.id}
              type="button"
              aria-pressed={option.current}
              aria-label={option.maat.label}
              title={option.maat.label}
              disabled={disabled}
              data-testid={`maat-${option.maat.id}`}
              onClick={() => onChange(option.maat.id)}
              className={cn("flex size-9 items-center justify-center rounded-full border-2 pointer-coarse:size-11", option.current ? "border-primary ring-2 ring-primary/30" : "border-border")}
            >
              <span className="size-6 rounded-full border border-black/10 pointer-coarse:size-8" style={{ backgroundColor: option.maat.kleur }} aria-hidden="true" />
            </button>
          ))}
          <span className="text-xs text-muted-foreground" data-testid="maat-huidig">{current?.maat.label}</span>
        </div>
      ) : (
        <div role="group" aria-label={family.maatTitel} className="flex flex-wrap gap-1.5">
          {options.map((option) => (
            <button
              key={option.maat.id}
              type="button"
              aria-pressed={option.current}
              disabled={disabled}
              title={option.maat.label}
              data-testid={`maat-${option.maat.id}`}
              onClick={() => onChange(option.maat.id)}
              className={cn("flex-1 rounded-md border px-2.5 text-sm font-medium hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40", TAP, option.current && "border-primary bg-primary/10 text-primary")}
            >
              {option.maat.label}
            </button>
          ))}
        </div>
      )}

      {currentModel && (
        <p className="text-xs text-muted-foreground" data-testid="maat-afmetingen">
          {meters(currentModel.length_m)} × {meters(currentModel.width_m)} × {meters(currentModel.height_m)} m (b × d × h)
        </p>
      )}
    </section>
  );
}
