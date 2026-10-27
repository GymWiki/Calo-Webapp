"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Line, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { Floorplan3dItem } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";
import { shapeOfDims, type ItemDims } from "@/components/canvas-3d/floorplan3d-geometry";
import { CollisionDebug, ShapeWireframe } from "@/components/canvas-3d/CollisionDebug";
import { measureMeshExtent } from "@/components/canvas-3d/collision-measure";
import type { MeshExtent } from "@/components/canvas-3d/collision-shape";
import { isTapDelta } from "@/components/canvas-3d/mobile/mobile-logic";
import { trackModelScene } from "@/components/canvas-3d/model-cache";

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
  // Voor het opruimen van GPU-geheugen zodra het laatste exemplaar van dit model weg is (model-cache.ts).
  useEffect(() => {
    trackModelScene(modelUrl, gltf.scene);
  }, [modelUrl, gltf.scene]);
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

/** Rotatiehandvat voor touch: een oranje bolletje voor het item, met een ruim (onzichtbaar)
 * raakvlak voor een vinger. Slepen draait het item (afgehandeld in Floorplan3dEditor). */
function RotateHandle({ dims, onPointerDown }: { dims: ItemDims; onPointerDown: (event: ThreeEvent<PointerEvent>) => void }) {
  const shape = shapeOfDims(dims);
  const reach = Math.max(shape.length_m, shape.width_m) / 2 + 0.55;
  const cx = shape.offset_x;
  const cz = shape.offset_z;
  const y = shape.base_m + 0.05;
  return (
    <group position={[cx, y, cz]}>
      <Line points={[[0, 0, 0], [reach, 0, 0]]} color="#f97316" lineWidth={2} depthTest={false} />
      <mesh position={[reach, 0, 0]} renderOrder={10} onPointerDown={onPointerDown}>
        <sphereGeometry args={[0.2, 20, 14]} />
        <meshBasicMaterial color="#f97316" depthTest={false} />
      </mesh>
      {/* Groot raakvlak (≈ 0,5 m): een vingertop is veel groter dan de muiscursor. */}
      <mesh position={[reach, 0, 0]} visible={false} onPointerDown={onPointerDown}>
        <sphereGeometry args={[0.5, 8, 6]} />
      </mesh>
    </group>
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
  touchUi = false,
  onRotateHandleDown,
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
  /** Touch-bediening: rotatiehandvat bij het geselecteerde item. */
  touchUi?: boolean;
  onRotateHandleDown?: (id: string, event: ThreeEvent<PointerEvent>) => void;
}) {
  const lastPointerTypeRef = useRef<string>("mouse");
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
        lastPointerTypeRef.current = event.nativeEvent.pointerType;
        // Touch: een vinger op een NIET-geselecteerd item draait de camera (OrbitControls luistert
        // op het canvas zelf); selecteren gebeurt pas bij een tik (onClick). Alleen het
        // geselecteerde item is sleepbaar — zo verschuift er nooit iets per ongeluk.
        if (event.nativeEvent.pointerType === "touch" && !selected) return;
        event.stopPropagation();
        onSelect?.(item.id);
        // Vergrendelde items selecteer je wel, maar slepen niet.
        if (item.locked) return;
        onPointerDownItem?.(item.id, event);
      }}
      onClick={(event) => {
        if (!interactive) return;
        if (lastPointerTypeRef.current === "touch" && !selected && isTapDelta(event.delta)) {
          event.stopPropagation();
          onSelect?.(item.id);
        }
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
      {selected && touchUi && interactive && !item.locked && !debugCollision && onRotateHandleDown && (
        <RotateHandle dims={dims} onPointerDown={(event) => { event.stopPropagation(); onRotateHandleDown(item.id, event); }} />
      )}
      {debugCollision && (
        <CollisionDebug slug={item.slug} shape={shapeOfDims(dims)} extent={measured} labelVisible={selected || hovered} />
      )}
    </group>
  );
}
