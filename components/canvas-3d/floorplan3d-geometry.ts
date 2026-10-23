// Pure, R3F/three-onafhankelijke geometrie-helpers voor de 3D-plattegrond:
// voetafdrukken, overlaptest (SAT, geen fysica), de "dichtstbijzijnde vrije
// plek"-zoekfunctie en stapelhoogtes bij laden. Plaatsen/snappen zelf:
// resolvePlacement.ts. Los van React/drei
// gehouden zodat dit zonder een canvas te renderen te doorlopen is, en
// zodat Floorplan3dEditor.tsx zich puur met orchestratie/state bezig kan
// houden.

import type { MaterialModel } from "@/types/materialModel";
import type { Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import { EPS_M, OVERLAP_IGNORE_M } from "@/components/canvas-3d/placement-config";
import { COLLISION_OVERRIDES } from "@/components/canvas-3d/collision-overrides";
import { COLLISION_PROFILES } from "@/components/canvas-3d/collision-profiles.generated";
import {
  footprintExtents,
  footprintPolygons,
  isElevated,
  resolveCollisionShape,
  rotateXZ,
  verticalRange,
  type CollisionShape,
  type ShapePart,
} from "@/components/canvas-3d/collision-shape";

/**
 * Afmetingen + collision-vorm van een asset. Alleen lengte/breedte/hoogte/
 * stackable zijn verplicht (zo blijven eenvoudige testdata en onbekende
 * assets werken); de rest komt uit de collision-vorm (collision-shape.ts):
 * middelpunt-offset t.o.v. de pivot, onderkant, draaiing van de vorm en
 * het vormtype.
 */
export type ItemDims = {
  length_m: number;
  width_m: number;
  height_m: number;
  stackable: boolean;
  kind?: CollisionShape["kind"];
  offset_x?: number;
  offset_z?: number;
  base_m?: number;
  yaw_deg?: number;
  parts?: ShapePart[];
};

/** De volledige collision-vorm van een asset (ontbrekende velden = gecentreerde box op de vloer). */
export function shapeOfDims(dims: ItemDims): CollisionShape {
  return {
    kind: dims.kind ?? "box",
    length_m: dims.length_m,
    width_m: dims.width_m,
    height_m: dims.height_m,
    offset_x: dims.offset_x ?? 0,
    offset_z: dims.offset_z ?? 0,
    base_m: dims.base_m ?? 0,
    yaw_deg: dims.yaw_deg ?? 0,
    parts: dims.parts,
    source: "db",
  };
}

/** Modellen-opzoektabel op slug — elke geometriefunctie hieronder heeft de
 * afmetingen/stackable-vlag van ELK item nodig, niet alleen van het item
 * waarmee net geïnteracteerd wordt. */
export type DimsLookup = (slug: string) => ItemDims | undefined;

/** Dims van één model: vorm uit de geometrie (profiel) of override, anders de oude box uit de database. */
export function dimsOfModel(model: MaterialModel, legacy = false): ItemDims {
  // `legacy` (alleen voor ?debug=collision-legacy): de oude, gecentreerde box uit de database — voor voor/na-vergelijkingen.
  if (legacy) return { length_m: model.length_m, width_m: model.width_m, height_m: model.height_m, stackable: model.stackable };
  const profile = COLLISION_PROFILES[model.slug];
  const shape = resolveCollisionShape({
    db: { length_m: model.length_m, width_m: model.width_m, height_m: model.height_m },
    auto: profile ? { shape: { kind: "box", ...profile.shape, source: "mesh" }, aabb: profile.aabb } : null,
    override: COLLISION_OVERRIDES[model.slug] ?? null,
  });
  return {
    length_m: shape.length_m,
    width_m: shape.width_m,
    height_m: shape.height_m,
    // Verhoogd (hangend) of puur visueel materiaal wordt nooit een ondergrond.
    stackable: model.stackable && shape.kind !== "none" && !isElevated(shape),
    kind: shape.kind,
    offset_x: shape.offset_x,
    offset_z: shape.offset_z,
    base_m: shape.base_m,
    yaw_deg: shape.yaw_deg,
    parts: shape.parts,
  };
}

export function dimsLookupFromModels(models: MaterialModel[], legacy = false): DimsLookup {
  const bySlug = new Map(models.map((model) => [model.slug, dimsOfModel(model, legacy)]));
  return (slug) => bySlug.get(slug);
}

const UNKNOWN_DIMS: ItemDims = { length_m: 0.5, width_m: 0.5, height_m: 0.5, stackable: true };

export function dimsOf(item: Floorplan3dItem, lookup: DimsLookup): ItemDims {
  return lookup(item.slug) ?? UNKNOWN_DIMS;
}

// ----------------------------------------------------------------------------
// Voetafdruk — 4 wereldhoekpunten (XZ-vlak) van een geroteerde rechthoek.
// ----------------------------------------------------------------------------

export type Point2D = { x: number; z: number };

export function footprintCorners(
  x: number,
  z: number,
  lengthM: number,
  widthM: number,
  rotYDeg: number,
): Point2D[] {
  const halfL = lengthM / 2;
  const halfW = widthM / 2;

  // Lokale hoekpunten (langs X=length, Z=width) vóór rotatie. De rotatie
  // volgt three.js (`rotation.y = +graden`), zodat de voetafdruk exact
  // samenvalt met wat de scene tekent (zie collision-shape.ts).
  const local: Point2D[] = [
    { x: -halfL, z: -halfW },
    { x: halfL, z: -halfW },
    { x: halfL, z: halfW },
    { x: -halfL, z: halfW },
  ];

  return local.map((p) => {
    const r = rotateXZ(p.x, p.z, rotYDeg);
    return { x: x + r.x, z: z + r.z };
  });
}

/** Axis-aligned bounding box van een (mogelijk geroteerde) voetafdruk —
 * gebruikt voor randsnapping en de vrije-plek-zoekfunctie. Volledige OBB-
 * tegen-OBB-randsnapping zou voor de meeste 90°-opgestelde meubels niets
 * extra opleveren (hun AABB IS hun voetafdruk) en is voor schuine hoeken
 * (±15°) een randgeval dat de eenvoud hier niet waard is. */
export function footprintAabb(x: number, z: number, lengthM: number, widthM: number, rotYDeg: number) {
  const corners = footprintCorners(x, z, lengthM, widthM, rotYDeg);
  const xs = corners.map((c) => c.x);
  const zs = corners.map((c) => c.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
}

// ----------------------------------------------------------------------------
// Overlap tussen twee geroteerde rechthoeken (XZ-vlak): SAT-indringdiepte,
// overlapoppervlak en punt-in-voetafdruk. Geen fysica, puur geometrie.
// ----------------------------------------------------------------------------

function unitAxesOf(corners: Point2D[]): Point2D[] {
  // Randnormalen van alle zijden (rechthoek, cirkel-achtige of capsule-
  // polygonen), genormaliseerd zodat de projectie-overlap in meters is.
  return corners.map((corner, index) => {
    const next = corners[(index + 1) % corners.length];
    const dx = next.x - corner.x;
    const dz = next.z - corner.z;
    const length = Math.hypot(dx, dz) || 1;
    return { x: -dz / length, z: dx / length };
  });
}

function projectOntoAxis(corners: Point2D[], axis: Point2D) {
  const dots = corners.map((c) => c.x * axis.x + c.z * axis.z);
  return { min: Math.min(...dots), max: Math.max(...dots) };
}

/** Indringdiepte (m): hoe ver de voetafdrukken minimaal in elkaar steken.
 * <= 0 betekent gescheiden of precies rakend. */
export function footprintOverlapDepth(a: Point2D[], b: Point2D[]): number {
  let depth = Infinity;
  for (const axis of [...unitAxesOf(a), ...unitAxesOf(b)]) {
    const projA = projectOntoAxis(a, axis);
    const projB = projectOntoAxis(b, axis);
    depth = Math.min(depth, Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min));
  }
  return depth;
}

/** Overlappen de voetafdrukken SIGNIFICANT? Overlap kleiner dan `minDepthM`
 * (standaard OVERLAP_IGNORE_M) telt niet, zodat rakende items en
 * afrondingsfouten nooit als "over elkaar" gelden. */
export function footprintsOverlap(a: Point2D[], b: Point2D[], minDepthM: number = OVERLAP_IGNORE_M): boolean {
  return footprintOverlapDepth(a, b) >= minDepthM;
}

function signedArea(poly: Point2D[]): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    sum += p.x * q.z - q.x * p.z;
  }
  return sum / 2;
}

