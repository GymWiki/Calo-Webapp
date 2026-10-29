// "Zoom op de inhoud" voor de alleen-lezen plattegrond-viewer (en de thumbnails): de camera kadert niet meer op de hele zaal maar op
// wat er echt staat — items, leerlingen en afgezette velden — zodat een docent in één oogopslag ziet wat de bedoeling is.
// Pure functies, geen React/three: zie viewer-framing.test.ts.
//
//   computeFraming({ items, fields, room, aspect, mode })  → stand (richting, doelpunt, zichtbare breedte in meters)
//   initialViewFor(...)                                    → de ViewState waarmee de viewer start en waar "Reset" naar terugkeert
//   wallsToHide(...)                                       → welke muren tussen camera en inhoud zitten (die worden weggelaten)
//
// De viewer is orthografisch: "zoom" = pixels per meter = viewportbreedte / zichtbareBreedte. `visibleWidthM` bevat de marge.

import { fieldBounds } from "@/components/canvas-3d/cone-field";
import { GYM_LAYOUTS, DEFAULT_GYM_LAYOUT, type GymLayoutId, type WallSide } from "@/components/canvas-3d/environments";
import { itemPolygons, itemVerticalRange, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import {
  AZIMUTH_3D_DEG,
  DEFAULT_VIEW,
  POLAR_3D_DEG,
  POLAR_TOP_DEG,
  cameraPosition,
  cross,
  dot,
  normalize,
  viewDirection,
  type ViewPreset,
  type ViewState,
} from "@/components/plattegrond/viewer-camera";
import type { ConeField, Floorplan3dEnvironment, Floorplan3dItem } from "@/types/floorplan3d";

/** Keuze per plattegrond: "auto" laat de viewer kiezen (zie `suggestViewMode`). */
export type ViewMode = "auto" | "3d" | "top";
export const VIEW_MODES: readonly ViewMode[] = ["auto", "3d", "top"];

/** Marge rond de inhoud: 1,2 = de inhoud vult ±83% van de breedte of hoogte. */
export const FRAMING_MARGIN = 1.2;
/** Kleinste kader (m): één pion of één leerling mag niet tot een absurde zoom leiden. */
export const MIN_SPAN_X_M = 6;
export const MIN_SPAN_Z_M = 4;
/** Items hoger dan dit (m) maken de opstelling "ruimtelijk": dan is de schuine 3D-weergave het duidelijkst. */
export const FLAT_LAYOUT_MAX_HEIGHT_M = 0.9;
/** Hoogste punt dat we in het kader meenemen (hoge palen/doelen niet laten bepalen hoe ver we uitzoomen). */
const MAX_FRAMED_HEIGHT_M = 4;
/** De zoom houdt rekening met een beetje slepen (graden), zodat de inhoud niet meteen uit beeld draait. */
const DRAG_SPREAD_3D_DEG = 12;
const AZIMUTH_CANDIDATES_DEG = [AZIMUTH_3D_DEG, 20, 0];
/** Een andere kijkrichting dan de standaard (45°) moet minstens zoveel kleiner kader geven om gekozen te worden. */
const AZIMUTH_GAIN = 0.92;

export type ContentBounds = { minX: number; maxX: number; minZ: number; maxZ: number; maxY: number };
type Vec3 = [number, number, number];

export type FramingInput = {
  items: readonly Floorplan3dItem[];
  fields?: readonly ConeField[];
  room: { width_m: number; length_m: number };
  /** Breedte / hoogte van het zichtbare kader. */
  aspect: number;
  mode?: ViewMode;
  lookup?: DimsLookup;
  /** Vaste kijkrichting (graden); zonder: de beste uit enkele kandidaten (alleen 3D). */
  azimuthDeg?: number;
  /** Vaste kantelhoek (graden vanaf verticaal); zonder: die van de gekozen weergave. */
  polarDeg?: number;
  margin?: number;
};

export type Framing = {
  mode: ViewPreset;
  azimuthDeg: number;
  polarDeg: number;
  /** Punt waar de camera naar kijkt (midden van de inhoud). */
  target: Vec3;
  /** Camerapositie op `distance` van het doelpunt. */
  position: Vec3;
  /** Zichtbare breedte/hoogte (m) inclusief marge; de orthografische zoom is viewportbreedte / visibleWidthM. */
  visibleWidthM: number;
  visibleHeightM: number;
  /** De omhullende van de inhoud (of van de hele zaal als er niets staat). */
  bounds: ContentBounds;
  /** Er staat niets: de hele zaal is ingekaderd. */
  empty: boolean;
};

/** Omhullende (XZ + hoogste punt) van alle items en velden, of null als er niets staat. */
export function contentBounds(items: readonly Floorplan3dItem[], fields: readonly ConeField[] = [], lookup?: DimsLookup): ContentBounds | null {
  let bounds: ContentBounds | null = null;
  const add = (b: ContentBounds) => {
    bounds = bounds
      ? { minX: Math.min(bounds.minX, b.minX), maxX: Math.max(bounds.maxX, b.maxX), minZ: Math.min(bounds.minZ, b.minZ), maxZ: Math.max(bounds.maxZ, b.maxZ), maxY: Math.max(bounds.maxY, b.maxY) }
      : b;
  };
  for (const item of items) {
    if (lookup) {
      const points = itemPolygons(item, lookup).flat();
      if (points.length > 0) {
        const xs = points.map((p) => p.x);
        const zs = points.map((p) => p.z);
        add({ minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs), maxY: Math.min(MAX_FRAMED_HEIGHT_M, Math.max(0.1, itemVerticalRange(item, lookup)[1])) });
        continue;
      }
    }
    add({ minX: item.x - 0.5, maxX: item.x + 0.5, minZ: item.z - 0.5, maxZ: item.z + 0.5, maxY: Math.min(MAX_FRAMED_HEIGHT_M, item.y + 1) });
  }
  for (const field of fields) {
    const b = fieldBounds(field);
    add({ minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ, maxY: 0.3 });
  }
  return bounds;
}

