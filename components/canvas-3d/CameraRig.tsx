"use client";

import { OrbitControls, OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { TOUCH } from "three";
import { cameraPosition } from "@/components/plattegrond/viewer-camera";
import { fitOrthoZoom, fitPerspectiveDistance } from "@/components/canvas-3d/camera-fit";
import type { Floorplan3dRoom } from "@/types/floorplan3d";

/** Azimut van de schuine editorcamera (de camera staat op +x/+z). */
const ANGLED_AZIMUTH_DEG = 45;
/** Telefoon in portret: steiler kijken (de langste zijde van de zaal benut de breedte) en kleinere marge. */
const PORTRAIT_POLAR_DEG = 38;
const DEFAULT_POLAR_DEG = 46;

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

/** Zoomknoppen van de werkbalk: orthografisch = zoomfactor, perspectief = dichterbij/verder weg langs de kijklijn. */
function ZoomController({ request }: { request?: { factor: number; nonce: number } }) {
  const get = useThree((state) => state.get);
  const handled = useRef(request?.nonce ?? 0);
  useEffect(() => {
    if (!request || request.nonce === handled.current) return;
    handled.current = request.nonce;
    const { camera } = get();
    const controls = get().controls as { target: { x: number; y: number; z: number }; update: () => void } | null;
    if ("isOrthographicCamera" in camera && camera.isOrthographicCamera) {
      camera.zoom = Math.min(Math.max(camera.zoom * request.factor, 5), 2000);
      camera.updateProjectionMatrix();
    } else if (controls) {
      camera.position.set(
        controls.target.x + (camera.position.x - controls.target.x) / request.factor,
        controls.target.y + (camera.position.y - controls.target.y) / request.factor,
        controls.target.z + (camera.position.z - controls.target.z) / request.factor,
      );
    }
    controls?.update();
  }, [request, get]);
  return null;
}

export function CameraRig({
  mode,
  room,
  controlsEnabled,
  drawMode = false,
  resetKey = 0,
  onViewCenter,
  zoomRequest,
  bottomInsetPx = 0,
}: {
  mode: CameraMode;
  room: Floorplan3dRoom;
  controlsEnabled: boolean;
  /** "Veld afzetten": slepen op de vloer is tekenen — dus geen draaien/pannen met één vinger of muisknop; zoomen blijft. */
  drawMode?: boolean;
  /** Verhogen = camera terug naar de beginstand van de huidige modus (dubbeltik / Reset). */
  resetKey?: number;
  onViewCenter?: (center: { x: number; z: number }) => void;
  /** Zoomknoppen: factor > 1 = inzoomen. Een nieuwe `nonce` voert de zoom één keer uit. */
  zoomRequest?: { factor: number; nonce: number };
  /** Hoogte (px) van een sheet onderin het canvas; het beeld schuift mee omhoog. */
  bottomInsetPx?: number;
}) {
  const span = Math.max(room.width_m, room.length_m);
  const size = useThree((state) => state.size);
  const portraitPhone = size.width < size.height && size.width < 768;
  const margin = portraitPhone ? 1.05 : 1.12;
  const angledPolar = portraitPhone ? PORTRAIT_POLAR_DEG : DEFAULT_POLAR_DEG;
  const orthoZoom =
    size.width > 0 && size.height > 0
      ? fitOrthoZoom(room, mode === "top" ? 0 : ANGLED_AZIMUTH_DEG, mode === "top" ? 0.05 : angledPolar, size, margin)
      : 380 / span;
  const angledOffset = cameraPosition(ANGLED_AZIMUTH_DEG, angledPolar, span * 1.3);
  const angledPosition: [number, number, number] = [angledOffset[0], angledOffset[1], angledOffset[2]];
  // Y net niet exact op de as (anders verliest OrbitControls zijn
  // referentie-op-vector bij recht-naar-onder-kijken — gimbal-lock-achtig
  // probleem).
  const topPosition: [number, number, number] = [0, span * 1.4, 0.001];
  // Vrij draaien (perspectief): dezelfde diagonale blik, afstand zo dat de zaal het canvas vult (portret: steiler en dichterbij).
  const freeAzimuth = 40;
  const freePolar = portraitPhone ? PORTRAIT_POLAR_DEG : 52;
  const aspect = size.width > 0 && size.height > 0 ? size.width / size.height : 1.6;
  const freeDistance = size.width > 0 ? fitPerspectiveDistance(room, freeAzimuth, freePolar, aspect, 50, portraitPhone ? 1.12 : 1.2) : span * 1.6;
  const freeOffset = cameraPosition(freeAzimuth, freePolar, freeDistance);
  const freePosition: [number, number, number] = [freeOffset[0], freeOffset[1], freeOffset[2]];

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
        minZoom={mode !== "free" ? orthoZoom * 0.5 : undefined}
        maxZoom={mode !== "free" ? orthoZoom * 8 : undefined}
        target={[0, 0, 0]}
        // Touch: in "Vrij draaien" draait één vinger de camera; in schuin/bovenaanzicht (waar draaien
        // uit staat) verschuift één vinger het beeld. Twee vingers = knijpen (zoom) + verschuiven.
        touches={{ ONE: mode === "free" && !drawMode ? TOUCH.ROTATE : TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      />
      {onViewCenter && <ViewCenterReporter onViewCenter={onViewCenter} />}
      <ZoomController request={zoomRequest} />
      <ViewInset insetPx={bottomInsetPx} />
    </group>
  );
}
