// Touwen tussen items: pure logica (geen React). Een touw is geen item (zie types/floorplan3d.ts): het heeft geen maten, doet niet
// mee met botsen, snappen of stapelen en wordt bij elke render opnieuw uit de positie van de twee items berekend. Daardoor blijft elk
// uiteinde vast zitten aan zijn punt op het item, ook als dat item wordt verplaatst, gedraaid of gekanteld.

import { anchorPosition, anchorsFor, nearestAnchor, type RopeKind } from "@/components/canvas-3d/anchors";
import { dimsOf, shapeOfDims, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { localToWorld, rotationOf, worldToLocal, type Vec3 } from "@/components/canvas-3d/orientation";
import type { Floorplan3dItem, Rope, RopeAnchor } from "@/types/floorplan3d";

export { removeRopesOfItems, ropesWithItems } from "@/lib/plattegrond/ropes";
export type { Rope, RopeAnchor };

/** Kleur van het touw (toverkoord). */
export const ROPE_COLOR = "#dc2626";
/** Dikte van het touw (m): dik genoeg om vanaf de hele zaal te zien. */
export const ROPE_RADIUS_M = 0.03;
/** Doorhang: een klein beetje, evenredig met de horizontale afstand tussen de uiteinden, met een maximum (m). */
export const ROPE_SAG_RATIO = 0.03;
export const ROPE_MAX_SAG_M = 0.3;
/** Doorhang per soort verbinding (1 = touw): een lint en een net hangen niet door (strak gespannen). Instelbaar per type. */
export const SAG_FACTOR: Record<RopeKind, number> = { touw: 1, lint: 0, net: 0 };
/** Het touw komt niet onder de vloer. */
export const ROPE_MIN_Y_M = 0.03;
/** Een touw korter dan dit (m) is geen touw: de twee punten zitten op elkaar. */
export const MIN_ROPE_LENGTH_M = 0.1;

function shapeOf(item: Floorplan3dItem, lookup: DimsLookup) {
  return shapeOfDims(dimsOf(item, lookup));
}

/** Verschuiving (m) waarboven het migreren van een oud uiteinde naar een anchor wordt gemeld. */
export const MIGRATION_TOLERANCE_M = 0.05;

/**
 * Het punt van een uiteinde in de item-ruimte. Met een `anchor`-id is dat het bevestigingspunt van het item (met de gekozen hoogte bij
 * een verstelbare anchor); een oud uiteinde zonder id wordt direct naar het dichtstbijzijnde passende bevestigingspunt gezet (zie
 * `migrateRopes` voor het blijvend opslaan); bestaat de anchor niet meer, dan is `local` de terugval.
 */
export function anchorLocal(anchor: RopeAnchor, item: Floorplan3dItem, lookup: DimsLookup, kind: RopeKind = "touw"): Vec3 {
  const defs = anchorsFor(item, lookup);
  if (anchor.anchor) {
    const def = defs.find((candidate) => candidate.id === anchor.anchor);
    if (def) return anchorPosition(def, anchor.height);
    return anchor.local;
  }
  const hit = nearestAnchor(defs, anchor.local, kind) ?? nearestAnchor(defs, anchor.local, "any");
  return hit ? hit.point : anchor.local;
}

/** Het punt van een uiteinde in de wereld, of `null` als het item er niet meer is. */
export function anchorWorld(anchor: RopeAnchor, items: readonly Floorplan3dItem[], lookup: DimsLookup, kind: RopeKind = "touw"): Vec3 | null {
  const item = items.find((candidate) => candidate.id === anchor.item);
  if (!item) return null;
  return localToWorld(shapeOf(item, lookup), [item.x, item.y, item.z], rotationOf(item), anchorLocal(anchor, item, lookup, kind));
}

/**
 * Een uiteinde op het bevestigingspunt van een item dat het dichtst bij `world` ligt (het punt waar je klikte of liet los). Het geklikte
 * punt bepaalt alleen WELKE anchor en bij een verstelbare anchor de hoogte; het eindpunt is altijd het bevestigingspunt zelf, nooit de
 * rand van het model of de omhullende box.
 */
export function anchorAt(item: Floorplan3dItem, world: Vec3, lookup: DimsLookup, kind: RopeKind = "touw"): RopeAnchor {
  const hit = snapToAnchor(item, world, lookup, kind);
  return hit.anchor;
}

export type AnchorSnap = { anchor: RopeAnchor; /** Het bevestigingspunt in de wereld. */ world: Vec3; /** Afstand (m) van het geklikte punt tot het bevestigingspunt. */ distance: number; anchorId: string };

/** Zoals `anchorAt`, maar met ook het wereldpunt en de afstand (voor het voorvertoon-touw en de markering tijdens het slepen). */
export function snapToAnchor(item: Floorplan3dItem, world: Vec3, lookup: DimsLookup, kind: RopeKind = "touw"): AnchorSnap {
  const shape = shapeOf(item, lookup);
  const rot = rotationOf(item);
  const pos: Vec3 = [item.x, item.y, item.z];
  const hitLocal = worldToLocal(shape, pos, rot, world);
  const defs = anchorsFor(item, lookup);
  const nearest = nearestAnchor(defs, hitLocal, kind) ?? nearestAnchor(defs, hitLocal, "any");
  if (!nearest) {
    const local: Vec3 = [round(hitLocal[0]), round(hitLocal[1]), round(hitLocal[2])];
    return { anchor: { item: item.id, local }, world: localToWorld(shape, pos, rot, local), distance: 0, anchorId: "" };
  }
  const local: Vec3 = [round(nearest.point[0]), round(nearest.point[1]), round(nearest.point[2])];
  const anchor: RopeAnchor = { item: item.id, local, anchor: nearest.def.id, ...(nearest.height !== undefined ? { height: round(nearest.height) } : {}) };
  return { anchor, world: localToWorld(shape, pos, rot, local), distance: nearest.distance, anchorId: nearest.def.id };
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000 + 0;
}

export function ropeEndpoints(rope: Rope, items: readonly Floorplan3dItem[], lookup: DimsLookup): { a: Vec3; b: Vec3 } | null {
  const kind = rope.kind ?? "touw";
  const a = anchorWorld(rope.a, items, lookup, kind);
  const b = anchorWorld(rope.b, items, lookup, kind);
  return a && b ? { a, b } : null;
}

export function ropeLength(a: Vec3, b: Vec3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

/** Een touw mag niet aan hetzelfde item vastzitten aan beide kanten. */
export function canConnect(a: RopeAnchor, b: RopeAnchor): boolean {
  return a.item !== b.item;
}

export function createRope(id: string, a: RopeAnchor, b: RopeAnchor, kind: RopeKind = "touw"): Rope {
  return kind === "touw" ? { id, a, b } : { id, a, b, kind };
}

/** Zet één uiteinde van een touw op een ander punt. */
export function withAnchor(rope: Rope, end: "a" | "b", anchor: RopeAnchor): Rope {
  return { ...rope, [end]: anchor };
}

/**
 * De lijn van het touw: een lichte parabool tussen de twee uiteinden (de uiteinden liggen exact op hun punt), het midden hangt een
 * klein beetje door. De doorhang volgt de horizontale afstand, dus een bijna verticaal touw hangt niet door, en blijft zo klein dat het touw
 * boven de vloer blijft (een touw tussen twee lage objecten hangt dus bijna niet door). `segments + 1` punten.
 */
export function ropeCurvePoints(a: Vec3, b: Vec3, segments = 24, kind: RopeKind = "touw"): Vec3[] {
  const horizontal = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const sagFactor = SAG_FACTOR[kind];
  const sag = Math.max(0, Math.min(ROPE_MAX_SAG_M * sagFactor, horizontal * ROPE_SAG_RATIO * sagFactor, Math.min(a[1], b[1]) - ROPE_MIN_Y_M));
  const points: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    points.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * sag * t * (1 - t), a[2] + (b[2] - a[2]) * t]);
  }
  return points;
}

