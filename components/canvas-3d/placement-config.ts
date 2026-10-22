// Alle drempels voor plaatsen/stapelen/snappen in de 3D-editor op één plek.
// Afstanden in meter. Wijzig hier, niet in floorplan3d-geometry.ts of
// resolvePlacement.ts.

/** Rand-snap-afstand: komt een rand binnen deze afstand van een andere rand
 * (of muur), dan wordt de afstand exact 0. */
export const SNAP_EDGE_M = 0.08;

/** Een item stapelt op een ander als de voetafdrukken méér dan dit deel van
 * de KLEINSTE voetafdruk overlappen (0.2 = 20%) — of als het middelpunt van
 * het gesleepte item binnen de voetafdruk eronder valt. */
export const STACK_OVERLAP_MIN = 0.2;

/** Overlap (indringdiepte) kleiner dan dit telt niet als overlap, zodat
 * items strak tegen elkaar kunnen staan zonder over elkaar te springen. */
export const OVERLAP_IGNORE_M = 0.02;

/** Tolerantie voor afrondings-/vergelijkingsfouten (2 mm). */
export const EPS_M = 0.002;
