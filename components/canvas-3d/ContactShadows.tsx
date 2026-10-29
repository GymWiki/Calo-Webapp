"use client";

import { useMemo } from "react";
import * as THREE from "three";

import { dimsOf, shapeOfDims, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { isElevated } from "@/components/canvas-3d/collision-shape";
import type { Floorplan3dItem } from "@/types/floorplan3d";

const MIN_RADIUS_M = 0.18;

/**
 * Zachte, ronde schaduwvlek onder elk item op de vloer (alleen in de alleen-lezen viewer en de thumbnails). Goedkoop: één gedeelde
 * geometrie en materiaal, geen extra render-pass. Hangend materiaal (netten, ringen) en items zonder voetafdruk krijgen geen vlek.
 */
export function ContactShadows({ items, lookup }: { items: readonly Floorplan3dItem[]; lookup: DimsLookup }) {
  const { geometry, material } = useMemo(() => {
    const circle = new THREE.CircleGeometry(1, 28);
    circle.rotateX(-Math.PI / 2);
    return { geometry: circle, material: new THREE.MeshBasicMaterial({ color: "#0f172a", transparent: true, opacity: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }) };
  }, []);

  return (
    <group>
      {items.map((item) => {
        const shape = shapeOfDims(dimsOf(item, lookup));
        if (shape.kind === "none" || isElevated(shape)) return null;
        const radiusX = Math.max(MIN_RADIUS_M, shape.length_m / 2) * 1.15;
        const radiusZ = Math.max(MIN_RADIUS_M, shape.width_m / 2) * 1.15;
        const yaw = THREE.MathUtils.degToRad(item.rot_y_deg);
        // Middelpunt van de voetafdruk (offset t.o.v. de pivot, mee gedraaid met het item).
        const cx = item.x + shape.offset_x * Math.cos(yaw) + shape.offset_z * Math.sin(yaw);
        const cz = item.z - shape.offset_x * Math.sin(yaw) + shape.offset_z * Math.cos(yaw);
        return (
          <mesh key={item.id} geometry={geometry} material={material} position={[cx, item.y + 0.012, cz]} rotation={[0, yaw + THREE.MathUtils.degToRad(shape.yaw_deg), 0]} scale={[radiusX, 1, radiusZ]} raycast={() => {}} renderOrder={1} />
        );
      })}
    </group>
  );
}
