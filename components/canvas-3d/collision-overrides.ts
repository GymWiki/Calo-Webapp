import type { CollisionOverride } from "@/components/canvas-3d/collision-shape";

/**
 * Handmatige uitzonderingen op de automatische collision-vorm (die uit de
 * zichtbare geometrie van het GLB komt, zie collision-shape.ts). Alleen
 * gebruiken waar een box niet past; ELKE override heeft een reden.
 *
 * Velden die je weglaat, blijven de automatische waarde. Voorbeelden:
 *   kind: "none"      puur visueel: botst niet en blokkeert niets (net, lint)
 *   kind: "cylinder"  rond grondvlak (straal = grootste maat / 2)
 *   kind: "capsule"   langwerpig met afgeronde einden (stok, paal)
 *   kind: "compound"  meerdere boxen via `parts` (bv. een doel met open net)
 */
export const COLLISION_OVERRIDES: Record<string, CollisionOverride> = {
  dikke_mat_300x200x30: {
    reason:
      "Het GLB is 3,06 m lang door overstekende naden; de mat is 3,00 × 2,00 × 0,30 m. De botsing volgt de echte matmaat (zelfde maat als de database-override).",
    length_m: 3,
    width_m: 2,
    height_m: 0.3,
  },
};
