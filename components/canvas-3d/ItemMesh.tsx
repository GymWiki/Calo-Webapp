"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Floorplan3dItem } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";
import { shapeOfDims, type ItemDims } from "@/components/canvas-3d/floorplan3d-geometry";
import { CollisionDebug, ShapeWireframe } from "@/components/canvas-3d/CollisionDebug";
import { measureMeshExtent } from "@/components/canvas-3d/collision-measure";
import type { MeshExtent } from "@/components/canvas-3d/collision-shape";

const SELECTION_COLOR = "#2563eb"; // tailwind blue-600
const UNKNOWN_BOX_COLOR = "#9ca3af"; // tailwind gray-400

/** Selectie-outline = de echte collision-vorm (oriented, met offset en onderkant), niet een gecentreerde box. */
function SelectionOutline({ dims }: { dims: ItemDims }) {
  return <ShapeWireframe shape={shapeOfDims(dims)} color={SELECTION_COLOR} />;
}

/** Geladen GLB-model (useGLTF, Suspense + drei's cache — zie Stap 4.1: de
 * eerste plaatsing van een slug laadt het bestand, elke volgende hergebruikt
 * de cache). Gebruikt `clone(true)` zodat meerdere exemplaren van hetzelfde
 * model onafhankelijk hun eigen plek in de scene-graaf kunnen hebben. */
function LoadedModel({ modelUrl, onMeasured }: { modelUrl: string; onMeasured?: (extent: MeshExtent | null) => void }) {
  const gltf = useGLTF(modelUrl);
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  // Alleen in de debug-weergave: de zichtbare geometrie meten (gecachet per model).
  useEffect(() => {
    if (onMeasured) onMeasured(measureMeshExtent(gltf.scene));
  }, [gltf.scene, onMeasured]);
  return <primitive object={cloned} />;
}

/** Grijs placeholder-vakje — slug komt niet (meer) voor in de actieve
 * modellenlijst (zie Stap 4.9: "nooit een crash"). Afmetingen onbekend,
 * dus een vast, herkenbaar klein blokje. */
function UnknownItemBox() {
  return (
    <mesh position={[0, 0.25, 0]}>
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial color={UNKNOWN_BOX_COLOR} />
    </mesh>
  );
}

/** Dev-only placeholder (zie components/canvas-3d/devPlaceholderModels.ts) — een gekleurde
 * doos op de echte tafelafmetingen, duidelijk anders dan UnknownItemBox
 * (die altijd 0,5×0,5×0,5 grijs is, ongeacht afmetingen). */
function DevPlaceholderBox({ dims, color }: { dims: ItemDims; color: string }) {
  return (
    <mesh position={[0, dims.height_m / 2, 0]}>
      <boxGeometry args={[dims.length_m, dims.height_m, dims.width_m]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

export function ItemMesh({
  item,
  model,
  dims: dimsFromLookup,
  selected,
  interactive = true,
  debugCollision = false,
  onPointerDownItem,
  onSelect,
  onHover,
}: {
  item: Floorplan3dItem;
  model: MaterialModel | undefined;
  /** Collision-vorm en maten van dit asset (uit de dims-lookup); zonder: de oude box uit het model. */
  dims?: ItemDims;
  selected: boolean;
  /** false tijdens "Veld afzetten": klikken gaan dan door naar de vloer. */
  interactive?: boolean;
  /** `?debug=collision`: collision-vorm (blauw) en mesh-bounds (groen) tonen. */
  debugCollision?: boolean;
  onPointerDownItem?: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onSelect?: (id: string) => void;
  /** Alleen-lezen weergave: hover/tik geeft het item door (tooltip met naam). */
  onHover?: (item: Floorplan3dItem | null) => void;
}) {
  const dims: ItemDims =
    dimsFromLookup ??
    (model
      ? { length_m: model.length_m, width_m: model.width_m, height_m: model.height_m, stackable: model.stackable }
      : { length_m: 0.5, width_m: 0.5, height_m: 0.5, stackable: true });
  const [measured, setMeasured] = useState<MeshExtent | null>(null);
  const [hovered, setHovered] = useState(false);
  const handleMeasured = useCallback((extent: MeshExtent | null) => setMeasured(extent), []);

  return (
    <group
      position={[item.x, item.y, item.z]}
      rotation={[0, THREE.MathUtils.degToRad(item.rot_y_deg), 0]}
      onPointerDown={(event) => {
        if (!interactive) {
          // Alleen-lezen: tik/klik toont alleen de naam (geen selectie of slepen).
          if (onHover) onHover(item);
          return;
        }
        event.stopPropagation();
        onSelect?.(item.id);
        onPointerDownItem?.(item.id, event);
      }}
      onPointerOver={
        onHover || debugCollision
          ? (event) => {
              event.stopPropagation();
              if (onHover) onHover(item);
              if (debugCollision) setHovered(true);
            }
          : undefined
      }
      onPointerOut={
        onHover || debugCollision
          ? () => {
              if (onHover) onHover(null);
              if (debugCollision) setHovered(false);
            }
          : undefined
      }
    >
      {model ? (
        model.devColor ? (
          <DevPlaceholderBox dims={dims} color={model.devColor} />
        ) : (
          <Suspense fallback={<UnknownItemBox />}>
            <LoadedModel modelUrl={model.model_url} onMeasured={debugCollision ? handleMeasured : undefined} />
          </Suspense>
        )
      ) : (
        <UnknownItemBox />
      )}
      {selected && !debugCollision && <SelectionOutline dims={dims} />}
      {debugCollision && (
        <CollisionDebug slug={item.slug} shape={shapeOfDims(dims)} extent={measured} labelVisible={selected || hovered} />
      )}
    </group>
  );
}
