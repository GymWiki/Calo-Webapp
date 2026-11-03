// Slepen van touwen, linten en netten: pure logica (geen React/three), zodat editor en tests dezelfde berekening gebruiken.
//
// Eén bron van waarheid: een uiteinde is ofwel vastgemaakt aan een anchor van een object ({ item, anchor, … }) ofwel een VRIJ punt
// in de wereld ({ free }). Wat de gebruiker loslaat wordt zo opgeslagen en daarna nergens opnieuw afgeleid uit iets ouders.

import { shapeOfDims } from "@/components/canvas-3d/floorplan3d-geometry";
import { dimsOf, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { anchorWorld, canConnect, ropeLength, snapToAnchor, MIN_ROPE_LENGTH_M, type AnchorSnap } from "@/components/canvas-3d/rope";
import type { RopeKind } from "@/components/canvas-3d/anchors";
import type { Vec3 } from "@/components/canvas-3d/orientation";
import { endItemId, isFreeEnd, type Floorplan3dItem, type Rope, type RopeEnd } from "@/types/floorplan3d";

/** Een eindpunt dat binnen deze afstand (m) van een passend bevestigingspunt wordt losgelaten, springt daaraan vast. */
export const ROPE_SNAP_RADIUS_M = 0.6;
/** Bij het verplaatsen van het hele touw: een eindpunt springt alleen aan een anchor die dichterbij ligt dan dit. */
export const ROPE_WHOLE_SNAP_RADIUS_M = 0.4;
/** Rastergrootte (m) voor vrije punten en voor het verplaatsen van het hele touw. Shift = geen raster en geen snap. */
export const ROPE_GRID_M = 0.25;
export const ROPE_MIN_Y_M = 0.05;
export const ROPE_MAX_Y_M = 8;
/** Minimale en maximale lengte (m) per soort verbinding. */
export const ROPE_LIMITS: Record<RopeKind, { min: number; max: number }> = {
  touw: { min: MIN_ROPE_LENGTH_M, max: 40 },
  lint: { min: MIN_ROPE_LENGTH_M, max: 40 },
  net: { min: 0.5, max: 30 },
};
/** Verplaatsing (m) waarboven een tik op het touw een sleepbeweging wordt. */
export const ROPE_MOVE_THRESHOLD_M = 0.12;

export type Room = { width_m: number; length_m: number };

const round3 = (v: number) => Math.round(v * 1000) / 1000 + 0;
const snapTo = (v: number, grid: number) => (grid > 0 ? Math.round(v / grid) * grid + 0 : v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const formatLength = (m: number): string => `${m.toFixed(1).replace(".", ",")} m`;

export function insideRoom(point: Vec3, room: Room, toleranceM = 0.01): boolean {
  return Math.abs(point[0]) <= room.width_m / 2 + toleranceM && Math.abs(point[2]) <= room.length_m / 2 + toleranceM;
}

/** `null` = geldig; anders een Nederlandse reden (nooit stil terugzetten: de editor toont die). */
export function validateRope(a: Vec3, b: Vec3, kind: RopeKind, room: Room): string | null {
  if (!insideRoom(a, room) || !insideRoom(b, room)) return "Buiten de zaal";
  const length = ropeLength(a, b);
  const limits = ROPE_LIMITS[kind];
  if (length < limits.min) return `Te kort (minimaal ${formatLength(limits.min)})`;
  if (length > limits.max) return `Te lang (maximaal ${formatLength(limits.max)})`;
  return null;
}

// --- loslaten van een eindpunt ------------------------------------------------------------------------------------------

export type Drop =
  | { ok: true; end: RopeEnd; world: Vec3; via: "anchor" | "free"; itemId: string | null; anchorId: string | null; distance: number }
  | { ok: false; reason: string; world: Vec3 };

export type DropInput = {
  /** Het punt onder de cursor (wereld): op een object, of op de vloer. */
  cursor: Vec3;
  /** Het item onder de cursor (raycast), of null. */
  hoveredItemId: string | null;
  items: readonly Floorplan3dItem[];
  lookup: DimsLookup;
  room: Room;
  kind: RopeKind;
  /** Het andere uiteinde van het touw (blijft zitten): bepaalt de hoogte van een vrij punt en verbiedt hetzelfde item. */
  otherEnd?: RopeEnd | null;
  /** false (Shift): geen anchor-snap en geen raster. */
  snap: boolean;
  /** Eigen hoogte voor een vrij punt; standaard die van het andere uiteinde. */
  height?: number;
  otherWorld?: Vec3 | null;
};

/** Het bevestigingspunt dat bij de cursor hoort: het item onder de cursor, of het dichtstbijzijnde anchor binnen de snapradius. */
export function nearestSnap(input: Pick<DropInput, "cursor" | "hoveredItemId" | "items" | "lookup" | "kind" | "otherEnd">, radius = ROPE_SNAP_RADIUS_M): AnchorSnap | null {
  const exclude = input.otherEnd ? endItemId(input.otherEnd) : null;
  const hovered = input.hoveredItemId ? input.items.find((item) => item.id === input.hoveredItemId) : null;
  if (hovered && hovered.id !== exclude) return snapToAnchor(hovered, input.cursor, input.lookup, input.kind);

  let best: AnchorSnap | null = null;
  for (const item of input.items) {
    if (item.id === exclude) continue;
    // Snel afkappen: ver buiten het voetprint-gebied + snapradius kan niets aan te raken zijn.
    const shape = shapeOfDims(dimsOf(item, input.lookup));
    const reach = Math.max(shape.length_m, shape.width_m) / 2 + radius + 1;
    if (Math.abs(item.x - input.cursor[0]) > reach || Math.abs(item.z - input.cursor[2]) > reach) continue;
    const snap = snapToAnchor(item, input.cursor, input.lookup, input.kind);
    const world = snap.world;
    const distance = Math.hypot(world[0] - input.cursor[0], world[1] - input.cursor[1], world[2] - input.cursor[2]);
    if (distance <= radius && (!best || distance < best.distance)) best = { ...snap, distance };
  }
  return best;
}

/**
 * Wat gebeurt er met een eindpunt dat hier wordt losgelaten? 1) vastmaken aan het (dichtstbijzijnde passende) anchor, 2) een vrij punt op
 * de vloer of in de lucht (raster, hoogte), 3) ongeldig (buiten de zaal): `ok: false` met een reden.
 */
export function resolveDrop(input: DropInput): Drop {
  if (input.snap) {
    const snap = nearestSnap(input);
    if (snap) {
      if (input.otherEnd && !canConnect(input.otherEnd, snap.anchor)) return { ok: false, reason: "Een touw loopt tussen twee verschillende objecten", world: snap.world };
      return { ok: true, end: snap.anchor, world: snap.world, via: "anchor", itemId: snap.anchor.item, anchorId: snap.anchorId || null, distance: snap.distance };
    }
  }
  const grid = input.snap ? ROPE_GRID_M : 0;
  const y = clamp(input.height ?? input.otherWorld?.[1] ?? 0.5, ROPE_MIN_Y_M, ROPE_MAX_Y_M);
  const free: Vec3 = [round3(snapTo(input.cursor[0], grid)), round3(snapTo(y, input.snap ? 0.05 : 0)), round3(snapTo(input.cursor[2], grid))];
  if (!insideRoom(free, input.room)) return { ok: false, reason: "Geen geldig punt: buiten de zaal", world: free };
  return { ok: true, end: { free }, world: free, via: "free", itemId: null, anchorId: null, distance: 0 };
}

// --- het hele touw verplaatsen --------------------------------------------------------------------------------------------

export type WholeMove = {
  a: RopeEnd;
  b: RopeEnd;
  worldA: Vec3;
  worldB: Vec3;
  /** Beide uiteinden hangen aan een anchor (automatisch vastgemaakt). */
  anchored: boolean;
  /** Was het touw aan objecten vastgemaakt en is die koppeling nu verbroken? */
  detached: boolean;
};

/** Houdt de verschuiving zo dat beide uiteinden binnen de zaal blijven (het touw loopt vast tegen de wand i.p.v. eruit te gaan). */
export function clampDeltaToRoom(startA: Vec3, startB: Vec3, delta: { x: number; z: number }, room: Room): { x: number; z: number } {
  const hx = room.width_m / 2;
  const hz = room.length_m / 2;
  const minX = Math.min(startA[0], startB[0]);
  const maxX = Math.max(startA[0], startB[0]);
  const minZ = Math.min(startA[2], startB[2]);
  const maxZ = Math.max(startA[2], startB[2]);
  return {
    x: clamp(delta.x, -hx - minX, hx - maxX),
    z: clamp(delta.z, -hz - minZ, hz - maxZ),
  };
}

/**
 * Verschuift het hele touw met `delta` (x,z), met behoud van lengte, richting en hoogte; het raster geldt voor de verschuiving. Passen daarna
 * BEIDE uiteinden op een nabij anchor van twee verschillende objecten, dan hangt het touw daar vast; anders blijft het een vrij touw met vrije
 * uiteinden. Shift (`snap = false`): vrij bewegen zonder raster en zonder snap.
 */
export function moveRopeWhole(input: {
  rope: Rope;
  items: readonly Floorplan3dItem[];
  lookup: DimsLookup;
  room: Room;
  delta: { x: number; z: number };
  startA: Vec3;
  startB: Vec3;
  snap: boolean;
}): WholeMove {
  const { rope, items, lookup, room, snap } = input;
  const kind = rope.kind ?? "touw";
  const grid = snap ? ROPE_GRID_M : 0;
  let delta = clampDeltaToRoom(input.startA, input.startB, { x: snapTo(input.delta.x, grid), z: snapTo(input.delta.z, grid) }, room);
  delta = { x: round3(delta.x), z: round3(delta.z) };
  const worldA: Vec3 = [round3(input.startA[0] + delta.x), input.startA[1], round3(input.startA[2] + delta.z)];
  const worldB: Vec3 = [round3(input.startB[0] + delta.x), input.startB[1], round3(input.startB[2] + delta.z)];
  const wasAnchored = endItemId(rope.a) !== null || endItemId(rope.b) !== null;

  if (snap) {
    const sa = nearestSnap({ cursor: worldA, hoveredItemId: null, items, lookup, kind, otherEnd: null }, ROPE_WHOLE_SNAP_RADIUS_M);
    const sb = nearestSnap({ cursor: worldB, hoveredItemId: null, items, lookup, kind, otherEnd: null }, ROPE_WHOLE_SNAP_RADIUS_M);
    if (sa && sb && canConnect(sa.anchor, sb.anchor)) {
      return { a: sa.anchor, b: sb.anchor, worldA: sa.world, worldB: sb.world, anchored: true, detached: false };
    }
  }
  const unchanged = delta.x === 0 && delta.z === 0;
  return { a: { free: worldA }, b: { free: worldB }, worldA, worldB, anchored: false, detached: wasAnchored && !unchanged };
}

/** Draait een touw om zijn midden (graden, alleen in het vlak van de vloer); beide uiteinden worden vrij. */
export function rotateRopeAboutMid(a: Vec3, b: Vec3, deg: number, room: Room): { a: RopeEnd; b: RopeEnd } | null {
  const mx = (a[0] + b[0]) / 2;
  const mz = (a[2] + b[2]) / 2;
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const turn = (p: Vec3): Vec3 => [round3(mx + (p[0] - mx) * cos - (p[2] - mz) * sin), p[1], round3(mz + (p[0] - mx) * sin + (p[2] - mz) * cos)];
  const na = turn(a);
  const nb = turn(b);
  if (!insideRoom(na, room) || !insideRoom(nb, room)) return null;
  return { a: { free: na }, b: { free: nb } };
}

/** Zet de hoogte (m) van alle VRIJE uiteinden van een touw; vastgemaakte uiteinden volgen hun anchor en blijven ongemoeid. */
export function withFreeHeight(rope: Rope, height: number): Rope {
  const y = round3(clamp(height, ROPE_MIN_Y_M, ROPE_MAX_Y_M));
  const set = (end: RopeEnd): RopeEnd => (isFreeEnd(end) ? { free: [end.free[0], y, end.free[2]] } : end);
  return { ...rope, a: set(rope.a), b: set(rope.b) };
}

export function hasFreeEnd(rope: Rope): boolean {
  return isFreeEnd(rope.a) || isFreeEnd(rope.b);
}

/** De wereldpunten van beide uiteinden (of null als een item ontbreekt). */
export function worldEnds(rope: Rope, items: readonly Floorplan3dItem[], lookup: DimsLookup): { a: Vec3; b: Vec3 } | null {
  const kind = rope.kind ?? "touw";
  const a = anchorWorld(rope.a, items, lookup, kind);
  const b = anchorWorld(rope.b, items, lookup, kind);
  return a && b ? { a, b } : null;
}

/** Items waarvan een deel binnen `radius` m (horizontaal) van het punt ligt: hun bevestigingspunten lichten op tijdens het slepen. */
export function itemsNear(items: readonly Floorplan3dItem[], lookup: DimsLookup, point: Vec3, radius = 2.5): string[] {
  return items
    .filter((item) => {
      const shape = shapeOfDims(dimsOf(item, lookup));
      const reach = Math.max(shape.length_m, shape.width_m) / 2 + radius;
      return Math.abs(item.x - point[0]) <= reach && Math.abs(item.z - point[2]) <= reach;
    })
    .map((item) => item.id);
}
