import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { floorplan3dItemSchema } from "@/types/floorplan3d";
import type { CollisionShape } from "@/components/canvas-3d/collision-shape";
import { clampRotation, normalizeItemRotation, orientationFor } from "@/components/canvas-3d/asset-orientation";
import {
  isOutsideRoom,
  isTilted,
  itemObbs,
  lowestOffset,
  matrixToRotation,
  obbsOverlap,
  rotateAboutLocalAxis,
  rotateAboutWorldAxis,
  rotatedExtents,
  rotatedVerticalRange,
  rotationMatrix,
  rotationOf,
  tiltedPolygons,
  worldCorners,
  type Rotation3,
} from "@/components/canvas-3d/orientation";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

function box(length: number, width: number, height: number, extra: Partial<CollisionShape> = {}): CollisionShape {
  return { kind: "box", length_m: length, width_m: width, height_m: height, offset_x: 0, offset_z: 0, base_m: 0, yaw_deg: 0, source: "db", ...extra };
}

/** Onafhankelijke referentie met three.js: T(pos)·Ry·T(c)·Rx·Rz·T(−c) — dezelfde transform als de editor rendert. */
function threeWorld(shape: CollisionShape, pos: [number, number, number], rot: Rotation3, p: [number, number, number]) {
  const c = new THREE.Vector3(shape.offset_x, shape.base_m, shape.offset_z);
  const rad = (d: number) => THREE.MathUtils.degToRad(d);
  const m = new THREE.Matrix4()
    .makeTranslation(pos[0], pos[1], pos[2])
    .multiply(new THREE.Matrix4().makeRotationY(rad(rot.y)))
    .multiply(new THREE.Matrix4().makeTranslation(c.x, c.y, c.z))
    .multiply(new THREE.Matrix4().makeRotationX(rad(rot.x)))
    .multiply(new THREE.Matrix4().makeRotationZ(rad(rot.z)))
    .multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  return new THREE.Vector3(...p).applyMatrix4(m);
}

const SAMPLES: Rotation3[] = [
  { x: 0, y: 0, z: 0 },
  { x: 90, y: 0, z: 0 },
  { x: 0, y: 0, z: 90 },
  { x: 45, y: 30, z: 0 },
  { x: 30, y: 15, z: 45 },
  { x: -20, y: 100, z: 35 },
  { x: 90, y: 90, z: 0 },
  { x: 0, y: 270, z: 180 },
];

test("rotatiematrix volgt three.js Euler 'YXZ'", () => {
  for (const rot of SAMPLES) {
    const euler = new THREE.Euler(THREE.MathUtils.degToRad(rot.x), THREE.MathUtils.degToRad(rot.y), THREE.MathUtils.degToRad(rot.z), "YXZ");
    const m = rotationMatrix(rot);
    for (const v of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [0.3, -0.7, 1.9]] as const) {
      const expected = new THREE.Vector3(...v).applyEuler(euler);
      const got = [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
      near(got[0], expected.x);
      near(got[1], expected.y);
      near(got[2], expected.z);
    }
  }
});

test("Euler ↔ matrix: omrekenen geeft dezelfde rotatie terug, ook bij gimbal lock (x = ±90°)", () => {
  for (const rot of SAMPLES) {
    const back = matrixToRotation(rotationMatrix(rot));
    const a = rotationMatrix(rot);
    const b = rotationMatrix(back);
    for (let i = 0; i < 9; i++) near(a[i], b[i], 1e-6);
    assert.ok(back.x >= -90 - 1e-6 && back.x <= 90 + 1e-6, `x binnen ±90°: ${back.x}`);
  }
  // en gelijk aan wat three.js uit dezelfde matrix haalt
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.4, 1.2, -0.7, "YXZ"));
  const e = new THREE.Euler().setFromQuaternion(q, "YXZ");
  const mine = matrixToRotation(rotationMatrix({ x: (0.4 * 180) / Math.PI, y: (1.2 * 180) / Math.PI, z: (-0.7 * 180) / Math.PI }));
  near(mine.x, (e.x * 180) / Math.PI, 1e-3);
  near(mine.y, (e.y * 180) / Math.PI, 1e-3);
  near(mine.z, (e.z * 180) / Math.PI, 1e-3);
});