/** "auto": een vlakke indeling (veld afzetten, circuit met lage toestellen) is het duidelijkst van boven; ruimtelijke opstellingen (netten, doelen, leerlingen) schuin. */
export function suggestViewMode(items: readonly Floorplan3dItem[], fields: readonly ConeField[] = [], lookup?: DimsLookup): ViewPreset {
  if (items.length === 0) return fields.length > 0 ? "top" : "3d";
  const tallest = Math.max(...items.map((item) => (lookup ? itemVerticalRange(item, lookup)[1] - item.y : 1)));
  return tallest <= FLAT_LAYOUT_MAX_HEIGHT_M ? "top" : "3d";
}

export function resolveViewMode(mode: ViewMode | undefined, items: readonly Floorplan3dItem[], fields: readonly ConeField[] = [], lookup?: DimsLookup): ViewPreset {
  return mode === "3d" || mode === "top" ? mode : suggestViewMode(items, fields, lookup);
}

/** Het kader nooit kleiner dan MIN_SPAN (rond het midden), en niet groter dan nodig. */
function padBounds(bounds: ContentBounds): ContentBounds {
  const growX = Math.max(0, MIN_SPAN_X_M - (bounds.maxX - bounds.minX)) / 2;
  const growZ = Math.max(0, MIN_SPAN_Z_M - (bounds.maxZ - bounds.minZ)) / 2;
  return { ...bounds, minX: bounds.minX - growX, maxX: bounds.maxX + growX, minZ: bounds.minZ - growZ, maxZ: bounds.maxZ + growZ };
}

