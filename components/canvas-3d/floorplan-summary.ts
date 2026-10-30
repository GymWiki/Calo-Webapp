// Compacte samenvatting van een plattegrond (gastexport en editor):
// afgezette velden, pionnen/dopjes per kleur en de
// gebruikte materialen. Pure functie, zie floorplan-summary.test.ts. Het
// materiaaloverzicht van de pionnen is dezelfde logica als in de editor
// (coneMaterialTotals in cone-field.ts) — niet opnieuw geïmplementeerd.

import type { ConeField, Floorplan3dItem } from "@/types/floorplan3d";
import { coneMaterialTotals, fieldLabel, summarizeConeField, type ConeMaterialRow } from "@/components/canvas-3d/cone-field";
import { LIBRARY_CATEGORIES, PERSONS_ID } from "@/lib/constants/libraryTaxonomy";

export type SummaryItem = { slug: string; naam: string; count: number };

/** Materiaal gegroepeerd per hoofdcategorie van de bibliotheek (taxonomie-volgorde). */
export type SummaryGroup = { categorie: string; label: string; total: number; items: SummaryItem[] };

export type FloorplanSummary = {
  fields: { id: string; label: string; total: number }[];
  coneTotal: number;
  coneMaterials: ConeMaterialRow[];
  items: SummaryItem[];
  /** Hetzelfde als `items`, maar zonder personen en per categorie gegroepeerd. Zonder categorie-info: één groep per niet-bepaalde categorie ("overig"). */
  groups: SummaryGroup[];
  /** Aantal personen (leerlingen) — horen niet bij de materiaallijst. */
  personTotal: number;
  itemTotal: number;
  isEmpty: boolean;
};

export function summarizeFloorplan(
  items: Floorplan3dItem[],
  fields: ConeField[],
  nameBySlug: (slug: string) => string | undefined,
  categoryBySlug: (slug: string) => string | undefined = () => undefined,
): FloorplanSummary {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.slug, (counts.get(item.slug) ?? 0) + 1);

  const itemRows = [...counts.entries()]
    .map(([slug, count]) => ({ slug, naam: nameBySlug(slug) ?? "Onbekend materiaal", count }))
    .sort((a, b) => b.count - a.count || a.naam.localeCompare(b.naam, "nl"));

  const groupMap = new Map<string, SummaryItem[]>();
  let personTotal = 0;
  for (const row of itemRows) {
    const categorie = categoryBySlug(row.slug) ?? "overig";
    if (categorie === PERSONS_ID) {
      personTotal += row.count;
      continue;
    }
    groupMap.set(categorie, [...(groupMap.get(categorie) ?? []), row]);
  }
  const groups: SummaryGroup[] = [
    ...LIBRARY_CATEGORIES.map((category) => ({ id: category.id, label: category.label })),
    { id: "overig", label: "Overig" },
  ]
    .filter((category) => groupMap.has(category.id))
    .map((category) => {
      const rows = groupMap.get(category.id)!;
      return { categorie: category.id, label: category.label, total: rows.reduce((sum, row) => sum + row.count, 0), items: rows };
    });

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
    groups,
    personTotal,
    itemTotal: items.length,
    isEmpty: items.length === 0 && fields.length === 0,
  };
}
