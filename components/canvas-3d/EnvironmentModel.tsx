"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { ALWAYS_HIDDEN_NODES, environmentModelUrl } from "@/components/canvas-3d/environments";
import { resolveEnvironment } from "@/components/canvas-3d/environment-kinds";
import { WALL_MOUNT_NODE, WALL_RACK_FRONT_SHIFT_M } from "@/components/canvas-3d/wall-mount";
import type { Floorplan3dEnvironment } from "@/types/floorplan3d";

/**
 * De omgeving (gymzaal, sportveld, atletiekbaan of zwembad) als GLB. Eén
 * GLB per indeling; wanden, lijnen, trappen enz. zijn losse nodes met vaste
 * namen en worden hier alleen zichtbaar/onzichtbaar gezet
 * (`environment.hidden`). Het model is niet interactief (raycast uit):
 * slepen/selecteren gaat altijd door muren en vloer heen naar het
 * onzichtbare sleepvlak in Scene3D.
 */
export function EnvironmentModel({ environment, extraHidden = [] }: { environment: Floorplan3dEnvironment; /** Extra verborgen nodes bovenop `environment.hidden` (viewer: de muren die voor de camera staan). */ extraHidden?: readonly string[] }) {
  const layout = resolveEnvironment(environment);
  const gltf = useGLTF(environmentModelUrl(layout));
  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);
    cloned.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) object.raycast = () => {};
      // Wandrekken staan in de GLB's 180° verkeerd om (console de zaal in, ribben tegen de muur): omdraaien en tegen de wand zetten (zie wall-mount.ts).
      if (object.name && WALL_MOUNT_NODE.test(object.name)) {
        object.rotateY(Math.PI);
        object.translateZ(WALL_RACK_FRONT_SHIFT_M);
      }
    });
    return cloned;
  }, [gltf.scene]);

  const invalidate = useThree((state) => state.invalidate);
  const hiddenKey = [...ALWAYS_HIDDEN_NODES, ...environment.hidden, ...extraHidden].join("|");

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
