"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { ROPE_COLOR, ROPE_RADIUS_M, ropeCurvePoints, ropeLength } from "@/components/canvas-3d/rope";
import type { Vec3 } from "@/components/canvas-3d/orientation";

const SELECTED_COLOR = "#ef4444";
const HANDLE_COLOR = "#f97316";
/** Zoveel meter aan elk uiteinde (vanaf het object) is niet aan te klikken als touw. */
const PICK_END_GAP_M = 0.45;
const SEGMENTS = 24;

function tube(points: Vec3[], radius: number, radialSegments: number): THREE.TubeGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return new THREE.TubeGeometry(curve, Math.max(points.length * 2, 8), radius, radialSegments, false);
}

/** Het middenstuk van het touw (zonder de uiteinden) als punten voor het raakvlak. */
function pickPoints(points: Vec3[], length: number): Vec3[] {
  const n = points.length - 1;
  const gap = Math.min(0.45, PICK_END_GAP_M / Math.max(length, 1e-6));
  const from = Math.ceil(gap * n);
  const to = Math.floor((1 - gap) * n);
  if (to - from >= 2) return points.slice(from, to + 1);
  const mid = Math.floor(n / 2);
  return points.slice(Math.max(mid - 1, 0), Math.min(mid + 2, n + 1));
}

/**
 * Een rood touw (toverkoord) tussen twee punten. Geen item: het raakt nergens aan, heeft geen botsvorm en stapelt niet. In de editor
 * is het aan te klikken (ruim, onzichtbaar raakvlak) en toont het geselecteerde touw twee oranje handvatten om een uiteinde naar een ander
 * object te slepen. In de viewer en thumbnails is het alleen-lezen.
 */
export function RopeMesh({
  from,
  to,
  selected = false,
  preview = false,
  interactive = false,
  onSelect,
  onHandleDown,
}: {
  from: Vec3;
  to: Vec3;
  selected?: boolean;
  /** Het touw dat je nu sleept: iets doorzichtig. */
  preview?: boolean;
  interactive?: boolean;
  onSelect?: (event: ThreeEvent<PointerEvent>) => void;
  /** Handvat ("a" = begin, "b" = einde) van het geselecteerde touw ingedrukt. */
  onHandleDown?: (end: "a" | "b", event: ThreeEvent<PointerEvent>) => void;
}) {
  const length = ropeLength(from, to);
  const points = useMemo(() => ropeCurvePoints(from, to, SEGMENTS), [from, to]);
  const radius = selected ? ROPE_RADIUS_M * 1.5 : ROPE_RADIUS_M;
  const body = useMemo(() => (length < 1e-4 ? null : tube(points, radius, 8)), [points, radius, length]);
  const pick = useMemo(() => (length >= 1e-4 && interactive && onSelect ? tube(pickPoints(points, length), 0.2, 6) : null), [points, length, interactive, onSelect]);
  useEffect(() => () => body?.dispose(), [body]);
  useEffect(() => () => pick?.dispose(), [pick]);
  if (!body) return null;
  const color = selected ? SELECTED_COLOR : ROPE_COLOR;
  const opacity = preview ? 0.7 : 1;

  return (
    <group>
      <mesh geometry={body}>
        <meshStandardMaterial color={color} roughness={0.7} transparent={preview} opacity={opacity} />
      </mesh>
      {([from, to] as const).map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[radius * 1.6, 12, 8]} />
          <meshStandardMaterial color={color} roughness={0.7} transparent={preview} opacity={opacity} />
        </mesh>
      ))}
      {pick && (
        // Ruim, onzichtbaar raakvlak: een touw van 6 cm is anders nauwelijks aan te klikken. De uiteinden blijven vrij, zodat je het
        // object waar het touw aan vastzit nog gewoon kunt pakken en verslepen.
        <mesh geometry={pick} visible={false} onPointerDown={onSelect}>
          <meshBasicMaterial side={THREE.DoubleSide} />
        </mesh>
      )}
      {interactive && selected && onHandleDown && (
        <>
          {([["a", from], ["b", to]] as const).map(([end, point]) => (
            <group key={end} position={point}>
              <mesh renderOrder={10} onPointerDown={(event) => onHandleDown(end, event)}>
                <sphereGeometry args={[0.13, 16, 12]} />
                <meshBasicMaterial color={HANDLE_COLOR} depthTest={false} />
              </mesh>
              <mesh visible={false} onPointerDown={(event) => onHandleDown(end, event)}>
                <sphereGeometry args={[0.4, 8, 6]} />
              </mesh>
            </group>
          ))}
        </>
      )}
    </group>
  );
}

