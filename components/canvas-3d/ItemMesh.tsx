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
import { ModelErrorBoundary } from "@/components/canvas-3d/ModelErrorBoundary";
import { StudentModel } from "@/components/students/StudentModel";
import { isStudentSlug } from "@/lib/students/catalog";
import { isTilted, rotationOf, tiltCenter } from "@/components/canvas-3d/orientation";

const SELECTION_COLOR = "#2563eb"; // tailwind blue-600
const UNKNOWN_BOX_COLOR = "#9ca3af"; // tailwind gray-400

const OUTSIDE_COLOR = "#dc2626"; // tailwind red-600
const GROUP_COLOR = "#f97316"; // GymWiki-oranje: overige leden van een meervoudige selectie

/** Selectie-outline = de echte collision-vorm (oriented, met offset en onderkant), niet een gecentreerde box.
 * Rood als (een deel van) het item buiten de zaal valt. */
function SelectionOutline({ dims, outside = false }: { dims: ItemDims; outside?: boolean }) {
  return <ShapeWireframe shape={shapeOfDims(dims)} color={outside ? OUTSIDE_COLOR : SELECTION_COLOR} />;
}

/**
 * Kantelen: eerst om het onderste midden van de voetafdruk (Rx·Rz), de heading (Y) doet de buitenste groep
 * om de pivot. Zonder kanteling geeft dit de kinderen ongewijzigd terug — de scene is dan identiek aan
 * die van vóór de kantelfunctie. Moet exact overeenkomen met `localToWorld` in orientation.ts.
 */
function TiltFrame({ dims, item, children }: { dims: ItemDims; item: Floorplan3dItem; children: React.ReactNode }) {
  const rot = rotationOf(item);
  if (!isTilted(rot)) return <>{children}</>;
  const [cx, cy, cz] = tiltCenter(shapeOfDims(dims));
  return (
    <group position={[cx, cy, cz]}>
      <group rotation={new THREE.Euler(THREE.MathUtils.degToRad(rot.x), 0, THREE.MathUtils.degToRad(rot.z), "XZY")}>
        <group position={[-cx, -cy, -cz]}>{children}</group>
      </group>
    </group>
  );
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
  grouped = false,
  interactive = true,
  debugCollision = false,
  onPointerDownItem,
  onSelect,
  onHover,
  touchUi = false,
  onRotateHandleDown,
  outsideRoom = false,
  ropeTool = false,
  ropeTarget = false,
  onPointerMoveItem,
  onPointerUpItem,
}: {
  /** "Touw spannen" actief: een vinger/muis op het item start een touw (ook op touch, ook niet-geselecteerd) en loslaten maakt het vast. */
  ropeTool?: boolean;
  /** Dit item is het punt waar het touw nu op zou vastzitten (oranje omlijning). */
  ropeTarget?: boolean;
  onPointerMoveItem?: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onPointerUpItem?: (id: string, event: ThreeEvent<PointerEvent>) => void;
  /** Een gekanteld item steekt buiten de zaal: subtiele rode outline (waarschuwing, geen blokkade). */
  outsideRoom?: boolean;
  item: Floorplan3dItem;
  model: MaterialModel | undefined;
  /** Collision-vorm en maten van dit asset (uit de dims-lookup); zonder: de oude box uit het model. */
  dims?: ItemDims;
  selected: boolean;
  /** Onderdeel van een meervoudige selectie (niet het primaire object): oranje omlijning. */
  grouped?: boolean;
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
        if (event.nativeEvent.pointerType === "touch" && !selected && !ropeTool) return;
        event.stopPropagation();
        onSelect?.(item.id);
        // Vergrendelde items selecteer je wel, maar slepen niet.
        // (Het touw spannen werkt wel aan een vergrendeld item: dat verplaatst het niet.)
        if (item.locked && !ropeTool) return;
        onPointerDownItem?.(item.id, event);
      }}
      onPointerMove={interactive && onPointerMoveItem ? (event) => onPointerMoveItem(item.id, event) : undefined}
      onPointerUp={interactive && onPointerUpItem ? (event) => onPointerUpItem(item.id, event) : undefined}
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
      <TiltFrame dims={dims} item={item}>
        {model ? (
          model.devColor ? (
            <DevPlaceholderBox dims={dims} color={model.devColor} />
          ) : (
            <ModelErrorBoundary resetKey={model.model_url} fallback={<UnknownItemBox />}>
              <Suspense fallback={<UnknownItemBox />}>
                {isStudentSlug(item.slug) ? (
                  <StudentModel modelUrl={model.model_url} color={item.color} size={item.size} />
                ) : (
                  <LoadedModel modelUrl={model.model_url} onMeasured={debugCollision ? handleMeasured : undefined} />
                )}
              </Suspense>
            </ModelErrorBoundary>
          )
        ) : (
          <UnknownItemBox />
        )}
        {selected && !debugCollision && <SelectionOutline dims={dims} outside={outsideRoom} />}
        {grouped && !selected && !debugCollision && <ShapeWireframe shape={shapeOfDims(dims)} color={GROUP_COLOR} />}
        {ropeTarget && !selected && !debugCollision && <ShapeWireframe shape={shapeOfDims(dims)} color={GROUP_COLOR} />}
        {!selected && outsideRoom && !debugCollision && <ShapeWireframe shape={shapeOfDims(dims)} color={OUTSIDE_COLOR} />}
        {debugCollision && (
          <CollisionDebug slug={item.slug} shape={shapeOfDims(dims)} extent={measured} labelVisible={selected || hovered} />
        )}
      </TiltFrame>
      {selected && touchUi && interactive && !item.locked && !debugCollision && onRotateHandleDown && (
        <RotateHandle dims={dims} onPointerDown={(event) => { event.stopPropagation(); onRotateHandleDown(item.id, event); }} />
      )}
    </group>
  );
}
