"use client";

import { Suspense, useMemo } from "react";
import * as THREE from "three";
import { Edges, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Floorplan3dItem } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";
import type { ItemDims } from "@/components/canvas-3d/floorplan3d-geometry";

const SELECTION_COLOR = "#2563eb"; // tailwind blue-600
const UNKNOWN_BOX_COLOR = "#9ca3af"; // tailwind gray-400

function SelectionOutline({ dims }: { dims: ItemDims }) {
  return (
    <mesh position={[0, dims.height_m / 2, 0]}>
      <boxGeometry args={[dims.length_m, dims.height_m, dims.width_m]} />
      <meshBasicMaterial visible={false} />
      <Edges color={SELECTION_COLOR} lineWidth={2} />
    </mesh>
  );
}

/** Geladen GLB-model (useGLTF, Suspense + drei's cache — zie Stap 4.1: de
 * eerste plaatsing van een slug laadt het bestand, elke volgende hergebruikt
 * de cache). Gebruikt `clone(true)` zodat meerdere exemplaren van hetzelfde
 * model onafhankelijk hun eigen plek in de scene-graaf kunnen hebben. */
function LoadedModel({ modelUrl }: { modelUrl: string }) {
  const gltf = useGLTF(modelUrl);
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
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
  selected,
  interactive = true,
  onPointerDownItem,
  onSelect,
  onHover,
}: {
  item: Floorplan3dItem;
  model: MaterialModel | undefined;
  selected: boolean;
  /** false tijdens "Veld afzetten": klikken gaan dan door naar de vloer. */
  interactive?: boolean;
  onPointerDownItem?: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onSelect?: (id: string) => void;
  /** Alleen-lezen weergave: hover/tik geeft het item door (tooltip met naam). */
  onHover?: (item: Floorplan3dItem | null) => void;
}) {
  const dims: ItemDims = model
    ? { length_m: model.length_m, width_m: model.width_m, height_m: model.height_m, stackable: model.stackable }
    : { length_m: 0.5, width_m: 0.5, height_m: 0.5, stackable: true };

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
      onPointerOver={onHover ? (event) => { event.stopPropagation(); onHover(item); } : undefined}
      onPointerOut={onHover ? () => onHover(null) : undefined}
    >
      {model ? (
        model.devColor ? (
          <DevPlaceholderBox dims={dims} color={model.devColor} />
        ) : (
          <Suspense fallback={<UnknownItemBox />}>
            <LoadedModel modelUrl={model.model_url} />
          </Suspense>
        )
      ) : (
        <UnknownItemBox />
      )}
      {selected && <SelectionOutline dims={dims} />}
    </group>
  );
}
