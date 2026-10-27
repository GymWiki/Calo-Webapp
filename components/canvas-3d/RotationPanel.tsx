"use client";

import {
  ArrowDownToLine,
  FlipVertical2,
  Info,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";

import type { ResolvedOrientation } from "@/components/canvas-3d/asset-orientation";
import {
  AXIS_COLOR,
  AXIS_LABEL,
  AXIS_RANGE,
  QUICK_POSES,
  SNAP_OPTIONS,
  formatDeg,
  poseAllowed,
  type PoseId,
  type RotationAxis,
} from "@/components/canvas-3d/rotation-controls";
import type { Rotation3 } from "@/components/canvas-3d/orientation";
import { NumberStepper } from "@/components/ui/number-stepper";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const POSE_ICON: Record<PoseId, React.ReactNode> = {
  plat: <RectangleHorizontal className="size-4" aria-hidden="true" />,
  rechtop: <RectangleVertical className="size-4" aria-hidden="true" />,
  schuin15: <TrendingUp className="size-4" aria-hidden="true" />,
  schuin30: <TrendingUp className="size-4" aria-hidden="true" />,
  schuin45: <TrendingUp className="size-4" aria-hidden="true" />,
  opkop: <FlipVertical2 className="size-4" aria-hidden="true" />,
  reset: <RotateCcw className="size-4" aria-hidden="true" />,
};

const AXES: RotationAxis[] = ["y", "x", "z"];
const AXIS_HINT: Record<RotationAxis, string> = {
  y: "Groen · om de verticale as",
  x: "Rood · voorover / achterover",
  z: "Blauw · naar links / rechts",
};

/** Knop van minimaal 44 px hoog op touch (en in de drawer-variant altijd). */
const BTN =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border bg-background px-2 text-sm font-medium tabular-nums hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none active:scale-95 disabled:pointer-events-none disabled:opacity-40";

function DegInput({ value, min, max, label, disabled, onChange }: { value: number; min: number; max: number; label: string; disabled: boolean; onChange: (deg: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      disabled={disabled}
      value={draft ?? String(Math.round(value * 10) / 10).replace(".", ",")}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        setDraft(event.target.value);
        const parsed = Number(event.target.value.replace(",", ".").replace("−", "-"));
        if (event.target.value.trim() !== "" && Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
      }}
      onBlur={() => setDraft(null)}
      className="h-9 min-h-9 w-full min-w-0 rounded-lg border bg-background px-1 text-center text-base tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-40"
    />
  );
}

function AxisControl({
  axis,
  value,
  disabled,
  big,
  onSet,
  onStep,
}: {
  axis: RotationAxis;
  value: number;
  disabled: boolean;
  big: boolean;
  onSet: (axis: RotationAxis, deg: number) => void;
  onStep: (axis: RotationAxis, delta: number) => void;
}) {
  const [min, max] = AXIS_RANGE[axis];
  const label = AXIS_LABEL[axis];
  const btn = cn(BTN, big && "min-h-11");
  return (
    <div data-testid={`rotatie-as-${axis}`} className={cn("space-y-1.5", disabled && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: AXIS_COLOR[axis] }} aria-hidden="true" />
          {label}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums" aria-live="polite">{formatDeg(value)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{AXIS_HINT[axis]}</p>
      <input
        type="range"
        aria-label={`${label} (schuifregelaar)`}
        min={min}
        max={max}
        step={1}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onChange={(event) => onSet(axis, Number(event.target.value))}
        className={cn("w-full cursor-pointer accent-primary disabled:cursor-not-allowed", big ? "h-11" : "h-6")}
      />
      <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-1">
        <button type="button" disabled={disabled} className={btn} aria-label={`${label} −90°`} onClick={() => onStep(axis, -90)}>
          −90°
        </button>
        <button type="button" disabled={disabled} className={btn} aria-label={`${label} −15°`} onClick={() => onStep(axis, -15)}>
          −15°
        </button>
        <DegInput value={value} min={axis === "y" ? 0 : min} max={max} label={`${label} (graden)`} disabled={disabled} onChange={(deg) => onSet(axis, deg)} />
        <button type="button" disabled={disabled} className={btn} aria-label={`${label} +15°`} onClick={() => onStep(axis, 15)}>
          +15°
        </button>
        <button type="button" disabled={disabled} className={btn} aria-label={`${label} +90°`} onClick={() => onStep(axis, 90)}>
          +90°
        </button>
      </div>
    </div>
  );
}

/**
 * Rotatie van het geselecteerde item: Draaien (Y), Kantelen voor/achter (X), Kantelen zijwaarts (Z),
 * snelle standen, snapping, wereld/lokale assen en hoogte. Eén component voor het desktop-itempaneel
 * (`variant="panel"`) en de mobiele drawer (`variant="drawer"`, grotere knoppen, zonder 3D-ring-opties).
 */
export function RotationPanel({
  rotation,
  lift,
  orientation,
  locked,
  snapDeg,
  onSnapChange,
  localAxes,
  onLocalAxesChange,
  onSetAxis,
  onStepAxis,
  onPose,
  onLift,
  variant = "panel",
}: {
  rotation: Rotation3;
  lift: number | undefined;
  orientation: ResolvedOrientation;
  locked: boolean;
  snapDeg: number;
  onSnapChange: (deg: number) => void;
  localAxes: boolean;
  onLocalAxesChange: (local: boolean) => void;
  onSetAxis: (axis: RotationAxis, deg: number) => void;
  onStepAxis: (axis: RotationAxis, delta: number) => void;
  onPose: (pose: PoseId) => void;
  onLift: (meters: number | null) => void;
  variant?: "panel" | "drawer";
}) {
  const drawer = variant === "drawer";
  const free = lift !== undefined;
  const btn = cn(BTN, drawer && "min-h-11");

  return (
    <section aria-label="Rotatie" data-testid="rotatie-paneel" className="space-y-4">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Rotatie</h3>

      {!orientation.allowTilt && (
        <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground" role="note">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{orientation.reason} Alleen draaien kan.</span>
        </p>
      )}

      <div className="space-y-4">
        {AXES.map((axis) => (
          <AxisControl
            key={axis}
            axis={axis}
            value={rotation[axis]}
            disabled={locked || (axis !== "y" && !orientation.allowTilt)}
            big={drawer}
            onSet={onSetAxis}
            onStep={onStepAxis}
          />
        ))}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Snelle standen</p>
        <div className="grid grid-cols-2 gap-1.5">
          {QUICK_POSES.map((pose) => (
            <button
              key={pose.id}
              type="button"
              title={pose.hint}
              disabled={locked || !poseAllowed(pose.id, orientation)}
              className={cn(btn, "justify-start", pose.id === "reset" && "col-span-2")}
              onClick={() => onPose(pose.id)}
            >
              {POSE_ICON[pose.id]} {pose.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Snapping</p>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Hoeksnapping">
          {SNAP_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={snapDeg === option}
              className={cn(btn, "flex-1 px-3", snapDeg === option && "border-primary bg-primary/10 text-primary")}
              onClick={() => onSnapChange(option)}
            >
              {option === 0 ? "Uit" : `${option}°`}
            </button>
          ))}
        </div>
        {!drawer && <p className="mt-1 text-xs text-muted-foreground">Houd Shift ingedrukt bij het slepen van een ring voor vrij draaien.</p>}
      </div>

      {!drawer && orientation.allowTilt && (
        <label className="flex min-h-9 items-center justify-between gap-3 text-sm">
          <span>
            Lokale assen
            <span className="block text-xs text-muted-foreground">De ringen draaien om de assen van het item i.p.v. die van de zaal.</span>
          </span>
          <Switch checked={localAxes} onCheckedChange={onLocalAxesChange} />
        </label>
      )}

      <div className="space-y-2">
        <label className="flex min-h-9 items-center justify-between gap-3 text-sm">
          <span>
            Op vloer houden
            <span className="block text-xs text-muted-foreground">Het laagste punt blijft op de vloer, ook na kantelen.</span>
          </span>
          <Switch checked={!free} onCheckedChange={(onFloor) => onLift(onFloor ? null : 0)} disabled={locked} />
        </label>
        {free && (
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <ArrowDownToLine className="size-4 rotate-180" aria-hidden="true" /> Hoogte boven de vloer
            </p>
            <NumberStepper label="Hoogte" unit="m" value={lift ?? 0} step={0.1} min={0} max={10} onChange={(meters) => onLift(meters)} />
          </div>
        )}
      </div>
    </section>
  );
}
