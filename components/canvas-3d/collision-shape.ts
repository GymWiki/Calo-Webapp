// Centrale collision-vorm van een 3D-asset, afgeleid uit de ECHTE zichtbare
// geometrie. Puur (geen React/three, geen alias-imports) zodat dezelfde code
// draait in de editor, de debug-weergave, het audit-script (Node) en de tests.
//
// Ruimte: alles in de LOKALE ruimte van het item (de oorsprong/pivot van het
// GLB, vóór de rotatie van het item in de plattegrond). Een vorm heeft:
//   offset_x/offset_z  middelpunt van de voetafdruk t.o.v. de pivot
//   base_m             onderkant t.o.v. de pivot (hangend materiaal: > 0)
//   yaw_deg            draaiing van de vorm binnen de lokale ruimte (voor
//                      assets die in het GLB schuin zijn gemodelleerd)
//   length_m/width_m   maten langs de EIGEN assen van de vorm
//   height_m           hoogte
// Het item zelf draait met `rot_y_deg` mee: de vorm is dus altijd een
// oriented box, nooit een world-AABB.
//
// Rotatieconventie = three.js (`rotation.y = +graden`): een lokaal punt
// (x, z) wordt (x·cos + z·sin, −x·sin + z·cos). Zo valt de voetafdruk exact
// samen met wat de scene rendert.

export type Point = { x: number; z: number };

export type ShapeKind = "box" | "cylinder" | "capsule" | "compound" | "none";

export type ShapePart = {
  offset_x: number;
  offset_z: number;
  length_m: number;
  width_m: number;
  yaw_deg: number;
  /** Onderkant en hoogte van dit deel; standaard die van de hele vorm. */
  base_m?: number;
  height_m?: number;
};

export type CollisionShape = {
  kind: ShapeKind;
  length_m: number;
  width_m: number;
  height_m: number;
  offset_x: number;
  offset_z: number;
  base_m: number;
  yaw_deg: number;
  /** Alleen bij `compound`: meerdere boxen in de lokale ruimte van het item. */
  parts?: ShapePart[];
  /** Waar deze vorm vandaan komt. */
  source: "mesh" | "override" | "db";
};

/** Zichtbare geometrie van een asset: de convexe omtrek in het grondvlak + hoogtebereik. */
export type MeshExtent = {
  hull: Point[];
  minY: number;
  maxY: number;
};

/** Handmatige uitzondering voor assets waar de automatische vorm niet goed werkt. */
export type CollisionOverride = {
  /** Verplicht: waarom wijkt dit af van de automatische vorm. */
  reason: string;
  kind?: ShapeKind;
  length_m?: number;
  width_m?: number;
  height_m?: number;
  offset_x?: number;
  offset_z?: number;
  base_m?: number;
  yaw_deg?: number;
  parts?: ShapePart[];
};

/** Assets waarvan de onderkant minstens zo hoog hangt, staan niet "op de vloer" (touwen, ringen, netten). */
export const ELEVATED_MIN_M = 0.25;
/** Een schuine vorm moet minstens zoveel kleiner zijn dan de axis-aligned box om de moeite waard te zijn. */
const ORIENTED_GAIN = 0.9;
const ROUND_MM = 1000;

const round = (value: number) => Math.round(value * ROUND_MM) / ROUND_MM;

// ----------------------------------------------------------------------------
// Rotatie (three.js-conventie) en basisgeometrie
// ----------------------------------------------------------------------------

export function rotateXZ(x: number, z: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: x * cos + z * sin, z: -x * sin + z * cos };
}

/** Hoekpunten van een geroteerde rechthoek (middelpunt cx,cz; maten l×w; draaiing `deg`). */
export function boxCorners(cx: number, cz: number, length: number, width: number, deg: number): Point[] {
  const hl = length / 2;
  const hw = width / 2;
  return [
    { x: -hl, z: -hw },
    { x: hl, z: -hw },
    { x: hl, z: hw },
    { x: -hl, z: hw },
  ].map((p) => {
    const r = rotateXZ(p.x, p.z, deg);
    return { x: cx + r.x, z: cz + r.z };
  });
}

