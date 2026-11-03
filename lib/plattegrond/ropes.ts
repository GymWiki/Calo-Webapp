// Pure hulpjes voor touwen (types/floorplan3d.ts) zonder 3D-afhankelijkheden: gebruikt door de editor, de import en het CLI-script.

import { endItemId, type Floorplan3dItem, type Rope } from "@/types/floorplan3d";

/** Haalt de touwen weg die aan een van deze items vastzitten (bij verwijderen van een item). Vrije uiteinden hangen aan niets. */
export function removeRopesOfItems(ropes: readonly Rope[], itemIds: ReadonlySet<string>): Rope[] {
  return ropes.filter((rope) => {
    const a = endItemId(rope.a);
    const b = endItemId(rope.b);
    return !(a !== null && itemIds.has(a)) && !(b !== null && itemIds.has(b));
  });
}

/**
 * Alleen touwen waarvan alle vastgemaakte uiteinden een bestaand item hebben, en die niet twee keer aan hetzelfde item vastzitten
 * (bij laden en importeren). Vrije uiteinden zijn altijd geldig.
 */
export function ropesWithItems(ropes: readonly Rope[], items: readonly Pick<Floorplan3dItem, "id">[]): Rope[] {
  const ids = new Set(items.map((item) => item.id));
  return ropes.filter((rope) => {
    const a = endItemId(rope.a);
    const b = endItemId(rope.b);
    if ((a !== null && !ids.has(a)) || (b !== null && !ids.has(b))) return false;
    return a === null || b === null || a !== b;
  });
}
