// Pure plaatsingslogica voor de 3D-editor: waar komt een gesleept item
// terecht (stapelen, rand-snap, raster)? Geen React/three — zie
// resolvePlacement.test.ts. Drempels staan in placement-config.ts.
//
// Volgorde (belangrijk): 1) bepaal op de ruwe pointerpositie of het item
// stapelt, 2) snap daarna pas randen (nooit andersom — een rand-snap mag
// het stapelen niet verstoren), 3) raster alleen op assen zonder rand-snap.

import type { Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import {
  dimsOf,
  extentsFor,
  findNearestFreeSpot,
  floorY,
  itemPolygons,
  itemVerticalRange,
  pointInPolygons,
  polygonsAabb,
  polygonsArea,
  polygonsOverlap,
  polygonsOverlapArea,
  polygonsAt,
  polygonsOverlapDepth,
  rangeFor,
  shapeOfDims,
  shapesCollide,
  type DimsLookup,
  type Point2D,
  type SnapGridSize,
} from "@/components/canvas-3d/floorplan3d-geometry";
import { footprintCenter, isElevated } from "@/components/canvas-3d/collision-shape";
import { isTilted, itemIsTilted, rotationOf } from "@/components/canvas-3d/orientation";
import {
  EPS_M,
  OVERLAP_IGNORE_M,
  SNAP_EDGE_M,
  STACK_OVERLAP_MIN,
} from "@/components/canvas-3d/placement-config";

export type PlacementMode = "stack" | "edge" | "grid" | "none" | "relocated";

/** Eén snaplijn voor de debug-weergave: een rand op `at` (langs `axis`),
 * getekend van `from` tot `to` op de andere as. `targetSlug` is null voor een muur. */
export type SnapGuide = {
  axis: "x" | "z";
  at: number;
  from: number;
  to: number;
  targetSlug: string | null;
};

export type PlacementResult = {
  x: number;
  y: number;
  z: number;
  mode: PlacementMode;
  /** Slugs van de items waarop gestapeld wordt. */
  stackedOn: string[];
  /** Waar naartoe gesnapt is: slug van het item, of null voor een muur. */
  edgeTargets: (string | null)[];
  /** Er blijft een significante overlap met een item waarop NIET gestapeld
   * kan worden (bv. niet-stapelbaar). Bij `final` is dat al opgelost. */
  blocked: boolean;
  guides: SnapGuide[];
  /** Eén regel voor de debug-log: "stack op <slug>", "rand-snap naar <slug>", "raster". */
  log: string;
};

export type PlacementInput = {
  /** Gewenste positie van de pivot van het item (ruwe pointerpositie, vóór snappen). */
  pointer: Point2D;
  dragged: { slug: string; rot_y_deg: number; rot_x_deg?: number; rot_z_deg?: number; lift_m?: number };
  /** Alle andere items (het gesleepte item zelf niet meegeven). */
  others: Floorplan3dItem[];
  room: Floorplan3dRoom;
  grid: SnapGridSize;
  lookup: DimsLookup;
  /** true bij loslaten: een geblokkeerde plek wordt vervangen door de
   * dichtstbijzijnde vrije plek ernaast. Tijdens het slepen false. */
  final?: boolean;
};

function round(value: number): number {
  // Wegwerken van drijvende-komma-ruis (cos(90°) ≠ 0) zodat "0 mm spleet"
  // ook echt 0 is.
  return Math.round(value * 1e6) / 1e6;
}

function isRightAngle(rotDeg: number): boolean {
  const rest = ((rotDeg % 90) + 90) % 90;
  return rest < 1e-6 || 90 - rest < 1e-6;
}

type Aabb = { minX: number; maxX: number; minZ: number; maxZ: number };
type Correction = { delta: number; guide: SnapGuide; targetSlug: string | null };

function bestCorrection(candidates: Correction[]): Correction | null {
  let best: Correction | null = null;
  for (const candidate of candidates) {
    if (Math.abs(candidate.delta) > SNAP_EDGE_M + 1e-9) continue;
    if (!best || Math.abs(candidate.delta) < Math.abs(best.delta) - 1e-9) best = candidate;
  }
  return best;
}

/** Rand-snapkandidaten op één as. `own` is de AABB van het gesleepte item. */
function axisCorrections(
  axis: "x" | "z",
  own: Aabb,
  targets: { slug: string; aabb: Aabb; abut: boolean }[],
  room: Floorplan3dRoom,
): Correction[] {
  const minKey = axis === "x" ? "minX" : "minZ";
  const maxKey = axis === "x" ? "maxX" : "maxZ";
  const crossMin = axis === "x" ? "minZ" : "minX";
  const crossMax = axis === "x" ? "maxZ" : "maxX";
  const halfRoom = (axis === "x" ? room.width_m : room.length_m) / 2;
  const out: Correction[] = [];

  function push(delta: number, at: number, slug: string | null, spanFrom: number, spanTo: number) {
    out.push({ delta, targetSlug: slug, guide: { axis, at, from: spanFrom, to: spanTo, targetSlug: slug } });
  }

  for (const target of targets) {
    // Alleen echte buren: op de andere as moeten de items elkaar raken of
    // binnen snapafstand liggen, anders zou een item ver weg toch trekken.
    const gap = Math.max(own[crossMin] - target.aabb[crossMax], target.aabb[crossMin] - own[crossMax]);
    if (gap > SNAP_EDGE_M) continue;

    const from = Math.min(own[crossMin], target.aabb[crossMin]);
    const to = Math.max(own[crossMax], target.aabb[crossMax]);

    if (target.abut) {
      // Rand tegen rand: onze max tegen zijn min, onze min tegen zijn max.
      push(target.aabb[minKey] - own[maxKey], target.aabb[minKey], target.slug, from, to);
      push(target.aabb[maxKey] - own[minKey], target.aabb[maxKey], target.slug, from, to);
    }
    // Uitlijnen: min met min, max met max (gestapeld én naast elkaar).
    push(target.aabb[minKey] - own[minKey], target.aabb[minKey], target.slug, from, to);
    push(target.aabb[maxKey] - own[maxKey], target.aabb[maxKey], target.slug, from, to);
  }

  // Muren: altijd rand-snap (AABB), ook bij willekeurige rotatie.
  const spanFrom = -(axis === "x" ? room.length_m : room.width_m) / 2;
  const spanTo = -spanFrom;
  push(-halfRoom - own[minKey], -halfRoom, null, spanFrom, spanTo);
  push(halfRoom - own[maxKey], halfRoom, null, spanFrom, spanTo);

  return out;
}

/** Effectieve draaiing van de voetafdruk: draaiing van het item + draaiing van de vorm zelf. */
function effectiveAngle(rotDeg: number, yawDeg: number): number {
  return rotDeg + yawDeg;
}

export function resolvePlacement(input: PlacementInput): PlacementResult {
  const { pointer, dragged, others, room, grid, lookup } = input;
  const dims = dimsOf({ slug: dragged.slug } as Floorplan3dItem, lookup);
  const shape = shapeOfDims(dims);
  const rot = dragged.rot_y_deg;
  const rot3 = rotationOf(dragged);
  const tilted = isTilted(rot3);
  const lift = dragged.lift_m ?? 0;
  // Puur visueel materiaal botst nergens mee; hangend materiaal (touwen, ringen,
  // netten) staat nooit op iets en wordt ook nergens door gedragen. Een gekanteld
  // item rust met zijn laagste punt op de vloer en stapelt niet.
  const collides = shape.kind !== "none";
  const canStack = collides && !isElevated(shape) && !tilted;
  const draggedRight = !tilted && isRightAngle(effectiveAngle(rot, shape.yaw_deg));

  const rawPolygons = polygonsAt(shape, pointer.x, pointer.z, rot3);
  const rawArea = polygonsArea(rawPolygons);
  const rawCenter = footprintCenter(shape, pointer.x, pointer.z, rot);

  // --- 1. Stapelen: op de RUWE positie, vóór enige snap. -----------------
  const stackBases: Floorplan3dItem[] = [];
  let blockedByUnstackable = false;
  if (canStack) {
    for (const other of others) {
      // Gekantelde items zijn nooit een ondergrond; botsen met ze wordt hieronder in 3D getoetst.
      if (itemIsTilted(other)) continue;
      const otherPolygons = itemPolygons(other, lookup);
      if (polygonsOverlapDepth(rawPolygons, otherPolygons) < OVERLAP_IGNORE_M) continue;

      const otherArea = polygonsArea(otherPolygons);
      if (otherArea <= 0 || rawArea <= 0) continue;
      const ratio = polygonsOverlapArea(rawPolygons, otherPolygons) / Math.min(rawArea, otherArea);
      const stacks = ratio > STACK_OVERLAP_MIN || pointInPolygons(rawCenter, otherPolygons);
      if (!stacks) continue; // Randoverlap: wordt hieronder naast-elkaar opgelost.

      // Hangend materiaal boven de vloer is geen ondergrond én geen obstakel voor de vloer.
      if (isElevated(shapeOfDims(dimsOf(other, lookup)))) continue;
      if (dimsOf(other, lookup).stackable) stackBases.push(other);
      else blockedByUnstackable = true;
    }
  }

  const stacking = stackBases.length > 0 && !blockedByUnstackable;
  // Onderkant van het item op de bovenkant van de hoogste basis.
  const restY = floorY(shape, rot3, lift);
  const y = stacking ? Math.max(...stackBases.map((base) => itemVerticalRange(base, lookup)[1])) - shape.base_m + lift : restY;
  const ownRange = rangeFor(shape, y, rot3);
  const sameHeight = (other: Floorplan3dItem) => {
    const [lo, hi] = itemVerticalRange(other, lookup);
    return lo < ownRange[1] - EPS_M && ownRange[0] < hi - EPS_M;
  };

  // --- 2. Rand-snap (nooit het stapelen verstoren: y ligt al vast). -------
  const extent = extentsFor(shape, rot3);
  const own = {
    minX: pointer.x + extent.minX,
    maxX: pointer.x + extent.maxX,
    minZ: pointer.z + extent.minZ,
    maxZ: pointer.z + extent.maxZ,
  };

  const snapTargets: { slug: string; aabb: Aabb; abut: boolean }[] = [];
  const candidates = !collides
    ? []
    : stacking
      ? stackBases.map((base) => ({ base, abut: false }))
      : others.filter(sameHeight).map((base) => ({ base, abut: true }));

  if (draggedRight) {
    for (const { base, abut } of candidates) {
      const baseShape = shapeOfDims(dimsOf(base, lookup));
      if (itemIsTilted(base)) continue;
      if (!isRightAngle(effectiveAngle(base.rot_y_deg, baseShape.yaw_deg))) continue;
      const polygons = itemPolygons(base, lookup);
      if (polygons.length === 0) continue;
      snapTargets.push({ slug: base.slug, abut, aabb: polygonsAabb(polygons) });
    }
  }

  const xCorrection = bestCorrection(axisCorrections("x", own, snapTargets, room));
  const zCorrection = bestCorrection(axisCorrections("z", own, snapTargets, room));

  // --- 3. Raster: alleen op assen zonder rand-snap. -----------------------
  const snapAxis = (value: number, correction: Correction | null) =>
    correction ? value + correction.delta : grid === 0 ? value : Math.round(value / grid) * grid;

  const halfRoomX = room.width_m / 2;
  const halfRoomZ = room.length_m / 2;
  let x = snapAxis(pointer.x, xCorrection);
  let z = snapAxis(pointer.z, zCorrection);

  // Blijf binnen de kamer, ook na snapping (de voetafdruk kan t.o.v. de pivot verschoven zijn).
  if (collides) {
    x = Math.min(Math.max(x, -halfRoomX - extent.minX), halfRoomX - extent.maxX);
    z = Math.min(Math.max(z, -halfRoomZ - extent.minZ), halfRoomZ - extent.maxZ);
  }

  const guides = [xCorrection, zCorrection].flatMap((c) => (c ? [c.guide] : []));
  const edgeTargets = [xCorrection, zCorrection].flatMap((c) => (c ? [c.targetSlug] : []));

  // --- 4. Blijft er een significante overlap die niet mag? ----------------
  const finalPolygons = polygonsAt(shape, x, z, rot3);
  const collidesWith = (other: Floorplan3dItem) =>
    tilted || itemIsTilted(other)
      ? shapesCollide(
          { shape, pos: [x, y, z], rot: rot3 },
          { shape: shapeOfDims(dimsOf(other, lookup)), pos: [other.x, other.y, other.z], rot: rotationOf(other) },
        )
      : polygonsOverlap(finalPolygons, itemPolygons(other, lookup));
  const blocked =
    collides &&
    (blockedByUnstackable || (!stacking && others.some((other) => sameHeight(other) && collidesWith(other))));

  if (blocked && input.final) {
    const spot = findNearestFreeSpot(x, z, dims, rot, others, room, lookup, { x: rot3.x, z: rot3.z, lift });
    return {
      x: round(spot.x),
      y: round(restY),
      z: round(spot.z),
      mode: "relocated",
      stackedOn: [],
      edgeTargets: [],
      blocked: false,
      guides: [],
      log: "ernaast gelegd (vrije plek)",
    };
  }

  const parts: string[] = [];
  if (stacking) parts.push(`stack op ${[...new Set(stackBases.map((b) => b.slug))].join(", ")}`);
  for (const target of new Set(edgeTargets)) parts.push(`rand-snap naar ${target ?? "muur"}`);
  if (grid !== 0 && (!xCorrection || !zCorrection)) parts.push("raster");

  const mode: PlacementMode = stacking
    ? "stack"
    : edgeTargets.length > 0
      ? "edge"
      : grid !== 0
        ? "grid"
        : "none";

  return {
    x: round(x),
    y: round(y),
    z: round(z),
    mode,
    stackedOn: stacking ? [...new Set(stackBases.map((base) => base.slug))] : [],
    edgeTargets,
    blocked,
    guides,
    log: parts.length > 0 ? parts.join(" + ") : "vrij (geen snap)",
  };
}