export function polygonArea(poly: Point2D[]): number {
  return Math.abs(signedArea(poly));
}

/** Oppervlak van de doorsnede van twee convexe polygonen (Sutherland–Hodgman). */
export function overlapArea(subject: Point2D[], clip: Point2D[]): number {
  const clipPoly = signedArea(clip) < 0 ? [...clip].reverse() : clip;
  let output = subject;

  for (let i = 0; i < clipPoly.length && output.length > 0; i++) {
    const a = clipPoly[i];
    const b = clipPoly[(i + 1) % clipPoly.length];
    const inside = (p: Point2D) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x) >= 0;
    const intersect = (p: Point2D, q: Point2D): Point2D => {
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const denom = (b.x - a.x) * dz - (b.z - a.z) * dx;
      const t = ((b.x - a.x) * (a.z - p.z) - (b.z - a.z) * (a.x - p.x)) / denom;
      return { x: p.x + t * dx, z: p.z + t * dz };
    };

    const input = output;
    output = [];
    for (let j = 0; j < input.length; j++) {
      const current = input[j];
      const previous = input[(j + input.length - 1) % input.length];
      if (inside(current)) {
        if (!inside(previous)) output.push(intersect(previous, current));
        output.push(current);
      } else if (inside(previous)) {
        output.push(intersect(previous, current));
      }
    }
  }

  return output.length < 3 ? 0 : polygonArea(output);
}

