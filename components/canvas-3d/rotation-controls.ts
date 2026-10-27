// Pure logica achter de rotatiebediening (paneel, sneltoetsen, 3D-ringen, mobiele drawer).
// De bediening werkt met Euler-hoeken per as (Draaien = Y, Kantelen voor/achter = X, Kantelen
// zijwaarts = Z); de 3D-ringen en sneltoetsen kunnen daarnaast om een wereld- of lokale as draaien
// (via matrixcompositie, zie orientation.ts) en geven altijd weer Euler-hoeken terug.

import { clampRotation, type OrientationConfig } from "@/components/canvas-3d/asset-orientation";
import {
  normalizeRotation,
  rotateAboutLocalAxis,
  rotateAboutWorldAxis,
  type Rotation3,
} from "@/components/canvas-3d/orientation";

export type RotationAxis = "x" | "y" | "z";

/** Slim-stapgroottes (graden); 0 = vrij (geen snapping). */
export const SNAP_OPTIONS = [5, 15, 45, 90, 0] as const;
export const DEFAULT_SNAP_DEG = 15;

/** Bereik van de schuifregelaars. X is beperkt tot ±90° (Euler-conventie: voorover/achterover); Z gaat tot ±180° zodat "op kop" bestaat. */
export const AXIS_RANGE: Record<RotationAxis, [number, number]> = {
  y: [0, 360],
  x: [-90, 90],
  z: [-180, 180],
};

export const AXIS_LABEL: Record<RotationAxis, string> = {
  y: "Draaien",
  x: "Kantelen voor/achter",
  z: "Kantelen zijwaarts",
};

export const AXIS_COLOR: Record<RotationAxis, string> = {
  y: "#16a34a", // groen = draaien
  x: "#dc2626", // rood = voor/achter
  z: "#2563eb", // blauw = zijwaarts
};

/** Snapt een hoek op `stepDeg` (0 of lager = vrij). */
export function snapAngle(deg: number, stepDeg: number): number {
  if (!(stepDeg > 0)) return deg;
  return Math.round(deg / stepDeg) * stepDeg;
}

/** Zet één Euler-component, binnen het bereik van de as en de limieten van het asset. */
export function withAxis(rot: Rotation3, axis: RotationAxis, deg: number, config: OrientationConfig): Rotation3 {
  if (axis !== "y" && !config.allowTilt) return rot;
  const [min, max] = AXIS_RANGE[axis];
  let value = deg;
  if (axis === "y") value = ((deg % 360) + 360) % 360;
  else value = Math.min(max, Math.max(min, deg));
  return clampRotation(normalizeRotation({ ...rot, [axis]: Math.round(value * 100) / 100 }), config);
}

/** Verhoogt een Euler-component met `deltaDeg` (hoek mag over de rand: Y wrapt, X klemt, Z wrapt naar ±180). */
export function stepAxis(rot: Rotation3, axis: RotationAxis, deltaDeg: number, config: OrientationConfig): Rotation3 {
  if (axis === "z") {
    const raw = rot.z + deltaDeg;
    const wrapped = ((((raw + 180) % 360) + 360) % 360) - 180;
    return withAxis(rot, "z", wrapped === -180 && raw > 0 ? 180 : wrapped, config);
  }
  return withAxis(rot, axis, rot[axis] + deltaDeg, config);
}

export type PoseId = "plat" | "rechtop" | "schuin15" | "schuin30" | "schuin45" | "opkop" | "reset";

export type Pose = { id: PoseId; label: string; hint: string };

export const QUICK_POSES: Pose[] = [
  { id: "plat", label: "Plat", hint: "Kanteling weg; het item ligt weer plat (draairichting blijft)" },
  { id: "rechtop", label: "Rechtop (90°)", hint: "Kantel 90° voorover: het item staat rechtop" },
  { id: "schuin15", label: "Schuin 15°", hint: "Kantel 15° voorover" },
  { id: "schuin30", label: "Schuin 30°", hint: "Kantel 30° voorover" },
  { id: "schuin45", label: "Schuin 45°", hint: "Kantel 45° voorover" },
  { id: "opkop", label: "Op kop", hint: "Draai het item 180° zijwaarts: ondersteboven" },
  { id: "reset", label: "Reset rotatie", hint: "Terug naar de standaardstand: plat en met de voorkant naar voren" },
];

/** Past een snelle stand toe. "Plat/Rechtop/Schuin/Op kop" houden de draairichting (Y); alleen "Reset" zet ook Y terug. */
export function applyPose(pose: PoseId, current: Rotation3, config: OrientationConfig): Rotation3 {
  const base = { x: 0, y: current.y, z: 0 };
  const defaults = config.defaultRotation;
  switch (pose) {
    case "reset":
      return clampRotation({ x: defaults?.x ?? 0, y: defaults?.y ?? 0, z: defaults?.z ?? 0 }, config);
    case "plat":
      return clampRotation(base, config);
    case "rechtop":
      return clampRotation({ ...base, x: 90 }, config);
    case "schuin15":
      return clampRotation({ ...base, x: 15 }, config);
    case "schuin30":
      return clampRotation({ ...base, x: 30 }, config);
    case "schuin45":
      return clampRotation({ ...base, x: 45 }, config);
    case "opkop":
      return clampRotation({ ...base, z: 180 }, config);
  }
}

/** Gebruikt de stand de kantelruimte van dit asset? (voor het uitschakelen van de poses bij beperkte assets) */
export function poseAllowed(pose: PoseId, config: OrientationConfig): boolean {
  if (pose === "reset") return true;
  if (!config.allowTilt) return pose === "plat";
  if (pose === "opkop") return config.maxTiltDeg >= 180;
  if (pose === "rechtop") return config.maxTiltDeg >= 90;
  if (pose === "schuin45") return config.maxTiltDeg >= 45;
  if (pose === "schuin30") return config.maxTiltDeg >= 30;
  if (pose === "schuin15") return config.maxTiltDeg >= 15;
  return true;
}

/**
 * Draait de startstand met `deltaDeg` om `axis`, wereld- of lokaal. Met `snapDeg` wordt de bijbehorende
 * Euler-hoek van het resultaat op het raster gelegd (bij "wereld" alleen voor de verticale as; X/Z
 * snappen daar de hoek zelf), zodat een ring niet op scheve waarden uitkomt.
 */
export function rotateWithGizmo(
  start: Rotation3,
  axis: RotationAxis,
  deltaDeg: number,
  options: { local: boolean; snapDeg: number; config: OrientationConfig },
): Rotation3 {
  const { local, snapDeg, config } = options;
  const compose = local ? rotateAboutLocalAxis : rotateAboutWorldAxis;
  let delta = deltaDeg;
  if (snapDeg > 0) {
    const eulerAligned = local || axis === "y";
    if (eulerAligned) {
      const target = snapAngle(start[axis] + deltaDeg, snapDeg);
      delta = target - start[axis];
    } else {
      delta = snapAngle(deltaDeg, snapDeg);
    }
  }
  const next = normalizeRotation(compose(start, axis, delta));
  return clampRotation(next, config);
}

/** Hoekverschil tussen twee hoeken, in (−180, 180]. */
export function angleDelta(from: number, to: number): number {
  const d = ((((to - from + 180) % 360) + 360) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** "12°" / "−45°" voor weergave. */
export function formatDeg(deg: number): string {
  const rounded = Math.round(deg * 10) / 10;
  return `${String(rounded).replace(".", ",").replace("-", "−")}°`;
}
