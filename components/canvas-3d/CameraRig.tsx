"use client";

import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { TOUCH } from "three";
import { cameraPosition } from "@/components/plattegrond/viewer-camera";
import { fitPerspectiveDistance } from "@/components/canvas-3d/camera-fit";
import type { Floorplan3dRoom } from "@/types/floorplan3d";

/** Telefoon in portret: steiler kijken (de langste zijde van de zaal benut de breedte) en kleinere marge. */
const PORTRAIT_POLAR_DEG = 38;
const DEFAULT_POLAR_DEG = 52;
/** Diagonale standaardblik (azimut), zoals de viewer. */
const START_AZIMUTH_DEG = 40;

/** Verschuift het beeld omhoog als er onderin een sheet staat, zodat de zaal in het zichtbare deel blijft (geanimeerd, niet bij reduced motion). */
function ViewInset({ insetPx }: { insetPx: number }) {
  const current = useRef(0);
  useFrame((state, delta) => {
    const { camera, size } = state;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const next = reduce ? insetPx : current.current + (insetPx - current.current) * Math.min(1, delta * 9);
    if (Math.abs(next - current.current) < 0.05 && next === current.current) return;
    current.current = Math.abs(next - insetPx) < 0.5 ? insetPx : next;
    const cam = camera as unknown as { setViewOffset?: (...args: number[]) => void; clearViewOffset?: () => void };
    if (current.current === 0) cam.clearViewOffset?.();
    else cam.setViewOffset?.(size.width, size.height, 0, current.current / 2, size.width, size.height);
  });
  return null;
}

export type CameraMode = "angled" | "top" | "free";

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

/**
 * De editorcamera is altijd "vrij": een perspectiefcamera die om het midden draait (slepen = draaien, scrollen/pinch = zoomen,
 * rechtermuisknop/twee vingers = pannen). De beginstand vult de zaal in het canvas (diagonaal, steiler in portret); `resetKey` verhogen
 * zet de camera terug (dubbelklik/dubbeltik op leeg canvas, camera-herstelknop). De camera kan niet onder de vloer.
 */
export function CameraRig({
  room,
  controlsEnabled,
  drawMode = false,
  resetKey = 0,
  onViewCenter,
  bottomInsetPx = 0,
}: {
  room: Floorplan3dRoom;
  controlsEnabled: boolean;
  /** "Veld afzetten": slepen op de vloer is tekenen: dus geen draaien/pannen met één vinger of muisknop; zoomen blijft. */
  drawMode?: boolean;
  /** Verhogen = camera terug naar de beginstand. */
  resetKey?: number;
  onViewCenter?: (center: { x: number; z: number }) => void;
  /** Hoogte (px) van een sheet onderin het canvas; het beeld schuift mee omhoog. */
  bottomInsetPx?: number;
}) {
  const span = Math.max(room.width_m, room.length_m);
  const size = useThree((state) => state.size);
  const portraitPhone = size.width < size.height && size.width < 768;
  const polar = portraitPhone ? PORTRAIT_POLAR_DEG : DEFAULT_POLAR_DEG;
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1.6;
  const distance = size.width > 0 ? fitPerspectiveDistance(room, START_AZIMUTH_DEG, polar, aspect, 50, portraitPhone ? 1.12 : 1.2) : span * 1.6;
  const offset = cameraPosition(START_AZIMUTH_DEG, polar, distance);
  const position: [number, number, number] = [offset[0], offset[1], offset[2]];

  return (
    <group key={`vrij-${resetKey}`}>
      <PerspectiveCamera makeDefault position={position} fov={50} near={0.1} far={span * 10} />
      <OrbitControls
        makeDefault
        enabled={controlsEnabled}
        enableRotate={!drawMode}
        enablePan={!drawMode}
        enableZoom
        // Niet onder de vloer en niet precies loodrecht omlaag (gimbal-lock).
        maxPolarAngle={Math.PI / 2 - 0.05}
        minPolarAngle={0.05}
        target={[0, 0, 0]}
        // Touch: één vinger draait de camera; twee vingers = knijpen (zoom) + verschuiven.
        touches={{ ONE: drawMode ? TOUCH.PAN : TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
      />
      {onViewCenter && <ViewCenterReporter onViewCenter={onViewCenter} />}
      <ViewInset insetPx={bottomInsetPx} />
    </group>
  );
}
