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
  supportOffsetOf,
  type DimsLookup,
  type Point2D,
  type SnapGridSize,
} from "@/components/canvas-3d/floorplan3d-geometry";
import { footprintCenter, isElevated } from "@/components/canvas-3d/collision-shape";
import { isTilted, itemIsTilted, rotationOf } from "@/components/canvas-3d/orientation";
import { layerOf, overlapWarns, staysAtOwnHeight, type CollisionLayer } from "@/lib/constants/collisionRules";
import {
  EPS_M,
  OVERLAP_IGNORE_M,
  SNAP_EDGE_M,
  STACK_OVERLAP_MIN,
} from "@/components/canvas-3d/placement-config";

export type PlacementMode = "stack" | "edge" | "grid" | "none";

/** Zachte waarschuwing bij een plaatsing: de plaatsing zelf blijft zoals de docent hem neerzet. */
export type PlacementWarning =
  | { kind: "overlap"; withSlug: string; withId: string }
  | { kind: "outside" };

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
  /** Er is een overlap die volgens de botsingsregels een waarschuwing verdient (lib/constants/collisionRules.ts).
   * Alleen een waarschuwing: de positie wordt NOOIT aangepast. */
  blocked: boolean;
  /** Alle waarschuwingen (overlap per item, of: het item past niet in de zaal). */
  warnings: PlacementWarning[];
  /** Laag van het gesleepte item (botsingsregels). */
  layer: CollisionLayer;
  guides: SnapGuide[];
  /** Eén regel voor de debug-log: "stack op <slug>", "rand-snap naar <slug>", "raster". */
  log: string;
};

