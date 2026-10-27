// Volledige 3D-oriëntatie van een geplaatst item: heading (Y) + kanteling (X voor/achter, Z zijwaarts).
// Puur (geen React/three), zodat editor, tests en scripts dezelfde berekening gebruiken.
//
// Opslag: graden (leesbaar in de JSON) als Euler in de volgorde YXZ — de volgorde van three.js'
// `Euler('YXZ')`: R = Ry(y) · Rx(x) · Rz(z). Samenstellen en omrekenen gebeurt via rotatiematrices
// (gelijkwaardig aan quaternions en vrij van gimbal-lock-problemen); alleen het opslagformaat en
// de UI tonen Euler-hoeken.
//
// Transform van een lokaal punt p (item-ruimte) naar de wereld, met c = onderste midden van de
// voetafdruk (offset_x, base_m, offset_z):
//     wereld(p) = pos + Ry(y) · ( Rx(x)·Rz(z) · (p − c) + c )
// Zonder kanteling is dat precies `pos + Ry(y)·p`: bestaande plattegronden (alleen heading, om de
// pivot) blijven dus exact hetzelfde staan. Kantelen gebeurt om het onderste midden, zodat een item
// niet om een hoek van het model zwaait.

import { convexHull, partsOf, rotateXZ, type CollisionShape, type Point } from "@/components/canvas-3d/collision-shape";

export type Rotation3 = { x: number; y: number; z: number };
export type Vec3 = [number, number, number];
type Mat3 = [number, number, number, number, number, number, number, number, number];

export const NO_ROTATION: Rotation3 = { x: 0, y: 0, z: 0 };
const TILT_EPS_DEG = 1e-4;
const DEG = Math.PI / 180;

export type ItemRotationFields = { rot_y_deg: number; rot_x_deg?: number; rot_z_deg?: number };

/** Beperkt een kantelhoek tot ±max (graden). */
export function clampTilt(deg: number, maxDeg: number): number {
  return Math.min(maxDeg, Math.max(-maxDeg, deg));
}

/** De volledige rotatie van een item; ontbrekende kantelhoeken (oude plattegronden) zijn 0. */
export function rotationOf(item: ItemRotationFields): Rotation3 {
  return { x: item.rot_x_deg ?? 0, y: item.rot_y_deg, z: item.rot_z_deg ?? 0 };
}

export function isTilted(rot: Pick<Rotation3, "x" | "z">): boolean {
  return Math.abs(rot.x) > TILT_EPS_DEG || Math.abs(rot.z) > TILT_EPS_DEG;
}

export function itemIsTilted(item: ItemRotationFields): boolean {
  return isTilted({ x: item.rot_x_deg ?? 0, z: item.rot_z_deg ?? 0 });
}

// --- matrices --------------------------------------------------------------

const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

function mul(a: Mat3, b: Mat3): Mat3 {
  const out = new Array(9) as Mat3;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) out[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  }
  return out;
}

