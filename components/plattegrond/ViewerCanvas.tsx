"use client";

import { useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import type * as THREE from "three";

import { FloorplanContent } from "@/components/canvas-3d/FloorplanContent";
import {
  TRANSITION_MS,
  cameraPosition,
  lerpPose,
  poseFor,
  type CameraPose,
  type ViewState,
} from "@/components/plattegrond/viewer-camera";
import type { ConeField, Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

type TweenState = { from: CameraPose; to: CameraPose; start: number } | null;

/** Zet de (orthografische) camera in een stand. Bewust een losse functie: de
 * camera is een mutable three-object dat R3F beheert, geen React-state. */
function applyPose(camera: THREE.OrthographicCamera, pose: CameraPose, distance: number) {
  const [x, y, z] = cameraPosition(pose.azimuthDeg, pose.polarDeg, distance);
  camera.position.set(x, y, z);
  camera.zoom = pose.zoom;
  camera.near = 0.1;
  camera.far = distance * 3;
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
}

/** Eigen, kleine camerabesturing i.p.v. OrbitControls: de weergave is
 * alleen-lezen en bewust beperkt (zie viewer-camera.ts); de besturing
 * (slepen/knoppen/toetsen) leeft in de DOM-shell eromheen, deze rig volgt
 * alleen de stand `view` en animeert daar naartoe. */
function ViewerCameraRig({
  room,
  view,
  instant,
}: {
  room: Pick<Floorplan3dRoom, "width_m" | "length_m" | "environment">;
  view: ViewState;
  instant: boolean;
}) {
  const camera = useThree((state) => state.camera) as THREE.OrthographicCamera;
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const state = useRef<{ current: CameraPose | null; tween: TweenState }>({ current: null, tween: null });
  const distance = Math.max(room.width_m, room.length_m) * 3 + 30;

  useEffect(() => {
    const rig = state.current;
    const target = poseFor(view, room, size);
    if (instant || !rig.current) {
      rig.tween = null;
      applyPose(camera, target, distance);
      rig.current = target;
    } else {
      rig.tween = { from: rig.current, to: target, start: performance.now() };
    }
    invalidate();
    // De afhankelijkheden zijn de echte invoer (stand, kamermaat, canvasgrootte).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, instant, room.width_m, room.length_m, room.environment, size.width, size.height]);

  useFrame(() => {
    const rig = state.current;
    const active = rig.tween;
    if (!active) return;
    const t = (performance.now() - active.start) / TRANSITION_MS;
    const pose = lerpPose(active.from, active.to, t);
    applyPose(camera, pose, distance);
    rig.current = pose;
    if (t >= 1) rig.tween = null;
    else invalidate();
  });

  return null;
}

/** Meldt zodra alle assets (GLB's) geladen zijn — dan pas verdwijnt de thumbnail. */
function ReadyProbe({ onReady }: { onReady: () => void }) {
  const { active } = useProgress();
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (active) return;
    // Even wachten zodat de eerste frames met het geladen model getekend zijn.
    invalidate();
    const timer = setTimeout(onReady, 250);
    return () => clearTimeout(timer);
  }, [active, invalidate, onReady]);
  return null;
}

export default function ViewerCanvas({
  room,
  items,
  fields,
  modelBySlug,
  view,
  instant,
  onReady,
  onItemHover,
}: {
  room: Floorplan3dRoom;
  items: Floorplan3dItem[];
  fields: ConeField[];
  modelBySlug: (slug: string) => MaterialModel | undefined;
  view: ViewState;
  instant: boolean;
  onReady: () => void;
  onItemHover: (item: Floorplan3dItem | null) => void;
}) {
  return (
    <Canvas
      // Geen continue render-loop: alleen bij een wijziging of animatie.
      frameloop="demand"
      // Pixel ratio begrensd: scherp genoeg, maar zuinig op mobiel.
      dpr={[1, 1.5]}
      orthographic
      camera={{ position: [10, 10, 10], zoom: 30, near: 0.1, far: 500 }}
      gl={{ antialias: true, powerPreference: "low-power" }}
      // Het gebied is puur een weergave: geen focus/selectie via de canvas zelf.
      tabIndex={-1}
    >
      <ambientLight intensity={0.75} />
      <directionalLight position={[10, 20, 10]} intensity={0.9} />
      <ViewerCameraRig room={room} view={view} instant={instant} />
      <FloorplanContent
        room={room}
        items={items}
        fields={fields}
        modelBySlug={modelBySlug}
        interactive={false}
        onItemHover={onItemHover}
      />
      <ReadyProbe onReady={onReady} />
    </Canvas>
  );
}
