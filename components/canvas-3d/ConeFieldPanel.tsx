"use client";

import { useState } from "react";
import { Copy, RotateCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  CONE_COLOR_PRESETS,
  CONE_MARKER_LABELS,
  MAX_CONE_INTERVAL_M,
  MIN_CONE_INTERVAL_M,
  MIN_FIELD_SIZE_M,
  coneMaterialTotals,
  colorName,
  fieldLabel,
  fieldTooltipLines,
  normalizeFieldRotation,
} from "@/components/canvas-3d/cone-field";
import { CONE_MARKER_TYPES, type ConeField } from "@/types/floorplan3d";

const ROTATION_STEP_DEG = 15;

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>;
}

/** Numerieke invoer met eigen tekststaat: tijdens het typen ("1.") mag de
 * waarde tijdelijk ongeldig zijn; pas een geldig getal wordt doorgegeven. */
function NumberField({
  label,
  value,
  min,
  max,
  step = 0.1,
  onCommit,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onCommit: (value: number) => void;
}) {
  const format = (n: number) => String(Math.round(n * 100) / 100);
  // Zolang er getypt wordt staat de tekst in `typed`; daarna (blur) volgt het veld weer de waarde.
  const [typed, setTyped] = useState<string | null>(null);
  const text = typed ?? format(value);

  return (
    <label className="space-y-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {label}
      <Input
        type="number"
        inputMode="decimal"
        value={text}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          setTyped(event.target.value);
          const parsed = Number(event.target.value.replace(",", "."));
          if (event.target.value.trim() === "" || !Number.isFinite(parsed)) return;
          if ((min !== undefined && parsed < min) || (max !== undefined && parsed > max)) return;
          onCommit(parsed);
        }}
        onBlur={() => setTyped(null)}
      />
    </label>
  );
}

