"use client";

import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";

import { FloorplanContent } from "@/components/canvas-3d/FloorplanContent";
import { dimsLookupFromModels } from "@/components/canvas-3d/floorplan3d-geometry";
import { framingContent, initialViewFor, wallNodes, wallsToHide } from "@/components/plattegrond/viewer-framing";
import { ViewerCameraRig } from "@/components/plattegrond/ViewerCanvas";
import { azimuthDegOf, type ViewState } from "@/components/plattegrond/viewer-camera";
import type { ConeField, Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

export const THUMBNAIL_WIDTH = 800;
export const THUMBNAIL_HEIGHT = 450;
const BACKGROUND = "#f8fafc"; // slate-50, gelijk aan de viewer-achtergrond

/** Wacht tot alles geladen is en leest dan de canvas uit als JPEG. */
function CaptureProbe({ onCapture, mime }: { onCapture: (dataUrl: string) => void; mime: "image/jpeg" | "image/png" }) {
  const { active } = useProgress();
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    if (active) return;
    // Minstens even wachten: de camerarig zet de stand pas na de eerste meting.
    const timer = setTimeout(() => {
      gl.render(scene, camera);
      onCapture(gl.domElement.toDataURL(mime, 0.85));
    }, 700);
    return () => clearTimeout(timer);
  }, [active, gl, scene, camera, onCapture, mime]);

  return null;
}

/**
 * Onzichtbare, kortstondige render van de plattegrond in de standaard
 * 3D-weergave van de viewer (zelfde camera, zelfde FloorplanContent) →
 * JPEG data-URL. De editor mount dit na een geslaagde save en unmount het
 * direct na `onCapture`; zo blijft er nooit een tweede WebGL-context hangen.
 */
export function FloorplanThumbnailCapture({
  room,
  items,
  fields,
  models,
  onCapture,
  view: viewProp,
  width = THUMBNAIL_WIDTH,
  height = THUMBNAIL_HEIGHT,
  mime = "image/jpeg",
}: {
  room: Floorplan3dRoom;
  items: Floorplan3dItem[];
  fields: ConeField[];
  models: MaterialModel[];
  onCapture: (dataUrl: string) => void;
  /** Camerastand: standaard de automatisch gekozen weergave (viewer-framing.ts); `{ ...DEFAULT_VIEW, preset: "top" }` voor het bovenaanzicht (gast-export). */
  view?: ViewState;
  width?: number;
  height?: number;
  mime?: "image/jpeg" | "image/png";
}) {
  const bySlug = new Map(models.map((model) => [model.slug, model]));
  // Dezelfde kadrering als de viewer (zie viewer-framing.ts): de kaartjes zijn zo meteen helder.
  const lookup = dimsLookupFromModels(models);
  const content = framingContent({ items, fields, room, lookup });
  const view = viewProp ?? initialViewFor({ items, fields, room, lookup, aspect: width / height, mode: room.view });
  const hiddenWalls = wallNodes(room.environment, wallsToHide(azimuthDegOf({ ...view, offsetDeg: 0 }), view.preset));

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 -left-[9999px]"
      style={{ width, height }}
    >
      <Canvas
        frameloop="demand"
        dpr={1}
        orthographic
        camera={{ position: [10, 10, 10], zoom: 30, near: 0.1, far: 500 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
      >
        <color attach="background" args={[BACKGROUND]} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 20, 10]} intensity={0.9} />
        <ViewerCameraRig room={room} view={view} instant content={content} />
        <FloorplanContent room={room} items={items} fields={fields} modelBySlug={(slug) => bySlug.get(slug)} lookup={lookup} hideEnvironmentNodes={hiddenWalls} contactShadows interactive={false} />
        <CaptureProbe onCapture={onCapture} mime={mime} />
      </Canvas>
    </div>
  );
}
