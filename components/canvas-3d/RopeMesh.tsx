"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
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
  touchUi = false,
  label,
  invalid = false,
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
  /** Handvat van het geselecteerde touw ingedrukt: "a" = begin, "b" = einde (eindpunt verslepen), "mid" = het hele touw verplaatsen. */
  onHandleDown?: (end: "a" | "b" | "mid", event: ThreeEvent<PointerEvent>) => void;
  /** Touch-bediening: grotere handvatten (tikdoel ≥ 44 px). */
  touchUi?: boolean;
  /** Zwevend label bij het touw (bijv. de lengte tijdens het slepen). */
  label?: string;
  /** Het label en het touw zijn rood: de huidige plek is ongeldig. */
  invalid?: boolean;
}) {
  const length = ropeLength(from, to);
  const points = useMemo(() => ropeCurvePoints(from, to, SEGMENTS), [from, to]);
  const radius = selected ? ROPE_RADIUS_M * 1.5 : ROPE_RADIUS_M;
  const body = useMemo(() => (length < 1e-4 ? null : tube(points, radius, 8)), [points, radius, length]);
  const pick = useMemo(() => (length >= 1e-4 && interactive && onSelect ? tube(pickPoints(points, length), touchUi ? 0.35 : 0.2, 6) : null), [points, length, interactive, onSelect, touchUi]);
  useEffect(() => () => body?.dispose(), [body]);
  useEffect(() => () => pick?.dispose(), [pick]);
  if (!body) return null;
  const color = invalid ? "#f97316" : selected ? SELECTED_COLOR : ROPE_COLOR;
  const mid = points[Math.floor(points.length / 2)];
  const visibleHandle = touchUi ? 0.2 : 0.13;
  const hitHandle = touchUi ? 0.8 : 0.4;
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
      {label && (
        <Html position={[mid[0], mid[1] + 0.25, mid[2]]} center zIndexRange={[24, 0]} style={{ pointerEvents: "none" }}>
          <div
            className={`rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow ${invalid ? "bg-orange-600" : "bg-slate-900/90"}`}
            data-testid="touw-lengte"
          >
            {label}
          </div>
        </Html>
      )}
      {interactive && selected && onHandleDown && (
        <>
          {([["a", from], ["b", to], ["mid", mid as Vec3]] as const).map(([end, point]) => (
            // userData.ropeHandle: een object dat ervoor ligt geeft de pointerdown door aan het handvat (zie ItemMesh), want het touw heeft voorrang.
            <group key={end} position={point} userData={{ ropeHandle: true }}>
              <mesh renderOrder={10} userData={{ ropeHandle: true }} onPointerDown={(event) => onHandleDown(end, event)}>
                <sphereGeometry args={[end === "mid" ? visibleHandle * 0.8 : visibleHandle, 16, 12]} />
                <meshBasicMaterial color={end === "mid" ? "#2563eb" : HANDLE_COLOR} depthTest={false} />
              </mesh>
              <mesh visible={false} userData={{ ropeHandle: true }} onPointerDown={(event) => onHandleDown(end, event)}>
                <sphereGeometry args={[hitHandle, 8, 6]} />
              </mesh>
            </group>
          ))}
        </>
      )}
    </group>
  );
}

