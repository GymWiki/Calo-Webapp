import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { getFloorplan3d, listFloorplans3d } from "@/actions/floorplans3d";
import { Floorplan3dEditorLoader } from "@/components/canvas-3d/Floorplan3dEditorLoader";
import { DEV_PLACEHOLDER_MODELS } from "@/components/canvas-3d/devPlaceholderModels";
import { GUEST_TOOL_PATH } from "@/lib/guest/constants";
import { getActiveMaterialModels } from "@/lib/services/materialModels";
import { getCurrentUserProfile } from "@/lib/supabase/get-current-profile";
import { createClient } from "@/utils/supabase/server";
import type { Floorplan3dData } from "@/types/floorplan3d";

/**
 * De plattegrondeditor — de ENIGE manier om een plattegrond te maken en te bewerken (de 2D-editor is verwijderd). Eigen opslag
 * (public.floorplans_3d), bereikbaar via de "Plattegrond"-kaart van een activiteit
 * (components/plattegrond/PlattegrondCard.tsx), het menu en de snelle actie op het dashboard.
 *
 * three/@react-three/fiber/@react-three/drei raken `window`/WebGL aan —
 * Floorplan3dEditorLoader doet de ssr:false dynamic-import, dus deze
 * server component zelf blijft licht: alleen de (kleine) materiaalmeta-
 * data en de lijst "Mijn 3D-plattegronden" worden hier al server-side
 * opgehaald, zodat de pagina instant met echte data rendert i.p.v. pas na
 * een client-side fetch (zie CLAUDE.md se "Instant-reacting UI"-standaard)
 * — het GLB-model zelf laadt pas client-side, en pas zodra een item
 * daadwerkelijk wordt neergezet (zie ItemMesh.tsx).
 */
export default async function Plattegrond3dPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; activiteit?: string; debug?: string }>;
}) {
  const profile = await getCurrentUserProfile();
  const { open, activiteit, debug } = await searchParams;
  if (!profile) {
    // Zonder account: de gratis tool is de juiste plek. Een link naar een opgeslagen plattegrond of activiteit vraagt wél om in te loggen.
    redirect(open || activiteit ? "/login" : `${GUEST_TOOL_PATH}#start`);
  }

  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const [models, floorplansResult] = await Promise.all([
    getActiveMaterialModels(supabase),
    listFloorplans3d(),
  ]);

  // Dev-only fallback (zie Stap 5 van de brief): zolang niemand nog
  // `npm run import:materials` heeft gedraaid, is material_models leeg —
  // in productie blijft het menu dan simpelweg leeg (geen placeholders).
  const effectiveModels =
    models.length === 0 && process.env.NODE_ENV === "development" ? DEV_PLACEHOLDER_MODELS : models;

  const initialFloorplans = "success" in floorplansResult ? floorplansResult.floorplans : [];

  let initialFloorplan: { id: string; naam: string; data: Floorplan3dData } | null = null;
  if (open) {
    const result = await getFloorplan3d(open);
    if ("success" in result) {
      initialFloorplan = { id: result.floorplan.id, naam: result.floorplan.naam, data: result.floorplan.data };
    }
  }

  return (
    <Floorplan3dEditorLoader
      models={effectiveModels}
      initialFloorplans={initialFloorplans}
      initialFloorplan={initialFloorplan}
      activiteitId={activiteit}
      debug={debug === "1"}
      debugCollision={debug === "collision" || debug === "collision-legacy"}
      debugLegacy={debug === "collision-legacy"}
    />
  );
}