/** Breedte/hoogte (m) van de projectie van de box in het beeldvlak van een camera met deze richting. */
export function projectedSpan(bounds: ContentBounds, azimuthDeg: number, polarDeg: number): { width: number; height: number } {
  const d = viewDirection(azimuthDeg, polarDeg);
  const right = normalize(cross(d, [0, 1, 0]));
  const up = normalize(cross(right, d));
  const heights = polarDeg < 5 ? [0] : [0, bounds.maxY];
  const rs: number[] = [];
  const us: number[] = [];
  for (const x of [bounds.minX, bounds.maxX]) for (const z of [bounds.minZ, bounds.maxZ]) for (const y of heights) {
    const corner: Vec3 = [x, y, z];
    rs.push(dot(corner, right));
    us.push(dot(corner, up));
  }
  return { width: Math.max(...rs) - Math.min(...rs), height: Math.max(...us) - Math.min(...us) };
}

/** Zichtbare breedte (m) zodat de box met marge in een kader met deze aspect past, over een klein sleepbereik. */
function visibleWidthFor(bounds: ContentBounds, azimuthDeg: number, polarDeg: number, aspect: number, margin: number, spreadDeg: number): number {
  const azimuths = spreadDeg > 0 ? [azimuthDeg - spreadDeg, azimuthDeg, azimuthDeg + spreadDeg] : [azimuthDeg];
  let widest = 0;
  for (const az of azimuths) {
    const span = projectedSpan(bounds, az, polarDeg);
    widest = Math.max(widest, span.width * margin, span.height * margin * aspect);
  }
  return widest;
}

export function computeFraming(input: FramingInput): Framing {
  const { items, fields = [], room, mode = "auto", lookup, margin = FRAMING_MARGIN } = input;
  const aspect = Number.isFinite(input.aspect) && input.aspect > 0.2 ? input.aspect : 1.6;
  const content = contentBounds(items, fields, lookup);
  const empty = content === null;
  // Lege zaal: val terug op de hele zaal.
  const bounds = padBounds(content ?? { minX: -room.width_m / 2, maxX: room.width_m / 2, minZ: -room.length_m / 2, maxZ: room.length_m / 2, maxY: 0.5 });
  const preset = resolveViewMode(mode, items, fields, lookup);
  const polarDeg = input.polarDeg ?? (preset === "top" ? POLAR_TOP_DEG : POLAR_3D_DEG);
  const spread = preset === "3d" ? DRAG_SPREAD_3D_DEG : 0;

  let azimuthDeg = input.azimuthDeg ?? (preset === "top" ? 0 : AZIMUTH_3D_DEG);
  let visibleWidthM = visibleWidthFor(bounds, azimuthDeg, polarDeg, aspect, margin, spread);
  if (input.azimuthDeg === undefined && preset === "3d") {
    // Een langgerekte opstelling vult het kader beter onder een rechtere kijkhoek; de standaard (45°) blijft tenzij het merkbaar wint.
    for (const candidate of AZIMUTH_CANDIDATES_DEG.slice(1)) {
      const width = visibleWidthFor(bounds, candidate, polarDeg, aspect, margin, spread);
      if (width < visibleWidthM * AZIMUTH_GAIN) {
        azimuthDeg = candidate;
        visibleWidthM = width;
      }
    }
  }

  const target: Vec3 = [(bounds.minX + bounds.maxX) / 2, preset === "top" ? 0 : bounds.maxY / 2, (bounds.minZ + bounds.maxZ) / 2];
  clampToRoom(target, azimuthDeg, visibleWidthM, visibleWidthM / aspect, room);
  const distance = Math.max(room.width_m, room.length_m, 10) * 3 + 30;
  const offset = cameraPosition(azimuthDeg, polarDeg, distance);
  return {
    mode: preset,
    azimuthDeg,
    polarDeg,
    target,
    position: [target[0] + offset[0], target[1] + offset[1], target[2] + offset[2]],
    visibleWidthM,
    visibleHeightM: visibleWidthM / aspect,
    bounds,
    empty,
  };
}

