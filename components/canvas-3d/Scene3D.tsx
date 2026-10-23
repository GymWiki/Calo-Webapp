"use client";

import { Line } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { CameraRig, type CameraMode } from "@/components/canvas-3d/CameraRig";
import { ConeFieldMesh } from "@/components/canvas-3d/ConeFieldMesh";
import { FloorplanContent } from "@/components/canvas-3d/FloorplanContent";
import type { ConeField, Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";
import { dimsOf, itemPolygons, shapeOfDims, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import type { SnapGuide } from "@/components/canvas-3d/resolvePlacement";

/** `?debug=1`: voetafdrukken als omtrek (de exacte polygonen waarmee
 * plaatsen/snappen rekent) + de actieve snaplijnen. */
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
        const shape = shapeOfDims(dimsOf(item, lookup));
        const y = item.y + shape.base_m + 0.01;
        const color = item.id === draggingId ? "#f97316" : "#22c55e";
        // Dezelfde (oriented) polygonen als waarmee plaatsen/snappen/stapelen rekent.
        return itemPolygons(item, lookup).map((polygon, index) => (
          <Line
            key={`${item.id}-${index}`}
            points={[...polygon, polygon[0]].map((p) => [p.x, y, p.z] as [number, number, number])}
            color={color}
            lineWidth={2}
            depthTest={false}
          />
        ));
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
  debugCollision = false,
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
  debugCollision?: boolean;
  debugGuides?: SnapGuide[];
  lookup: DimsLookup;
}) {
  return (
    <Canvas frameloop="demand" dpr={[1, 2]} onPointerMissed={onBackgroundClick}>
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 20, 10]} intensity={0.9} />
      <CameraRig mode={cameraMode} room={room} controlsEnabled={!isDragging} drawMode={drawMode} />
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

      <FloorplanContent
        room={room}
        items={items}
        fields={fields}
        modelBySlug={modelBySlug}
        lookup={lookup}
        debugCollision={debugCollision}
        selectedId={selectedId}
        interactive={!drawMode}
        onItemPointerDown={onItemPointerDown}
        onSelect={onSelect}
        onFieldPointerDown={onFieldPointerDown}
        onFieldHandlePointerDown={onFieldHandlePointerDown}
      />
      {draftField && <ConeFieldMesh field={draftField} preview interactive={false} />}
      {debug && <DebugOverlay items={items} lookup={lookup} guides={debugGuides} draggingId={isDragging ? selectedId : null} />}
    </Canvas>
  );
}
