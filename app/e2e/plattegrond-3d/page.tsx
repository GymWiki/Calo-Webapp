import { notFound } from "next/navigation";

import { Floorplan3dEditorLoader } from "@/components/canvas-3d/Floorplan3dEditorLoader";
import { E2E_MODELS } from "@/components/canvas-3d/e2e-models";
import { isStudentSlug, studentModels } from "@/lib/students/catalog";

/**
 * Testpagina voor de Playwright-tests (e2e/): dezelfde editor als /plattegrond-3d, maar zonder login en
 * met vaste testmodellen (gekleurde dozen, geen Supabase of GLB's nodig). Bestaat alleen buiten productie,
 * of als `E2E_HARNESS=1` is gezet — in een gewone productiebuild geeft dit een 404.
 */
export default async function E2EEditorPage({ searchParams }: { searchParams: Promise<{ beheer?: string; debug?: string; echt?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();
  // `?beheer=1`: toont de beheerbadge met vaste testgegevens (de server-acties erachter hebben geen sessie in de testomgeving).
  const { beheer, debug, echt } = await searchParams;
  const adminInfo = beheer ? { floorplanId: "00000000-0000-0000-0000-000000000001", ownerName: "Test Eigenaar", ownerIsSelf: false, activityId: "test-activiteit", activityTitle: "Testactiviteit" } : null;
  // `?echt=1`: de leerlingen als echte GLB's (url http://e2e.local/students/<id>.glb, in de test via een netwerkroute uit materiaal-import/leerlingen); `?debug=collision`: debugweergave (hand- en greeppunten).
  const models = echt ? [...E2E_MODELS.filter((model) => !isStudentSlug(model.slug)), ...studentModels("http://e2e.local")] : E2E_MODELS;
  return <Floorplan3dEditorLoader models={models} initialFloorplans={[]} initialFloorplan={null} adminInfo={adminInfo} debugCollision={debug === "collision"} />;
}
