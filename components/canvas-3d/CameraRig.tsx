"use client";

import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import type { Floorplan3dRoom } from "@/types/floorplan3d";

export type CameraMode = "angled" | "top" | "free";

/**
 * Drie cameramodi (zie Stap 4.6): standaard orthografisch-schuin, een
 * "Bovenaanzicht"-knop (orthografisch, recht van boven) en "Vrij draaien"
 * (perspectief + volledige OrbitControls-rotatie). `key={mode}` dwingt een
 * volledige remount bij het wisselen van modus — zonder dat zou een eerder
 * door de gebruiker weggedraaide/-gezoomde OrbitControls-staat blijven
 * hangen i.p.v. netjes terug te resetten naar de nieuwe modus se
 * standaardaanzicht.
 */
export function CameraRig({
  mode,
  room,
  controlsEnabled,
  drawMode = false,
}: {
  mode: CameraMode;
  room: Floorplan3dRoom;
  controlsEnabled: boolean;
  /** "Veld afzetten": slepen op de vloer is tekenen — dus geen draaien/pannen met één vinger of muisknop; zoomen blijft. */
  drawMode?: boolean;
}) {
  const span = Math.max(room.width_m, room.length_m);
  const orthoZoom = 380 / span;
  const angledPosition: [number, number, number] = [span * 0.55, span * 0.75, span * 0.55];
  // Y net niet exact op de as (anders verliest OrbitControls zijn
  // referentie-op-vector bij recht-naar-onder-kijken — gimbal-lock-achtig
  // probleem).
  const topPosition: [number, number, number] = [0, span * 1.4, 0.001];
  const freePosition: [number, number, number] = [span * 0.7, span * 0.55, span * 0.9];

  return (
    <group key={mode}>
      {mode !== "free" ? (
        <OrthographicCamera
          makeDefault
          position={mode === "top" ? topPosition : angledPosition}
          zoom={orthoZoom}
          near={0.1}
          far={span * 10}
        />
      ) : (
        <PerspectiveCamera makeDefault position={freePosition} fov={50} near={0.1} far={span * 10} />
      )}
      <OrbitControls
        makeDefault
        enabled={controlsEnabled}
        enableRotate={mode === "free" && !drawMode}
        enablePan={!drawMode}
        enableZoom
        target={[0, 0, 0]}
      />
    </group>
  );
}
