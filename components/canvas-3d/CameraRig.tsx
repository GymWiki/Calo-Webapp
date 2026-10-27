"use client";

import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { TOUCH } from "three";
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
/** Meldt het punt waar de camera naar kijkt (x/z op de vloer) zonder re-render, zodat een item
 * dat je plaatst in het midden van wat je ziet terechtkomt — ook na pannen of zoomen. */
function ViewCenterReporter({ onViewCenter }: { onViewCenter: (center: { x: number; z: number }) => void }) {
  const controls = useThree((state) => state.controls) as { target: { x: number; z: number }; addEventListener: (type: string, fn: () => void) => void; removeEventListener: (type: string, fn: () => void) => void } | null;
  useEffect(() => {
    if (!controls) return;
    const report = () => onViewCenter({ x: controls.target.x, z: controls.target.z });
    controls.addEventListener("change", report);
    return () => controls.removeEventListener("change", report);
  }, [controls, onViewCenter]);
  return null;
}

export function CameraRig({
  mode,
  room,
  controlsEnabled,
  drawMode = false,
  resetKey = 0,
  onViewCenter,
}: {
  mode: CameraMode;
  room: Floorplan3dRoom;
  controlsEnabled: boolean;
  /** "Veld afzetten": slepen op de vloer is tekenen — dus geen draaien/pannen met één vinger of muisknop; zoomen blijft. */
  drawMode?: boolean;
  /** Verhogen = camera terug naar de beginstand van de huidige modus (dubbeltik / Reset). */
  resetKey?: number;
  onViewCenter?: (center: { x: number; z: number }) => void;
}) {
  const span = Math.max(room.width_m, room.length_m);
  const orthoZoom = 380 / span;
  const angledPosition: [number, number, number] = [span * 0.55, span * 0.75, span * 0.55];
  // Y net niet exact op de as (anders verliest OrbitControls zijn
  // referentie-op-vector bij recht-naar-onder-kijken — gimbal-lock-achtig
  // probleem).
  const topPosition: [number, number, number] = [0, span * 1.4, 0.001];
  const freePosition: [number, number, number] = [span * 0.95, span * 0.75, span * 1.2];

  return (
    <group key={`${mode}-${resetKey}`}>
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
        // Touch: in "Vrij draaien" draait één vinger de camera; in schuin/bovenaanzicht (waar draaien
        // uit staat) verschuift één vinger het beeld. Twee vingers = knijpen (zoom) + verschuiven.
        touches={{ ONE: mode === "free" && !drawMode ? TOUCH.ROTATE : TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      />
      {onViewCenter && <ViewCenterReporter onViewCenter={onViewCenter} />}
    </group>
  );
}
