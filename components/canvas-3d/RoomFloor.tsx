"use client";

import { Grid } from "@react-three/drei";
import type { Floorplan3dRoom } from "@/types/floorplan3d";

const WALL_HEIGHT_M = 0.3;
const WALL_THICKNESS_M = 0.08;
const WALL_COLOR = "#cbd5e1"; // tailwind slate-300 — neutrale, lage rand.

/**
 * Vloer (raster) + lage rand/muren rond de kamer — geen plafond (zie Stap
 * 4.7). `width_m` loopt langs X, `length_m` langs Z, middelpunt van de
 * kamer op de oorsprong (0,0,0) — zelfde coördinatenconventie als de
 * geplaatste items (floorplan3d-geometry.ts).
 */
export function RoomFloor({ room }: { room: Floorplan3dRoom }) {
  const halfX = room.width_m / 2;
  const halfZ = room.length_m / 2;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <planeGeometry args={[room.width_m, room.length_m]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>

      <Grid
        position={[0, 0.001, 0]}
        args={[room.width_m, room.length_m]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#cbd5e1"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#94a3b8"
        fadeDistance={50}
        infiniteGrid={false}
      />

      {/* Lage rand aan alle vier de zijden — géén plafond. */}
      <mesh position={[0, WALL_HEIGHT_M / 2, -halfZ - WALL_THICKNESS_M / 2]}>
        <boxGeometry args={[room.width_m + WALL_THICKNESS_M * 2, WALL_HEIGHT_M, WALL_THICKNESS_M]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
      <mesh position={[0, WALL_HEIGHT_M / 2, halfZ + WALL_THICKNESS_M / 2]}>
        <boxGeometry args={[room.width_m + WALL_THICKNESS_M * 2, WALL_HEIGHT_M, WALL_THICKNESS_M]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
      <mesh position={[-halfX - WALL_THICKNESS_M / 2, WALL_HEIGHT_M / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS_M, WALL_HEIGHT_M, room.length_m + WALL_THICKNESS_M * 2]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
      <mesh position={[halfX + WALL_THICKNESS_M / 2, WALL_HEIGHT_M / 2, 0]}>
        <boxGeometry args={[WALL_THICKNESS_M, WALL_HEIGHT_M, room.length_m + WALL_THICKNESS_M * 2]} />
        <meshStandardMaterial color={WALL_COLOR} />
      </mesh>
    </group>
  );
}
