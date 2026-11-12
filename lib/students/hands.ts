// Handpunten van leerlingposes (uit lib/students/handpoints.generated.ts) in wereldcoördinaten voor een geplaatste leerling.

import { HAND_POINTS } from "@/lib/students/handpoints.generated";
import { poseIdOfSlug, studentScale } from "@/lib/students/catalog";
import type { Floorplan3dItem } from "@/types/floorplan3d";

export type Hand = "links" | "rechts";
export const HANDS: readonly Hand[] = ["links", "rechts"];
export const HAND_LABEL: Record<Hand, string> = { links: "linkerhand", rechts: "rechterhand" };
export type Vec3 = [number, number, number];

/** Draait een punt om de verticale as (zelfde conventie als de rest van de editor: positieve hoek = linksom gezien van boven). */
export function rotateY(point: Vec3, deg: number): Vec3 {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return [point[0] * cos + point[2] * sin, point[1], -point[0] * sin + point[2] * cos];
}

/** Handpunt in de ruimte van het pose-GLB (1,8 m), of null als de pose die hand niet heeft. */
export function handLocal(slug: string, hand: Hand): Vec3 | null {
  const poseId = poseIdOfSlug(slug);
  return (poseId && HAND_POINTS[poseId]?.[hand]) || null;
}

/** Wereldpositie van de hand van een geplaatste leerling (meegedraaid, geschaald naar klein/middel/groot, op de hoogte van het item). */
export function handWorld(student: Floorplan3dItem, hand: Hand): Vec3 | null {
  const local = handLocal(student.slug, hand);
  if (!local) return null;
  const scale = studentScale(student.size);
  const rotated = rotateY([local[0] * scale, local[1] * scale, local[2] * scale], student.rot_y_deg);
  return [student.x + rotated[0], student.y + rotated[1], student.z + rotated[2]];
}