test("samenstellen om wereld- en lokale assen komt overeen met quaternions", () => {
  const start: Rotation3 = { x: 20, y: 90, z: 10 };
  const q0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(20), THREE.MathUtils.degToRad(90), THREE.MathUtils.degToRad(10), "YXZ"));
  for (const axis of ["x", "y", "z"] as const) {
    const unit = new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
    const dq = new THREE.Quaternion().setFromAxisAngle(unit, THREE.MathUtils.degToRad(30));
    const world = dq.clone().multiply(q0);
    const local = q0.clone().multiply(dq);
    for (const [mine, q] of [[rotateAboutWorldAxis(start, axis, 30), world], [rotateAboutLocalAxis(start, axis, 30), local]] as const) {
      const m = rotationMatrix(mine);
      const ref = new THREE.Matrix4().makeRotationFromQuaternion(q).elements;
      // three: kolom-major
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) near(m[r * 3 + c], ref[c * 4 + r], 1e-4);
    }
  }
  // wereld-Y = gewoon de heading ophogen
  const turned = rotateAboutWorldAxis({ x: 30, y: 10, z: 0 }, "y", 25);
  near(turned.y, 35, 1e-6);
  near(turned.x, 30, 1e-6);
});

test("hoekpunten in de wereld kloppen met een onafhankelijke three.js-berekening (90°, 45°, 30° en combinaties)", () => {
  const shape = box(2, 1, 0.4, { offset_x: 0.3, offset_z: -0.2, base_m: 0.05, yaw_deg: 20 });
  for (const rot of SAMPLES) {
    const pos: [number, number, number] = [1.5, 0.1, -2];
    const mine = worldCorners(shape, pos, rot)[0];
    // dezelfde lokale hoeken via three
    const hl = 1, hw = 0.5, hh = 0.2, cy = 0.05 + 0.2;
    let i = 0;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const yaw = THREE.MathUtils.degToRad(20);
      const lx = sx * hl, lz = sz * hw;
      const p: [number, number, number] = [0.3 + lx * Math.cos(yaw) + lz * Math.sin(yaw), cy + sy * hh, -0.2 - lx * Math.sin(yaw) + lz * Math.cos(yaw)];
      const ref = threeWorld(shape, pos, rot, p);
      near(mine[i][0], ref.x, 1e-9);
      near(mine[i][1], ref.y, 1e-9);
      near(mine[i][2], ref.z, 1e-9);
      i++;
    }
  }
});

test("zonder kanteling is de voetafdruk precies die van de oude 2D-berekening", () => {
  const shape = box(2, 1, 0.4, { offset_x: 0.3, offset_z: -0.2, yaw_deg: 20 });
  const rot = { x: 0, y: 37, z: 0 };
  assert.equal(isTilted(rot), false);
  assert.equal(lowestOffset(shape, rot), shape.base_m);
  const [lo, hi] = rotatedVerticalRange(shape, 1, rot);
  near(lo, 1);
  near(hi, 1.4);
});

test("laagste punt na kantelen: rechtop (90°) en schuin (45°, 30°) — op de vloer zonder zakken of zweven", () => {
  const bank = box(2, 1, 0.4);
  // 90° voor/achter: de bank staat op zijn lange rand; hoogte = breedte (1 m), laagste punt −0,5 t.o.v. de pivot.
  near(lowestOffset(bank, { x: 90, y: 0, z: 0 }), -0.5);
  let y = -lowestOffset(bank, { x: 90, y: 0, z: 0 });
  let range = rotatedVerticalRange(bank, y, { x: 90, y: 0, z: 0 });
  near(range[0], 0);
  near(range[1], 1);

  // 45° zijwaarts: y' = sinθ·x + cosθ·y → laagste −0,7071, hoogste 0,7071 + 0,4·0,7071 = 0,9899
  const rot45 = { x: 0, y: 0, z: 45 };
  near(lowestOffset(bank, rot45), -Math.SQRT1_2);
  y = -lowestOffset(bank, rot45);
  range = rotatedVerticalRange(bank, y, rot45);
  near(range[0], 0, 1e-4);
  near(range[1], Math.SQRT1_2 * 2.4, 1e-4); // 0,7071 (correctie) + 0,9899 (hoogste punt)

  // 30° voor/achter én 30° zijwaarts: het laagste punt ligt na correctie exact op 0, nooit eronder
  const combo = { x: 30, y: 50, z: 30 };
  y = -lowestOffset(bank, combo);
  range = rotatedVerticalRange(bank, y, combo);
  near(range[0], 0, 1e-9);
  assert.ok(range[1] > 0);
  // een pivot onder de vloer (base_m < 0) blijft ook kloppen
  const sunk = box(2, 1, 0.4, { base_m: -0.1 });
  y = -lowestOffset(sunk, combo);
  near(rotatedVerticalRange(sunk, y, combo)[0], 0, 1e-9);
});

