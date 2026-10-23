"use client";

import { useId, type KeyboardEvent } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  GYM_LAYOUT_ORDER,
  GYM_LAYOUTS,
  isPartOn,
  setPartOn,
  setPartsOn,
  type EnvironmentPart,
  type GymLayout,
  type GymLayoutId,
  type WallSide,
} from "@/components/canvas-3d/environments";
import type { Floorplan3dEnvironment } from "@/types/floorplan3d";

// ---------------------------------------------------------------------------
// Kleine plattegrond-schema's. Boven = achter, onder = voor (zoals je de
// zaal vanuit de standaardcamera ziet). Maten in meters, dus de schema's
// zijn altijd op schaal.
// ---------------------------------------------------------------------------

function LayoutIcon({ layout, className }: { layout: GymLayout; className?: string }) {
  const { width_m: w, length_m: l } = layout;
  return (
    <svg viewBox={`${-w / 2 - 1} ${-l / 2 - 1} ${w + 2} ${l + 2}`} className={className} aria-hidden="true">
      <rect x={-w / 2} y={-l / 2} width={w} height={l} rx={1} className="fill-muted stroke-foreground/60" strokeWidth={1} />
      {layout.curtains.map((curtain) => (
        <line
          key={curtain.id}
          x1={curtain.from.x}
          y1={curtain.from.z}
          x2={curtain.to.x}
          y2={curtain.to.z}
          className="stroke-foreground/50"
          strokeWidth={0.8}
          strokeDasharray="1.6 1.2"
        />
      ))}
      {layout.zalen.map((zaal) => (
        <text
          key={zaal.nummer}
          x={zaal.x}
          y={zaal.z}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground/70 font-semibold"
          fontSize={Math.min(w, l) > 20 ? 7 : 5}
        >
          {zaal.nummer}
        </text>
      ))}
    </svg>
  );
}

function onActivateKey(event: KeyboardEvent<SVGElement>, action: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    action();
  }
}

const WALL_LINE: Record<WallSide, (l: GymLayout) => { x1: number; y1: number; x2: number; y2: number }> = {
  achter: (l) => ({ x1: -l.width_m / 2, y1: -l.length_m / 2, x2: l.width_m / 2, y2: -l.length_m / 2 }),
  voor: (l) => ({ x1: -l.width_m / 2, y1: l.length_m / 2, x2: l.width_m / 2, y2: l.length_m / 2 }),
  links: (l) => ({ x1: -l.width_m / 2, y1: -l.length_m / 2, x2: -l.width_m / 2, y2: l.length_m / 2 }),
  rechts: (l) => ({ x1: l.width_m / 2, y1: -l.length_m / 2, x2: l.width_m / 2, y2: l.length_m / 2 }),
};

function sideLabelPosition(side: WallSide, l: GymLayout, offset: number): { x: number; y: number } {
  if (side === "achter") return { x: 0, y: -l.length_m / 2 - offset };
  if (side === "voor") return { x: 0, y: l.length_m / 2 + offset };
  if (side === "links") return { x: -l.width_m / 2 - offset, y: 0 };
  return { x: l.width_m / 2 + offset, y: 0 };
}

