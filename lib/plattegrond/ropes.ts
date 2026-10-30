// Pure hulpjes voor touwen (types/floorplan3d.ts) zonder 3D-afhankelijkheden: gebruikt door de editor, de import en het CLI-script.

import type { Floorplan3dItem, Rope } from "@/types/floorplan3d";

/** Haalt de touwen weg die aan een van deze items vastzitten (bij verwijderen van een item). */
export function removeRopesOfItems(ropes: readonly Rope[], itemIds: ReadonlySet<string>): Rope[] {
  return ropes.filter((rope) => !itemIds.has(rope.a.item) && !itemIds.has(rope.b.item));
}

/** Alleen touwen waarvan beide items bestaan en die twee verschillende items verbinden (bij laden en importeren). */
export function ropesWithItems(ropes: readonly Rope[], items: readonly Pick<Floorplan3dItem, "id">[]): Rope[] {
  const ids = new Set(items.map((item) => item.id));
  return ropes.filter((rope) => ids.has(rope.a.item) && ids.has(rope.b.item) && rope.a.item !== rope.b.item);
}