test("oriented box klopt: een gekantelde doos blijft 'strak' en wordt niet de grote world-AABB", () => {
  const bank = box(2, 1, 0.4);
  const rot = { x: 0, y: 0, z: 45 };
  const [obb] = itemObbs(bank, [0, 0, 0], rot);
  // halve maten blijven die van de doos zelf
  assert.deepEqual(obb.half, [1, 0.2, 0.5]);
  // de AABB van de projectie is breder dan de doos (cosinus), maar de oriënted box niet
  const polygons = tiltedPolygons(bank, 0, 0, rot);
  const xs = polygons[0].map((p) => p.x);
  near(Math.max(...xs) - Math.min(...xs), 2 * Math.cos(Math.PI / 4) + 0 * 0.4, 0.45);
  // as-uitlijning: lokale x-as wijst na 45° Z naar (cos45, sin45, 0)
  near(obb.axes[0][0], Math.SQRT1_2);
  near(obb.axes[0][1], Math.SQRT1_2);
});

test("rechtop zetten: voetafdruk wordt lengte × dikte, extents kloppen", () => {
  const mat = box(2, 1, 0.1);
  // x = 90: de mat staat op zijn lange rand → voetafdruk 2 (x) × 0,1 (dikte, z)
  const extents = rotatedExtents(mat, { x: 90, y: 0, z: 0 });
  near(extents.maxX - extents.minX, 2);
  near(extents.maxZ - extents.minZ, 0.1); // na Rx(90) wordt de dikte (lokale y) de diepte (z); de breedte (1 m) wordt hoogte
  const [lo, hi] = rotatedVerticalRange(mat, -lowestOffset(mat, { x: 90, y: 0, z: 0 }), { x: 90, y: 0, z: 0 });
  near(lo, 0, 1e-9);
  near(hi, 1, 1e-9);
});

test("3D-overlap (SAT): raken telt niet, snijden wel; schuin tegen een klimrek kan zonder botsing", () => {
  const frame = box(0.2, 3, 2.5); // klimrek: dun, hoog
  const bank = box(2.5, 0.3, 0.3);
  const frameObbs = itemObbs(frame, [0, 0, 0], { x: 0, y: 0, z: 0 });

  // bank plat op de vloer, naast het rek (x = 1,35 → rand op 0,1 + 0,25): geen overlap
  const flatAway = itemObbs(bank, [1.5, 0.0, 0], { x: 0, y: 0, z: 0 });
  assert.equal(obbsOverlap(frameObbs, flatAway), false);

  // plat dwars door het rek: overlap
  const through = itemObbs(bank, [0, 0, 0], { x: 0, y: 0, z: 0 });
  assert.equal(obbsOverlap(frameObbs, through), true);

  // schuin (45° zijwaarts) met de onderkant op de vloer en de bovenkant TEGEN het rek: geen overlap als er lucht tussen zit
  const rot = { x: 0, y: 0, z: 45 };
  const y = -lowestOffset(bank, rot);
  const leaning = itemObbs(bank, [1.9, y, 0], rot);
  assert.equal(obbsOverlap(frameObbs, leaning, 0.005), false);
  // …en door het rek heen schuiven geeft wel overlap
  const intersecting = itemObbs(bank, [0.9, y, 0], rot);
  assert.equal(obbsOverlap(frameObbs, intersecting), true);

  // symmetrisch
  assert.equal(obbsOverlap(leaning, frameObbs, 0.005), false);
});

