"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { environmentModelUrl, GYM_LAYOUTS } from "@/components/canvas-3d/environments";
import type { Floorplan3dEnvironment } from "@/types/floorplan3d";

/**
 * De gymzaal-GLB als omgeving. Eén GLB per indeling; muren, gordijnen,
 * wandrekken en sportlijnen zijn losse nodes met vaste namen en worden hier
 * alleen zichtbaar/onzichtbaar gezet (`environment.hidden`). Het model is
 * niet interactief (raycast uit): slepen/selecteren gaat altijd door de
 * muren en de vloer heen naar het onzichtbare sleepvlak in Scene3D.
 */
export function GymEnvironment({ environment }: { environment: Floorplan3dEnvironment }) {
  const layout = GYM_LAYOUTS[environment.layout];
  const gltf = useGLTF(environmentModelUrl(layout));
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) object.raycast = () => {};
    });
    return cloned;
  }, [gltf.scene]);

  const invalidate = useThree((state) => state.invalidate);
  const hiddenKey = environment.hidden.join("|");

  useEffect(() => {
    const hidden = new Set(hiddenKey ? hiddenKey.split("|") : []);
    scene.traverse((object) => {
      if (object.name) object.visible = !hidden.has(object.name);
    });
    // frameloop="demand": zonder invalidate zie je de wijziging pas bij de volgende beweging.
    invalidate();
  }, [scene, hiddenKey, invalidate]);

  return <primitive object={scene} />;
}
