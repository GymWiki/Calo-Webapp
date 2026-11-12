"use client";

import { Html, Line } from "@react-three/drei";

export type LiftGuideData = { x: number; y: number; z: number; label: string; snapped?: string | null };

/**
 * Hulp tijdens het tillen (er zijn geen schaduwen in de scène): een dun verticaal lijntje van het object naar de vloer, een kleine cirkel op de
 * vloer onder het object en een hoogtelabel ("1,35 m"). Raakt niets aan (geen raycast).
 */
export function LiftGuide({ guide }: { guide: LiftGuideData }) {
  const { x, y, z } = guide;
  return (
    <group raycast={() => null}>
      {y > 0.01 && <Line points={[[x, 0.01, z], [x, y, z]]} color="#f97316" lineWidth={1.5} dashed dashSize={0.06} gapSize={0.05} depthTest={false} transparent opacity={0.9} />}
      <mesh position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={9} raycast={() => null}>
        <ringGeometry args={[0.1, 0.13, 32]} />
        <meshBasicMaterial color="#f97316" depthTest={false} transparent opacity={0.85} />
      </mesh>
      <Html position={[x, y + 0.12, z]} center zIndexRange={[24, 0]} style={{ pointerEvents: "none" }}>
        <div className="rounded-md bg-slate-900/90 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow" data-testid="tilhoogte">
          {guide.label}
          {guide.snapped ? <span className="ml-1 font-normal text-orange-300">· {guide.snapped}</span> : null}
        </div>
      </Html>
    </group>
  );
}
