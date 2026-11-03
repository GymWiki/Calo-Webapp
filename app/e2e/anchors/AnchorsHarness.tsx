"use client";

import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";

import { FloorplanContent } from "@/components/canvas-3d/FloorplanContent";
import { COLLISION_PROFILES } from "@/components/canvas-3d/collision-profiles.generated";
import { dimsLookupFromModels } from "@/components/canvas-3d/floorplan3d-geometry";
import type { Floorplan3dItem, Rope } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

function modelFor(slug: string, supabaseUrl: string): MaterialModel {
  const shape = COLLISION_PROFILES[slug]?.shape;
  return {
    id: `harness-${slug}`, slug, material_id: null, naam: slug, categorie: "doelen_netten", subgroep: null, sporten: [], tags: [],
    model_url: `${supabaseUrl}/storage/v1/object/public/materials-3d/models/${slug}.glb`, preview_url: "",
    length_m: shape?.length_m ?? 1, width_m: shape?.width_m ?? 1, height_m: shape?.height_m ?? 1, stackable: false, sort_order: 0,
  } as MaterialModel;
}

export function AnchorsHarness({ stand, showAnchors, slug, supabaseUrl }: { stand: "voor" | "na"; showAnchors: boolean; slug: string; supabaseUrl: string }) {
  const model = useMemo(() => modelFor(slug, supabaseUrl), [slug, supabaseUrl]);
  const lookup = useMemo(() => dimsLookupFromModels([model]), [model]);
  const items: Floorplan3dItem[] = [
    { id: "p1", slug, x: -3, y: 0, z: 0, rot_y_deg: 0 },
    { id: "p2", slug, x: 3, y: 0, z: 0, rot_y_deg: 0 },
  ];
  // Opgeslagen zoals vóór de anchors: de plek waar de muis de gele korf raakte (rand van de korf).
  const rim = (z: number): [number, number, number] => [0.5, 2.45, z];
  const ropes: Rope[] = [
    stand === "voor"
      ? { id: "r1", a: { item: "p1", local: rim(0.12), anchor: "__oud" }, b: { item: "p2", local: rim(-0.12), anchor: "__oud" } }
      : { id: "r1", a: { item: "p1", local: rim(0.12) }, b: { item: "p2", local: rim(-0.12) } },
  ];

  return (
    <div style={{ width: 960, height: 540, background: "#f6f5f1" }} data-testid="anchors-harness" data-stand={stand}>
      <Canvas camera={{ position: [0.4, 2.6, 7.2], fov: 38, near: 0.1, far: 100 }} gl={{ preserveDrawingBuffer: true }} onCreated={({ camera }) => camera.lookAt(0.2, 1.7, 0)}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[6, 12, 8]} intensity={1.1} />
        <Suspense fallback={null}>
          <FloorplanContent
            room={{ width_m: 12, length_m: 8 }}
            items={items}
            fields={[]}
            ropes={ropes}
            modelBySlug={() => model}
            lookup={lookup}
            interactive={false}
            showAllAnchors={showAnchors}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
