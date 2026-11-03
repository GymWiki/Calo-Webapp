"use client";

import { Html } from "@react-three/drei";

import type { AnchorDef } from "@/components/canvas-3d/anchors";

export type AnchorView = { /** Het anchor dat nu gekozen is (groter, wit omrand). */ highlightId: string | null; labels: boolean };

const COLOR = "#f97316";
const RANGE_COLOR = "#2563eb";

/**
 * Kleine bolletjes op de bevestigingspunten van één item, in de lokale ruimte van het item (draaien, kantelen en verplaatsen dus mee).
 * Altijd bovenop het model getekend (geen dieptetest), zodat je ze ook ziet als ze in een paal zitten. Verstelbare anchors krijgen een
 * dunne blauwe lijn over hun hoogtebereik. Alleen visueel: raakt geen klikken (geen raakvlak).
 */
export function AnchorMarkers({ anchors, view }: { anchors: readonly AnchorDef[]; view: AnchorView }) {
  return (
    <group renderOrder={30}>
      {anchors.map((anchor) => {
        const active = anchor.id === view.highlightId;
        const radius = active ? 0.07 : 0.035;
        return (
          <group key={anchor.id}>
            {anchor.adjustable && (
              <mesh position={[anchor.pos[0], (anchor.adjustable.min + anchor.adjustable.max) / 2, anchor.pos[2]]} renderOrder={29}>
                <boxGeometry args={[0.012, anchor.adjustable.max - anchor.adjustable.min, 0.012]} />
                <meshBasicMaterial color={RANGE_COLOR} transparent opacity={0.55} depthTest={false} />
              </mesh>
            )}
            <mesh position={anchor.pos} renderOrder={30}>
              <sphereGeometry args={[radius, 16, 12]} />
              <meshBasicMaterial color={active ? "#ffffff" : COLOR} depthTest={false} />
            </mesh>
            {active && (
              <mesh position={anchor.pos} renderOrder={29}>
                <sphereGeometry args={[radius * 1.5, 16, 12]} />
                <meshBasicMaterial color={COLOR} depthTest={false} />
              </mesh>
            )}
            {view.labels && (
              <Html position={[anchor.pos[0], anchor.pos[1] + 0.1, anchor.pos[2]]} center zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
                <div className="rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] leading-tight whitespace-nowrap text-white shadow" data-testid="anchor-label">
                  {anchor.label}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}
