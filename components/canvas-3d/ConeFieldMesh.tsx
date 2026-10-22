"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Html, Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import type { ConeField, ConeMarkerType } from "@/types/floorplan3d";
import {
  CONE_MARKER_DIMS,
  computeConePositions,
  fieldTooltipLines,
  type Vec2,
} from "@/components/canvas-3d/cone-field";

const SELECTION_COLOR = "#2563eb"; // zelfde blauw als ItemMesh
const DRAFT_COLOR = "#f97316"; // GymWiki-oranje
const HANDLE_RADIUS_M = 0.28; // ruim genoeg om met een vinger te raken

// Pionnen zijn puur visueel: ze vangen geen pointer-events (het veld als
// geheel is het klikdoel, zie het onzichtbare vlak hieronder).
const noRaycast = () => null;

/** Low-poly, procedureel model per markeertype; oorsprong op de vloer. */
function markerGeometry(marker: ConeMarkerType): THREE.BufferGeometry {
  const { height, radius } = CONE_MARKER_DIMS[marker];
  const geometry =
    marker === "dopje"
      ? new THREE.CylinderGeometry(radius, radius, height, 20)
      : new THREE.ConeGeometry(radius, height, 14);
  geometry.translate(0, height / 2, 0);
  return geometry;
}

/** Eén InstancedMesh voor alle pionnen van één kleur — ook bij velden met
 * honderden pionnen blijft dat één draw-call. */
function MarkerInstances({ points, marker, color }: { points: Vec2[]; marker: ConeMarkerType; color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree((state) => state.invalidate);
  const geometry = useMemo(() => markerGeometry(marker), [marker]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    points.forEach((point, index) => {
      matrix.makeTranslation(point.x, 0, point.z);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [points, geometry, invalidate]);

  if (points.length === 0) return null;
  return (
    // `key` op het aantal: een InstancedMesh heeft een vaste capaciteit.
    <instancedMesh key={points.length} ref={ref} args={[geometry, undefined, points.length]} frustumCulled={false} raycast={noRaycast}>
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

export function ConeFieldMesh({
  field,
  selected = false,
  interactive = true,
  preview = false,
  onSelect,
  onFieldPointerDown,
  onHandlePointerDown,
}: {
  field: ConeField;
  selected?: boolean;
  /** false tijdens het tekenen: het veld vangt dan geen klikken. */
  interactive?: boolean;
  /** Concept tijdens het tekenen: oranje contour + tooltip. */
  preview?: boolean;
  onSelect?: (id: string) => void;
  onFieldPointerDown?: (id: string, event: ThreeEvent<PointerEvent>) => void;
  onHandlePointerDown?: (id: string, cornerIndex: number, event: ThreeEvent<PointerEvent>) => void;
}) {
  const { corners, edges } = useMemo(
    () =>
      computeConePositions({
        width: field.width_m,
        length: field.length_m,
        interval: field.interval_m,
        mode: field.distribution,
      }),
    [field.width_m, field.length_m, field.interval_m, field.distribution],
  );

  const hw = field.width_m / 2;
  const hl = field.length_m / 2;
  const outline = useMemo<[number, number, number][]>(
    () => [
      [-hw, 0.03, -hl],
      [hw, 0.03, -hl],
      [hw, 0.03, hl],
      [-hw, 0.03, hl],
      [-hw, 0.03, -hl],
    ],
    [hw, hl],
  );
  const accent = preview ? DRAFT_COLOR : SELECTION_COLOR;
  const cornerColor = field.corner_color ?? field.color;

  return (
    <group position={[field.x, 0, field.z]} rotation={[0, THREE.MathUtils.degToRad(field.rot_y_deg), 0]}>
      {/* Onzichtbaar klikvlak: selecteren/verplaatsen van het hele veld. */}
      {interactive && !preview && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, 0]}
          visible={false}
          onPointerDown={(event) => {
            event.stopPropagation();
            onSelect?.(field.id);
            onFieldPointerDown?.(field.id, event);
          }}
        >
          <planeGeometry args={[Math.max(field.width_m, 0.3), Math.max(field.length_m, 0.3)]} />
        </mesh>
      )}

      {(selected || preview) && field.width_m > 0.01 && field.length_m > 0.01 && (
        <>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} raycast={noRaycast}>
            <planeGeometry args={[field.width_m, field.length_m]} />
            <meshBasicMaterial color={accent} transparent opacity={0.1} depthWrite={false} />
          </mesh>
          <Line points={outline} color={accent} lineWidth={2} dashed={preview} dashSize={0.25} gapSize={0.15} />
        </>
      )}

      <MarkerInstances points={edges} marker={field.marker} color={field.color} />
      <MarkerInstances points={corners} marker={field.marker} color={cornerColor} />

      {selected && !preview && interactive && (
        <>
          {corners.length === 4 &&
            corners.map((corner, index) => (
              <mesh
                key={index}
                position={[corner.x, 0.05, corner.z]}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onHandlePointerDown?.(field.id, index, event);
                }}
              >
                <cylinderGeometry args={[HANDLE_RADIUS_M, HANDLE_RADIUS_M, 0.08, 20]} />
                <meshBasicMaterial color={SELECTION_COLOR} transparent opacity={0.85} depthTest={false} />
              </mesh>
            ))}
        </>
      )}

      {preview && (
        <Html position={[0, 0.6, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded-md bg-slate-900/90 px-2 py-1 text-xs leading-snug whitespace-nowrap text-white shadow">
            {fieldTooltipLines(field).map((line, index) => (
              <div key={index} className={index === 0 ? "font-semibold" : undefined}>
                {line}
              </div>
            ))}
          </div>
        </Html>
      )}
    </group>
  );
}
