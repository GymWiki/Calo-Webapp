// Pure logica voor "Veld afzetten": waar staan de pionnen/dopjes langs de
// omtrek van een rechthoekig veld, hoe snapt/schuift/schaalt zo'n veld, en
// wat is het totaal materiaal. Geen React/three — zie cone-field.test.ts.
//
// Coördinaten: `Vec2 = {x, z}` in het vloervlak (meters). Lokaal ligt het
// midden van het veld op (0,0), `width` loopt langs X en `length` langs Z.
// Wereldrotatie volgt three.js (`rotation.y = +graden`), zodat de berekende
// hoeken exact overeenkomen met wat de scene rendert.

import type { ConeDistribution, ConeField, ConeMarkerType, Floorplan3dRoom } from "@/types/floorplan3d";

export type Vec2 = { x: number; z: number };

export const DEFAULT_CONE_INTERVAL_M = 2;
export const MIN_CONE_INTERVAL_M = 0.5;
export const MAX_CONE_INTERVAL_M = 10;
/** Kleinste veld dat getekend/ingesteld mag worden (m). */
export const MIN_FIELD_SIZE_M = 0.5;
/** Snapafstand naar zaalrand en andere velden (m). */
export const FIELD_SNAP_M = 0.15;

const EPS = 1e-6;
/** Veiligheidsgrens: nooit meer dan dit aantal segmenten per zijde. */
const MAX_SEGMENTS_PER_SIDE = 1000;

// ----------------------------------------------------------------------------
// Pionnen langs de omtrek
// ----------------------------------------------------------------------------

export type ConePositions = {
  /** De (unieke) hoekpunten, in volgorde: -x-z, +x-z, +x+z, -x+z. */
  corners: Vec2[];
  /** Alle pionnen langs de zijden, zonder de hoeken. */
  edges: Vec2[];
};

export type ConeSideInfo = {
  length: number;
  /** Aantal tussenruimtes op deze zijde (= pionnen langs de zijde + 1). */
  segments: number;
  /** Werkelijke tussenruimte: bij "gelijkmatig" overal gelijk. */
  interval: number;
  /** Laatste tussenruimte (bij "exact" mogelijk korter dan `interval`). */
  lastInterval: number;
};