function apply(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

export function axisMatrix(axis: "x" | "y" | "z", deg: number): Mat3 {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  if (axis === "x") return [1, 0, 0, 0, c, -s, 0, s, c];
  if (axis === "y") return [c, 0, s, 0, 1, 0, -s, 0, c];
  return [c, -s, 0, s, c, 0, 0, 0, 1];
}

/** R = Ry · Rx · Rz (three.js Euler 'YXZ'). */
export function rotationMatrix(rot: Rotation3): Mat3 {
  return mul(axisMatrix("y", rot.y), mul(axisMatrix("x", rot.x), axisMatrix("z", rot.z)));
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clean = (deg: number) => Math.round(deg * 1e4) / 1e4 + 0; // −0 → 0, ruis weg

/** Euler 'YXZ' (graden) uit een rotatiematrix — dezelfde formules als three.js. x ∈ [−90°, 90°]. */
export function matrixToRotation(m: Mat3): Rotation3 {
  const m23 = m[5];
  const x = Math.asin(-clamp(m23, -1, 1));
  let y: number;
  let z: number;
  if (Math.abs(m23) < 0.9999999) {
    y = Math.atan2(m[2], m[8]);
    z = Math.atan2(m[3], m[4]);
  } else {
    y = Math.atan2(-m[6], m[0]);
    z = 0;
  }
  return { x: clean(x / DEG), y: clean(y / DEG), z: clean(z / DEG) };
}

/** Draait de rotatie met `deg` om een WERELD-as (voorspelbaar: kantelt altijd om dezelfde as op het scherm). */
export function rotateAboutWorldAxis(rot: Rotation3, axis: "x" | "y" | "z", deg: number): Rotation3 {
  return matrixToRotation(mul(axisMatrix(axis, deg), rotationMatrix(rot)));
}

/** Draait de rotatie met `deg` om een LOKALE as van het item (gevorderd). */
export function rotateAboutLocalAxis(rot: Rotation3, axis: "x" | "y" | "z", deg: number): Rotation3 {
  return matrixToRotation(mul(rotationMatrix(rot), axisMatrix(axis, deg)));
}

/** Normaliseert hoeken naar [0, 360) voor heading en (−180, 180] voor kanteling. */
export function normalizeRotation(rot: Rotation3): Rotation3 {
  const wrap180 = (deg: number) => {
    const w = ((((deg + 180) % 360) + 360) % 360) - 180;
    return clean(w === -180 ? 180 : w);
  };
  const headingWrapped = ((rot.y % 360) + 360) % 360;
  return { x: wrap180(rot.x), y: clean(headingWrapped), z: wrap180(rot.z) };
}

// --- vorm → 3D-dozen -------------------------------------------------------

export type LocalBox = { center: Vec3; half: Vec3; yawDeg: number };

/** Onderste midden van de voetafdruk (draaipunt van het kantelen), in lokale itemruimte. */
export function tiltCenter(shape: CollisionShape): Vec3 {
  return [shape.offset_x, shape.base_m, shape.offset_z];
}

/**
 * De dozen waaruit een vorm bestaat (lokale itemruimte). Een kanteling gebruikt altijd de oriented
 * box: ook cilinders en capsules worden dan als hun omhullende doos benaderd.
 */
export function shapeBoxes(shape: CollisionShape): LocalBox[] {
  return partsOf(shape).map((part) => {
    const base = part.base_m ?? shape.base_m;
    const height = part.height_m ?? shape.height_m;
    return {
      center: [part.offset_x, base + height / 2, part.offset_z],
      half: [part.length_m / 2, height / 2, part.width_m / 2],
      yawDeg: part.yaw_deg,
    };
  });
}

type Frame = { pos: Vec3; tilt: Mat3; heading: Mat3; center: Vec3 };

function frameOf(shape: CollisionShape, pos: Vec3, rot: Rotation3): Frame {
  return { pos, tilt: mul(axisMatrix("x", rot.x), axisMatrix("z", rot.z)), heading: axisMatrix("y", rot.y), center: tiltCenter(shape) };
}

function toWorld(frame: Frame, p: Vec3): Vec3 {
  const rel: Vec3 = [p[0] - frame.center[0], p[1] - frame.center[1], p[2] - frame.center[2]];
  const t = apply(frame.tilt, rel);
  const q = apply(frame.heading, [t[0] + frame.center[0], t[1] + frame.center[1], t[2] + frame.center[2]]);
  return [frame.pos[0] + q[0], frame.pos[1] + q[1], frame.pos[2] + q[2]];
}

/** Lokaal punt → wereldpunt voor een item op `pos` met rotatie `rot`. */
export function localToWorld(shape: CollisionShape, pos: Vec3, rot: Rotation3, p: Vec3): Vec3 {
  return toWorld(frameOf(shape, pos, rot), p);
}

function localCorners(box: LocalBox): Vec3[] {
  const corners: Vec3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const r = rotateXZ(sx * box.half[0], sz * box.half[2], box.yawDeg);
        corners.push([box.center[0] + r.x, box.center[1] + sy * box.half[1], box.center[2] + r.z]);
      }
    }
  }
  return corners;
}

/** De 8 hoekpunten per doos in de wereld. */
export function worldCorners(shape: CollisionShape, pos: Vec3, rot: Rotation3): Vec3[][] {
  const frame = frameOf(shape, pos, rot);
  return shapeBoxes(shape).map((box) => localCorners(box).map((corner) => toWorld(frame, corner)));
}

/** Voetafdruk (convexe omtrek van de projectie op de vloer) van een gekanteld item, per doos. */
export function tiltedPolygons(shape: CollisionShape, x: number, z: number, rot: Rotation3): Point[][] {
  return worldCorners(shape, [x, 0, z], rot).map((corners) => convexHull(corners.map((c) => ({ x: c[0], z: c[2] }))));
}

