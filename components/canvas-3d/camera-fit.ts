// Beginafstand van de perspectief-editorcamera: de zaal vult het canvas met een kleine marge. Puur (geen React/three), zie camera-fit.test.ts.
import { projectedSpan } from "@/components/plattegrond/viewer-framing";

/** Afstand van de perspectiefcamera (fov in graden, verticaal) waarbij de zaal met marge in het canvas past (breedte én hoogte). */
export function fitPerspectiveDistance(room: { width_m: number; length_m: number }, azimuthDeg: number, polarDeg: number, aspect: number, fovDeg: number, margin: number): number {
  const span = projectedSpan({ minX: -room.width_m / 2, maxX: room.width_m / 2, minZ: -room.length_m / 2, maxZ: room.length_m / 2, maxY: 2.5 }, azimuthDeg, polarDeg);
  const tan = Math.tan((fovDeg * Math.PI) / 360);
  return Math.max(5, Math.max((span.width * margin) / (2 * tan * Math.max(aspect, 0.2)), (span.height * margin) / (2 * tan)));
}