// --- migratie van oude verbindingen -------------------------------------------------------------------------------------

export type RopeMigrationChange = {
  ropeId: string;
  end: "a" | "b";
  itemId: string;
  slug: string;
  anchorId: string;
  /** Hoeveel meter het uiteinde is verschoven door te kiezen voor het bevestigingspunt. */
  shiftM: number;
  /** Groter dan de tolerantie: melden. */
  exceeded: boolean;
};

/**
 * Zet uiteinden zonder `anchor`-id (plattegronden van vóór de anchors) op het dichtstbijzijnde passende bevestigingspunt van hun item.
 * Gewone, al gemigreerde uiteinden blijven ongemoeid (idempotent). Geeft ook de lijst van wijzigingen terug (voor de console en het rapport).
 */
export function migrateRopes(
  ropes: readonly Rope[],
  items: readonly Floorplan3dItem[],
  lookup: DimsLookup,
  toleranceM = MIGRATION_TOLERANCE_M,
): { ropes: Rope[]; changes: RopeMigrationChange[] } {
  const changes: RopeMigrationChange[] = [];
  const out = ropes.map((rope) => {
    const kind = rope.kind ?? "touw";
    const next: Rope = { ...rope };
    for (const end of ["a", "b"] as const) {
      const anchor = rope[end];
      if (anchor.anchor) continue;
      const item = items.find((candidate) => candidate.id === anchor.item);
      if (!item) continue;
      const defs = anchorsFor(item, lookup);
      const hit = nearestAnchor(defs, anchor.local, kind) ?? nearestAnchor(defs, anchor.local, "any");
      if (!hit) continue;
      const local: Vec3 = [round(hit.point[0]), round(hit.point[1]), round(hit.point[2])];
      next[end] = { item: anchor.item, local, anchor: hit.def.id, ...(hit.height !== undefined ? { height: round(hit.height) } : {}) };
      const shiftM = Math.hypot(local[0] - anchor.local[0], local[1] - anchor.local[1], local[2] - anchor.local[2]);
      changes.push({ ropeId: rope.id, end, itemId: item.id, slug: item.slug, anchorId: hit.def.id, shiftM: round(shiftM), exceeded: shiftM > toleranceM });
    }
    return next;
  });
  return { ropes: out, changes };
}

/** Migreert bij het laden en meldt grotere verschuivingen in de console (zodat je ziet welke plattegronden zijn bijgewerkt). */
export function migrateRopesWithReport(ropes: readonly Rope[], items: readonly Floorplan3dItem[], lookup: DimsLookup, context = "plattegrond"): Rope[] {
  const { ropes: migrated, changes } = migrateRopes(ropes, items, lookup);
  for (const change of changes.filter((c) => c.exceeded)) {
    console.warn(`[anchors] ${context}: touw ${change.ropeId.slice(0, 8)} uiteinde ${change.end} op "${change.slug}" is ${(change.shiftM * 100).toFixed(0)} cm verschoven naar bevestigingspunt "${change.anchorId}".`);
  }
  return migrated;
}
