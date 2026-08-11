"use client";

import type { ReactNode } from "react";
import {
  Arrow,
  Circle,
  Ellipse,
  Group,
  Line,
  Rect,
  RegularPolygon,
  Ring,
} from "react-konva";

import type { ElementType, ViewMode } from "./gym-canvas-types";
import { ELEMENT_DEFS } from "./gym-canvas-types";

const STROKE = "rgba(0,0,0,0.25)";
const SEAM = "rgba(0,0,0,0.35)";

// -- small reusable primitives ----------------------------------------------

function seamPoints(r: number, angleDeg: number): number[] {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rotate = (x: number, y: number) => [x * cos - y * sin, x * sin + y * cos];
  return [...rotate(-r * 0.7, -r * 0.4), ...rotate(0, 0), ...rotate(-r * 0.7, r * 0.4)];
}

function Seam({
  r,
  angleDeg,
  color,
  width = 1.3,
}: {
  r: number;
  angleDeg: number;
  color: string;
  width?: number;
}) {
  return (
    <Line
      points={seamPoints(r, angleDeg)}
      tension={0.6}
      stroke={color}
      strokeWidth={width}
      listening={false}
    />
  );
}

function BallBase({ radius, fill }: { radius: number; fill: string }) {
  return (
    <Circle
      radius={radius}
      fill={fill}
      stroke={STROKE}
      strokeWidth={1}
      shadowColor="black"
      shadowBlur={2}
      shadowOpacity={0.15}
      shadowOffsetY={1}
    />
  );
}

/**
 * Ball wrapper: in side view, adds a ground-contact shadow beneath the ball
 * so it reads as floating at "leefhoogte" (play height) rather than glued
 * to the floor, per the brief's explicit side-view example.
 */
function Ball({
  r,
  fill,
  side,
  children,
}: {
  r: number;
  fill: string;
  side: boolean;
  children?: ReactNode;
}) {
  return (
    <>
      {side && (
        <Ellipse
          y={r * 1.4}
          radiusX={r * 0.8}
          radiusY={r * 0.25}
          fill="rgba(0,0,0,0.18)"
        />
      )}
      <BallBase radius={r} fill={fill} />
      {children}
    </>
  );
}

function PlayerTopDown({ r, fill }: { r: number; fill: string }) {
  return (
    <>
      <Circle
        radius={r}
        fill={fill}
        stroke={STROKE}
        strokeWidth={1.2}
        shadowColor="black"
        shadowBlur={2}
        shadowOpacity={0.15}
        shadowOffsetY={1}
      />
      <Line
        points={[0, 0, 0, -r * 0.9]}
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={2}
        lineCap="round"
      />
      <Circle radius={r * 0.38} fill="rgba(255,255,255,0.9)" />
    </>
  );
}

function PlayerSide({ h, fill }: { h: number; fill: string }) {
  return (
    <>
      <Ellipse y={h * 0.42} radiusX={h * 0.24} radiusY={h * 0.06} fill="rgba(0,0,0,0.15)" />
      <Circle y={-h * 0.32} radius={h * 0.16} fill={fill} stroke={STROKE} strokeWidth={1} />
      <Line points={[0, -h * 0.16, -h * 0.24, -h * 0.34]} stroke={fill} strokeWidth={2.5} lineCap="round" />
      <Line points={[0, -h * 0.16, h * 0.24, -h * 0.34]} stroke={fill} strokeWidth={2.5} lineCap="round" />
      <Line points={[0, -h * 0.16, 0, h * 0.12]} stroke={fill} strokeWidth={3} lineCap="round" />
      <Line points={[0, h * 0.12, -h * 0.18, h * 0.32]} stroke={fill} strokeWidth={2.5} lineCap="round" />
      <Line points={[0, h * 0.12, h * 0.14, h * 0.36]} stroke={fill} strokeWidth={2.5} lineCap="round" />
    </>
  );
}

