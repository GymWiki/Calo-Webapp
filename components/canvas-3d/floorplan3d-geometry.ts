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

export type ItemDims = { length_m: number; width_m: number; height_m: number; stackable: boolean };

/** Modellen-opzoektabel op slug — elke geometriefunctie hieronder heeft de
 * afmetingen/stackable-vlag van ELK item nodig, niet alleen van het item
 * waarmee net geïnteracteerd wordt. */
export type DimsLookup = (slug: string) => ItemDims | undefined;

export function dimsLookupFromModels(models: MaterialModel[]): DimsLookup {
  const bySlug = new Map(models.map((model) => [model.slug, model]));
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
  const rad = (rotYDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Lokale hoekpunten (langs X=length, Z=width) vóór rotatie.
  const local: Point2D[] = [
    { x: -halfL, z: -halfW },
    { x: halfL, z: -halfW },
    { x: halfL, z: halfW },
    { x: -halfL, z: halfW },
  ];

  return local.map((p) => ({
    x: x + p.x * cos - p.z * sin,
    z: z + p.x * sin + p.z * cos,
  }));
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
  // Twee onafhankelijke randnormalen per rechthoek (de andere twee zijn
  // hun tegenovergestelde, niet nodig voor SAT), genormaliseerd zodat de
  // projectie-overlap in meters is.
  const edges = [
    { x: corners[1].x - corners[0].x, z: corners[1].z - corners[0].z },
    { x: corners[2].x - corners[1].x, z: corners[2].z - corners[1].z },
  ];
  return edges.map((edge) => {
    const length = Math.hypot(edge.x, edge.z) || 1;
    return { x: -edge.z / length, z: edge.x / length };
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

export function itemFootprint(item: Floorplan3dItem, lookup: DimsLookup): Point2D[] {
  const dims = dimsOf(item, lookup);
  return footprintCorners(item.x, item.z, dims.length_m, dims.width_m, item.rot_y_deg);
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

  function fitsAt(x: number, z: number): boolean {
    if (x - dims.length_m / 2 < -halfL || x + dims.length_m / 2 > halfL) return false;
    if (z - dims.width_m / 2 < -halfW || z + dims.width_m / 2 > halfW) return false;

    const candidateFootprint = footprintCorners(x, z, dims.length_m, dims.width_m, rotYDeg);
    return !otherItems.some((other) => footprintsOverlap(candidateFootprint, itemFootprint(other, lookup)));
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
  const baseDims = dimsOf(base, lookup);
  const baseTop = base.y + baseDims.height_m;
  const baseFootprint = itemFootprint(base, lookup);

  const directlyOn = items.filter(
    (item) =>
      item.id !== baseId &&
      Math.abs(item.y - baseTop) < EPS_M &&
      footprintsOverlap(baseFootprint, itemFootprint(item, lookup)),
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
    const footprint = itemFootprint(item, lookup);
    let y = 0;
    for (const base of placed) {
      if (!footprintsOverlap(footprint, itemFootprint(base, lookup))) continue;
      const baseDims = dimsOf(base, lookup);
      if (!baseDims.stackable) continue;
      y = Math.max(y, base.y + baseDims.height_m);
    }
    placed.push({ ...item, y });
  }

  const yById = new Map(placed.map((item) => [item.id, item.y]));
  return items.map((item) => ({ ...item, y: yById.get(item.id) ?? 0 }));
}