/** Klikbare plattegrond: tik op een muur of gordijn om hem weg te halen of terug te zetten. */
function PlanToggles({
  layout,
  hidden,
  onHiddenChange,
}: {
  layout: GymLayout;
  hidden: string[];
  onHiddenChange: (hidden: string[]) => void;
}) {
  const { width_m: w, length_m: l } = layout;
  const hitWidth = Math.max(w, l) / 7;
  const wallStroke = Math.max(w, l) / 28;
  const labelSize = Math.max(w, l) / 17;
  // Labels staan buiten de muur: halve muurdikte + ruimte voor de tekst.
  const labelOffset = wallStroke / 2 + labelSize * 0.85;
  const pad = labelOffset + labelSize * 0.8;

  function toggle(part: EnvironmentPart) {
    onHiddenChange(setPartOn(hidden, part, !isPartOn(part, hidden)));
  }

  return (
    <svg
      viewBox={`${-w / 2 - pad} ${-l / 2 - pad} ${w + pad * 2} ${l + pad * 2}`}
      className="mx-auto max-h-72 w-full touch-manipulation select-none"
      role="group"
      aria-label="Plattegrond van de zaal: kies welke muren en gordijnen er staan"
    >
      <rect x={-w / 2} y={-l / 2} width={w} height={l} className="fill-muted" />

      {layout.zalen.map((zaal) => (
        <text
          key={zaal.nummer}
          x={zaal.x}
          y={zaal.z}
          textAnchor="middle"
          dominantBaseline="central"
          className="pointer-events-none fill-muted-foreground/60 font-semibold"
          fontSize={Math.min(w, l) > 20 ? 6 : 4}
        >
          {layout.zalen.length > 1 ? `Zaal ${zaal.nummer}` : "Zaal"}
        </text>
      ))}

      {layout.curtains.map((curtain) => {
        const on = isPartOn(curtain, hidden);
        return (
          <g
            key={curtain.id}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`Gordijn ${curtain.label}: ${on ? "staat, tik om weg te halen" : "weg, tik om terug te zetten"}`}
            className="cursor-pointer outline-none [&:focus-visible_.focus-ring]:opacity-100"
            onClick={() => toggle(curtain)}
            onKeyDown={(event) => onActivateKey(event, () => toggle(curtain))}
          >
            <line
              x1={curtain.from.x}
              y1={curtain.from.z}
              x2={curtain.to.x}
              y2={curtain.to.z}
              className="focus-ring stroke-ring opacity-0"
              strokeWidth={hitWidth}
              strokeLinecap="round"
            />
            <line
              x1={curtain.from.x}
              y1={curtain.from.z}
              x2={curtain.to.x}
              y2={curtain.to.z}
              stroke="transparent"
              strokeWidth={hitWidth}
            />
            <line
              x1={curtain.from.x}
              y1={curtain.from.z}
              x2={curtain.to.x}
              y2={curtain.to.z}
              className={on ? "stroke-sky-600" : "stroke-muted-foreground/50"}
              strokeWidth={wallStroke * 0.7}
              strokeDasharray={on ? undefined : `${wallStroke * 1.4} ${wallStroke * 1.4}`}
            />
            <title>{`Gordijn ${curtain.label}`}</title>
          </g>
        );
      })}

      {layout.walls.map((wall) => {
        const on = isPartOn(wall, hidden);
        const line = WALL_LINE[wall.side](layout);
        return (
          <g
            key={wall.id}
            role="button"
            tabIndex={0}
            aria-pressed={on}
            aria-label={`${wall.label}: ${on ? "staat, tik om weg te halen" : "weg, tik om terug te zetten"}`}
            className="cursor-pointer outline-none [&:focus-visible_.focus-ring]:opacity-100"
            onClick={() => toggle(wall)}
            onKeyDown={(event) => onActivateKey(event, () => toggle(wall))}
          >
            <line {...line} className="focus-ring stroke-ring opacity-0" strokeWidth={hitWidth} strokeLinecap="round" />
            <line {...line} stroke="transparent" strokeWidth={hitWidth} />
            <line
              {...line}
              className={on ? "stroke-foreground" : "stroke-muted-foreground/50"}
              strokeWidth={wallStroke}
              strokeDasharray={on ? undefined : `${wallStroke * 1.4} ${wallStroke * 1.4}`}
              strokeLinecap="butt"
            />
            <title>{wall.label}</title>
          </g>
        );
      })}

      {layout.walls.map((wall) => {
        const position = sideLabelPosition(wall.side, layout, labelOffset);
        return (
          <text
            key={`label-${wall.id}`}
            x={position.x}
            y={position.y}
            textAnchor="middle"
            dominantBaseline="central"
            className="pointer-events-none fill-muted-foreground"
            fontSize={labelSize}
            transform={wall.side === "links" || wall.side === "rechts" ? `rotate(${wall.side === "links" ? -90 : 90} ${position.x} ${position.y})` : undefined}
          >
            {wall.side.charAt(0).toUpperCase() + wall.side.slice(1)}
          </text>
        );
      })}
    </svg>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>;
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="min-w-0 text-sm">
        {label}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

/**
 * Keuzepaneel voor de gymzaal-omgeving: indeling (1 of meer zalen), muren en
 * scheidingsgordijnen aan/uit op een klikbare plattegrond, en extra's
 * (wandrekken, sportlijnen). Alleen UI — de aanroeper bewaart de state.
 */
export function GymEnvironmentPanel({
  environment,
  onLayoutChange,
  onHiddenChange,
}: {
  environment: Floorplan3dEnvironment;
  onLayoutChange: (layout: GymLayoutId) => void;
  onHiddenChange: (hidden: string[]) => void;
}) {
  const layout = GYM_LAYOUTS[environment.layout as GymLayoutId] ?? GYM_LAYOUTS.standaard;
  const { hidden } = environment;

  const wallsOn = layout.walls.filter((wall) => isPartOn(wall, hidden)).length;
  const curtainsOn = layout.curtains.filter((curtain) => isPartOn(curtain, hidden)).length;

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle>Indeling</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {GYM_LAYOUT_ORDER.map((id) => {
            const option = GYM_LAYOUTS[id];
            const selected = id === environment.layout;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                onClick={() => !selected && onLayoutChange(id)}
                className={cn(
                  "relative flex min-w-0 flex-col items-center gap-1.5 rounded-lg border bg-background p-2 text-center transition-colors duration-150 ease-brand hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  selected && "border-primary bg-primary/5 ring-1 ring-primary",
                )}
              >
                {selected && (
                  <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <LayoutIcon layout={option} className="h-16 w-full" />
                <span className="text-xs leading-tight font-medium">{option.label}</span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {option.width_m} × {option.length_m} m
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionTitle>Muren{layout.curtains.length > 0 ? " en gordijnen" : ""}</SectionTitle>
        <p className="mb-2 text-xs text-muted-foreground">
          Tik op een muur
          {layout.curtains.length > 0 ? " of gordijn" : ""} in de plattegrond om hem weg te halen of terug te zetten.
        </p>
        <PlanToggles layout={layout} hidden={hidden} onHiddenChange={onHiddenChange} />

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-5 bg-foreground" /> muur staat
          </span>
          {layout.curtains.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-5 bg-sky-600" /> gordijn dicht
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-5 border-t-2 border-dashed border-muted-foreground/60" /> weg
          </span>
        </div>

        <div className={cn("mt-3 grid gap-2", layout.curtains.length > 0 ? "grid-cols-2" : "grid-cols-1")}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onHiddenChange(setPartsOn(hidden, layout.walls, wallsOn === 0))}
          >
            {wallsOn === 0 ? "Alle muren terug" : "Alle muren weg"}
          </Button>
          {layout.curtains.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onHiddenChange(setPartsOn(hidden, layout.curtains, curtainsOn === 0))}
            >
              {curtainsOn === 0 ? "Alle gordijnen dicht" : "Alle gordijnen open"}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <SectionTitle>Extra&apos;s</SectionTitle>
        <ToggleRow
          label="Wandrekken"
          checked={isPartOn(layout.wandrekken, hidden)}
          onCheckedChange={(on) => onHiddenChange(setPartOn(hidden, layout.wandrekken, on))}
        />
        <div>
          <p className="mb-1.5 text-sm">Sportlijnen op de vloer</p>
          <div className="flex flex-wrap gap-1.5">
            {layout.lijnen.map((part) => {
              const on = isPartOn(part, hidden);
              return (
                <Button
                  key={part.id}
                  type="button"
                  size="sm"
                  variant={on ? "default" : "outline"}
                  aria-pressed={on}
                  onClick={() => onHiddenChange(setPartOn(hidden, part, !on))}
                >
                  {part.label}
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