/**
 * Houdt het kader binnen de zaal (geen leeg wit naast de vloer) als de camera recht op een wand kijkt (azimut 0/90/180/270°) en het
 * kader in de zaal past. Bij schuine kijkrichtingen blijft het doelpunt op het midden van de inhoud.
 */
function clampToRoom(target: Vec3, azimuthDeg: number, visibleWidthM: number, _visibleHeightM: number, room: { width_m: number; length_m: number }): void {
  const rad = (azimuthDeg * Math.PI) / 180;
  const alongX = Math.abs(Math.cos(rad)) > 0.99; // horizontaal op het scherm = x
  const alongZ = Math.abs(Math.sin(rad)) > 0.99; // horizontaal op het scherm = z
  const half = visibleWidthM / 2;
  if (alongX && visibleWidthM < room.width_m) target[0] = Math.min(Math.max(target[0], -room.width_m / 2 + half), room.width_m / 2 - half);
  else if (alongZ && visibleWidthM < room.length_m) target[2] = Math.min(Math.max(target[2], -room.length_m / 2 + half), room.length_m / 2 - half);
}

/** Hoeveel van het kader de inhoud vult (0–1+): het grootste aandeel van breedte of hoogte, zonder marge. Boven 1 = afgesneden. */
export function framingFill(framing: Pick<Framing, "bounds" | "azimuthDeg" | "polarDeg" | "visibleWidthM" | "visibleHeightM">): number {
  const span = projectedSpan(framing.bounds, framing.azimuthDeg, framing.polarDeg);
  return Math.max(span.width / framing.visibleWidthM, span.height / framing.visibleHeightM);
}

/** De begin-ViewState van een plattegrond: gekozen weergave en kijkrichting; "Reset" keert hiernaar terug. */
export function initialViewFor(input: Omit<FramingInput, "azimuthDeg">): ViewState {
  const framing = computeFraming(input);
  return framing.mode === "3d" ? { ...DEFAULT_VIEW, preset: "3d", azimuthBase: framing.azimuthDeg } : { ...DEFAULT_VIEW, preset: "top" };
}

/** Voor `poseFor`: de stand bij een vaste richting (de viewer bepaalt azimut/polar via de ViewState). */
export function framingContent(input: Omit<FramingInput, "aspect" | "azimuthDeg" | "mode">) {
  return {
    framing: (azimuthDeg: number, polarDeg: number, aspect: number) =>
      computeFraming({ ...input, aspect, azimuthDeg, polarDeg, mode: polarDeg < 5 ? "top" : "3d" }),
  };
}

// ----------------------------------------------------------------------------
// Muren tussen camera en inhoud
// ----------------------------------------------------------------------------

/** Welke wanden staan voor de camera? Die zouden de inhoud afdekken en worden weggelaten (alleen schuine weergave). */
export function wallsToHide(azimuthDeg: number, preset: ViewPreset): WallSide[] {
  if (preset === "top") return [];
  const rad = (azimuthDeg * Math.PI) / 180;
  // Camera staat op (sin az, cos az): +z = voor, +x = rechts.
  const x = Math.sin(rad);
  const z = Math.cos(rad);
  const sides: WallSide[] = [];
  if (z > 0.35) sides.push("voor");
  if (z < -0.35) sides.push("achter");
  if (x > 0.35) sides.push("rechts");
  if (x < -0.35) sides.push("links");
  return sides;
}

/** GLB-nodenamen van de wanden aan deze kanten (alleen de gymzaal heeft bekende wandnodes). */
export function wallNodes(environment: Pick<Floorplan3dEnvironment, "type" | "layout"> | undefined, sides: readonly WallSide[]): string[] {
  if (!environment || environment.type !== "gymzaal" || sides.length === 0) return [];
  const layout = GYM_LAYOUTS[environment.layout as GymLayoutId] ?? GYM_LAYOUTS[DEFAULT_GYM_LAYOUT];
  return layout.walls.filter((wall) => sides.includes(wall.side)).flatMap((wall) => wall.nodes);
}
