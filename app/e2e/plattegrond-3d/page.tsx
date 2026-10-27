import { notFound } from "next/navigation";

import { Floorplan3dEditorLoader } from "@/components/canvas-3d/Floorplan3dEditorLoader";
import { E2E_MODELS } from "@/components/canvas-3d/e2e-models";

/**
 * Testpagina voor de Playwright-tests (e2e/): dezelfde editor als /plattegrond-3d, maar zonder login en
 * met vaste testmodellen (gekleurde dozen, geen Supabase of GLB's nodig). Bestaat alleen buiten productie,
 * of als `E2E_HARNESS=1` is gezet — in een gewone productiebuild geeft dit een 404.
 */
export default function E2EEditorPage() {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();
  return <Floorplan3dEditorLoader models={E2E_MODELS} initialFloorplans={[]} initialFloorplan={null} />;
}
