// Touwen tussen items: pure logica (geen React). Een touw is geen item (zie types/floorplan3d.ts): het heeft geen maten, doet niet
// mee met botsen, snappen of stapelen en wordt bij elke render opnieuw uit de positie van de twee items berekend. Daardoor blijft elk
// uiteinde vast zitten aan zijn punt op het item, ook als dat item wordt verplaatst, gedraaid of gekanteld.

import { dimsOf, shapeOfDims, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { localToWorld, rotationOf, worldToLocal, type Vec3 } from "@/components/canvas-3d/orientation";
import type { Floorplan3dItem, Rope, RopeAnchor } from "@/types/floorplan3d";

export { removeRopesOfItems, ropesWithItems } from "@/lib/plattegrond/ropes";
export type { Rope, RopeAnchor };

/** Kleur van het touw (toverkoord). */
export const ROPE_COLOR = "#dc2626";
/** Dikte van het touw (m): dik genoeg om vanaf de hele zaal te zien. */
export const ROPE_RADIUS_M = 0.03;
/** Een touw korter dan dit (m) is geen touw: de twee punten zitten op elkaar. */
export const MIN_ROPE_LENGTH_M = 0.1;

function shapeOf(item: Floorplan3dItem, lookup: DimsLookup) {
  return shapeOfDims(dimsOf(item, lookup));
}

/** Het punt van een uiteinde in de wereld, of `null` als het item er niet meer is. */
export function anchorWorld(anchor: RopeAnchor, items: readonly Floorplan3dItem[], lookup: DimsLookup): Vec3 | null {
  const item = items.find((candidate) => candidate.id === anchor.item);
  if (!item) return null;
  return localToWorld(shapeOf(item, lookup), [item.x, item.y, item.z], rotationOf(item), anchor.local);
}

/** Een uiteinde op het punt `world` van een item: het punt wordt omgerekend naar de lokale ruimte van het item. */
export function anchorAt(item: Floorplan3dItem, world: Vec3, lookup: DimsLookup): RopeAnchor {
  const local = worldToLocal(shapeOf(item, lookup), [item.x, item.y, item.z], rotationOf(item), world);
  return { item: item.id, local: [round(local[0]), round(local[1]), round(local[2])] };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000 + 0;
}

export function ropeEndpoints(rope: Rope, items: readonly Floorplan3dItem[], lookup: DimsLookup): { a: Vec3; b: Vec3 } | null {
  const a = anchorWorld(rope.a, items, lookup);
  const b = anchorWorld(rope.b, items, lookup);
  return a && b ? { a, b } : null;
}

export function ropeLength(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

/** Een touw mag niet aan hetzelfde item vastzitten aan beide kanten. */
export function canConnect(a: RopeAnchor, b: RopeAnchor): boolean {
  return a.item !== b.item;
}

export function createRope(id: string, a: RopeAnchor, b: RopeAnchor): Rope {
  return { id, a, b };
}

/** Zet één uiteinde van een touw op een ander punt. */
export function withAnchor(rope: Rope, end: "a" | "b", anchor: RopeAnchor): Rope {
  return { ...rope, [end]: anchor };
}
