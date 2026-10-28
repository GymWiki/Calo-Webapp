import type { CSSProperties } from "react";

/** Eén blok in de isometrische schets: positie/afmeting op het vloerraster, hoogte in rastereenheden. */
export type IsoBlock = {
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  color: string;
  /** Vertraging (s) van de drop-animatie; alleen met `animated`. */
  delay?: number;
};

export type IsoCone = { x: number; y: number; delay?: number };

const S = 22; // schaal van één rastereenheid in de viewBox

const project = (x: number, y: number, z = 0): [number, number] => [(x - y) * S, ((x + y) * S) / 2 - z * S];
const pts = (points: [number, number][]) => points.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");

function shade(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return `rgb(${c((n >> 16) & 255)} ${c((n >> 8) & 255)} ${c(n & 255)})`;
}

function Block({ block, animated }: { block: IsoBlock; animated: boolean }) {
  const { x, y, w, d, h, color } = block;
  const top = pts([project(x, y, h), project(x + w, y, h), project(x + w, y + d, h), project(x, y + d, h)]);
  const left = pts([project(x, y + d, h), project(x + w, y + d, h), project(x + w, y + d, 0), project(x, y + d, 0)]);
  const right = pts([project(x + w, y, h), project(x + w, y + d, h), project(x + w, y + d, 0), project(x + w, y, 0)]);
  const style: CSSProperties | undefined = animated ? { animationDelay: `${block.delay ?? 0}s` } : undefined;
  return (
    <g className={animated ? "iso-anim" : undefined} style={style}>
      <polygon points={left} fill={shade(color, 0.78)} />
      <polygon points={right} fill={shade(color, 0.6)} />
      <polygon points={top} fill={color} />
    </g>
  );
}

/**
 * Lichtgewicht, decoratieve 3D-schets (puur SVG, geen WebGL): een zaalvloer met blokken als toestellen en pionnen.
 * Wordt in de hero (animated) en in de interactieve teaser (statisch per scène) gebruikt. De echte editor laadt pas na een klik.
 */
export function IsoScene({
  width = 12,
  depth = 8,
  blocks,
  cones = [],
  animated = false,
  className,
}: {
  width?: number;
  depth?: number;
  blocks: IsoBlock[];
  cones?: IsoCone[];
  animated?: boolean;
  className?: string;
}) {
  const corners = [project(0, 0), project(width, 0), project(width, depth), project(0, depth)];
  const xs = corners.map((c) => c[0]);
  const minX = Math.min(...xs) - 16;
  const maxX = Math.max(...xs) + 16;
  const minY = Math.min(...corners.map((c) => c[1])) - 70;
  const maxY = Math.max(...corners.map((c) => c[1])) + 24;
  // Achterste blokken eerst tekenen (x + y oplopend).
  const ordered = [...blocks].sort((a, b) => a.x + a.y - (b.x + b.y));
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className={className} aria-hidden="true" focusable="false">
      <polygon points={pts(corners)} fill="#e6c48f" stroke="#b98a4d" strokeWidth="2" />
      <polygon points={pts([project(0.5, 0.5), project(width - 0.5, 0.5), project(width - 0.5, depth - 0.5), project(0.5, depth - 0.5)])} fill="none" stroke="#ffffff" strokeOpacity="0.8" strokeWidth="1.5" />
      <polyline points={pts([project(width / 2, 0.5), project(width / 2, depth - 0.5)])} fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.5" />
      <polygon points={pts([project(0, 0), project(width, 0), project(width, 0, 3.2), project(0, 0, 3.2)])} fill="#cfd3d8" />
      <polygon points={pts([project(0, 0), project(0, depth), project(0, depth, 3.2), project(0, 0, 3.2)])} fill="#b9bec5" />
      {cones.map((cone, index) => {
        const [cx, cy] = project(cone.x, cone.y);
        return (
          <g key={`c${index}`} className={animated ? "iso-anim" : undefined} style={animated ? { animationDelay: `${cone.delay ?? 0}s` } : undefined}>
            <polygon points={`${cx},${cy - 12} ${cx + 5},${cy} ${cx - 5},${cy}`} fill="#ff5a1f" />
            <ellipse cx={cx} cy={cy + 0.5} rx="6" ry="2.4" fill="#d94614" />
          </g>
        );
      })}
      {ordered.map((block, index) => (
        <Block key={index} block={block} animated={animated} />
      ))}
    </svg>
  );
}