export function pointInFootprint(point: Point2D, footprint: Point2D[]): boolean {
  const orientation = signedArea(footprint) < 0 ? -1 : 1;
  for (let i = 0; i < footprint.length; i++) {
    const a = footprint[i];
    const b = footprint[(i + 1) % footprint.length];
    const cross = ((b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x)) * orientation;
    if (cross < -EPS_M * Math.hypot(b.x - a.x, b.z - a.z)) return false;
  }
  return true;
}

/** Convexe voetafdruk-polygonen van een geplaatst item (leeg voor puur visueel materiaal). */
export function itemPolygons(item: Floorplan3dItem, lookup: DimsLookup): Point2D[][] {
  return footprintPolygons(shapeOfDims(dimsOf(item, lookup)), item.x, item.z, item.rot_y_deg);
}

/** Verticaal bereik [onder, boven] van een geplaatst item. */
export function itemVerticalRange(item: Floorplan3dItem, lookup: DimsLookup): [number, number] {
  return verticalRange(shapeOfDims(dimsOf(item, lookup)), item.y);
}

// --- Verzamelingen polygonen (een vorm kan uit meerdere delen bestaan) -------

/** Grootste indringdiepte over alle paren delen; -Infinity als een van beide leeg is. */
export function polygonsOverlapDepth(a: Point2D[][], b: Point2D[][]): number {
  let depth = -Infinity;
  for (const pa of a) for (const pb of b) depth = Math.max(depth, footprintOverlapDepth(pa, pb));
  return depth;
}

export function polygonsOverlap(a: Point2D[][], b: Point2D[][], minDepthM: number = OVERLAP_IGNORE_M): boolean {
  return polygonsOverlapDepth(a, b) >= minDepthM;
}

