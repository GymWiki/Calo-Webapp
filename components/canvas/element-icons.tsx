"use client";

import useImage from "use-image";
import {
  Arrow,
  Group,
  Circle,
  Ellipse,
  Image as KonvaImage,
  Line,
  Rect,
  RegularPolygon,
  Text,
} from "react-konva";

import type {
  DiagramElement,
  ElementType,
  MaterialDiagramElement,
  ViewMode,
} from "./gym-canvas-types";
import { ELEMENT_DEFS } from "./gym-canvas-types";

const STROKE = "rgba(0,0,0,0.25)";

// -- small reusable primitives (spelers/lijnen/pijlen) -----------------------

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

// -- materiaal (dynamisch, uit Supabase) -------------------------------------

/**
 * Neutrale placeholder — getoond zolang de foto nog laadt, wanneer een
 * materiaal (nog) geen image_url heeft, of wanneer de afbeelding niet kan
 * laden (bijv. verwijderd uit Storage). Toont de eerste letters van de
 * materiaalnaam zodat het element ook zonder foto herkenbaar blijft.
 */
function MaterialPlaceholder({
  w,
  h,
  label,
}: {
  w: number;
  h: number;
  label: string;
}) {
  const initials = label
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        cornerRadius={6}
        fill="#e9ecef"
        stroke={STROKE}
        strokeWidth={1.3}
        dash={[4, 3]}
      />
      <Text
        text={initials || "?"}
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        align="center"
        verticalAlign="middle"
        fontSize={Math.max(9, Math.min(w, h) * 0.4)}
        fontStyle="bold"
        fill="#868e96"
      />
    </>
  );
}

function MaterialElementIcon({ element }: { element: MaterialDiagramElement }) {
  const [image, status] = useImage(element.imageUrl ?? "", "anonymous");
  const w = element.width;
  const h = element.height;

  if (!element.imageUrl || status === "failed" || status === "loading" || !image) {
    return <MaterialPlaceholder w={w} h={h} label={element.name} />;
  }

  // Contain-fit binnen de vaste elementgrootte i.p.v. uitrekken, zodat een
  // niet-vierkante foto zijn eigen beeldverhouding houdt.
  const scale = Math.min(w / image.width, h / image.height);
  const iw = image.width * scale;
  const ih = image.height * scale;

  return <KonvaImage image={image} x={-iw / 2} y={-ih / 2} width={iw} height={ih} />;
}

// -- element graphic per systeemtype -----------------------------------------

function VectorIcon({
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

/**
 * Public entry point voor een element dat al op het canvas staat. Rendert
 * de foto (met placeholder/fallback) voor dynamisch materiaal, of het
 * hand-getekende vector-icoon voor spelers/lijnen/pijlen.
 */
export function ElementIcon({
  element,
  viewMode = "top",
}: {
  element: DiagramElement;
  viewMode?: ViewMode;
}) {
  if (element.kind === "material") {
    return <MaterialElementIcon element={element} />;
  }

  return <VectorIcon type={element.type} viewMode={viewMode} />;
}

/** Variant voor de picker-thumbnail van systeemtypes (nog geen element-id nodig). */
export function SystemElementPreviewIcon({
  type,
  viewMode = "top",
}: {
  type: ElementType;
  viewMode?: ViewMode;
}) {
  return <VectorIcon type={type} viewMode={viewMode} />;
}
