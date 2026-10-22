import { CONE_MARKER_LABELS, colorName } from "@/components/canvas-3d/cone-field";
import type { FloorplanSummary } from "@/components/canvas-3d/floorplan-summary";

/** Compacte legenda onder de viewer: velden, pionnen per kleur en gebruikte materialen. */
export function PlattegrondLegend({ summary }: { summary: FloorplanSummary }) {
  if (summary.isEmpty) return null;

  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {summary.fields.length > 0 && (
        <div>
          <dt className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Afgezette velden</dt>
          <dd>
            <ul className="space-y-0.5">
              {summary.fields.map((field) => (
                <li key={field.id}>{field.label}</li>
              ))}
            </ul>
            {summary.coneMaterials.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
                {summary.coneMaterials.map((row) => (
                  <li key={`${row.marker}-${row.color}`} className="flex items-center gap-1.5">
                    <span
                      className="size-2.5 shrink-0 rounded-full border border-black/20"
                      style={{ backgroundColor: row.color }}
                      aria-hidden="true"
                    />
                    {row.count}× {colorName(row.color).toLowerCase()} {CONE_MARKER_LABELS[row.marker].toLowerCase()}
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
      )}
      {summary.items.length > 0 && (
        <div>
          <dt className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Materialen</dt>
          <dd>
            <ul className="space-y-0.5">
              {summary.items.map((item) => (
                <li key={item.slug} className="flex gap-2">
                  <span className="w-7 shrink-0 text-right font-medium tabular-nums">{item.count}×</span>
                  <span>{item.naam}</span>
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}
