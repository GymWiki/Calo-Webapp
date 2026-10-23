"use client";

import { useId } from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { isPartOn, setPartOn, setPartsOn } from "@/components/canvas-3d/environments";
import {
  findEnvironmentLayout,
  layoutsOfKind,
  type EnvironmentGroup,
} from "@/components/canvas-3d/environment-kinds";
import type { Floorplan3dEnvironment } from "@/types/floorplan3d";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</p>;
}

function ToggleRow({ label, checked, onCheckedChange }: { label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
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

function GroupSection({
  group,
  hidden,
  onHiddenChange,
}: {
  group: EnvironmentGroup;
  hidden: string[];
  onHiddenChange: (hidden: string[]) => void;
}) {
  if (group.parts.length === 0 || group.parts.every((p) => p.nodes.length === 0)) return null;
  const allOn = group.parts.every((p) => isPartOn(p, hidden));
  const manyParts = group.parts.length > 2;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>{group.label}</SectionTitle>
        {manyParts && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mt-1.5 h-7 px-2 text-xs"
            onClick={() => onHiddenChange(setPartsOn(hidden, group.parts, !allOn))}
          >
            {allOn ? "Alles uit" : "Alles aan"}
          </Button>
        )}
      </div>
      {group.parts
        .filter((p) => p.nodes.length > 0)
        .map((p) => (
          <ToggleRow
            key={p.id}
            label={p.label}
            checked={isPartOn(p, hidden)}
            onCheckedChange={(on) => onHiddenChange(setPartOn(hidden, p, on))}
          />
        ))}
    </div>
  );
}

/**
 * Keuzepaneel voor sportveld, atletiekbaan en zwembad: indeling kiezen en de
 * onderdelen van die indeling (belijning, banenlijnen, trappen, ...) aan of
 * uit zetten. Alleen UI — de aanroeper bewaart de state (zie
 * Floorplan3dEditor). De gymzaal heeft zijn eigen paneel met plattegrondschema.
 */
export function EnvironmentPanel({
  environment,
  onLayoutChange,
  onHiddenChange,
}: {
  environment: Floorplan3dEnvironment;
  onLayoutChange: (layoutId: string) => void;
  onHiddenChange: (hidden: string[]) => void;
}) {
  if (environment.type === "gymzaal") return null;
  const layouts = layoutsOfKind(environment.type);
  const layout = findEnvironmentLayout(environment.type, environment.layout) ?? layouts[0];
  if (!layout) return null;

  return (
    <div className="space-y-5">
      {layouts.length > 1 && (
        <div>
          <SectionTitle>Indeling</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {layouts.map((option) => {
              const selected = option.id === layout.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => !selected && onLayoutChange(option.id)}
                  className={cn(
                    "relative flex min-w-0 flex-col gap-0.5 rounded-lg border bg-background p-3 text-left transition-colors duration-150 ease-brand hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                    selected && "border-primary bg-primary/5 ring-1 ring-primary",
                  )}
                >
                  {selected && (
                    <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3" />
                    </span>
                  )}
                  <span className="text-sm leading-tight font-medium">{option.label}</span>
                  <span className="text-xs leading-tight text-muted-foreground">
                    {option.width_m.toLocaleString("nl-NL")} × {option.length_m.toLocaleString("nl-NL")} m
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {layout.description}. Het bouwvlak is {layout.width_m.toLocaleString("nl-NL")} × {layout.length_m.toLocaleString("nl-NL")} m.
      </p>

      {layout.groups.map((group) => (
        <GroupSection key={group.id} group={group} hidden={environment.hidden} onHiddenChange={onHiddenChange} />
      ))}
    </div>
  );
}
