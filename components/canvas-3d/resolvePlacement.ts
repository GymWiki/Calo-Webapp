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
  findNearestFreeSpot,
  footprintAabb,
  footprintCorners,
  footprintOverlapDepth,
  footprintsOverlap,
  itemFootprint,
  overlapArea,
  pointInFootprint,
  polygonArea,
  type DimsLookup,
  type Point2D,
  type SnapGridSize,
} from "@/components/canvas-3d/floorplan3d-geometry";
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
  /** Gewenst middelpunt (ruwe pointerpositie, vóór snappen). */
  pointer: Point2D;
  dragged: { slug: string; rot_y_deg: number };
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

type Aabb = ReturnType<typeof footprintAabb>;
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

export function resolvePlacement(input: PlacementInput): PlacementResult {
  const { pointer, dragged, others, room, grid, lookup } = input;
  const dims = dimsOf({ slug: dragged.slug } as Floorplan3dItem, lookup);
  const rot = dragged.rot_y_deg;
  const draggedRight = isRightAngle(rot);

  const rawFootprint = footprintCorners(pointer.x, pointer.z, dims.length_m, dims.width_m, rot);
  const rawArea = polygonArea(rawFootprint);

  // --- 1. Stapelen: op de RUWE positie, vóór enige snap. -----------------
  const stackBases: Floorplan3dItem[] = [];
  let blockedByUnstackable = false;
  for (const other of others) {
    const otherFootprint = itemFootprint(other, lookup);
    if (footprintOverlapDepth(rawFootprint, otherFootprint) < OVERLAP_IGNORE_M) continue;

    const otherArea = polygonArea(otherFootprint);
    const ratio = overlapArea(rawFootprint, otherFootprint) / Math.min(rawArea, otherArea);
    const stacks = ratio > STACK_OVERLAP_MIN || pointInFootprint(pointer, otherFootprint);
    if (!stacks) continue; // Randoverlap: wordt hieronder naast-elkaar opgelost.

    if (dimsOf(other, lookup).stackable) stackBases.push(other);
    else blockedByUnstackable = true;
  }

  const stacking = stackBases.length > 0 && !blockedByUnstackable;
  const y = stacking
    ? Math.max(...stackBases.map((base) => base.y + dimsOf(base, lookup).height_m))
    : 0;

  // --- 2. Rand-snap (nooit het stapelen verstoren: y ligt al vast). -------
  const own = footprintAabb(pointer.x, pointer.z, dims.length_m, dims.width_m, rot);

  const snapTargets: { slug: string; aabb: Aabb; abut: boolean }[] = [];
  const candidates = stacking
    ? stackBases.map((base) => ({ base, abut: false }))
    : others
        .filter((other) => {
          // Alleen items op dezelfde hoogte (verticale overlap) zijn buren.
          const otherDims = dimsOf(other, lookup);
          return other.y < y + dims.height_m - EPS_M && y < other.y + otherDims.height_m - EPS_M;
        })
        .map((base) => ({ base, abut: true }));

  if (draggedRight) {
    for (const { base, abut } of candidates) {
      if (!isRightAngle(base.rot_y_deg)) continue;
      const baseDims = dimsOf(base, lookup);
      snapTargets.push({
        slug: base.slug,
        abut,
        aabb: footprintAabb(base.x, base.z, baseDims.length_m, baseDims.width_m, base.rot_y_deg),
      });
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

  // Blijf binnen de kamer, ook na snapping.
  const halfExtentX = (own.maxX - own.minX) / 2;
  const halfExtentZ = (own.maxZ - own.minZ) / 2;
  x = Math.min(Math.max(x, -halfRoomX + halfExtentX), halfRoomX - halfExtentX);
  z = Math.min(Math.max(z, -halfRoomZ + halfExtentZ), halfRoomZ - halfExtentZ);

  const guides = [xCorrection, zCorrection].flatMap((c) => (c ? [c.guide] : []));
  const edgeTargets = [xCorrection, zCorrection].flatMap((c) => (c ? [c.targetSlug] : []));

  // --- 4. Blijft er een significante overlap die niet mag? ----------------
  const finalFootprint = footprintCorners(x, z, dims.length_m, dims.width_m, rot);
  const blocked =
    blockedByUnstackable ||
    (!stacking &&
      others.some((other) => {
        const otherDims = dimsOf(other, lookup);
        const verticalOverlap = other.y < dims.height_m - EPS_M && 0 < other.y + otherDims.height_m - EPS_M;
        return verticalOverlap && footprintsOverlap(finalFootprint, itemFootprint(other, lookup));
      }));

  if (blocked && input.final) {
    const spot = findNearestFreeSpot(x, z, dims, rot, others, room, lookup);
    return {
      x: round(spot.x),
      y: 0,
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
