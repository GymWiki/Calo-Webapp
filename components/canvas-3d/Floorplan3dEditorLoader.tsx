"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { Floorplan3dData, Floorplan3dSummary } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

// three/@react-three/fiber raken `window`/WebGL aan bij het laden — moet
// dus ssr:false, net als components/canvas/FullscreenDiagramEditor.tsx
// voor de 2D-editor (Konva) al doet. Dit houdt three/fiber/drei ook
// volledig buiten elke andere pagina se bundel: alleen wie /plattegrond-3d
// daadwerkelijk bezoekt, laadt deze chunk.
const Floorplan3dEditor = dynamic(
  () => import("@/components/canvas-3d/Floorplan3dEditor").then((mod) => mod.Floorplan3dEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[100dvh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        3D-editor laden...
      </div>
    ),
  },
);

export function Floorplan3dEditorLoader(props: {
  models: MaterialModel[];
  initialFloorplans: Floorplan3dSummary[];
  initialFloorplan: { id: string; naam: string; data: Floorplan3dData } | null;
  /** Nieuwe plattegrond direct aan deze activiteit koppelen (?activiteit=<id>). */
  activiteitId?: string;
  debug?: boolean;
  /** `?debug=collision`: collision-vormen (blauw) en mesh-bounds (groen) per item. */
  debugCollision?: boolean;
  /** `?debug=collision-legacy`: de oude gecentreerde box (voor/na-vergelijking). */
  debugLegacy?: boolean;
}) {
  return <Floorplan3dEditor {...props} />;
}
