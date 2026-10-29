import { notFound } from "next/navigation";

import { E2E_MODELS } from "@/components/canvas-3d/e2e-models";
import { createGymEnvironment } from "@/components/canvas-3d/environments";
import { PlattegrondViewer } from "@/components/plattegrond/PlattegrondViewer";
import { getActiveMaterialModels } from "@/lib/services/materialModels";
import { createPublicClient } from "@/utils/supabase/public";
import type { ConeField, Floorplan3dData, Floorplan3dItem } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

/**
 * Testpagina voor de detailweergave (e2e/viewer-framing.spec.ts en de voor/na-screenshots): de alleen-lezen viewer met drie
 * opstellingen, zoals op de activiteitpagina. Bestaat alleen buiten productie of met E2E_HARNESS=1.
 *
 *   ?scenario=volleybal | circuit | veld | leeg      &echt=1 (echte modellen uit Supabase i.p.v. gekleurde dozen)   &view=auto|3d|top
 */
const room = { width_m: 24, length_m: 14 };
const item = (id: string, slug: string, x: number, z: number, rot = 0, extra: Partial<Floorplan3dItem> = {}): Floorplan3dItem => ({ id, slug, x, y: 0, z, rot_y_deg: rot, ...extra });
const field = (id: string, x: number, z: number, width: number, length: number, color: string): ConeField => ({ id, type: "coneField", x, z, rot_y_deg: 0, width_m: width, length_m: length, interval_m: 2, distribution: "even", marker: "pion", color, corner_color: null });
const student = (id: string, pose: string, x: number, z: number, rot: number, color?: string): Floorplan3dItem => item(id, `leerling_pose_${pose}`, x, z, rot, color ? { color } : {});

function scenarioData(scenario: string, echt: boolean, view?: string): Floorplan3dData {
  const environment = createGymEnvironment("standaard");
  const base = { width_m: room.width_m, length_m: room.length_m, environment, ...(view === "3d" || view === "top" ? { view } : {}) } as Floorplan3dData["room"];
  if (scenario === "volleybal") {
    const net = echt ? item("net", "volleybalnet_middelhoog_180cm_los", -6, 2) : item("net", "korfbalpaal_test", -6, 2);
    return {
      version: 1,
      room: base,
      items: [
        net,
        ...(echt ? [item("pal1", "volleybalpalen_mobiel_set", -6, 2)] : []),
        student("s1", "volleybal_onderhands", -8, 4.5, 180, "#dc2626"),
        student("s2", "volleybal_bovenhands", -6, 5, 180, "#dc2626"),
        student("s3", "volleybal_onderhands", -4, 4.5, 180, "#dc2626"),
        student("s4", "volleybal_onderhands", -8, -1, 0, "#2563eb"),
        student("s5", "volleybal_bovenhands", -6, -1.5, 0, "#2563eb"),
        student("s6", "volleybal_onderhands", -4, -1, 0, "#2563eb"),
      ],
      coneFields: [],
    };
  }
  if (scenario === "circuit") {
    const mats = echt ? ["aerobic_step", "airblock_200x140_20cm", "aerobic_step", "yogamat_opgerold_set"] : ["testmat_groot", "turnbank_test", "springplank_test", "evenwichtsbalk_test"];
    return {
      version: 1,
      room: base,
      items: [
        item("c1", mats[0], -7, -3, 0),
        item("c2", mats[1], -2, -3, 90),
        item("c3", mats[2], 3, -3.5, 0),
        item("c4", mats[3], 7, -2, 45),
        item("c5", mats[0], 6, 3, 0),
        item("c6", mats[1], 0, 3.5, 0),
        student("s1", "hardlopen", -7, 1, 90, "#f97316"),
        student("s2", "juichen", 3, 1, 0, "#16a34a"),
      ],
      coneFields: [],
    };
  }
  if (scenario === "veld") {
    return {
      version: 1,
      room: base,
      items: echt ? [item("b1", "basketbal_maat_5", 0, 0)] : [item("b1", "basketbal_test", 0, 0)],
      coneFields: [field("f1", -2, 0, 10, 8, "#f97316"), field("f2", 6, 1, 4, 6, "#2563eb")],
    };
  }
  return { version: 1, room: base, items: [], coneFields: [] };
}

export default async function ViewerFramingHarness({ searchParams }: { searchParams: Promise<{ scenario?: string; echt?: string; view?: string }> }) {
  if (process.env.NODE_ENV === "production" && process.env.E2E_HARNESS !== "1") notFound();
  const { scenario = "volleybal", echt, view } = await searchParams;
  let models: MaterialModel[] = E2E_MODELS;
  if (echt) models = await getActiveMaterialModels(createPublicClient());
  const data = scenarioData(scenario, Boolean(echt), view);
  return (
    <main className="mx-auto w-full max-w-4xl space-y-3 p-4">
      <h1 className="text-base font-semibold">Detailweergave (test): {scenario}</h1>
      <PlattegrondViewer data={data} models={models} title={`Testplattegrond ${scenario}`} />
    </main>
  );
}
