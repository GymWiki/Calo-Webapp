// Alle drempels voor plaatsen/stapelen/snappen in de 3D-editor op één plek.
// Afstanden in meter. Wijzig hier, niet in floorplan3d-geometry.ts of
// resolvePlacement.ts.

/** Rand-snap-afstand: komt een rand binnen deze afstand van een andere rand
 * (of muur), dan wordt de afstand exact 0. */
export const SNAP_EDGE_M = 0.08;

/** Een item rust op een ander als minstens dit deel van ZIJN voetafdruk op de ondergrond steunt (0.3 = 30%) — of als zijn
 * middelpunt binnen de voetafdruk eronder valt. Steunt het minder, dan valt het naar een lagere ondergrond of de vloer. */
export const STACK_OVERLAP_MIN = 0.3;

/** Overlap (indringdiepte) kleiner dan dit telt niet als overlap, zodat
 * items strak tegen elkaar kunnen staan zonder over elkaar te springen. */
export const OVERLAP_IGNORE_M = 0.02;

/** Tolerantie voor afrondings-/vergelijkingsfouten (2 mm). */
export const EPS_M = 0.002;
