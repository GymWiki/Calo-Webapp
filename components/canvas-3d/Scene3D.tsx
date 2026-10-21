"use client";

import * as THREE from "three";
import { Line } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { CameraRig, type CameraMode } from "@/components/canvas-3d/CameraRig";
import { RoomFloor } from "@/components/canvas-3d/RoomFloor";
import { ItemMesh } from "@/components/canvas-3d/ItemMesh";
import type { Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
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
      <CameraRig mode={cameraMode} room={room} controlsEnabled={!isDragging} />
      <RoomFloor room={room} />

      {/* Onzichtbaar sleepvlak — ruim boven kamerformaat zodat de
          raycast tijdens het slepen vrijwel altijd raak is, ook als de
          cursor net buiten de kamer komt. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
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
          onPointerDownItem={onItemPointerDown}
          onSelect={onSelect}
        />
      ))}
      {debug && <DebugOverlay items={items} lookup={lookup} guides={debugGuides} draggingId={isDragging ? selectedId : null} />}
    </Canvas>
  );
}
