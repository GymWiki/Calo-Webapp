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

// De opgeslagen preview mag niet groter zijn dan MAX_PREVIEW_BYTES in actions/floorplans3d.ts (600 KB, base64 ≈ 4/3 daarvan).
const MAX_JPEG_DATA_URL_LENGTH = 780_000;

/** JPEG zo scherp mogelijk binnen de limiet: begint hoog en gaat pas omlaag als de preview te groot wordt. */
function encode(canvas: HTMLCanvasElement, mime: "image/jpeg" | "image/png"): string {
  if (mime === "image/png") return canvas.toDataURL(mime);
  let dataUrl = "";
  for (const quality of [0.92, 0.85, 0.75, 0.65]) {
    dataUrl = canvas.toDataURL(mime, quality);
    if (dataUrl.length <= MAX_JPEG_DATA_URL_LENGTH) break;
  }
  return dataUrl;
}

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
      onCapture(encode(gl.domElement, mime));
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
        // Kleine afbeeldingen (de preview in de bibliotheek, 800 × 450) worden 2× uitgerekend en zijn dus 1600 × 900: vloerlijnen en
        // leerlingen blijven daardoor glad als de kaart ze verkleind toont. Grote exports (gastdownload) zijn al groot genoeg.
        dpr={width >= 1400 ? 1 : 2}
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
