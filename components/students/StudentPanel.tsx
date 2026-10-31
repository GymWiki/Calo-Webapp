"use client";

import { useMemo } from "react";

import { PosePicker } from "@/components/students/PosePicker";
import {
  DEFAULT_STUDENT_SIZE,
  STUDENT_COLORS,
  STUDENT_COLOR_PATTERN,
  STUDENT_SIZES,
  type StudentSize,
} from "@/lib/students/catalog";
import { cn } from "@/lib/utils";
import type { Floorplan3dItem } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

export type StudentPatch = { slug?: string; color?: string | null; size?: StudentSize };

const SECTION_TITLE = "mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase";
/** Minimaal 44 px op touch (pointer-coarse), 36 px met de muis. */
const TAP = "min-h-9 pointer-coarse:min-h-11";

/**
 * Itempaneel-sectie "Leerling": pose (raster met thumbnails, sportfilter en zoekbalk), shirtkleur (teamkleuren + eigen kleur) en
 * grootte. Elke wijziging werkt direct op het geselecteerde figuur; het item hoeft niet opnieuw geplaatst te worden.
 */
export function StudentPanel({
  item,
  models,
  disabled,
  onChange,
}: {
  item: Floorplan3dItem;
  models: MaterialModel[];
  disabled: boolean;
  onChange: (patch: StudentPatch) => void;
}) {
  const previewBySlug = useMemo(() => new Map(models.map((model) => [model.slug, model.preview_url])), [models]);
  const color = item.color?.toLowerCase() ?? null;
  const size = item.size ?? DEFAULT_STUDENT_SIZE;
  const presetMatch = STUDENT_COLORS.find((option) => (option.hex ?? null) === color);

  return (
    <section aria-label="Leerling" className="space-y-4" data-testid="student-panel">
      <div>
        <p className={SECTION_TITLE}>Pose</p>
        <PosePicker currentSlug={item.slug} previewBySlug={previewBySlug} disabled={disabled} onSelect={(pose) => onChange({ slug: pose.slug })} />
      </div>

      <div>
        <p className={SECTION_TITLE}>Shirtkleur</p>
        <div role="group" aria-label="Shirtkleur" className="flex flex-wrap items-center gap-2">
          {STUDENT_COLORS.map((option) => {
            const active = (option.hex ?? null) === color;
            return (
              <button
                key={option.id}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                aria-label={`Kleur ${option.label}`}
                title={option.label}
                data-testid={`kleur-${option.id}`}
                onClick={() => onChange({ color: option.hex })}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 pointer-coarse:size-11",
                  active ? "border-primary ring-2 ring-primary/40" : "border-border",
                )}
              >
                <span
                  className="block size-6 rounded-full border border-black/10 pointer-coarse:size-8"
                  style={{ background: option.hex ?? "linear-gradient(135deg,#1e2a5c 50%,#e5e7eb 50%)" }}
                />
              </button>
            );
          })}
          <label
            className={cn(
              "relative flex size-9 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 pointer-coarse:size-11",
              color && !presetMatch ? "border-primary ring-2 ring-primary/40" : "border-border",
              disabled && "pointer-events-none opacity-50",
            )}
            title="Eigen kleur"
          >
            <span className="sr-only">Eigen kleur kiezen</span>
            <span className="block size-6 rounded-full border border-black/10 pointer-coarse:size-8" style={{ background: color && !presetMatch ? color : "conic-gradient(red,yellow,lime,aqua,blue,magenta,red)" }} />
            <input
              type="color"
              aria-label="Eigen shirtkleur"
              data-testid="kleur-eigen"
              disabled={disabled}
              value={color && STUDENT_COLOR_PATTERN.test(color) ? color : "#2563eb"}
              onChange={(event) => onChange({ color: event.target.value })}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">Alleen het shirt/hesje kleurt mee; huid, haar en schoenen blijven gelijk.</p>
      </div>

      <div>
        <p className={SECTION_TITLE}>Grootte</p>
        <div role="group" aria-label="Grootte" className="grid grid-cols-3 gap-1.5">
          {STUDENT_SIZES.map((option) => (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              aria-pressed={size === option.id}
              data-testid={`grootte-${option.id}`}
              onClick={() => onChange({ size: option.id })}
              className={cn(
                "rounded-lg border px-2 text-sm font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                TAP,
                size === option.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
              )}
            >
              {option.label}
              <span className="block text-xs font-normal opacity-80">{option.height_m.toString().replace(".", ",")} m</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