function sane(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function saneInterval(interval: number): number {
  if (!Number.isFinite(interval) || interval <= 0) return DEFAULT_CONE_INTERVAL_M;
  // Ondergrens voorkomt absurd veel pionnen bij een typefout.
  return Math.max(interval, 0.05);
}

/** Afstanden t (langs de zijde, 0 < t < length) van de tussenpionnen. */
function sideOffsets(length: number, interval: number, mode: ConeDistribution): number[] {
  if (length < EPS) return [];
  const d = saneInterval(interval);

  if (mode === "exact") {
    const out: number[] = [];
    for (let k = 1; k <= MAX_SEGMENTS_PER_SIDE; k++) {
      const t = k * d;
      if (t >= length - EPS) break;
      out.push(t);
    }
    return out;
  }

  const n = Math.min(MAX_SEGMENTS_PER_SIDE, Math.max(1, Math.round(length / d)));
  return Array.from({ length: n - 1 }, (_, i) => (length * (i + 1)) / n);
}

function localCorners(width: number, length: number): Vec2[] {
  const hw = width / 2;
  const hl = length / 2;
  return [
    { x: -hw, z: -hl },
    { x: hw, z: -hl },
    { x: hw, z: hl },
    { x: -hw, z: hl },
  ];
}

function pointKey(p: Vec2): string {
  return `${Math.round(p.x * 1e5)}:${Math.round(p.z * 1e5)}`;
}

export function computeConePositions({
  width,
  length,
  interval,
  mode = "even",
}: {
  width: number;
  length: number;
  interval: number;
  mode?: ConeDistribution;
}): ConePositions {
  const w = sane(width);
  const l = sane(length);
  const cornerPoints = localCorners(w, l);

  // Hoeken: nooit dubbel (bij een veld met breedte of lengte 0 vallen ze samen).
  const seen = new Set<string>();
  const corners: Vec2[] = [];
  for (const p of cornerPoints) {
    const key = pointKey(p);
    if (seen.has(key)) continue;
    seen.add(key);
    corners.push(p);
  }

  const edges: Vec2[] = [];
  for (let i = 0; i < 4; i++) {
    const a = cornerPoints[i];
    const b = cornerPoints[(i + 1) % 4];
    const side = Math.hypot(b.x - a.x, b.z - a.z);
    for (const t of sideOffsets(side, interval, mode)) {
      const p = { x: a.x + ((b.x - a.x) * t) / side, z: a.z + ((b.z - a.z) * t) / side };
      const key = pointKey(p);
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(p);
    }
  }

  return { corners, edges };
}

/** Per zijde: lengte, aantal tussenruimtes en het werkelijke interval. De
 * volgorde is gelijk aan de hoeken: zijde 0 = -z (breedte), 1 = +x (lengte),
 * 2 = +z (breedte), 3 = -x (lengte). */
export function coneSideInfo({
  width,
  length,
  interval,
  mode = "even",
}: {
  width: number;
  length: number;
  interval: number;
  mode?: ConeDistribution;
}): ConeSideInfo[] {
  const w = sane(width);
  const l = sane(length);
  return [w, l, w, l].map((side) => {
    if (side < EPS) return { length: 0, segments: 0, interval: 0, lastInterval: 0 };
    const offsets = sideOffsets(side, interval, mode);
    const segments = offsets.length + 1;
    if (mode === "exact") {
      const first = offsets[0] ?? side;
      const last = side - (offsets[offsets.length - 1] ?? 0);
      return { length: side, segments, interval: first, lastInterval: last };
    }
    return { length: side, segments, interval: side / segments, lastInterval: side / segments };
  });
}

export type ConeFieldSummary = {
  width: number;
  length: number;
  corners: number;
  total: number;
  sides: ConeSideInfo[];
};

export function summarizeConeField(
  field: Pick<ConeField, "width_m" | "length_m" | "interval_m" | "distribution">,
): ConeFieldSummary {
  const params = {
    width: field.width_m,
    length: field.length_m,
    interval: field.interval_m,
    mode: field.distribution,
  };
  const { corners, edges } = computeConePositions(params);
  return {
    width: field.width_m,
    length: field.length_m,
    corners: corners.length,
    total: corners.length + edges.length,
    sides: coneSideInfo(params),
  };
}

// ----------------------------------------------------------------------------
// Veld in de wereld (rotatie, hoeken, grenzen)
// ----------------------------------------------------------------------------

function rotate(p: Vec2, rotDeg: number): Vec2 {
  const rad = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // three.js: rotation.y = +θ  →  x' = x·cos + z·sin,  z' = −x·sin + z·cos
  return { x: p.x * cos + p.z * sin, z: -p.x * sin + p.z * cos };
}

function unrotate(p: Vec2, rotDeg: number): Vec2 {
  return rotate(p, -rotDeg);
}

export function fieldWorldCorners(
  field: Pick<ConeField, "x" | "z" | "rot_y_deg" | "width_m" | "length_m">,
): Vec2[] {
  return localCorners(field.width_m, field.length_m).map((p) => {
    const r = rotate(p, field.rot_y_deg);
    return { x: field.x + r.x, z: field.z + r.z };
  });
}

type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };

function boundsOf(points: Vec2[]): Bounds {
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}

export function fieldBounds(field: Pick<ConeField, "x" | "z" | "rot_y_deg" | "width_m" | "length_m">): Bounds {
  return boundsOf(fieldWorldCorners(field));
}

/** Houdt het veld binnen de zaal: schuift het, en schaalt het alleen
 * proportioneel kleiner als het veld (na rotatie) niet in de zaal past. */
export function clampFieldToRoom<T extends ConeField>(
  field: T,
  room: Pick<Floorplan3dRoom, "width_m" | "length_m">,
): { field: T; changed: boolean; shrunk: boolean } {
  let next = field;
  let shrunk = false;

  const b = fieldBounds(next);
  const spanX = b.maxX - b.minX;
  const spanZ = b.maxZ - b.minZ;
  if (spanX > room.width_m + EPS || spanZ > room.length_m + EPS) {
    const factor = Math.min(room.width_m / spanX, room.length_m / spanZ);
    next = { ...next, width_m: next.width_m * factor, length_m: next.length_m * factor };
    shrunk = true;
  }

  const nb = fieldBounds(next);
  const halfX = room.width_m / 2;
  const halfZ = room.length_m / 2;
  let dx = 0;
  let dz = 0;
  if (nb.minX < -halfX) dx = -halfX - nb.minX;
  else if (nb.maxX > halfX) dx = halfX - nb.maxX;
  if (nb.minZ < -halfZ) dz = -halfZ - nb.minZ;
  else if (nb.maxZ > halfZ) dz = halfZ - nb.maxZ;
  if (Math.abs(dx) > EPS || Math.abs(dz) > EPS) next = { ...next, x: next.x + dx, z: next.z + dz };

  return { field: next, changed: next !== field, shrunk };
}

// ----------------------------------------------------------------------------
// Snappen
// ----------------------------------------------------------------------------

export type FieldSnapContext = {
  /** 0 = uit. */
  grid: 0 | 0.1 | 0.5;
  room: Pick<Floorplan3dRoom, "width_m" | "length_m">;
  /** Andere velden waaraan gesnapt wordt (het veld zelf niet meegeven). */
  others: ConeField[];
};

