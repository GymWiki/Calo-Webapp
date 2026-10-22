"use client";

import * as THREE from "three";
import { Line } from "@react-three/drei";
import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { CameraRig, type CameraMode } from "@/components/canvas-3d/CameraRig";
import { RoomFloor } from "@/components/canvas-3d/RoomFloor";
import { GymEnvironment } from "@/components/canvas-3d/GymEnvironment";
import { ConeFieldMesh } from "@/components/canvas-3d/ConeFieldMesh";
import { ItemMesh } from "@/components/canvas-3d/ItemMesh";
import type { ConeField, Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";
import { dimsOf, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import type { SnapGuide } from "@/components/canvas-3d/resolvePlacement";

/** `?debug=1`: voetafdrukken als platte vlakken op de vloer (de exacte
 * rechthoeken waarmee plaatsen/snappen rekent) + de actieve snaplijnen. */
function DebugOverlay({
  items,
  lookup,
  guides,
  draggingId,
}: {
  items: Floorplan3dItem[];
  lookup: DimsLookup;
  guides: SnapGuide[];
  draggingId: string | null;
}) {
  return (
    <group>
      {items.map((item) => {
        const dims = dimsOf(item, lookup);
        return (
          <group key={item.id} position={[item.x, 0.004 + item.y, item.z]} rotation={[0, THREE.MathUtils.degToRad(item.rot_y_deg), 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[dims.length_m, dims.width_m]} />
              <meshBasicMaterial
                color={item.id === draggingId ? "#f97316" : "#22c55e"}
                transparent
                opacity={0.35}
                depthTest={false}
              />
            </mesh>
          </group>
        );
      })}
      {guides.map((guide, index) => (
        <Line
          key={index}
          points={
            guide.axis === "x"
              ? [[guide.at, 0.02, guide.from], [guide.at, 0.02, guide.to]]
              : [[guide.from, 0.02, guide.at], [guide.to, 0.02, guide.at]]
          }
          color={guide.targetSlug ? "#e11d48" : "#2563eb"}
          lineWidth={2}
          depthTest={false}
        />
      ))}
    </group>
  );
}

/**
 * De R3F-canvas zelf — bewust "dom": alle sleep-/selectie-/geschiedenis-
 * logica leeft in Floorplan3dEditor.tsx, dit component rendert alleen en
 * stuurt pointer-events terug via props. `frameloop="demand"` (Stap 4.10):
 * React Three Fiber tekent in die modus alleen een nieuw frame zodra er
 * daadwerkelijk iets in de scene-boom verandert (sleep-updates, selectie,
 * cameramodus) i.p.v. continu op 60fps te renderen.
 */
export function Scene3D({
  room,
  items,
  modelBySlug,
  selectedId,
  isDragging,
  cameraMode,
  onItemPointerDown,
  fields,
  draftField,
  drawMode,
  onFieldPointerDown,
  onFieldHandlePointerDown,
  onFloorPointerDown,
  onFloorPointerMove,
  onFloorPointerUp,
  onSelect,
  onBackgroundClick,
  debug = false,
  debugGuides = [],
  lookup,
}: {
  room: Floorplan3dRoom;
  items: Floorplan3dItem[];
  modelBySlug: (slug: string) => MaterialModel | undefined;
  selectedId: string | null;
  isDragging: boolean;
  cameraMode: CameraMode;
  onItemPointerDown: (id: string, event: ThreeEvent<PointerEvent>) => void;
  fields: ConeField[];
  /** Veld dat op dit moment getekend wordt (live preview). */
  draftField: ConeField | null;
  /** "Veld afzetten" actief: items en velden vangen dan geen klikken. */
  drawMode: boolean;
  onFieldPointerDown: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onFieldHandlePointerDown: (id: string, cornerIndex: number, event: ThreeEvent<PointerEvent>) => void;
  onFloorPointerDown: (event: ThreeEvent<PointerEvent>) => void;
  onFloorPointerMove: (event: ThreeEvent<PointerEvent>) => void;
  onFloorPointerUp: (event: ThreeEvent<PointerEvent>) => void;
  onSelect: (id: string) => void;
  onBackgroundClick: () => void;
  debug?: boolean;
  debugGuides?: SnapGuide[];
  lookup: DimsLookup;
}) {
  return (
    <Canvas frameloop="demand" dpr={[1, 2]} onPointerMissed={onBackgroundClick}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 20, 10]} intensity={0.9} />
      <CameraRig mode={cameraMode} room={room} controlsEnabled={!isDragging} drawMode={drawMode} />
      {room.environment ? (
        // Tijdens het laden van de GLB staat de gewone vloer er al; geen leeg scherm.
        <Suspense fallback={<RoomFloor room={room} />}>
          <GymEnvironment environment={room.environment} />
        </Suspense>
      ) : (
        <RoomFloor room={room} />
      )}

      {/* Onzichtbaar sleepvlak — ruim boven kamerformaat zodat de
          raycast tijdens het slepen vrijwel altijd raak is, ook als de
          cursor net buiten de kamer komt. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
        onPointerDown={onFloorPointerDown}
        onPointerMove={onFloorPointerMove}
        onPointerUp={onFloorPointerUp}
      >
        <planeGeometry args={[room.width_m * 3, room.length_m * 3]} />
      </mesh>

      {items.map((item) => (
        <ItemMesh
          key={item.id}
          item={item}
          model={modelBySlug(item.slug)}
          selected={item.id === selectedId}
          interactive={!drawMode}
          onPointerDownItem={onItemPointerDown}
          onSelect={onSelect}
        />
      ))}
      {fields.map((field) => (
        <ConeFieldMesh
          key={field.id}
          field={field}
          selected={field.id === selectedId}
          interactive={!drawMode}
          onSelect={onSelect}
          onFieldPointerDown={onFieldPointerDown}
          onHandlePointerDown={onFieldHandlePointerDown}
        />
      ))}
      {draftField && <ConeFieldMesh field={draftField} preview interactive={false} />}
      {debug && <DebugOverlay items={items} lookup={lookup} guides={debugGuides} draggingId={isDragging ? selectedId : null} />}
    </Canvas>
  );
}