test("buiten de zaal: waarschuwing bij uitsteken of onder de vloer, niet bij binnen blijven", () => {
  const bank = box(2, 0.4, 0.4);
  const room = { width_m: 10, length_m: 10 };
  assert.equal(isOutsideRoom(bank, [0, 0, 0], { x: 0, y: 0, z: 0 }, room), false);
  assert.equal(isOutsideRoom(bank, [4.5, 0, 0], { x: 0, y: 0, z: 0 }, room), true); // steekt 0,5 m uit
  assert.equal(isOutsideRoom(bank, [4.5, 0, 0], { x: 0, y: 90, z: 0 }, room), false); // gedraaid past hij
  assert.equal(isOutsideRoom(bank, [0, 0, 0], { x: 0, y: 0, z: 45 }, room), true); // zonder lift: onderkant onder de vloer
  assert.equal(isOutsideRoom(bank, [0, -lowestOffset(bank, { x: 0, y: 0, z: 45 }), 0], { x: 0, y: 0, z: 45 }, room), false);
});

test("opslag: oude items (alleen rot_y_deg) laden ongewijzigd; kanteling wordt alleen opgeslagen als ze niet 0 is", () => {
  const old = { id: "a", slug: "turnbank_1_los", x: 1, y: 0, z: 2, rot_y_deg: 90 };
  const parsed = floorplan3dItemSchema.parse(old);
  assert.deepEqual(parsed, old); // geen extra velden erbij
  assert.equal(JSON.stringify(parsed), JSON.stringify(old));
  assert.deepEqual(rotationOf(parsed), { x: 0, y: 90, z: 0 });

  const config = orientationFor({ slug: "turnbank_1_los", categorie: "toestellen", subgroep: "banken" });
  assert.equal(normalizeItemRotation(parsed, config), parsed); // zelfde object terug

  // opslaan en laden geeft een identieke transform
  const tilted = floorplan3dItemSchema.parse({ ...old, rot_x_deg: 30, rot_z_deg: -15, lift_m: 0.4 });
  const reloaded = floorplan3dItemSchema.parse(JSON.parse(JSON.stringify(tilted)));
  assert.deepEqual(reloaded, tilted);
  assert.deepEqual(rotationOf(reloaded), { x: 30, y: 90, z: -15 });
  assert.throws(() => floorplan3dItemSchema.parse({ ...old, rot_x_deg: 400 }));
});

test("asset-config: pionnen, personen en hangend materiaal kantelen niet; de rest wel", () => {
  assert.equal(orientationFor({ slug: "pion_effen_kleurenset", categorie: "klein_materiaal", subgroep: "afzetten" }).allowTilt, false);
  assert.equal(orientationFor({ slug: "dopje_blauw_los", categorie: "klein_materiaal", subgroep: "afzetten" }).allowTilt, false);
  assert.equal(orientationFor({ slug: "vloermarkering_rubber_set", categorie: "klein_materiaal", subgroep: "afzetten" }).allowTilt, false);
  assert.equal(orientationFor({ slug: "leerling_blauw", categorie: "personen" }).allowTilt, false);
  const hanging = orientationFor({ slug: "klimtouwen_set_2_hangend", categorie: "toestellen", subgroep: "klimmen" }, true);
  assert.equal(hanging.allowTilt, false);
  assert.ok(hanging.reason);
  for (const slug of ["turnbank_1_los", "turnmat_200x100x6", "zaalhockeydoel_300x200_wit", "springplank_senior_4veers", "evenwichtsbalk_hoog_fig_125"]) {
    const config = orientationFor({ slug });
    assert.equal(config.allowTilt, true, slug);
    assert.equal(config.maxTiltDeg, 180);
  }

  // clamp en normalisatie
  const flat = orientationFor({ slug: "pion_x", categorie: "klein_materiaal", subgroep: "afzetten" });
  assert.deepEqual(clampRotation({ x: 40, y: 10, z: 20 }, flat), { x: 0, y: 10, z: 0 });
  const stripped = normalizeItemRotation({ id: "p", slug: "pion_x", x: 0, y: 0, z: 0, rot_y_deg: 10, rot_x_deg: 40 }, flat);
  assert.equal("rot_x_deg" in stripped, false);
  const limited = clampRotation({ x: 120, y: 0, z: -120 }, { allowTilt: true, maxTiltDeg: 45 });
  assert.deepEqual(limited, { x: 45, y: 0, z: -45 });
});
