import { notFound } from "next/navigation";

import { AppLayout } from "@/components/app-layout";
import { Floorplan3dEditorLoader } from "@/components/canvas-3d/Floorplan3dEditorLoader";
import { E2E_MODELS } from "@/components/canvas-3d/e2e-models";

/**
 * Testpagina (e2e/mobiel-schermvullend.spec.ts): de editor BINNEN de app-shell (globale navigatie), zoals /plattegrond-3d.
 * De gewone testroute /e2e/plattegrond-3d heeft geen shell en toont dit probleem dus niet. Alleen buiten productie of met E2E_HARNESS=1.
 */
export default function ShellEditorHarness() {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();
  return (
    <AppLayout>
      <Floorplan3dEditorLoader models={E2E_MODELS} initialFloorplans={[]} initialFloorplan={null} adminInfo={null} />
    </AppLayout>
  );
}