/** Lijnen (x-waarden en z-waarden) waaraan een rand kan snappen. */
function snapLines(ctx: FieldSnapContext): { xs: number[]; zs: number[] } {
  const xs = [-ctx.room.width_m / 2, ctx.room.width_m / 2];
  const zs = [-ctx.room.length_m / 2, ctx.room.length_m / 2];
  for (const other of ctx.others) {
    for (const c of fieldWorldCorners(other)) {
      xs.push(c.x);
      zs.push(c.z);
    }
  }
  return { xs, zs };
}

/** Beste verschuiving (binnen FIELD_SNAP_M) waarmee een van `values` op een
 * lijn valt; null als niets dichtbij genoeg is. */
function bestDelta(values: number[], lines: number[]): number | null {
  let best: number | null = null;
  for (const value of values) {
    for (const line of lines) {
      const delta = line - value;
      if (Math.abs(delta) > FIELD_SNAP_M) continue;
      if (best === null || Math.abs(delta) < Math.abs(best)) best = delta;
    }
  }
  return best;
}

function gridSnap(value: number, grid: number): number {
  return grid === 0 ? value : Math.round(value / grid) * grid;
}

/** Snapt een losse hoek (bij tekenen of slepen van een handle):
 * eerst zaalrand/andere velden, anders het raster; altijd binnen de zaal. */
export function snapFieldPoint(point: Vec2, ctx: FieldSnapContext): Vec2 {
  const { xs, zs } = snapLines(ctx);
  const dx = bestDelta([point.x], xs);
  const dz = bestDelta([point.z], zs);
  const halfX = ctx.room.width_m / 2;
  const halfZ = ctx.room.length_m / 2;
  const x = dx !== null ? point.x + dx : gridSnap(point.x, ctx.grid);
  const z = dz !== null ? point.z + dz : gridSnap(point.z, ctx.grid);
  return { x: Math.min(Math.max(x, -halfX), halfX), z: Math.min(Math.max(z, -halfZ), halfZ) };
}

/** Snapt een heel veld dat verplaatst wordt naar `center`: de randen van
 * het veld snappen aan zaalrand/andere velden, anders snapt de linker/
 * bovenrand aan het raster. Het resultaat blijft binnen de zaal. */
export function snapFieldMove<T extends ConeField>(field: T, center: Vec2, ctx: FieldSnapContext): T {
  const moved = { ...field, x: center.x, z: center.z };
  const b = fieldBounds(moved);
  const { xs, zs } = snapLines(ctx);
  const dx = bestDelta([b.minX, b.maxX], xs);
  const dz = bestDelta([b.minZ, b.maxZ], zs);
  const snapped = {
    ...moved,
    x: moved.x + (dx !== null ? dx : gridSnap(b.minX, ctx.grid) - b.minX),
    z: moved.z + (dz !== null ? dz : gridSnap(b.minZ, ctx.grid) - b.minZ),
  };
  return clampFieldToRoom(snapped, ctx.room).field;
}

// ----------------------------------------------------------------------------
// Aanmaken en vergroten/verkleinen via de hoeken
// ----------------------------------------------------------------------------

export const CONE_COLOR_PRESETS: { id: string; label: string; hex: string }[] = [
  { id: "oranje", label: "Oranje", hex: "#f97316" },
  { id: "geel", label: "Geel", hex: "#facc15" },
  { id: "blauw", label: "Blauw", hex: "#2563eb" },
  { id: "rood", label: "Rood", hex: "#dc2626" },
  { id: "groen", label: "Groen", hex: "#16a34a" },
  { id: "wit", label: "Wit", hex: "#ffffff" },
];

export const CONE_MARKER_LABELS: Record<ConeMarkerType, string> = {
  pion: "Pion",
  pion_hoog: "Pion (hoog)",
  pion_laag: "Pion (laag)",
  dopje: "Dopje",
};

/** Afmetingen van het (procedurele) model per markeertype, in meters. */
export const CONE_MARKER_DIMS: Record<ConeMarkerType, { height: number; radius: number }> = {
  pion: { height: 0.3, radius: 0.09 },
  pion_hoog: { height: 0.5, radius: 0.1 },
  pion_laag: { height: 0.15, radius: 0.07 },
  dopje: { height: 0.025, radius: 0.1 },
};

export function colorName(hex: string): string {
  return CONE_COLOR_PRESETS.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.label ?? hex.toUpperCase();
}