function TeamCluster({ fill, w, h }: { fill: string; w: number; h: number }) {
  const positions: [number, number][] = [
    [-w * 0.22, h * 0.15],
    [w * 0.22, h * 0.15],
    [0, -h * 0.24],
  ];
  return (
    <>
      <Ellipse
        radiusX={w / 2}
        radiusY={h / 2}
        stroke="rgba(0,0,0,0.2)"
        strokeWidth={1}
        dash={[4, 3]}
        fill="rgba(0,0,0,0.04)"
      />
      {positions.map(([px, py], i) => (
        <Group key={i} x={px} y={py}>
          <Circle radius={8} fill={fill} stroke={STROKE} strokeWidth={1} />
          <Circle radius={3} fill="rgba(255,255,255,0.85)" />
        </Group>
      ))}
    </>
  );
}

function CurvedArrow({ w, h, color }: { w: number; h: number; color: string }) {
  return (
    <>
      <Line
        points={[-w / 2, h / 3, 0, -h / 2, w / 2 - 6, h / 4]}
        tension={0.5}
        stroke={color}
        strokeWidth={3}
        lineCap="round"
      />
      <RegularPolygon
        sides={3}
        radius={7}
        fill={color}
        x={w / 2}
        y={h / 3.6}
        rotation={110}
      />
    </>
  );
}

// -- element graphic per type -------------------------------------------------

