// Compacte samenvatting van een plattegrond voor de legenda onder de viewer
// (activiteitpagina): afgezette velden, pionnen/dopjes per kleur en de
// gebruikte materialen. Pure functie, zie floorplan-summary.test.ts. Het
// materiaaloverzicht van de pionnen is dezelfde logica als in de editor
// (coneMaterialTotals in cone-field.ts) — niet opnieuw geïmplementeerd.

import type { ConeField, Floorplan3dItem } from "@/types/floorplan3d";
import { coneMaterialTotals, fieldLabel, summarizeConeField, type ConeMaterialRow } from "@/components/canvas-3d/cone-field";

export type FloorplanSummary = {
  fields: { id: string; label: string; total: number }[];
  coneTotal: number;
  coneMaterials: ConeMaterialRow[];
  items: { slug: string; naam: string; count: number }[];
  itemTotal: number;
  isEmpty: boolean;
};

export function summarizeFloorplan(
  items: Floorplan3dItem[],
  fields: ConeField[],
  nameBySlug: (slug: string) => string | undefined,
): FloorplanSummary {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.slug, (counts.get(item.slug) ?? 0) + 1);

  const itemRows = [...counts.entries()]
    .map(([slug, count]) => ({ slug, naam: nameBySlug(slug) ?? "Onbekend materiaal", count }))
    .sort((a, b) => b.count - a.count || a.naam.localeCompare(b.naam, "nl"));

  const fieldRows = fields.map((field) => ({
    id: field.id,
    label: fieldLabel(field),
    total: summarizeConeField(field).total,
  }));

  return {
    fields: fieldRows,
    coneTotal: fieldRows.reduce((sum, row) => sum + row.total, 0),
    coneMaterials: coneMaterialTotals(fields),
    items: itemRows,
    itemTotal: items.length,
    isEmpty: items.length === 0 && fields.length === 0,
  };
}
