"use client";

import { Edges, Html } from "@react-three/drei";
import { aabbDims, compareShapeToMesh, type CollisionShape, type MeshExtent } from "@/components/canvas-3d/collision-shape";

export const COLLISION_COLOR = "#2563eb"; // blauw: de collision-vorm
const MESH_COLOR = "#16a34a"; // groen: de werkelijke mesh-bounds

const cm = (m: number) => (m * 100).toFixed(1);

/** Middelpunt van de axis-aligned mesh-bounds in de lokale ruimte van het item. */
function hullCenter(extent: MeshExtent) {
  const xs = extent.hull.map((p) => p.x);
  const zs = extent.hull.map((p) => p.z);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (extent.minY + extent.maxY) / 2,
    z: (Math.min(...zs) + Math.max(...zs)) / 2,
  };
}

/** Wireframe van een collision-vorm in de lokale ruimte van het item (deel voor deel). */
export function ShapeWireframe({ shape, color = COLLISION_COLOR, lineWidth = 2 }: { shape: CollisionShape; color?: string; lineWidth?: number }) {
  if (shape.kind === "none") {
    // Puur visueel: wél de afmetingen tonen (gestippeld), zodat je ziet wat er zou zijn.
    return <PartBox part={shape} shape={shape} color="#9ca3af" lineWidth={1} />;
  }
  const parts = shape.kind === "compound" && shape.parts?.length ? shape.parts : [shape];
  return (
    <>
      {parts.map((part, index) => (
        <PartBox key={index} part={part} shape={shape} color={color} lineWidth={lineWidth} />
      ))}
    </>
  );
}

function PartBox({
  part,
  shape,
  color,
  lineWidth,
}: {
  part: { offset_x: number; offset_z: number; length_m: number; width_m: number; yaw_deg: number; base_m?: number; height_m?: number };
  shape: CollisionShape;
  color: string;
  lineWidth: number;
}) {
  const base = part.base_m ?? shape.base_m;
  const height = part.height_m ?? shape.height_m;
  const yaw = (part.yaw_deg * Math.PI) / 180;
  const round = shape.kind === "cylinder" || shape.kind === "capsule";
  const radius = Math.max(part.length_m, part.width_m) / 2;
  return (
    <group position={[part.offset_x, base + height / 2, part.offset_z]} rotation={[0, yaw, 0]}>
      <mesh>
        {round ? <cylinderGeometry args={[radius, radius, height, 24]} /> : <boxGeometry args={[part.length_m, height, part.width_m]} />}
        <meshBasicMaterial visible={false} />
        <Edges color={color} lineWidth={lineWidth} />
      </mesh>
    </group>
  );
}

/**
 * `?debug=collision`: de collision-vorm (blauw) naast de werkelijke
 * mesh-bounds (groen) van één item, met bij hover/selectie een label met
 * asset-id, maten en het verschil. Alles in de lokale ruimte van het item,
 * dus het draait en verschuift exact mee.
 */
export function CollisionDebug({
  slug,
  shape,
  extent,
  labelVisible,
}: {
  slug: string;
  shape: CollisionShape;
  extent: MeshExtent | null;
  labelVisible: boolean;
}) {
  const mesh = extent ? aabbDims(extent) : null;
  const meshCenter = extent ? hullCenter(extent) : null;
  const comparison = extent ? compareShapeToMesh(shape, extent) : null;
  const ok =
    comparison !== null &&
    comparison.centerOffset <= 0.02 &&
    Math.abs(comparison.baseOffset) <= 0.02 &&
    comparison.sizeDelta.every((d) => Math.abs(d) <= 0.02) &&
    Math.abs(comparison.volumeDeltaPct) <= 5 &&
    comparison.protrudingPoints === 0;

  return (
    <>
      {mesh && meshCenter && (
        <group position={[meshCenter.x, meshCenter.y, meshCenter.z]}>
          <mesh>
            <boxGeometry args={[mesh.length_m, mesh.height_m, mesh.width_m]} />
            <meshBasicMaterial visible={false} />
            <Edges color={MESH_COLOR} lineWidth={1.5} />
          </mesh>
        </group>
      )}
      <ShapeWireframe shape={shape} />
      {labelVisible && (
        <Html position={[shape.offset_x, shape.base_m + shape.height_m + 0.15, shape.offset_z]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded-md bg-slate-900/95 px-2 py-1 text-[11px] leading-snug whitespace-nowrap text-white shadow">
            <div className="font-semibold">{slug}</div>
            {mesh ? (
              <>
                <div>
                  <span className="text-green-400">mesh</span> {cm(mesh.length_m)}×{cm(mesh.width_m)}×{cm(mesh.height_m)} cm
                </div>
                <div>
                  <span className="text-blue-400">vorm</span> {cm(shape.length_m)}×{cm(shape.width_m)}×{cm(shape.height_m)} cm · {shape.kind}
                  {shape.yaw_deg ? ` · ${shape.yaw_deg.toFixed(1)}°` : ""}
                </div>
                {comparison && (
                  <div className={ok ? "text-green-400" : "text-red-400"}>
                    {ok ? "klopt" : "afwijking"}: midden {cm(comparison.centerOffset)} cm · onderkant {cm(comparison.baseOffset)} cm · volume{" "}
                    {comparison.volumeDeltaPct.toFixed(0)}%
                  </div>
                )}
                <div className="text-slate-400">bron: {shape.source}</div>
              </>
            ) : (
              <div className="text-slate-400">mesh nog niet gemeten</div>
            )}
          </div>
        </Html>
      )}
    </>
  );
}
