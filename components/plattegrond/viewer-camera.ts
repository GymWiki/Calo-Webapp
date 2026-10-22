// Pure camerawiskunde van de alleen-lezen plattegrond-viewer: standen
// ("3D" schuin, "Bovenaanzicht"), beperkt draaien, zoomgrenzen en hoe groot
// de kamer in beeld moet passen. Geen React/three — zie viewer-camera.test.ts.
//
// Model: de camera kijkt altijd naar het midden van de kamer. De stand is
//   preset  — "3d" (schuin, ~isometrisch) of "top" (recht van boven)
//   step    — hele kwartslagen (pijltjes, 90° per stap, onbeperkt)
//   offset  — vrij slepen, begrensd op ±DRAG_LIMIT_DEG rond de huidige stap
//   zoom    — vermenigvuldiger op de "past precies"-zoom, begrensd

export type ViewPreset = "3d" | "top";

export type ViewState = {
  preset: ViewPreset;
  step: number;
  offsetDeg: number;
  zoom: number;
};

export const DEFAULT_VIEW: ViewState = { preset: "3d", step: 0, offsetDeg: 0, zoom: 1 };

/** Hoek (graden) vanaf verticaal van de schuine weergave (≈ isometrisch). */
export const POLAR_3D_DEG = 54.7;
/** Bijna 0 i.p.v. exact 0: bij precies loodrecht omlaag is "boven" op het scherm ongedefinieerd. */
export const POLAR_TOP_DEG = 0.05;
export const AZIMUTH_3D_DEG = 45;
export const DRAG_LIMIT_DEG = 40;
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 2.5;
export const ZOOM_STEP = 1.25;
export const TRANSITION_MS = 400;

export type CameraPose = { azimuthDeg: number; polarDeg: number; zoom: number };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function azimuthDegOf(view: Pick<ViewState, "preset" | "step" | "offsetDeg">): number {
  const base = view.preset === "3d" ? AZIMUTH_3D_DEG : 0;
  return base + 90 * view.step + view.offsetDeg;
}

export function polarDegOf(preset: ViewPreset): number {
  return preset === "3d" ? POLAR_3D_DEG : POLAR_TOP_DEG;
}

export function withPreset(view: ViewState, preset: ViewPreset): ViewState {
  return { ...view, preset, offsetDeg: 0 };
}

export function rotateStep(view: ViewState, direction: 1 | -1): ViewState {
  return { ...view, step: view.step + direction, offsetDeg: 0 };
}

export function dragBy(view: ViewState, deltaDeg: number): ViewState {
  return { ...view, offsetDeg: clamp(view.offsetDeg + deltaDeg, -DRAG_LIMIT_DEG, DRAG_LIMIT_DEG) };
}

export function zoomBy(view: ViewState, factor: number): ViewState {
  return { ...view, zoom: clamp(view.zoom * factor, ZOOM_MIN, ZOOM_MAX) };
}

export function canZoomIn(view: ViewState): boolean {
  return view.zoom < ZOOM_MAX - 1e-6;
}

export function canZoomOut(view: ViewState): boolean {
  return view.zoom > ZOOM_MIN + 1e-6;
}

export function resetView(): ViewState {
  return { ...DEFAULT_VIEW };
}

// ----------------------------------------------------------------------------
// Passend in beeld
// ----------------------------------------------------------------------------

type Vec3 = [number, number, number];

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Camerarichting (van camera naar midden) bij een azimut/polar. */
function viewDirection(azimuthDeg: number, polarDeg: number): Vec3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const polar = (polarDeg * Math.PI) / 180;
  return [-Math.sin(polar) * Math.sin(az), -Math.cos(polar), -Math.sin(polar) * Math.cos(az)];
}

/** Positie van de camera op `distance` van het midden. */
export function cameraPosition(azimuthDeg: number, polarDeg: number, distance: number): Vec3 {
  const d = viewDirection(azimuthDeg, polarDeg);
  return [-d[0] * distance, -d[1] * distance, -d[2] * distance];
}

/**
 * Zoom (pixels per meter, orthografisch) waarbij de hele kamer (inclusief
 * muurhoogte) net in beeld past, met marge. Rekent in het ergste geval over
 * het hele sleepbereik zodat de zoom niet "pompt" tijdens het draaien.
 */
export function fitZoom({
  room,
  viewport,
  azimuthDeg,
  polarDeg,
  wallHeight = 3,
  margin = 1.12,
}: {
  room: { width_m: number; length_m: number };
  viewport: { width: number; height: number };
  azimuthDeg: number;
  polarDeg: number;
  wallHeight?: number;
  margin?: number;
}): number {
  const hw = Math.max(room.width_m, 0.1) / 2;
  const hl = Math.max(room.length_m, 0.1) / 2;
  const corners: Vec3[] = [];
  for (const x of [-hw, hw]) for (const z of [-hl, hl]) for (const y of [0, wallHeight]) corners.push([x, y, z]);

  let best = Infinity;
  for (const az of [azimuthDeg - DRAG_LIMIT_DEG, azimuthDeg, azimuthDeg + DRAG_LIMIT_DEG]) {
    const d = viewDirection(az, polarDeg);
    const right = normalize(cross(d, [0, 1, 0]));
    const up = normalize(cross(right, d));
    const rs = corners.map((c) => dot(c, right));
    const us = corners.map((c) => dot(c, up));
    const spanR = Math.max(...rs) - Math.min(...rs);
    const spanU = Math.max(...us) - Math.min(...us);
    best = Math.min(best, viewport.width / (spanR * margin), viewport.height / (spanU * margin));
  }
  return Number.isFinite(best) && best > 0 ? best : 10;
}

export function poseFor(
  view: ViewState,
  room: { width_m: number; length_m: number },
  viewport: { width: number; height: number },
): CameraPose {
  const polarDeg = polarDegOf(view.preset);
  const baseAzimuth = azimuthDegOf({ ...view, offsetDeg: 0 });
  const fit = fitZoom({ room, viewport, azimuthDeg: baseAzimuth, polarDeg });
  return { azimuthDeg: azimuthDegOf(view), polarDeg, zoom: fit * view.zoom };
}

export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function lerpPose(from: CameraPose, to: CameraPose, t: number): CameraPose {
  const e = easeInOutCubic(t);
  return {
    azimuthDeg: from.azimuthDeg + (to.azimuthDeg - from.azimuthDeg) * e,
    polarDeg: from.polarDeg + (to.polarDeg - from.polarDeg) * e,
    // zoom vermenigvuldigt: gelijkmatig in log-ruimte voelt natuurlijker.
    zoom: from.zoom * Math.pow(to.zoom / from.zoom, e),
  };
}