export type PlacementInput = {
  /** Gewenste positie van de pivot van het item (ruwe pointerpositie, vóór snappen). */
  pointer: Point2D;
  dragged: { slug: string; rot_y_deg: number; rot_x_deg?: number; rot_z_deg?: number; lift_m?: number; size?: Floorplan3dItem["size"] };
  /** Alle andere items (het gesleepte item zelf niet meegeven). */
  others: Floorplan3dItem[];
  room: Floorplan3dRoom;
  grid: SnapGridSize;
  lookup: DimsLookup;
  /** @deprecated Geen effect meer: preview en commit zijn dezelfde berekening en een plek wordt nooit pas bij loslaten aangepast. */
  final?: boolean;
  /** Waarschuwen bij overlap (standaard aan). Uit = botsing negeren (schakelaar of Alt tijdens het slepen). */
  collisions?: boolean;
  /** Snappen aan raster en randen (standaard aan). Uit = vrij plaatsen (Alt tijdens het slepen). */
  snap?: boolean;
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
  const { pointer, dragged, others, room, lookup } = input;
  const snapOn = input.snap !== false;
  const warnOn = input.collisions !== false;
  const grid: SnapGridSize = snapOn ? input.grid : 0;
  const dims = dimsOf({ slug: dragged.slug, size: dragged.size } as Floorplan3dItem, lookup);
  const shape = shapeOfDims(dims);
  const rot = dragged.rot_y_deg;
  const rot3 = rotationOf(dragged);
  const tilted = isTilted(rot3);
  const lift = dragged.lift_m ?? 0;
  // Puur visueel materiaal botst nergens mee; hangend materiaal (touwen, ringen,
  // netten) staat nooit op iets en wordt ook nergens door gedragen. Een gekanteld
  // item rust met zijn laagste punt op de vloer en stapelt niet.
  const collides = shape.kind !== "none";
  const layer = layerOf(dragged.slug, isElevated(shape));
  const canStack = collides && !isElevated(shape) && !tilted && !staysAtOwnHeight(dragged.slug, layer);
  const draggedRight = !tilted && isRightAngle(effectiveAngle(rot, shape.yaw_deg));

  const rawPolygons = polygonsAt(shape, pointer.x, pointer.z, rot3);
  const rawArea = polygonsArea(rawPolygons);
  const rawCenter = footprintCenter(shape, pointer.x, pointer.z, rot);

  // --- 1. Stapelen: op de RUWE positie, vóór enige snap. -----------------
  const stackBases: Floorplan3dItem[] = [];
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
      // Klein materiaal (bal, pion, hoepel) ligt op bijna alles; de rest alleen op stapelbare items.
      // Een niet-stapelbaar item eronder is geen blokkade: de overlap krijgt hieronder hooguit een waarschuwing.
      if (dimsOf(other, lookup).stackable || (layer === "klein" && layerOf(other.slug) !== "klein" && layerOf(other.slug) !== "vloer")) stackBases.push(other);
    }
  }

  const stacking = stackBases.length > 0;
  // Onderkant van het item op de bovenkant van de hoogste basis.
  const restY = floorY(shape, rot3, lift);
  // Een zittende leerling rust met zijn zitvlak op de ondergrond (nooit onder de vloer: is de bank lager dan het zitvlak, dan staat hij op de vloer).
  const y = stacking ? Math.max(restY, Math.max(...stackBases.map((base) => itemVerticalRange(base, lookup)[1])) - supportOffsetOf(dims) + lift) : restY;
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

  // Hangend/overspannend materiaal (net, touw) snapt alleen aan muren, nooit aan banken of andere items.
  if (draggedRight && layer !== "overspannend") {
    for (const { base, abut } of candidates) {
      const baseShape = shapeOfDims(dimsOf(base, lookup));
      if (itemIsTilted(base)) continue;
      if (!isRightAngle(effectiveAngle(base.rot_y_deg, baseShape.yaw_deg))) continue;
      const polygons = itemPolygons(base, lookup);
      if (polygons.length === 0) continue;
      snapTargets.push({ slug: base.slug, abut, aabb: polygonsAabb(polygons) });
    }
  }

  const xCorrection = snapOn ? bestCorrection(axisCorrections("x", own, snapTargets, room)) : null;
  const zCorrection = snapOn ? bestCorrection(axisCorrections("z", own, snapTargets, room)) : null;

  // --- 3. Raster: alleen op assen zonder rand-snap. -----------------------
  const snapAxis = (value: number, correction: Correction | null) =>
    correction ? value + correction.delta : grid === 0 ? value : Math.round(value / grid) * grid;

  const halfRoomX = room.width_m / 2;
  const halfRoomZ = room.length_m / 2;
  let x = snapAxis(pointer.x, xCorrection);
  let z = snapAxis(pointer.z, zCorrection);

  // Blijf binnen de zaal als het item past; een item dat breder is dan de zaal (net van 10 m in een kleine zaal)
  // wordt NIET naar binnen geduwd maar krijgt een waarschuwing: het midden blijft in de zaal.
  const warnings: PlacementWarning[] = [];
  if (collides) {
    const fitsX = extent.maxX - extent.minX <= room.width_m + 1e-9;
    const fitsZ = extent.maxZ - extent.minZ <= room.length_m + 1e-9;
    if (fitsX) x = Math.min(Math.max(x, -halfRoomX - extent.minX), halfRoomX - extent.maxX);
    else x = Math.min(Math.max(x + (extent.minX + extent.maxX) / 2, -halfRoomX), halfRoomX) - (extent.minX + extent.maxX) / 2;
    if (fitsZ) z = Math.min(Math.max(z, -halfRoomZ - extent.minZ), halfRoomZ - extent.maxZ);
    else z = Math.min(Math.max(z + (extent.minZ + extent.maxZ) / 2, -halfRoomZ), halfRoomZ) - (extent.minZ + extent.maxZ) / 2;
    if (!fitsX || !fitsZ) warnings.push({ kind: "outside" });
  }

  const guides = [xCorrection, zCorrection].flatMap((c) => (c ? [c.guide] : []));
  const edgeTargets = [xCorrection, zCorrection].flatMap((c) => (c ? [c.targetSlug] : []));

  // --- 4. Overlap: alleen een waarschuwing, nooit een verplaatsing. -------
  const finalPolygons = polygonsAt(shape, x, z, rot3);
  const collidesWith = (other: Floorplan3dItem) =>
    tilted || itemIsTilted(other)
      ? shapesCollide(
          { shape, pos: [x, y, z], rot: rot3 },
          { shape: shapeOfDims(dimsOf(other, lookup)), pos: [other.x, other.y, other.z], rot: rotationOf(other) },
        )
      : polygonsOverlap(finalPolygons, itemPolygons(other, lookup));
  if (collides && warnOn) {
    for (const other of others) {
      if (!sameHeight(other) || stackBases.includes(other)) continue;
      const otherShape = shapeOfDims(dimsOf(other, lookup));
      if (otherShape.kind === "none") continue;
      if (!overlapWarns(layer, layerOf(other.slug, isElevated(otherShape)))) continue;
      if (collidesWith(other)) warnings.push({ kind: "overlap", withSlug: other.slug, withId: other.id });
    }
  }
  const blocked = warnings.some((warning) => warning.kind === "overlap");

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
    warnings,
    layer,
    guides,
    log: parts.length > 0 ? parts.join(" + ") : "vrij (geen snap)",
  };
}
