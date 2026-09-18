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
  FieldPresetDiagramElement,
  MaterialDiagramElement,
  ShapeDiagramElement,
  TextDiagramElement,
  ViewMode,
} from "./gym-canvas-types";
import { ELEMENT_DEFS } from "./gym-canvas-types";
import { FIELD_PRESETS } from "./field-presets";

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

// -- tekstvak -----------------------------------------------------------------

/**
 * `x`/`y` van een TextDiagramElement zijn de linkerbovenhoek (zie
 * gym-canvas-types.ts) — de omringende `<Group>` in GymCanvas.tsx zet die al
 * op de juiste plek, dus deze `<Text>` tekent op lokale (0,0) zonder verdere
 * offset-berekening.
 */
function TextElementIcon({ element }: { element: TextDiagramElement }) {
  return (
    <Text
      text={element.text}
      fontSize={element.fontSize}
      fill={element.fill}
      fontStyle={element.fontStyle}
      lineHeight={1.2}
      wrap="word"
    />
  );
}

// -- sportveld-presets --------------------------------------------------------

/**
 * Kant-en-klare veldbelijning (zie field-presets.ts) — getekend als gewone
 * witte lijnen/cirkels, net als de decoratieve gymzaal-achtergrond. Een
 * geplaatst preset is één BaseElement (zie FieldPresetDiagramElement), dus
 * dit rendert simpelweg alle lijnen/cirkels van het gekozen preset binnen
 * dezelfde Group die GymCanvas.tsx al voor elk element gebruikt — verplaatsen/
 * schalen/roteren werkt daardoor zonder extra logica, hetzelfde generieke pad
 * als materiaal- en systeemelementen.
 */
function FieldPresetElementIcon({ element }: { element: FieldPresetDiagramElement }) {
  const geometry = FIELD_PRESETS[element.sport];
  const stroke = "#ffffff";
  const strokeWidth = 3;

  return (
    <Group scaleX={geometry.initialScale} scaleY={geometry.initialScale} opacity={0.92}>
      <Rect
        x={-geometry.width / 2}
        y={-geometry.height / 2}
        width={geometry.width}
        height={geometry.height}
        fill="rgba(20,120,60,0.18)"
      />
      {geometry.lines.map((line, i) => (
        <Line
          key={i}
          points={line.points}
          stroke={stroke}
          strokeWidth={strokeWidth}
          dash={line.dash}
          lineJoin="round"
          closed={false}
        />
      ))}
      {geometry.circles.map((circle, i) => (
        <Circle
          key={i}
          x={circle.x}
          y={circle.y}
          radius={circle.radius}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ))}
    </Group>
  );
}

// -- vrije tekenvormen ---------------------------------------------------------

/**
 * Rechthoek/driehoek/cirkel — getekend op lokale (0,0), net als de andere
 * kinds hier: de omringende Group in GymCanvas.tsx staat al op x/y/rotation/
 * scaleX/scaleY, dus hier is geen verdere offset-berekening nodig. Cirkel
 * gebruikt Ellipse (radiusX/radiusY) i.p.v. Circle met één straal: zo blijft
 * een NIET-uniforme schaling (Shift+hoek-handle, zie ShapeDiagramElement in
 * gym-canvas-types.ts) een ellips i.p.v. dat de twee assen tegen elkaar in
 * zouden werken. Driehoek is geen Konva RegularPolygon (die kent alleen één
 * radius, dus geen onafhankelijke breedte/hoogte) maar een losse Line met 3
 * punten, gesloten — een gelijkzijdige driehoek bij de standaard-breedte/
 * hoogte uit SHAPE_DEFAULT_SIZE (GymCanvas.tsx), en gewoon een andere
 * driehoek zodra breedte/hoogte apart worden aangepast.
 */
function ShapeElementIcon({ element }: { element: ShapeDiagramElement }) {
  const { width: w, height: h, fill, stroke, strokeWidth } = element;

  if (element.shape === "rectangle") {
    return (
      <Rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  if (element.shape === "circle") {
    return (
      <Ellipse
        radiusX={w / 2}
        radiusY={h / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    );
  }

  return (
    <Line
      points={[0, -h / 2, -w / 2, h / 2, w / 2, h / 2]}
      closed
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      lineJoin="round"
    />
  );
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

  if (element.kind === "text") {
    return <TextElementIcon element={element} />;
  }

  if (element.kind === "field_preset") {
    return <FieldPresetElementIcon element={element} />;
  }

  if (element.kind === "shape") {
    return <ShapeElementIcon element={element} />;
  }

  // "line" wordt niet via dit pad getekend — zie LineElementNode in
  // GymCanvas.tsx, dat lijnen/pijlen buiten de gedeelde Group/Transformer-
  // schaling om rendert (zie de typecommentaar bij LineDiagramElement).
  if (element.kind === "line") return null;

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
