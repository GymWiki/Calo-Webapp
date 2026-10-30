"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { ROPE_COLOR, ROPE_RADIUS_M } from "@/components/canvas-3d/rope";
import type { Vec3 } from "@/components/canvas-3d/orientation";

const UP = new THREE.Vector3(0, 1, 0);
const SELECTED_COLOR = "#ef4444";
const HANDLE_COLOR = "#f97316";
/** Zoveel meter aan elk uiteinde (vanaf het object) is niet aan te klikken als touw. */
const PICK_END_GAP_M = 0.45;

/** Stand en lengte van een koord tussen twee punten (cilinder langs de Y-as, gedraaid naar de richting). */
function segment(from: Vec3, to: Vec3) {
  const a = new THREE.Vector3(...from);
  const b = new THREE.Vector3(...to);
  const direction = b.clone().sub(a);
  const length = direction.length();
  const quaternion = new THREE.Quaternion();
  if (length > 1e-6) quaternion.setFromUnitVectors(UP, direction.normalize());
  return { center: a.add(b).multiplyScalar(0.5), quaternion, length };
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
  const { center, quaternion, length } = useMemo(() => segment(from, to), [from, to]);
  if (length < 1e-4) return null;
  const radius = selected ? ROPE_RADIUS_M * 1.5 : ROPE_RADIUS_M;
  const color = selected ? SELECTED_COLOR : ROPE_COLOR;
  const opacity = preview ? 0.7 : 1;

  return (
    <group>
      <mesh position={center} quaternion={quaternion}>
        <cylinderGeometry args={[radius, radius, length, 8]} />
        <meshStandardMaterial color={color} roughness={0.7} transparent={preview} opacity={opacity} />
      </mesh>
      {([from, to] as const).map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[radius * 1.6, 12, 8]} />
          <meshStandardMaterial color={color} roughness={0.7} transparent={preview} opacity={opacity} />
        </mesh>
      ))}
      {interactive && onSelect && (
        // Ruim, onzichtbaar raakvlak: een touw van 6 cm is anders nauwelijks aan te klikken. De uiteinden blijven vrij, zodat je het
        // object waar het touw aan vastzit nog gewoon kunt pakken en verslepen.
        <mesh position={center} quaternion={quaternion} visible={false} onPointerDown={onSelect}>
          <cylinderGeometry args={[0.14, 0.14, Math.max(length - 2 * PICK_END_GAP_M, Math.min(length, 0.3)), 6]} />
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

