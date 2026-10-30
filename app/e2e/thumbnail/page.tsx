import { notFound } from "next/navigation";

import { E2E_MODELS } from "@/components/canvas-3d/e2e-models";
import { createGymEnvironment } from "@/components/canvas-3d/environments";
import { getActiveMaterialModels } from "@/lib/services/materialModels";
import { createPublicClient } from "@/utils/supabase/public";
import type { Floorplan3dData } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

import { ThumbnailHarness } from "./ThumbnailHarness";

/** Testpagina voor de preview-opname (bibliotheekkaart). `?echt=1`: echte modellen uit Supabase. Alleen buiten productie of met E2E_HARNESS=1. */
export default async function ThumbnailPage({ searchParams }: { searchParams: Promise<{ echt?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();
  const { echt } = await searchParams;
  const models: MaterialModel[] = echt ? await getActiveMaterialModels(createPublicClient()) : E2E_MODELS;
  const item = (id: string, slug: string, x: number, z: number, rot = 0, color?: string) => ({ id, slug, x, y: 0, z, rot_y_deg: rot, ...(color ? { color } : {}) });
  const data: Floorplan3dData = {
    version: 1,
    room: { width_m: 24, length_m: 14, environment: createGymEnvironment("standaard") },
    items: [
      item("s1", "leerling_pose_basketbal_dribbelen", -3, 0, 90, "#dc2626"),
      item("s2", "leerling_pose_verdedigen", -1, 0.5, 270, "#2563eb"),
      item("s3", "leerling_pose_standaard", 2, -1, 0, "#16a34a"),
      item("s4", "leerling_pose_hockey", 3, 2, 45, "#f97316"),
    ],
    coneFields: [],
    ropes: [],
  };
  return <ThumbnailHarness data={data} models={models} />;
}
