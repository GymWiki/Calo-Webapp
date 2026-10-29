"use client";

import { Search, X } from "lucide-react";
import Image from "next/image";
import { useMemo, useState } from "react";

import { sportLabel } from "@/lib/constants/libraryTaxonomy";
import {
  DEFAULT_STUDENT_SIZE,
  STUDENT_COLORS,
  STUDENT_COLOR_PATTERN,
  STUDENT_POSES,
  STUDENT_SIZES,
  filterPoses,
  studentSportIds,
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
  const [query, setQuery] = useState("");
  const [sport, setSport] = useState<string | null>(null);
  const previewBySlug = useMemo(() => new Map(models.map((model) => [model.slug, model.preview_url])), [models]);
  const sports = useMemo(() => studentSportIds(), []);
  const poses = useMemo(() => filterPoses(STUDENT_POSES, { query, sport }), [query, sport]);
  const color = item.color?.toLowerCase() ?? null;
  const size = item.size ?? DEFAULT_STUDENT_SIZE;
  const presetMatch = STUDENT_COLORS.find((option) => (option.hex ?? null) === color);

  return (
    <section aria-label="Leerling" className="space-y-4" data-testid="student-panel">
      <div>
        <p className={SECTION_TITLE}>Pose</p>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Zoek pose of sport..."
            aria-label="Zoek pose"
            className={cn("w-full rounded-md border bg-background pr-8 pl-9 text-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden", TAP)}
          />
          {query && (
            <button type="button" aria-label="Zoekopdracht wissen" onClick={() => setQuery("")} className="absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:text-foreground">
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div role="group" aria-label="Filter op sport" className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[null, ...sports].map((id) => (
            <button
              key={id ?? "alle"}
              type="button"
              aria-pressed={sport === id}
              onClick={() => setSport(id)}
              className={cn(
                "shrink-0 rounded-full border px-3 text-sm font-medium whitespace-nowrap focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                TAP,
                sport === id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-accent",
              )}
            >
              {id ? sportLabel(id) : "Alle"}
            </button>
          ))}
        </div>
        {poses.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Geen poses gevonden.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-2" role="group" aria-label="Poses">
            {poses.map((pose) => {
              const active = item.slug === pose.slug;
              const preview = previewBySlug.get(pose.slug);
              return (
                <button
                  key={pose.id}
                  type="button"
                  disabled={disabled}
                  aria-pressed={active}
                  aria-label={`Pose ${pose.label}`}
                  data-testid={`pose-${pose.id}`}
                  onClick={() => onChange({ slug: pose.slug })}
                  className={cn(
                    "flex min-h-11 flex-col overflow-hidden rounded-lg border bg-background text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
                    active ? "border-primary ring-2 ring-primary/40" : "hover:bg-accent",
                  )}
                >
                  <span className="relative block h-16 w-full bg-muted/40 pointer-coarse:h-20">
                    {preview && <Image src={preview} alt="" fill sizes="(min-width: 1024px) 120px, 33vw" className="object-contain" />}
                  </span>
                  <span className="px-1.5 py-1 text-xs leading-tight font-medium">{pose.label}</span>
                </button>
              );
            })}
          </div>
        )}
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