export function ElementIcon({
  type,
  viewMode = "top",
}: {
  type: ElementType;
  viewMode?: ViewMode;
}) {
  const def = ELEMENT_DEFS[type];
  const w = def.width;
  const h = def.height;
  const r = w / 2;
  const side = viewMode === "side";

  switch (type) {
    case "kast_klein":
    case "kast_groot": {
      const fill = type === "kast_klein" ? "#a97142" : "#8b5e34";
      const doors = type === "kast_klein" ? 1 : 2;
      if (side) {
        return (
          <>
            <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} cornerRadius={3} stroke={STROKE} strokeWidth={1.5} />
            <Line points={[-w / 2 + 4, -h * 0.1, w / 2 - 4, -h * 0.1]} stroke={SEAM} strokeWidth={1.3} />
            <Rect x={-w / 2 + 3} y={h / 2 - 5} width={6} height={5} fill="#5c4326" />
            <Rect x={w / 2 - 9} y={h / 2 - 5} width={6} height={5} fill="#5c4326" />
          </>
        );
      }
      return (
        <>
          <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={fill} cornerRadius={4} stroke={STROKE} strokeWidth={1.5} />
          {doors === 2 && <Line points={[0, -h / 2 + 5, 0, h / 2 - 5]} stroke={SEAM} strokeWidth={1.3} />}
          <Circle x={doors === 2 ? -6 : 0} radius={2} fill="rgba(0,0,0,0.4)" />
          {doors === 2 && <Circle x={6} radius={2} fill="rgba(0,0,0,0.4)" />}
        </>
      );
    }

    case "turnbank": {
      if (side) {
        return (
          <>
            <Rect x={-w / 2} y={-h / 2} width={w} height={h * 0.5} fill="#c99a52" cornerRadius={2} stroke={STROKE} strokeWidth={1.2} />
            <Line points={[-w / 2 + 6, h * 0.05, -w / 2 + 6, h / 2]} stroke="#8b5e34" strokeWidth={3} />
            <Line points={[w / 2 - 6, h * 0.05, w / 2 - 6, h / 2]} stroke="#8b5e34" strokeWidth={3} />
          </>
        );
      }
      return <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#c99a52" cornerRadius={3} stroke={STROKE} strokeWidth={1.2} />;
    }

    case "mat_dik": {
      if (side) {
        return (
          <>
            <Rect x={-w / 2} y={-h * 0.15} width={w} height={h * 0.3} fill="#3355c4" cornerRadius={2} stroke={STROKE} strokeWidth={1.2} />
            <Rect x={-w / 2} y={-h * 0.15 - 6} width={w} height={6} fill="#4c6ef5" />
          </>
        );
      }
      return (
        <>
          <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#4c6ef5" cornerRadius={6} stroke={STROKE} strokeWidth={1.5} />
          <Rect x={-w / 2 + 6} y={-h / 2 + 6} width={w - 12} height={h - 12} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} cornerRadius={3} />
          <Circle x={-w / 2 + 6} y={-h / 2 + 6} radius={2} fill="rgba(255,255,255,0.6)" />
          <Circle x={w / 2 - 6} y={h / 2 - 6} radius={2} fill="rgba(255,255,255,0.6)" />
        </>
      );
    }

    case "mat_klein":
      return <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#748ffc" cornerRadius={5} stroke={STROKE} strokeWidth={1.3} />;

    case "wandrek": {
      const rungCount = 7;
      const rungs = Array.from({ length: rungCount }, (_, i) => -h / 2 + 10 + (i * (h - 20)) / (rungCount - 1));
      return (
        <>
          <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#c99a52" cornerRadius={2} stroke={STROKE} strokeWidth={1.3} />
          {rungs.map((ry, i) => (
            <Line key={i} points={[-w / 2 + 2, ry, w / 2 - 2, ry]} stroke="#8b5e34" strokeWidth={2} />
          ))}
        </>
      );
    }

    case "trampoline":
      return (
        <>
          <Circle radius={r} fill="#2b2d31" stroke={STROKE} strokeWidth={1.5} />
          <Circle radius={r * 0.72} fill="#1c7ed6" />
          {Array.from({ length: 10 }, (_, i) => {
            const angle = (i / 10) * Math.PI * 2;
            return (
              <Line
                key={i}
                points={[Math.cos(angle) * r * 0.72, Math.sin(angle) * r * 0.72, Math.cos(angle) * r * 0.94, Math.sin(angle) * r * 0.94]}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={1}
              />
            );
          })}
        </>
      );

    case "korf": {
      if (side) {
        return (
          <>
            <Line points={[0, h / 2, 0, -h * 0.1]} stroke="#495057" strokeWidth={3} />
            <Ellipse y={-h * 0.1} radiusX={w / 2} radiusY={4} stroke="#e8590c" strokeWidth={2.5} />
            {Array.from({ length: 4 }, (_, i) => (
              <Line key={i} points={[-w / 2 + i * (w / 3), -h * 0.1, -w / 2 + i * (w / 3) + 4, -h * 0.1 + 10]} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
            ))}
          </>
        );
      }
      return (
        <>
          <Ring innerRadius={r - 3} outerRadius={r} fill="#e8590c" stroke={STROKE} strokeWidth={0.5} />
          <Circle radius={r - 4} fill="rgba(232,89,12,0.12)" />
        </>
      );
    }

    case "doel": {
      if (side) {
        return (
          <>
            <Line points={[-w / 2, h / 2, -w / 2, -h / 2, w / 2, -h / 2]} stroke="#f1f3f5" strokeWidth={4} lineCap="round" lineJoin="round" />
            <Line points={[-w / 2, -h / 2, -w * 0.1, h / 2]} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
            <Line points={[w / 2, -h / 2, -w * 0.1, h / 2]} stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
          </>
        );
      }
      return (
        <>
          <Rect x={-w / 2} y={-h / 2} width={w} height={h} stroke="#f1f3f5" strokeWidth={4} fill="rgba(255,255,255,0.5)" />
          {Array.from({ length: 5 }, (_, i) => (
            <Line key={`v${i}`} points={[-w / 2 + (i * w) / 4, -h / 2, -w / 2 + (i * w) / 4, h / 2]} stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
          ))}
          {Array.from({ length: 3 }, (_, i) => (
            <Line key={`h${i}`} points={[-w / 2, -h / 2 + (i * h) / 2, w / 2, -h / 2 + (i * h) / 2]} stroke="rgba(0,0,0,0.12)" strokeWidth={1} />
          ))}
        </>
      );
    }

    case "pion":
      return (
        <>
          <RegularPolygon sides={3} radius={r} fill="#ff5a1f" stroke={STROKE} strokeWidth={1} />
          <Line points={[-r * 0.45, -r * 0.1, r * 0.45, -r * 0.1]} stroke="rgba(255,255,255,0.7)" strokeWidth={2} />
        </>
      );

    case "lint":
      return (
        <>
          <Line points={[0, h / 2, 0, -h / 2]} stroke="#495057" strokeWidth={1.5} />
          <RegularPolygon sides={3} radius={r} fill="#f06595" rotation={90} y={-h / 2 + r * 0.6} />
        </>
      );

    case "hoepel":
      return <Ring innerRadius={r - 3} outerRadius={r} fill="#12b886" stroke={STROKE} strokeWidth={0.5} />;

    case "springtouw":
      return (
        <>
          <Line
            points={[-w / 2 + 6, 0, -w / 4, -h / 2, 0, h / 2, w / 4, -h / 2, w / 2 - 6, 0]}
            tension={0.5}
            stroke="#9c36b5"
            strokeWidth={2}
            lineCap="round"
          />
          <Circle x={-w / 2 + 6} radius={4} fill="#495057" />
          <Circle x={w / 2 - 6} radius={4} fill="#495057" />
        </>
      );

    case "bal_voetbal":
      return (
        <Ball r={r} fill="#f8f9fa" side={side}>
          <RegularPolygon sides={5} radius={r * 0.4} fill="#14171a" />
          <Seam r={r} angleDeg={35} color="#14171a" width={1.2} />
          <Seam r={r} angleDeg={155} color="#14171a" width={1.2} />
          <Seam r={r} angleDeg={275} color="#14171a" width={1.2} />
        </Ball>
      );

    case "bal_basketbal":
      return (
        <Ball r={r} fill="#e8590c" side={side}>
          <Line points={[-r, 0, r, 0]} stroke="#14171a" strokeWidth={1.3} />
          <Line points={[0, -r, 0, r]} stroke="#14171a" strokeWidth={1.3} />
          <Seam r={r} angleDeg={0} color="#14171a" />
          <Seam r={r} angleDeg={180} color="#14171a" />
        </Ball>
      );

    case "bal_korfbal":
      return (
        <Ball r={r} fill="#e8590c" side={side}>
          <Ring innerRadius={r * 0.86} outerRadius={r * 0.94} fill="rgba(255,255,255,0.8)" />
        </Ball>
      );

    case "bal_foam":
      return (
        <Ball r={r} fill="#f4c10a" side={side}>
          <Ellipse x={-r * 0.3} y={-r * 0.3} radiusX={r * 0.35} radiusY={r * 0.22} fill="rgba(255,255,255,0.4)" rotation={-30} />
        </Ball>
      );

    case "bal_trefbal":
      return (
        <Ball r={r} fill="#e03131" side={side}>
          <Seam r={r} angleDeg={90} color="rgba(255,255,255,0.75)" width={1.4} />
          <Seam r={r} angleDeg={270} color="rgba(255,255,255,0.75)" width={1.4} />
        </Ball>
      );

    case "bal_volleybal":
      return (
        <Ball r={r} fill="#f8f9fa" side={side}>
          <Seam r={r} angleDeg={0} color="#1c7ed6" />
          <Seam r={r} angleDeg={120} color="#f4c10a" />
          <Seam r={r} angleDeg={240} color="#1c7ed6" />
        </Ball>
      );

    case "speler_rood":
      return side ? <PlayerSide h={h} fill="#e03131" /> : <PlayerTopDown r={r} fill="#e03131" />;
    case "speler_blauw":
      return side ? <PlayerSide h={h} fill="#1c7ed6" /> : <PlayerTopDown r={r} fill="#1c7ed6" />;
    case "scheidsrechter":
      return side ? (
        <PlayerSide h={h} fill="#1b1d21" />
      ) : (
        <>
          <PlayerTopDown r={r} fill="#1b1d21" />
          <Circle x={r * 0.7} y={-r * 0.7} radius={2.5} fill="#f8f9fa" />
        </>
      );

    case "team_a":
      return <TeamCluster fill="#f59f00" w={w} h={h} />;
    case "team_b":
      return <TeamCluster fill="#0ca678" w={w} h={h} />;

    case "looplijn":
      return <Line points={[-w / 2, 0, w / 2, 0]} stroke="#495057" strokeWidth={2.5} dash={[8, 6]} lineCap="round" />;

    case "looprichting_pijl":
      return <Arrow points={[-w / 2, 0, w / 2, 0]} stroke="#14171a" fill="#14171a" strokeWidth={3.5} pointerLength={10} pointerWidth={10} />;

    case "balbaan_pijl":
      return <CurvedArrow w={w} h={h} color="#1c7ed6" />;

    case "aanvalszone":
      return (
        <Rect
          x={-w / 2}
          y={-h / 2}
          width={w}
          height={h}
          cornerRadius={12}
          fill="rgba(255,90,31,0.12)"
          stroke="rgba(255,90,31,0.55)"
          strokeWidth={2}
          dash={[10, 6]}
        />
      );

    default:
      return null;
  }
}