function ColorChoice({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      {CONE_COLOR_PRESETS.map((preset) => {
        const active = preset.hex.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            aria-label={preset.label}
            aria-pressed={active}
            onClick={() => onChange(preset.hex)}
            className={cn(
              "size-8 rounded-full border border-black/20 transition-transform focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95",
              active && "ring-2 ring-primary ring-offset-2 ring-offset-card",
            )}
            style={{ backgroundColor: preset.hex }}
          />
        );
      })}
      <label
        className="relative flex size-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-muted-foreground text-xs text-muted-foreground"
        title="Eigen kleur"
      >
        +
        <input
          type="color"
          value={value}
          aria-label="Eigen kleur"
          onChange={(event) => onChange(event.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

export function ConeFieldPanel({
  field,
  onChange,
  onRotate,
  onDuplicate,
  onDelete,
}: {
  field: ConeField;
  /** `key` voegt opeenvolgende wijzigingen van hetzelfde veld samen tot één undo-stap. */
  onChange: (patch: Partial<ConeField>, key: string) => void;
  onRotate: (deltaDeg: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [first, ...rest] = fieldTooltipLines(field);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium">Afgezet veld</p>
        <p className="text-xs text-muted-foreground">
          {first} · {rest[0]}
        </p>
        <p className="text-xs text-muted-foreground">{rest[1]}</p>
        <p className="text-xs text-muted-foreground">{rest[2]}</p>
      </div>

      <div>
        <SectionTitle>Interval (m)</SectionTitle>
        <div className="grid grid-cols-[1fr_5.5rem] items-center gap-3">
          <input
            type="range"
            min={MIN_CONE_INTERVAL_M}
            max={MAX_CONE_INTERVAL_M}
            step={0.1}
            value={field.interval_m}
            aria-label="Interval in meters"
            onChange={(event) => onChange({ interval_m: Number(event.target.value) }, "interval")}
            className="w-full accent-primary"
          />
          <Input
            type="number"
            inputMode="decimal"
            min={MIN_CONE_INTERVAL_M}
            max={MAX_CONE_INTERVAL_M}
            step={0.1}
            value={field.interval_m}
            aria-label="Interval in meters (invoer)"
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (Number.isFinite(parsed) && parsed >= MIN_CONE_INTERVAL_M && parsed <= MAX_CONE_INTERVAL_M) {
                onChange({ interval_m: Math.round(parsed * 10) / 10 }, "interval");
              }
            }}
          />
        </div>
      </div>

      <div>
        <SectionTitle>Verdeling</SectionTitle>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={field.distribution === "even" ? "default" : "outline"}
            aria-pressed={field.distribution === "even"}
            onClick={() => onChange({ distribution: "even" }, "verdeling")}
          >
            Gelijkmatig
          </Button>
          <Button
            type="button"
            size="sm"
            variant={field.distribution === "exact" ? "default" : "outline"}
            aria-pressed={field.distribution === "exact"}
            onClick={() => onChange({ distribution: "exact" }, "verdeling")}
          >
            Exact interval
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {field.distribution === "even"
            ? `Elke zijde gelijkmatig verdeeld, zo dicht mogelijk bij het interval.`
            : `Precies elke ${field.interval_m.toLocaleString("nl-NL")} m vanaf de hoek; de laatste ruimte is korter.`}
        </p>
      </div>

      <div>
        <SectionTitle>Type markering</SectionTitle>
        <div className="grid grid-cols-2 gap-1.5">
          {CONE_MARKER_TYPES.map((marker) => (
            <Button
              key={marker}
              type="button"
              size="sm"
              variant={field.marker === marker ? "default" : "outline"}
              aria-pressed={field.marker === marker}
              onClick={() => onChange({ marker }, "markering")}
            >
              {CONE_MARKER_LABELS[marker]}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Kleur</SectionTitle>
        <ColorChoice label="Kleur" value={field.color} onChange={(hex) => onChange({ color: hex }, "kleur")} />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm">Andere kleur voor hoekpionnen</span>
          <Switch
            checked={field.corner_color !== null}
            onCheckedChange={(checked) => onChange({ corner_color: checked ? "#ffffff" : null }, "hoekkleur-aan")}
          />
        </div>
        {field.corner_color !== null && (
          <ColorChoice
            label="Kleur hoekpionnen"
            value={field.corner_color}
            onChange={(hex) => onChange({ corner_color: hex }, "hoekkleur")}
          />
        )}
      </div>

      <div>
        <SectionTitle>Afmetingen en positie</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Breedte (m)" value={field.width_m} min={MIN_FIELD_SIZE_M} onCommit={(v) => onChange({ width_m: v }, "breedte")} />
          <NumberField label="Lengte (m)" value={field.length_m} min={MIN_FIELD_SIZE_M} onCommit={(v) => onChange({ length_m: v }, "lengte")} />
          <NumberField label="Positie X (m)" value={field.x} onCommit={(v) => onChange({ x: v }, "x")} />
          <NumberField label="Positie Z (m)" value={field.z} onCommit={(v) => onChange({ z: v }, "z")} />
        </div>
      </div>

      <div>
        <SectionTitle>Rotatie</SectionTitle>
        <div className="grid grid-cols-[1fr_1fr_5.5rem] items-end gap-2">
          <Button type="button" variant="outline" onClick={() => onRotate(-ROTATION_STEP_DEG)}>
            <RotateCw className="size-4 -scale-x-100" /> -15°
          </Button>
          <Button type="button" variant="outline" onClick={() => onRotate(ROTATION_STEP_DEG)}>
            <RotateCw className="size-4" /> +15°
          </Button>
          <Input
            type="number"
            inputMode="decimal"
            step={1}
            value={Math.round(field.rot_y_deg * 10) / 10}
            aria-label="Rotatie in graden"
            onChange={(event) => {
              const parsed = Number(event.target.value);
              if (Number.isFinite(parsed)) onChange({ rot_y_deg: normalizeFieldRotation(parsed) }, "rotatie");
            }}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Button type="button" variant="outline" className="w-full" onClick={onDuplicate}>
          <Copy className="size-4" /> Dupliceren (Ctrl+D)
        </Button>
        <Button type="button" variant="outline" className="w-full text-destructive" onClick={onDelete}>
          <Trash2 className="size-4" /> Verwijderen (Delete)
        </Button>
      </div>
    </div>
  );
}

/** Legenda van alle afgezette velden + totaal materiaal dat nodig is. */
export function ConeFieldOverview({
  fields,
  selectedId,
  onSelect,
}: {
  fields: ConeField[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (fields.length === 0) return null;
  const totals = coneMaterialTotals(fields);
  const grandTotal = totals.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Afgezette velden</SectionTitle>
        <ul className="space-y-1">
          {fields.map((field) => (
            <li key={field.id}>
              <button
                type="button"
                onClick={() => onSelect(field.id)}
                aria-current={field.id === selectedId}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  field.id === selectedId && "border-primary bg-primary/5",
                )}
              >
                <span className="size-3 shrink-0 rounded-full border border-black/20" style={{ backgroundColor: field.color }} />
                {fieldLabel(field)}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <SectionTitle>Materiaal nodig</SectionTitle>
        <ul className="space-y-1 text-sm">
          {totals.map((row) => (
            <li key={`${row.marker}-${row.color}`} className="flex items-center gap-2">
              <span className="size-3 shrink-0 rounded-full border border-black/20" style={{ backgroundColor: row.color }} />
              <span className="flex-1">
                {colorName(row.color)} {CONE_MARKER_LABELS[row.marker].toLowerCase()}
              </span>
              <span className="font-medium tabular-nums">{row.count}×</span>
            </li>
          ))}
          <li className="flex items-center gap-2 border-t pt-1 font-medium">
            <span className="flex-1">Totaal</span>
            <span className="tabular-nums">{grandTotal}×</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