export function polygonsOverlapArea(a: Point2D[][], b: Point2D[][]): number {
  let area = 0;
  for (const pa of a) for (const pb of b) area += overlapArea(pa, pb);
  return area;
}

export function polygonsArea(polygons: Point2D[][]): number {
  return polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0);
}

export function pointInPolygons(point: Point2D, polygons: Point2D[][]): boolean {
  return polygons.some((polygon) => pointInFootprint(point, polygon));
}

export function polygonsAabb(polygons: Point2D[][]) {
  const points = polygons.flat();
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}

// ----------------------------------------------------------------------------
// Dichtstbijzijnde vrije plek — spiraalvormige ring-zoektocht rond een
// startpunt, puur op (significante) XZ-overlap (ongeacht stapelbaarheid: dit
// is het "leg het ernaast op de vloer"-pad, zie Stap 4.5).
// ----------------------------------------------------------------------------

export function findNearestFreeSpot(
  startX: number,
  startZ: number,
  dims: ItemDims,
  rotYDeg: number,
  otherItems: Floorplan3dItem[],
  room: Floorplan3dRoom,
  lookup: DimsLookup,
): Point2D {
  const halfL = room.width_m / 2;
  const halfW = room.length_m / 2;
  const step = 0.2; // 20cm per ring — fijn genoeg, blijft snel voor normale kamers/itemaantallen.
  const maxRings = Math.ceil(Math.max(room.width_m, room.length_m) / step) + 2;

  const shape = shapeOfDims(dims);
  const extent = footprintExtents(shape, rotYDeg);
  // Alleen items die op dezelfde hoogte staan blokkeren de plek (hangend materiaal niet).
  const ownRange = verticalRange(shape, 0);
  const blockers = otherItems.filter((other) => {
    const [lo, hi] = itemVerticalRange(other, lookup);
    return lo < ownRange[1] - EPS_M && ownRange[0] < hi - EPS_M;
  });

  function fitsAt(x: number, z: number): boolean {
    if (shape.kind !== "none") {
      if (x + extent.minX < -halfL || x + extent.maxX > halfL) return false;
      if (z + extent.minZ < -halfW || z + extent.maxZ > halfW) return false;
    }

    const candidate = footprintPolygons(shape, x, z, rotYDeg);
    return !blockers.some((other) => polygonsOverlap(candidate, itemPolygons(other, lookup)));
  }

  if (fitsAt(startX, startZ)) return { x: startX, z: startZ };

  for (let ring = 1; ring <= maxRings; ring++) {
    const radius = ring * step;
    // Bemonster de ring op 16 punten per rondgang — voldoende dicht bij de
    // gebruikte stapgrootte om geen "poorten" tussen bemonsterde hoeken te
    // missen.
    const samples = Math.max(8, ring * 4);
    for (let i = 0; i < samples; i++) {
      const angle = (i / samples) * Math.PI * 2;
      const x = startX + Math.cos(angle) * radius;
      const z = startZ + Math.sin(angle) * radius;
      if (fitsAt(x, z)) return { x, z };
    }
  }

  // Geen vrije plek gevonden binnen de kamer — leg het gewoon op de
  // oorspronkelijke plek terug i.p.v. eindeloos te zoeken of te crashen.
  return { x: startX, z: startZ };
}

// Snappen en stapelen zelf staan in resolvePlacement.ts (drempels in
// placement-config.ts).
export type SnapGridSize = 0 | 0.1 | 0.5;

/** Items die (nu, vóór een verplaatsing) op `baseId` rusten — rechtstreeks
 * of via een ander item ertussen (recursief) — zodat een stapel als geheel
 * meeverplaatst, zie Stap 4.5: "niets zweeft". */
