// Materiaal in de hand van een leerling. Pure logica (geen React/three): snappen aan een hand, de positie van een vastgehouden object uit de
// actuele handpositie, loslaten en opruimen van koppelingen. De koppeling `houdt_vast` is het enige dat wordt opgeslagen; positie en draaiing
// worden hieruit berekend (applyHolds) en volgen dus elke verplaatsing, draaiing, schaalwissel en posewissel van de leerling.

import { handWorld, HANDS, rotateY, type Hand, type Vec3 } from "@/lib/students/hands";
import { isStudentSlug } from "@/lib/students/catalog";
import type { Floorplan3dItem } from "@/types/floorplan3d";

/** Afstand (m) waarbinnen het greeppunt van een object aan een handpunt vastklikt. */
export const HAND_SNAP_RADIUS_M = 0.14;
/** Standaard maximaal aantal objecten per leerling (één per hand). */
export const MAX_HELD_PER_STUDENT = 2;

export type GripFor = (item: Floorplan3dItem) => { pakbaar: boolean; grip: Vec3 } | null;

/** Wereldpositie van het greeppunt van een item (meegedraaid met de heading, op de hoogte van het item). */
export function gripWorld(item: Floorplan3dItem, grip: Vec3): Vec3 {
  const rotated = rotateY(grip, item.rot_y_deg);
  return [item.x + rotated[0], item.y + rotated[1], item.z + rotated[2]];
}

/** Welke hand van deze leerling is bezet, en door welk item? */
export function occupiedHands(items: readonly Floorplan3dItem[], studentId: string): Map<Hand, string> {
  const map = new Map<Hand, string>();
  for (const item of items) if (item.houdt_vast?.leerling === studentId) map.set(item.houdt_vast.hand, item.id);
  return map;
}

export type HandSnap = { studentId: string; hand: Hand; point: Vec3; distance: number; occupiedBy: string | null };

/**
 * De dichtstbijzijnde hand (binnen `radius`) bij het greeppunt van `item`. Een bezette hand wordt wel teruggegeven (met `occupiedBy`), zodat de editor
 * "Hand bezet" kan melden i.p.v. stil te vervangen. Het item zelf en leerlingen zonder handpunt tellen niet mee.
 */
export function nearestHand(item: Floorplan3dItem, grip: Vec3, items: readonly Floorplan3dItem[], radius: number = HAND_SNAP_RADIUS_M): HandSnap | null {
  const at = gripWorld(item, grip);
  let best: HandSnap | null = null;
  for (const student of items) {
    if (student.id === item.id || !isStudentSlug(student.slug)) continue;
    const taken = occupiedHands(items, student.id);
    for (const hand of HANDS) {
      const point = handWorld(student, hand);
      if (!point) continue;
      const distance = Math.hypot(point[0] - at[0], point[1] - at[1], point[2] - at[2]);
      if (distance <= radius && (!best || distance < best.distance)) best = { studentId: student.id, hand, point, distance, occupiedBy: taken.get(hand) ?? null };
    }
  }
  return best;
}

/** Het item in de hand: greeppunt precies op het handpunt, voorkant gelijk aan die van de leerling, hoogte via "Vrij in hoogte". */
export function holdPlacement(student: Floorplan3dItem, hand: Hand, grip: Vec3): Pick<Floorplan3dItem, "x" | "y" | "z" | "rot_y_deg" | "lift_m"> | null {
  const point = handWorld(student, hand);
  if (!point) return null;
  const rot_y_deg = student.rot_y_deg;
  const offset = rotateY(grip, rot_y_deg);
  const y = point[1] - offset[1];
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return { x: round(point[0] - offset[0]), y: round(Math.max(0, y)), z: round(point[2] - offset[2]), rot_y_deg, lift_m: round(Math.max(0, y)) };
}

export type HoldsResult = { items: Floorplan3dItem[]; released: { id: string; reason: "leerling-weg" | "hand-onbekend" | "niet-pakbaar" | "hand-bezet" }[] };

/**
 * Past alle koppelingen toe: elk vastgehouden object krijgt de plek van de actuele hand. Een koppeling die niet meer klopt (leerling weg, pose zonder
 * die hand, object niet pakbaar, twee objecten in één hand) wordt losgelaten: het object blijft staan waar het stond. Verandert niets als alles klopt.
 */
export function applyHolds(items: Floorplan3dItem[], gripFor: GripFor): HoldsResult {
  const byId = new Map(items.map((item) => [item.id, item]));
  const released: HoldsResult["released"] = [];
  const claimed = new Set<string>();
  let changed = false;
  const next = items.map((item) => {
    const hold = item.houdt_vast;
    if (!hold) return item;
    const release = (reason: HoldsResult["released"][number]["reason"]) => {
      released.push({ id: item.id, reason });
      changed = true;
      const { houdt_vast: _gone, ...rest } = item;
      void _gone;
      return rest as Floorplan3dItem;
    };
    const student = byId.get(hold.leerling);
    if (!student || !isStudentSlug(student.slug)) return release("leerling-weg");
    const grip = gripFor(item);
    if (!grip || !grip.pakbaar) return release("niet-pakbaar");
    const key = `${hold.leerling}:${hold.hand}`;
    if (claimed.has(key)) return release("hand-bezet");
    const placement = holdPlacement(student, hold.hand, grip.grip);
    if (!placement) return release("hand-onbekend");
    claimed.add(key);
    if (placement.x === item.x && placement.y === item.y && placement.z === item.z && placement.rot_y_deg === item.rot_y_deg && placement.lift_m === item.lift_m) return item;
    changed = true;
    return { ...item, ...placement };
  });
  return { items: changed ? next : items, released };
}

/** Los alle koppelingen aan een leerling (bijv. voor het verwijderen): de objecten blijven op de plek van de hand staan. */
export function releaseFromStudent(items: Floorplan3dItem[], studentId: string): Floorplan3dItem[] {
  return items.map((item) => {
    if (item.houdt_vast?.leerling !== studentId) return item;
    const { houdt_vast: _gone, ...rest } = item;
    void _gone;
    return rest as Floorplan3dItem;
  });
}