/** Convexe omhullende (monotone chain), tegen de klok in. */
export function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const unique = sorted.filter((p, i) => i === 0 || p.x !== sorted[i - 1].x || p.z !== sorted[i - 1].z);
  if (unique.length < 3) return unique;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const lower: Point[] = [];
  for (const p of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Point[] = [];
  for (const p of [...unique].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

function bounds2D(points: Point[]) {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}

type OrientedRect = { yaw_deg: number; cx: number; cz: number; length: number; width: number };

/** Kleinste rechthoek (rond de kleinste oppervlakte) om een convexe omtrek, met draaiing in [−45°, 45°). */
export function minAreaRect(hull: Point[]): OrientedRect {
  const aabb = bounds2D(hull);
  let best: OrientedRect = {
    yaw_deg: 0,
    cx: (aabb.minX + aabb.maxX) / 2,
    cz: (aabb.minZ + aabb.maxZ) / 2,
    length: aabb.maxX - aabb.minX,
    width: aabb.maxZ - aabb.minZ,
  };
  let bestArea = best.length * best.width;

  const angles = new Set<number>([0]);
  for (let i = 0; i < hull.length; i++) {
    const a = hull[i];
    const b = hull[(i + 1) % hull.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (Math.hypot(dx, dz) < 1e-9) continue;
    // Lokale x-as in itemruimte = (cos θ, −sin θ)  ⇒  θ = atan2(−dz, dx).
    const theta = (Math.atan2(-dz, dx) * 180) / Math.PI;
    angles.add(((((theta + 45) % 90) + 90) % 90) - 45);
  }

  for (const theta of angles) {
    const rad = (theta * Math.PI) / 180;
    const d = { x: Math.cos(rad), z: -Math.sin(rad) };
    const n = { x: Math.sin(rad), z: Math.cos(rad) };
    const us = hull.map((p) => p.x * d.x + p.z * d.z);
    const vs = hull.map((p) => p.x * n.x + p.z * n.z);
    const uMin = Math.min(...us);
    const uMax = Math.max(...us);
    const vMin = Math.min(...vs);
    const vMax = Math.max(...vs);
    const length = uMax - uMin;
    const width = vMax - vMin;
    const area = length * width;
    // Bij (bijna) gelijke oppervlakte liever de kleinste draaiing.
    if (area < bestArea - 1e-9 || (Math.abs(area - bestArea) <= 1e-9 && Math.abs(theta) < Math.abs(best.yaw_deg))) {
      const uc = (uMin + uMax) / 2;
      const vc = (vMin + vMax) / 2;
      best = { yaw_deg: theta, cx: uc * d.x + vc * n.x, cz: uc * d.z + vc * n.z, length, width };
      bestArea = area;
    }
  }
  return best;
}

// ----------------------------------------------------------------------------
// Vorm afleiden uit de zichtbare geometrie
// ----------------------------------------------------------------------------

/** Axis-aligned maten van de zichtbare geometrie (zoals de importer ze in de database zette). */
export function aabbDims(extent: MeshExtent): { length_m: number; width_m: number; height_m: number } {
  const b = bounds2D(extent.hull);
  return { length_m: b.maxX - b.minX, width_m: b.maxZ - b.minZ, height_m: extent.maxY - extent.minY };
}

/** De automatische vorm: een box (oriented als dat merkbaar strakker is), direct uit de geometrie. */
export function shapeFromExtent(extent: MeshExtent): CollisionShape {
  const hull = extent.hull.length >= 3 ? extent.hull : convexHull(extent.hull);
  const aabb = bounds2D(hull);
  const aabbArea = (aabb.maxX - aabb.minX) * (aabb.maxZ - aabb.minZ);
  const rect = minAreaRect(hull);
  const useRect = rect.length * rect.width < aabbArea * ORIENTED_GAIN;

  const base = {
    kind: "box" as const,
    height_m: round(extent.maxY - extent.minY),
    base_m: round(extent.minY),
    source: "mesh" as const,
  };
  if (useRect) {
    return {
      ...base,
      length_m: round(rect.length),
      width_m: round(rect.width),
      offset_x: round(rect.cx),
      offset_z: round(rect.cz),
      yaw_deg: Math.round(rect.yaw_deg * 100) / 100,
    };
  }
  return {
    ...base,
    length_m: round(aabb.maxX - aabb.minX),
    width_m: round(aabb.maxZ - aabb.minZ),
    offset_x: round((aabb.minX + aabb.maxX) / 2),
    offset_z: round((aabb.minZ + aabb.maxZ) / 2),
    yaw_deg: 0,
  };
}

/** Vorm zoals de editor hem vóór deze module kende: gecentreerd op de pivot, op de vloer. */
export function legacyShape(dims: { length_m: number; width_m: number; height_m: number }): CollisionShape {
  return { kind: "box", ...dims, offset_x: 0, offset_z: 0, base_m: 0, yaw_deg: 0, source: "db" };
}

/**
 * Welke vorm geldt voor een asset? Volgorde:
 *   1. handmatige override (collisionOverrides.ts) — altijd met een reden;
 *   2. de automatische vorm uit de GLB (`auto`), tenzij de maten in de
 *      database bewust afwijken van de GLB-bounds (dan is dat een handmatige
 *      correctie van de eigenaar en blijven die maten leidend);
 *   3. de oude, gecentreerde box uit de database (nieuw asset zonder profiel).
 */
export function resolveCollisionShape(input: {
  db: { length_m: number; width_m: number; height_m: number };
  auto?: { shape: CollisionShape; aabb: { length_m: number; width_m: number; height_m: number } } | null;
  override?: CollisionOverride | null;
  /** Tolerantie waarmee database-maten "gelijk aan de GLB" heten (m). */
  tolerance?: number;
}): CollisionShape {
  const { db, auto, override } = input;
  const tolerance = input.tolerance ?? 0.02;

  let shape: CollisionShape;
  if (auto) {
    const dbMatchesGlb =
      Math.abs(db.length_m - auto.aabb.length_m) <= tolerance &&
      Math.abs(db.width_m - auto.aabb.width_m) <= tolerance &&
      Math.abs(db.height_m - auto.aabb.height_m) <= tolerance;
    shape = dbMatchesGlb
      ? auto.shape
      : // Bewuste maatcorrectie in de database: maten blijven, positie komt uit de geometrie.
        { ...auto.shape, length_m: db.length_m, width_m: db.width_m, height_m: db.height_m, yaw_deg: 0, source: "db" };
  } else {
    shape = legacyShape(db);
  }

  if (!override) return shape;
  const merged: CollisionShape = { ...shape, ...stripUndefined(override), source: "override" };
  delete (merged as { reason?: string }).reason;
  return merged;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

// ----------------------------------------------------------------------------
// Voetafdruk en verticaal bereik van een vorm voor een geplaatst item
// ----------------------------------------------------------------------------

const CIRCLE_SEGMENTS = 20;
const CAP_SEGMENTS = 8;

export function partsOf(shape: CollisionShape): ShapePart[] {
  if (shape.kind === "none") return [];
  if (shape.kind === "compound" && shape.parts && shape.parts.length > 0) return shape.parts;
  return [
    {
      offset_x: shape.offset_x,
      offset_z: shape.offset_z,
      length_m: shape.length_m,
      width_m: shape.width_m,
      yaw_deg: shape.yaw_deg,
    },
  ];
}

function polygonFor(kind: ShapeKind, part: ShapePart): Point[] {
  const local: Point[] = [];
  if (kind === "cylinder") {
    const r = Math.max(part.length_m, part.width_m) / 2;
    for (let i = 0; i < CIRCLE_SEGMENTS; i++) {
      const a = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
      local.push({ x: Math.cos(a) * r, z: Math.sin(a) * r });
    }
  } else if (kind === "capsule") {
    // Stadion langs de lokale x-as: lengte = totale lengte, straal = halve breedte.
    const r = part.width_m / 2;
    const half = Math.max(part.length_m / 2 - r, 0);
    for (let i = 0; i <= CAP_SEGMENTS; i++) {
      const a = -Math.PI / 2 + (i / CAP_SEGMENTS) * Math.PI;
      local.push({ x: half + Math.cos(a) * r, z: Math.sin(a) * r });
    }
    for (let i = 0; i <= CAP_SEGMENTS; i++) {
      const a = Math.PI / 2 + (i / CAP_SEGMENTS) * Math.PI;
      local.push({ x: -half + Math.cos(a) * r, z: Math.sin(a) * r });
    }
  } else {
    const hl = part.length_m / 2;
    const hw = part.width_m / 2;
    local.push({ x: -hl, z: -hw }, { x: hl, z: -hw }, { x: hl, z: hw }, { x: -hl, z: hw });
  }
  return local.map((p) => {
    const inShape = rotateXZ(p.x, p.z, part.yaw_deg);
    return { x: part.offset_x + inShape.x, z: part.offset_z + inShape.z };
  });
}

/** Convexe polygonen van de voetafdruk, in lokale itemruimte (zonder de rotatie van het item). */
export function localFootprintPolygons(shape: CollisionShape): Point[][] {
  return partsOf(shape).map((part) => polygonFor(shape.kind === "compound" ? "box" : shape.kind, part));
}

/** Voetafdruk van een geplaatst item in de wereld: itempositie + rotatie van het item. */
export function footprintPolygons(shape: CollisionShape, x: number, z: number, rotYDeg: number): Point[][] {
  return localFootprintPolygons(shape).map((polygon) =>
    polygon.map((p) => {
      const r = rotateXZ(p.x, p.z, rotYDeg);
      return { x: x + r.x, z: z + r.z };
    }),
  );
}

/** Middelpunt van de voetafdruk in de wereld (het "echte" midden van het item). */
export function footprintCenter(shape: CollisionShape, x: number, z: number, rotYDeg: number): Point {
  const r = rotateXZ(shape.offset_x, shape.offset_z, rotYDeg);
  return { x: x + r.x, z: z + r.z };
}

/** Itempositie die het voetafdruk-middelpunt op (cx, cz) legt — omgekeerde van `footprintCenter`. */
export function originForCenter(shape: CollisionShape, cx: number, cz: number, rotYDeg: number): Point {
  const r = rotateXZ(shape.offset_x, shape.offset_z, rotYDeg);
  return { x: cx - r.x, z: cz - r.z };
}

/** Grenzen van de voetafdruk t.o.v. de itempositie (voor kamerbegrenzing en snappen). */
export function footprintExtents(shape: CollisionShape, rotYDeg: number) {
  const points = footprintPolygons(shape, 0, 0, rotYDeg).flat();
  if (points.length === 0) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  return bounds2D(points);
}

/** Verticaal bereik [onder, boven] van het item als zijn pivot op hoogte `y` staat. */
export function verticalRange(shape: CollisionShape, y: number): [number, number] {
  return [y + shape.base_m, y + shape.base_m + shape.height_m];
}

/** Hangt/staat dit item verhoogd (touwen, ringen, netten, borden) — dus nooit "op de vloer of op iets"? */
export function isElevated(shape: CollisionShape): boolean {
  return shape.base_m >= ELEVATED_MIN_M;
}

// ----------------------------------------------------------------------------
// Vergelijken met de werkelijke mesh (audit en debug)
// ----------------------------------------------------------------------------

export type ShapeComparison = {
  /** Afstand tussen het middelpunt van de vorm en dat van de mesh (m), in het grondvlak. */
  centerOffset: number;
  /** Verschil in onderkant (m). */
  baseOffset: number;
  /** Verschil per as in de eigen assen van de vorm (m): lengte, breedte, hoogte. */
  sizeDelta: [number, number, number];
  /** Volume van de vorm t.o.v. de strakste box om de mesh (%): + te groot, − te klein. */
  volumeDeltaPct: number;
  /** Deel van de mesh-omtrek (hoekpunten) dat buiten de vorm valt. */
  protrudingPoints: number;
};

/** Is `p` binnen de (oriented) box van een deel, met marge `tol`? */
function insideBox(p: Point, part: ShapePart, tol: number): boolean {
  const local = rotateXZ(p.x - part.offset_x, p.z - part.offset_z, -part.yaw_deg);
  return Math.abs(local.x) <= part.length_m / 2 + tol && Math.abs(local.z) <= part.width_m / 2 + tol;
}

/** Vergelijkt een vorm (box/oriented box) met de strakste box om de zichtbare mesh. */
export function compareShapeToMesh(shape: CollisionShape, extent: MeshExtent, tol = 0.005): ShapeComparison {
  const ideal = shapeFromExtent(extent);
  const center = { x: shape.offset_x, z: shape.offset_z };
  const idealCenter = { x: ideal.offset_x, z: ideal.offset_z };
  const volume = (s: Pick<CollisionShape, "length_m" | "width_m" | "height_m">) => s.length_m * s.width_m * s.height_m;
  const parts = partsOf(shape);
  const protruding = shape.kind === "none" ? 0 : extent.hull.filter((p) => !parts.some((part) => insideBox(p, part, tol))).length;
  return {
    centerOffset: Math.hypot(center.x - idealCenter.x, center.z - idealCenter.z),
    baseOffset: shape.base_m - ideal.base_m,
    sizeDelta: [shape.length_m - ideal.length_m, shape.width_m - ideal.width_m, shape.height_m - ideal.height_m],
    volumeDeltaPct: ((volume(shape) - volume(ideal)) / Math.max(volume(ideal), 1e-9)) * 100,
    protrudingPoints: protruding,
  };
}