export function findItemsResting(baseId: string, items: Floorplan3dItem[], lookup: DimsLookup): string[] {
  const base = items.find((item) => item.id === baseId);
  if (!base) return [];
  const baseTop = itemVerticalRange(base, lookup)[1];
  const basePolygons = itemPolygons(base, lookup);

  const directlyOn = items.filter(
    (item) =>
      item.id !== baseId &&
      // Een item rust op de bovenkant van de basis als zijn ONDERKANT daar ligt.
      Math.abs(itemVerticalRange(item, lookup)[0] - baseTop) < EPS_M &&
      polygonsOverlap(basePolygons, itemPolygons(item, lookup)),
  );

  const result = directlyOn.map((item) => item.id);
  for (const onTop of directlyOn) {
    result.push(...findItemsResting(onTop.id, items, lookup));
  }
  return [...new Set(result)];
}

export const ROTATION_STEP_SMALL_DEG = 15;
export const ROTATION_STEP_LARGE_DEG = 90;

export function normalizeRotationDeg(deg: number): number {
  const normalized = deg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

/**
 * Herberekent `y` voor elk item op basis van stapeloverlap — opgeslagen
 * `y`-waarden worden NOOIT blind vertrouwd bij het laden (zie Stap 4.9):
 * een model se hoogte kan sindsdien gewijzigd zijn, of de opslag kan van
 * een eerdere, iets andere berekening stammen.
 *
 * Items worden in volgorde van opgeslagen `y` (laagste eerst, daarna
 * opslagvolgorde) afgehandeld en rusten alleen op items die al aan de beurt
 * waren. Zo blijft de oorspronkelijke onder/boven-volgorde behouden; een
 * symmetrische berekening (alles tegelijk) liet twee overlappende items
 * elkaar juist omhoog duwen.
 */
export function recomputeStackedYs(items: Floorplan3dItem[], lookup: DimsLookup): Floorplan3dItem[] {
  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.y - b.item.y || a.index - b.index);

  const placed: Floorplan3dItem[] = [];
  for (const { item } of order) {
    const shape = shapeOfDims(dimsOf(item, lookup));
    // Hangend of puur visueel materiaal stapelt nooit: de pivot blijft op de vloer.
    if (shape.kind === "none" || isElevated(shape)) {
      placed.push({ ...item, y: 0 });
      continue;
    }

    const polygons = itemPolygons(item, lookup);
    let y = 0;
    for (const base of placed) {
      if (!dimsOf(base, lookup).stackable) continue;
      if (!polygonsOverlap(polygons, itemPolygons(base, lookup))) continue;
      // Onderkant van dit item op de bovenkant van de basis.
      y = Math.max(y, itemVerticalRange(base, lookup)[1] - shape.base_m);
    }
    placed.push({ ...item, y });
  }

  const yById = new Map(placed.map((item) => [item.id, item.y]));
  return items.map((item) => ({ ...item, y: yById.get(item.id) ?? 0 }));
}

/**
 * Schuift items die (deels) buiten een nieuwe ruimte vallen terug naar binnen
 * — nodig bij het wisselen van zaalindeling. Stapelhoogtes worden daarna
 * opnieuw berekend. `moved` is het aantal verplaatste items.
 */
export function clampItemsToRoom(
  items: Floorplan3dItem[],
  room: Floorplan3dRoom,
  lookup: DimsLookup,
): { items: Floorplan3dItem[]; moved: number } {
  let moved = 0;
  const clamped = items.map((item) => {
    const shape = shapeOfDims(dimsOf(item, lookup));
    if (shape.kind === "none") return item;
    // Grenzen van de voetafdruk t.o.v. de itempositie (offset en draaiing inbegrepen).
    const extent = footprintExtents(shape, item.rot_y_deg);
    const x = Math.min(Math.max(item.x, -room.width_m / 2 - extent.minX), room.width_m / 2 - extent.maxX);
    const z = Math.min(Math.max(item.z, -room.length_m / 2 - extent.minZ), room.length_m / 2 - extent.maxZ);
    if (Math.abs(x - item.x) < EPS_M && Math.abs(z - item.z) < EPS_M) return item;
    moved += 1;
    return { ...item, x, z };
  });
  return { items: moved > 0 ? recomputeStackedYs(clamped, lookup) : clamped, moved };
}
