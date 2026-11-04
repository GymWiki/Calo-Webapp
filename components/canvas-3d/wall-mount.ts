// Wandmontage-objecten in de zaalmodellen (wandrekken): de voorkant (klimzijde) wijst de zaal in, de achterkant (montageconsole) zit tegen de wand.
// Puur (geen three/React): zie wall-mount.test.ts en scripts/audit-wall-orientation.ts.
//
// Bevinding (GLB's gymzaal_standaard, _complex_2x2, _complex_4x1): de Wandrek_*-nodes staan 180° gedraaid, zodat de montageconsole (lokale −Z, het
// stalen Staal_Wandconsole op z = −0,14) de zaal in wijst en de ribben (lokale +Z) tegen/in de achterwand zitten. Het model zelf is goed
// (lokale +Z = voorkant); de fout zit in de nodeplaatsing in het zaalmodel. Voorkeursoplossing: hier corrigeren in de loader (geen Blender-wijziging nodig).

/** Naam van wandmontage-nodes in het zaalmodel die gecorrigeerd worden. */
export const WALL_MOUNT_NODE = /^Wandrek/;

/** Diepte van het wandrek achter zijn oorsprong (lokale −Z: de achterkant van de console), uit de mesh gemeten. */
export const WALL_RACK_BACK_DEPTH_M = 0.14;
/** Afstand van de oorsprong tot de binnenkant van de wand in het model: wandmidden + 0,19 m (zo staan de nodes in de GLB's) en de binnenkant ligt 0,14 m vóór het wandmidden. */
export const WALL_RACK_MODEL_OFFSET_M = 0.19;
export const WALL_INNER_FACE_FROM_CENTER_M = 0.14;
/**
 * Hoeveel de oorsprong na het omdraaien naar de zaal toe moet, zodat de achterkant precies de wand raakt: de achterkant ligt 0,14 m achter de
 * oorsprong en de wandbinnenkant 0,19 − 0,14 = 0,05 m achter de huidige oorsprong → 0,14 − 0,05 = 0,09 m.
 */
export const WALL_RACK_FRONT_SHIFT_M = WALL_RACK_BACK_DEPTH_M - (WALL_RACK_MODEL_OFFSET_M - WALL_INNER_FACE_FROM_CENTER_M);

export type WallMountPose = { x: number; z: number; yawDeg: number };

/** Voorwaartse richting (lokale +Z) in de wereld voor een draaiing om Y (three.js: rotation.y = +graden). */
export function frontNormal(yawDeg: number): { x: number; z: number } {
  const rad = (yawDeg * Math.PI) / 180;
  return { x: Math.sin(rad), z: Math.cos(rad) };
}

/** Wereldpunt op de achterkant van het object (lokaal z = −backDepth). */
export function backFacePoint(pose: WallMountPose, backDepth = WALL_RACK_BACK_DEPTH_M): { x: number; z: number } {
  const n = frontNormal(pose.yawDeg);
  return { x: pose.x - n.x * backDepth, z: pose.z - n.z * backDepth };
}

/** De gecorrigeerde plaatsing van een wandrek-node: 180° om Y en het stukje naar de zaal toe zodat de achterkant de wand raakt. */
export function correctWallMount(pose: WallMountPose): WallMountPose {
  const yawDeg = (((pose.yawDeg + 180) % 360) + 360) % 360;
  const n = frontNormal(yawDeg);
  return { x: pose.x + n.x * WALL_RACK_FRONT_SHIFT_M, z: pose.z + n.z * WALL_RACK_FRONT_SHIFT_M, yawDeg };
}
