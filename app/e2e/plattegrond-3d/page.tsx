import { notFound } from "next/navigation";

import { Floorplan3dEditorLoader } from "@/components/canvas-3d/Floorplan3dEditorLoader";
import { E2E_MODELS } from "@/components/canvas-3d/e2e-models";

/**
 * Testpagina voor de Playwright-tests (e2e/): dezelfde editor als /plattegrond-3d, maar zonder login en
 * met vaste testmodellen (gekleurde dozen, geen Supabase of GLB's nodig). Bestaat alleen buiten productie,
 * of als `E2E_HARNESS=1` is gezet — in een gewone productiebuild geeft dit een 404.
 */
export default async function E2EEditorPage({ searchParams }: { searchParams: Promise<{ beheer?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();
  // `?beheer=1`: toont de beheerbadge met vaste testgegevens (de server-acties erachter hebben geen sessie in de testomgeving).
  const { beheer } = await searchParams;
  const adminInfo = beheer ? { floorplanId: "00000000-0000-0000-0000-000000000001", ownerName: "Test Eigenaar", ownerIsSelf: false, activityId: "test-activiteit", activityTitle: "Testactiviteit" } : null;
  return <Floorplan3dEditorLoader models={E2E_MODELS} initialFloorplans={[]} initialFloorplan={null} adminInfo={adminInfo} />;
}