/** Nieuw (asgelijnd) veld uit twee tegenoverliggende hoeken. */
export function createFieldFromCorners(
  id: string,
  a: Vec2,
  c: Vec2,
  overrides: Partial<Omit<ConeField, "id" | "type">> = {},
): ConeField {
  return {
    id,
    type: "coneField",
    x: (a.x + c.x) / 2,
    z: (a.z + c.z) / 2,
    rot_y_deg: 0,
    width_m: Math.abs(c.x - a.x),
    length_m: Math.abs(c.z - a.z),
    interval_m: DEFAULT_CONE_INTERVAL_M,
    distribution: "even",
    marker: "pion",
    color: CONE_COLOR_PRESETS[0].hex,
    corner_color: null,
    ...overrides,
  };
}

export function isUsableField(field: Pick<ConeField, "width_m" | "length_m">): boolean {
  return field.width_m >= MIN_FIELD_SIZE_M - EPS && field.length_m >= MIN_FIELD_SIZE_M - EPS;
}

/** Sleept hoek `cornerIndex` naar `point` (wereld) terwijl de tegenoverliggende
 * hoek vast blijft staan; rotatie blijft gelijk. */
export function resizeFieldFromCorner<T extends ConeField>(field: T, cornerIndex: number, point: Vec2): T {
  const corners = fieldWorldCorners(field);
  const anchor = corners[(cornerIndex + 2) % 4];
  const local = unrotate({ x: point.x - anchor.x, z: point.z - anchor.z }, field.rot_y_deg);
  const sign = (value: number) => (value < 0 ? -1 : 1);
  const lx = sign(local.x) * Math.max(Math.abs(local.x), MIN_FIELD_SIZE_M);
  const lz = sign(local.z) * Math.max(Math.abs(local.z), MIN_FIELD_SIZE_M);
  const half = rotate({ x: lx / 2, z: lz / 2 }, field.rot_y_deg);
  return {
    ...field,
    x: anchor.x + half.x,
    z: anchor.z + half.z,
    width_m: Math.abs(lx),
    length_m: Math.abs(lz),
  };
}

/** Roteert om het middelpunt; houdt het veld daarna binnen de zaal. */
export function normalizeFieldRotation(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// ----------------------------------------------------------------------------
// Overzicht / materiaal nodig
// ----------------------------------------------------------------------------

export type ConeMaterialRow = { marker: ConeMarkerType; color: string; count: number };

/** Totaal aantal pionnen/dopjes per (type, kleur) in de hele plattegrond;
 * hoekpionnen tellen mee onder hun eigen kleur. */
export function coneMaterialTotals(fields: ConeField[]): ConeMaterialRow[] {
  const rows = new Map<string, ConeMaterialRow>();
  const add = (marker: ConeMarkerType, color: string, count: number) => {
    if (count <= 0) return;
    const key = `${marker}|${color.toLowerCase()}`;
    const row = rows.get(key);
    if (row) row.count += count;
    else rows.set(key, { marker, color: color.toLowerCase(), count });
  };
  for (const field of fields) {
    const { corners, edges } = computeConePositions({
      width: field.width_m,
      length: field.length_m,
      interval: field.interval_m,
      mode: field.distribution,
    });
    add(field.marker, field.corner_color ?? field.color, corners.length);
    add(field.marker, field.color, edges.length);
  }
  return [...rows.values()].sort((a, b) => b.count - a.count);
}

export function formatMeters(value: number): string {
  return value.toLocaleString("nl-NL", { maximumFractionDigits: 1 });
}

/** "Veld 12 x 20 m, 30 pionnen" */
export function fieldLabel(field: ConeField): string {
  const { total } = summarizeConeField(field);
  const noun = field.marker === "dopje" ? (total === 1 ? "dopje" : "dopjes") : total === 1 ? "pion" : "pionnen";
  return `Veld ${formatMeters(field.width_m)} x ${formatMeters(field.length_m)} m, ${total} ${noun}`;
}

/** Regels voor de tooltip bij het tekenen en in het paneel: afmetingen,
 * totaal aantal en het werkelijke interval per zijde. */
export function fieldTooltipLines(field: ConeField): string[] {
  const summary = summarizeConeField(field);
  const noun = field.marker === "dopje" ? "dopjes" : "pionnen";
  const [bSide, lSide] = summary.sides;
  const sideText = (side: ConeSideInfo) =>
    field.distribution === "exact" && Math.abs(side.lastInterval - side.interval) > 0.005
      ? `${formatMeters2(side.interval)} m (laatste ${formatMeters2(side.lastInterval)} m)`
      : `${formatMeters2(side.interval)} m`;
  return [
    `${formatMeters(field.width_m)} x ${formatMeters(field.length_m)} m`,
    `${summary.total} ${noun}`,
    `Interval breedte: ${sideText(bSide)}`,
    `Interval lengte: ${sideText(lSide)}`,
  ];
}

function formatMeters2(value: number): string {
  return value.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}
