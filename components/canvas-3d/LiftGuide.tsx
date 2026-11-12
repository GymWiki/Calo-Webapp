"use client";

import { Html, Line } from "@react-three/drei";

export type LiftGuideData = { x: number; y: number; z: number; label: string; snapped?: string | null; hand?: { pos: [number, number, number]; busy: boolean } | null };

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
      {guide.hand && <HandHighlight pos={guide.hand.pos} busy={guide.hand.busy} />}
      <Html position={[x, y + 0.12, z]} center zIndexRange={[24, 0]} style={{ pointerEvents: "none" }}>
        <div className="rounded-md bg-slate-900/90 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-white shadow" data-testid="tilhoogte">
          {guide.label}
          {guide.snapped ? <span className="ml-1 font-normal text-orange-300">· {guide.snapped}</span> : null}
        </div>
      </Html>
    </group>
  );
}

/** Debug (?debug=collision, "Toon anchors"): bolletjes op de handpunten van alle leerlingen en de greeppunten van pakbare objecten, met label. */
export function GripMarkers({ points }: { points: { id: string; pos: [number, number, number]; label: string; kind: "hand" | "greep" }[] }) {
  return (
    <group raycast={() => null}>
      {points.map((point) => (
        <group key={point.id} position={point.pos}>
          <mesh renderOrder={11} raycast={() => null}>
            <sphereGeometry args={[point.kind === "hand" ? 0.035 : 0.025, 12, 8]} />
            <meshBasicMaterial color={point.kind === "hand" ? "#22c55e" : "#3b82f6"} depthTest={false} />
          </mesh>
          <Html center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }} position={[0, 0.07, 0]}>
            <div className="rounded bg-slate-900/90 px-1 py-0.5 text-[10px] leading-tight whitespace-nowrap text-white" data-testid="greep-label">{point.label}</div>
          </Html>
        </group>
      ))}
    </group>
  );
}

/** Subtiele markering van de hand waar het object bij loslaten aan vastklikt. */
export function HandHighlight({ pos, busy }: { pos: [number, number, number]; busy: boolean }) {
  return (
    <mesh position={pos} renderOrder={12} raycast={() => null}>
      <sphereGeometry args={[0.07, 16, 12]} />
      <meshBasicMaterial color={busy ? "#ef4444" : "#f97316"} depthTest={false} transparent opacity={0.55} />
    </mesh>
  );
}
