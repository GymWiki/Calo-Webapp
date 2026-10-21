// Pure, R3F/three-onafhankelijke geometrie-helpers voor de 3D-plattegrond:
// snappen (raster/randen/muren), stapel-overlaptest (SAT, geen fysica) en
// de "dichtstbijzijnde vrije plek"-zoekfunctie. Los van React/drei
// gehouden zodat dit zonder een canvas te renderen te doorlopen is, en
// zodat Floorplan3dEditor.tsx zich puur met orchestratie/state bezig kan
// houden.

import type { MaterialModel } from "@/types/materialModel";
import type { Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";

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

function dimsOf(item: Floorplan3dItem, lookup: DimsLookup): ItemDims {
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
// SAT-overlaptest voor twee geroteerde rechthoeken (XZ-vlak) — geen fysica,
// puur "overlappen hun voetafdrukken wel of niet" (zie Stap 4.5 van de brief).
// ----------------------------------------------------------------------------

function axesOf(corners: Point2D[]): Point2D[] {
  // Twee onafhankelijke randnormalen per rechthoek (de andere twee zijn
  // hun tegenovergestelde, niet nodig voor SAT).
  const edge1 = { x: corners[1].x - corners[0].x, z: corners[1].z - corners[0].z };
  const edge2 = { x: corners[2].x - corners[1].x, z: corners[2].z - corners[1].z };
  return [
    { x: -edge1.z, z: edge1.x },
    { x: -edge2.z, z: edge2.x },
  ];
}

function projectOntoAxis(corners: Point2D[], axis: Point2D) {
  const dots = corners.map((c) => c.x * axis.x + c.z * axis.z);
  return { min: Math.min(...dots), max: Math.max(...dots) };
}

export function footprintsOverlap(a: Point2D[], b: Point2D[]): boolean {
  const axes = [...axesOf(a), ...axesOf(b)];
  for (const axis of axes) {
    const projA = projectOntoAxis(a, axis);
    const projB = projectOntoAxis(b, axis);
    if (projA.max < projB.min || projB.max < projA.min) {
      return false; // Separerende as gevonden — geen overlap.
    }
  }
  return true;
}

function itemFootprint(item: Floorplan3dItem, lookup: DimsLookup): Point2D[] {
  const dims = dimsOf(item, lookup);
  return footprintCorners(item.x, item.z, dims.length_m, dims.width_m, item.rot_y_deg);
}

// ----------------------------------------------------------------------------
// Stapelhoogte: y wordt de hoogste bovenkant van overlappende, stapelbare
// items; overlapt het met een niet-stapelbaar item, dan past deze plek niet
// (de aanroeper valt terug op findNearestFreeSpot — zie Floorplan3dEditor.tsx).
// ----------------------------------------------------------------------------

export type StackResult = { fits: true; y: number } | { fits: false };

export function computeStackY(
  candidate: { x: number; z: number; rot_y_deg: number },
  candidateDims: ItemDims,
  otherItems: Floorplan3dItem[],
  lookup: DimsLookup,
): StackResult {
  const candidateFootprint = footprintCorners(
    candidate.x,
    candidate.z,
    candidateDims.length_m,
    candidateDims.width_m,
    candidate.rot_y_deg,
  );

  let highestTop = 0;
  for (const other of otherItems) {
    const otherFootprint = itemFootprint(other, lookup);
    if (!footprintsOverlap(candidateFootprint, otherFootprint)) continue;

    const otherDims = dimsOf(other, lookup);
    if (!otherDims.stackable) {
      return { fits: false };
    }
    const otherTop = other.y + otherDims.height_m;
    if (otherTop > highestTop) highestTop = otherTop;
  }

  return { fits: true, y: highestTop };
}

// ----------------------------------------------------------------------------
// Dichtstbijzijnde vrije plek — spiraalvormige ring-zoektocht rond een
// startpunt, puur op XZ-overlap (ongeacht stapelbaarheid: dit is het
// "leg het ernaast op de vloer"-pad, zie Stap 4.5).
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

// ----------------------------------------------------------------------------
// Snappen: raster + randen van andere items + muren, binnen een tolerantie.
// ----------------------------------------------------------------------------

export type SnapGridSize = 0 | 0.1 | 0.5;
const EDGE_SNAP_TOLERANCE_M = 0.1;

function snapToGrid(value: number, grid: SnapGridSize): number {
  if (grid === 0) return value;
  return Math.round(value / grid) * grid;
}

/**
 * Past raster- en rand/muur-snapping toe op een kandidaat-positie (het
 * MIDDELPUNT van het item). Rand/muur-snapping werkt op de AABB van de
 * voetafdruk (zie footprintAabb hierboven) — elke AABB-rand van het
 * gesleepte item wordt los tegen elke AABB-rand van andere items én de 4
 * muren getest; de kleinste correctie binnen de tolerantie wint per as.
 */
export function applySnapping(
  x: number,
  z: number,
  dims: ItemDims,
  rotYDeg: number,
  grid: SnapGridSize,
  otherItems: Floorplan3dItem[],
  room: Floorplan3dRoom,
  lookup: DimsLookup,
): Point2D {
  let snappedX = snapToGrid(x, grid);
  let snappedZ = snapToGrid(z, grid);

  const halfL = dims.length_m / 2;
  const halfW = dims.width_m / 2;
  const aabb = footprintAabb(snappedX, snappedZ, dims.length_m, dims.width_m, rotYDeg);
  const halfRoomX = room.width_m / 2;
  const halfRoomZ = room.length_m / 2;

  const targetXs = [-halfRoomX, halfRoomX, ...otherItems.flatMap((other) => {
    const otherDims = dimsOf(other, lookup);
    const otherAabb = footprintAabb(other.x, other.z, otherDims.length_m, otherDims.width_m, other.rot_y_deg);
    return [otherAabb.minX, otherAabb.maxX];
  })];
  const targetZs = [-halfRoomZ, halfRoomZ, ...otherItems.flatMap((other) => {
    const otherDims = dimsOf(other, lookup);
    const otherAabb = footprintAabb(other.x, other.z, otherDims.length_m, otherDims.width_m, other.rot_y_deg);
    return [otherAabb.minZ, otherAabb.maxZ];
  })];

  let bestXCorrection = 0;
  let bestXDistance = EDGE_SNAP_TOLERANCE_M;
  for (const targetX of targetXs) {
    for (const ownEdge of [aabb.minX, aabb.maxX]) {
      const distance = Math.abs(ownEdge - targetX);
      if (distance < bestXDistance) {
        bestXDistance = distance;
        bestXCorrection = targetX - ownEdge;
      }
    }
  }

  let bestZCorrection = 0;
  let bestZDistance = EDGE_SNAP_TOLERANCE_M;
  for (const targetZ of targetZs) {
    for (const ownEdge of [aabb.minZ, aabb.maxZ]) {
      const distance = Math.abs(ownEdge - targetZ);
      if (distance < bestZDistance) {
        bestZDistance = distance;
        bestZCorrection = targetZ - ownEdge;
      }
    }
  }

  snappedX += bestXCorrection;
  snappedZ += bestZCorrection;

  // Blijf binnen de kamer, ook na snapping (een rand/raster-snap mag een
  // item nooit buiten de muren duwen).
  snappedX = Math.min(Math.max(snappedX, -halfRoomX + halfL), halfRoomX - halfL);
  snappedZ = Math.min(Math.max(snappedZ, -halfRoomZ + halfW), halfRoomZ - halfW);

  return { x: snappedX, z: snappedZ };
}

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
      Math.abs(item.y - baseTop) < 0.001 &&
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
 * een eerdere, iets andere berekening stammen. Simpele fixed-point-
 * iteratie (een paar passes over de volledige set, elke keer met de
 * nieuwste y-waarden) i.p.v. een topologische sortering — convergeert
 * voor elke eindige stapelhoogte binnen een handvol passes, en blijft
 * puur geometrisch (geen fysica/simulatie).
 */
export function recomputeStackedYs(items: Floorplan3dItem[], lookup: DimsLookup): Floorplan3dItem[] {
  let working = items.map((item) => ({ ...item, y: 0 }));

  for (let pass = 0; pass < 5; pass++) {
    working = working.map((item) => {
      const others = working.filter((other) => other.id !== item.id);
      const result = computeStackY(item, dimsOf(item, lookup), others, lookup);
      return { ...item, y: result.fits ? result.y : 0 };
    });
  }

  return working;
}

