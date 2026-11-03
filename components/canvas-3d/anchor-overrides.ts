// Handmatige correcties op de anchors die uit de geometrie zijn afgeleid (anchors.generated.ts). Alleen gebruiken als de afleiding
// niet klopt en het model zelf (nog) geen `anchor_…`-node heeft; elke override HEEFT een reden. Zodra het GLB een eigen anchor-node
// krijgt, verdwijnt de override. Zie docs/blender-naming.md voor de naamconventie.

import type { AnchorProfile } from "@/components/canvas-3d/anchors";

export const ANCHOR_OVERRIDES: Record<string, AnchorProfile & { reden: string }> = {};
