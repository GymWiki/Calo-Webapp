"use client";

import { Line, PerformanceMonitor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { CameraRig, type CameraMode } from "@/components/canvas-3d/CameraRig";
import { ConeFieldMesh } from "@/components/canvas-3d/ConeFieldMesh";
import { FloorplanContent } from "@/components/canvas-3d/FloorplanContent";
import type { ConeField, Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";
import { dimsOf, itemPolygons, shapeOfDims, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import type { SnapGuide } from "@/components/canvas-3d/resolvePlacement";
import { isDoubleTap, type RenderQuality, type TapRecord } from "@/components/canvas-3d/mobile/mobile-logic";
import { useRef } from "react";

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
  quality = { dpr: 2, antialias: true },
  onPerformanceChange,
  onViewCenter,
  cameraResetKey = 0,
  onResetCamera,
  touchUi = false,
  onRotateHandleDown,
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
  /** Pixel ratio en antialiasing (kwaliteitsinstelling, zie mobile-logic.resolveQuality). */
  quality?: RenderQuality;
  /** Prestatiemonitor (alleen in "Auto"): factor 0..1, lager = traag toestel. */
  onPerformanceChange?: (factor: number) => void;
  /** Het punt op de vloer waar de camera naar kijkt (voor plaatsen in het midden van het beeld). */
  onViewCenter?: (center: { x: number; z: number }) => void;
  cameraResetKey?: number;
  /** Dubbeltik op een leeg stuk (touch) = camera terug naar de beginstand. */
  onResetCamera?: () => void;
  touchUi?: boolean;
  onRotateHandleDown?: (id: string, event: ThreeEvent<PointerEvent>) => void;
}) {
  const lastPointerTypeRef = useRef("mouse");
  const lastTapRef = useRef<TapRecord | null>(null);

  function handleMissed(event: MouseEvent) {
    onBackgroundClick();
    // Dubbeltik (alleen touch; op desktop verandert er niets) op de lege vloer: camera resetten.
    if (!onResetCamera || lastPointerTypeRef.current !== "touch") return;
    const tap = { time: performance.now(), x: event.clientX, y: event.clientY };
    if (isDoubleTap(lastTapRef.current, tap)) {
      lastTapRef.current = null;
      onResetCamera();
    } else {
      lastTapRef.current = tap;
    }
  }

  return (
    <Canvas
      // De antialias-instelling kan alleen bij het aanmaken van de WebGL-context: remount bij wissel.
      key={quality.antialias ? "aa" : "no-aa"}
      frameloop="demand"
      dpr={quality.dpr}
      gl={{ antialias: quality.antialias, powerPreference: "high-performance" }}
      // touch-action: none → de browser doet zelf geen scrollen/pinch-zoom/pull-to-refresh boven het canvas.
      style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
      onPointerDownCapture={(event) => {
        lastPointerTypeRef.current = event.pointerType;
      }}
      onPointerMissed={handleMissed}
    >
      {onPerformanceChange && <PerformanceMonitor factor={1} bounds={() => [28, 50]} onChange={({ factor }) => onPerformanceChange(factor)} />}
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 20, 10]} intensity={0.9} />
      <CameraRig mode={cameraMode} room={room} controlsEnabled={!isDragging} drawMode={drawMode} resetKey={cameraResetKey} onViewCenter={onViewCenter} />
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
        touchUi={touchUi}
        onRotateHandleDown={onRotateHandleDown}
        warnOutside
      />
      {draftField && <ConeFieldMesh field={draftField} preview interactive={false} />}
      {debug && <DebugOverlay items={items} lookup={lookup} guides={debugGuides} draggingId={isDragging ? selectedId : null} />}
    </Canvas>
  );
}