/** Verticaal bereik [laagste, hoogste punt] als de pivot op hoogte `y` staat. */
export function rotatedVerticalRange(shape: CollisionShape, y: number, rot: Rotation3): [number, number] {
  const ys = worldCorners(shape, [0, y, 0], rot).flat().map((c) => c[1]);
  if (ys.length === 0) return [y + shape.base_m, y + shape.base_m + shape.height_m];
  return [Math.min(...ys), Math.max(...ys)];
}

/**
 * Hoogte van het laagste punt t.o.v. de pivot. Zonder kanteling is dat `base_m`; met kanteling
 * ligt het lager of hoger. De editor zet `y = ondergrond + lift − lowestOffset`, zodat het laagste
 * punt op de vloer (of `lift` erboven) blijft: niet door de vloer zakken, niet zweven.
 */
export function lowestOffset(shape: CollisionShape, rot: Rotation3): number {
  if (!isTilted(rot)) return shape.base_m;
  return rotatedVerticalRange(shape, 0, rot)[0];
}

/** Grenzen van de (gekantelde) voetafdruk t.o.v. de pivot, voor kamerbegrenzing en snappen. */
export function rotatedExtents(shape: CollisionShape, rot: Rotation3) {
  const points = tiltedPolygons(shape, 0, 0, rot).flat();
  if (points.length === 0) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  return {
    minX: Math.min(...points.map((p) => p.x)),
    maxX: Math.max(...points.map((p) => p.x)),
    minZ: Math.min(...points.map((p) => p.z)),
    maxZ: Math.max(...points.map((p) => p.z)),
  };
}

/** Steekt een deel van het item buiten de zaal (of onder de vloer)? Alleen om te waarschuwen, nooit om te blokkeren. */
export function isOutsideRoom(
  shape: CollisionShape,
  pos: Vec3,
  rot: Rotation3,
  room: { width_m: number; length_m: number },
  toleranceM = 0.02,
): boolean {
  const halfX = room.width_m / 2 + toleranceM;
  const halfZ = room.length_m / 2 + toleranceM;
  return worldCorners(shape, pos, rot)
    .flat()
    .some((c) => Math.abs(c[0]) > halfX || Math.abs(c[2]) > halfZ || c[1] < -toleranceM);
}

// --- oriented boxes in 3D en hun overlap (SAT, 15 assen) -------------------

export type Obb = { center: Vec3; axes: [Vec3, Vec3, Vec3]; half: Vec3 };

/** De oriented boxes van een geplaatst item (één per deel van de vorm). */
export function itemObbs(shape: CollisionShape, pos: Vec3, rot: Rotation3): Obb[] {
  const frame = frameOf(shape, pos, rot);
  const linear = mul(frame.heading, frame.tilt);
  return shapeBoxes(shape).map((box) => {
    const yawM = axisMatrix("y", box.yawDeg);
    const total = mul(linear, yawM);
    const column = (i: number): Vec3 => [total[i], total[3 + i], total[6 + i]];
    return { center: toWorld(frame, box.center), axes: [column(0), column(1), column(2)], half: box.half };
  });
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Snijden twee oriented boxes? `marginM` krimpt beide (raken telt niet als botsen). */
export function obbOverlap(a: Obb, b: Obb, marginM = 0): boolean {
  const ha = a.half.map((h) => Math.max(h - marginM, 0)) as Vec3;
  const hb = b.half.map((h) => Math.max(h - marginM, 0)) as Vec3;
  const d: Vec3 = [b.center[0] - a.center[0], b.center[1] - a.center[1], b.center[2] - a.center[2]];

  const axes: Vec3[] = [...a.axes, ...b.axes];
  for (const u of a.axes) for (const v of b.axes) axes.push(cross(u, v));

  for (const axis of axes) {
    const length = Math.hypot(axis[0], axis[1], axis[2]);
    if (length < 1e-9) continue; // evenwijdige assen: geen scheidende as hieruit
    const n: Vec3 = [axis[0] / length, axis[1] / length, axis[2] / length];
    const ra = a.axes.reduce((sum, u, i) => sum + ha[i] * Math.abs(dot(u, n)), 0);
    const rb = b.axes.reduce((sum, u, i) => sum + hb[i] * Math.abs(dot(u, n)), 0);
    if (Math.abs(dot(d, n)) > ra + rb) return false;
  }
  return true;
}

export function obbsOverlap(a: Obb[], b: Obb[], marginM = 0): boolean {
  return a.some((boxA) => b.some((boxB) => obbOverlap(boxA, boxB, marginM)));
}

export { IDENTITY as IDENTITY_MATRIX };
