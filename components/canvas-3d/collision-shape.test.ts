import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import type { Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import {
  boxCorners,
  compareShapeToMesh,
  convexHull,
  footprintCenter,
  footprintExtents,
  footprintPolygons,
  isElevated,
  legacyShape,
  localFootprintPolygons,
  minAreaRect,
  originForCenter,
  resolveCollisionShape,
  rotateXZ,
  shapeFromExtent,
  verticalRange,
  type CollisionShape,
  type MeshExtent,
  type Point,
} from "@/components/canvas-3d/collision-shape";
import { measureMeshExtent } from "@/components/canvas-3d/collision-measure";
import {
  clampItemsToRoom,
  footprintCorners,
  polygonsOverlap,
  recomputeStackedYs,
  type DimsLookup,
  type ItemDims,
} from "@/components/canvas-3d/floorplan3d-geometry";
import { resolvePlacement } from "@/components/canvas-3d/resolvePlacement";
import { CONE_MARKER_DIMS } from "@/components/canvas-3d/cone-field";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

/** Extent van een rechthoek (middelpunt cx,cz; maten l×w; draaiing deg) tussen y0 en y1. */
function rectExtent(cx: number, cz: number, l: number, w: number, deg: number, y0 = 0, y1 = 1): MeshExtent {
  return { hull: boxCorners(cx, cz, l, w, deg), minY: y0, maxY: y1 };
}

const room = { width_m: 30, length_m: 30 } as Floorplan3dRoom;
const item = (id: string, slug: string, x: number, z: number, rot = 0, y = 0): Floorplan3dItem => ({ id, slug, x, y, z, rot_y_deg: rot });

// ---------------------------------------------------------------------------
// Rotatie volgt three.js
// ---------------------------------------------------------------------------

test("footprint-rotatie komt overeen met de transformatie van three.js", () => {
  for (const deg of [15, 30, 45, 90, 135, 200]) {
    const group = new THREE.Group();
    group.position.set(2, 0, -3);
    group.rotation.y = THREE.MathUtils.degToRad(deg);
    group.updateMatrixWorld();
    const local = new THREE.Vector3(1.2, 0, 0.4);
    const world = local.clone().applyMatrix4(group.matrixWorld);
    const mine = rotateXZ(1.2, 0.4, deg);
    near(2 + mine.x, world.x, 1e-9);
    near(-3 + mine.z, world.z, 1e-9);
  }
  // En footprintCorners (gebruikt door plaatsen/snappen) draait dezelfde kant op.
  const corners = footprintCorners(0, 0, 2, 1, 30);
  const group = new THREE.Group();
  group.rotation.y = THREE.MathUtils.degToRad(30);
  group.updateMatrixWorld();
  const expected = new THREE.Vector3(1, 0, 0.5).applyMatrix4(group.matrixWorld);
  near(corners[2].x, expected.x, 1e-9);
  near(corners[2].z, expected.z, 1e-9);
});

// ---------------------------------------------------------------------------
// Pivot-offset
// ---------------------------------------------------------------------------

test("pivot-offset: de vorm staat op de mesh, niet op de pivot", () => {
  const shape = shapeFromExtent(rectExtent(0.3, -0.2, 1, 0.5, 0, 0, 1));
  near(shape.offset_x, 0.3);
  near(shape.offset_z, -0.2);
  near(shape.length_m, 1);
  near(shape.width_m, 0.5);
  assert.equal(shape.yaw_deg, 0);

  // Item op (5, 5), niet gedraaid: voetafdruk-midden = pivot + offset.
  const center = footprintCenter(shape, 5, 5, 0);
  near(center.x, 5.3);
  near(center.z, 4.8);
  // En omgekeerd: de pivot die het midden op (0,0) legt.
  const origin = originForCenter(shape, 0, 0, 0);
  near(origin.x, -0.3);
  near(origin.z, 0.2);
});

test("pivot-offset draait mee met het item (90° en 45°)", () => {
  const shape = shapeFromExtent(rectExtent(1, 0, 0.4, 0.4, 0));
  // three.js, rotation.y = +90°: lokaal (1, 0) → (0, −1)
  const c90 = footprintCenter(shape, 0, 0, 90);
  near(c90.x, 0, 1e-9);
  near(c90.z, -1, 1e-9);
  const c45 = footprintCenter(shape, 0, 0, 45);
  near(c45.x, Math.SQRT1_2, 1e-9);
  near(c45.z, -Math.SQRT1_2, 1e-9);
  // inverse bewerking klopt bij elke rotatie
  for (const rot of [0, 30, 45, 90, 270]) {
    const p = originForCenter(shape, 3, 4, rot);
    const back = footprintCenter(shape, p.x, p.z, rot);
    near(back.x, 3, 1e-9);
    near(back.z, 4, 1e-9);
  }
});

test("oriented box i.p.v. world-AABB bij 45°: de box draait mee en blijft strak", () => {
  const shape = shapeFromExtent(rectExtent(0, 0, 4, 0.2, 0));
  const [polygon] = footprintPolygons(shape, 0, 0, 45);
  const xs = polygon.map((p) => p.x);
  const aabbArea = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...polygon.map((p) => p.z)) - Math.min(...polygon.map((p) => p.z)));
  // Oriented box: 4 × 0,2 = 0,8 m²; de world-AABB zou ~4,4 m² zijn.
  assert.ok(aabbArea > 4);
  // Een punt langs de as van de lat valt erin, een punt in de AABB-hoek niet.
  const along = rotateXZ(1.5, 0, 45);
  const inCorner = { x: Math.max(...xs) - 0.05, z: Math.min(...polygon.map((p) => p.z)) + 0.05 };
  assert.ok(polygonContains(polygon, along));
  assert.ok(!polygonContains(polygon, inCorner));
});

function polygonContains(polygon: Point[], p: Point): boolean {
  let sign = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const cross = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
    if (Math.abs(cross) < 1e-12) continue;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Schuin gemodelleerde assets en schaal
// ---------------------------------------------------------------------------

test("schuin gemodelleerd: min-area-rechthoek vindt draaiing en maten terug", () => {
  for (const deg of [-40, -18, 10, 32.5]) {
    const rect = minAreaRect(convexHull(boxCorners(0.4, -0.1, 0.9, 0.3, deg)));
    near(rect.cx, 0.4, 1e-6);
    near(rect.cz, -0.1, 1e-6);
    // lengte/breedte kunnen verwisseld zijn bij ±45°-reductie; het product en de som blijven.
    near(rect.length * rect.width, 0.27, 1e-6);
    assert.ok(Math.abs(rect.yaw_deg) <= 45 + 1e-9);
  }
  const shape = shapeFromExtent(rectExtent(0, 0, 0.9, 0.3, 20));
  assert.ok(Math.abs(shape.yaw_deg) > 1);
  near(shape.length_m * shape.width_m, 0.27, 1e-3);
});

test("axis-aligned objecten blijven yaw 0, ook bij ruis", () => {
  const shape = shapeFromExtent(rectExtent(0, 0, 2, 1, 0.3));
  // 0,3° geeft nooit 10% winst: dus gewoon de AABB.
  assert.equal(shape.yaw_deg, 0);
});

test("niet-uniforme schaal van de mesh geeft de analytisch geschaalde vorm", () => {
  const base = shapeFromExtent(rectExtent(0.2, 0, 1, 0.5, 0, 0, 0.4));
  const scaled = shapeFromExtent({
    hull: rectExtent(0.2, 0, 1, 0.5, 0).hull.map((p) => ({ x: p.x * 1.5, z: p.z * 0.7 })),
    minY: 0,
    maxY: 0.4 * 2,
  });
  near(scaled.length_m, base.length_m * 1.5, 1e-3);
  near(scaled.width_m, base.width_m * 0.7, 1e-3);
  near(scaled.height_m, base.height_m * 2, 1e-3);
  near(scaled.offset_x, base.offset_x * 1.5, 1e-3);
});

// ---------------------------------------------------------------------------
// Verticaal: hangend, onder de vloer
// ---------------------------------------------------------------------------

test("onderkant: hangend materiaal heeft base_m > 0 en is 'verhoogd'", () => {
  const rings = shapeFromExtent(rectExtent(0, 0, 0.9, 0.2, 0, 2.8, 5.05));
  near(rings.base_m, 2.8);
  near(rings.height_m, 2.25);
  assert.ok(isElevated(rings));
  const [lo, hi] = verticalRange(rings, 0);
  near(lo, 2.8);
  near(hi, 5.05);
  const sunk = shapeFromExtent(rectExtent(0, 0, 1, 1, 0, -0.04, 1));
  assert.equal(isElevated(sunk), false);
  near(sunk.base_m, -0.04);
});

// ---------------------------------------------------------------------------
// Compound, cylinder, capsule, none
// ---------------------------------------------------------------------------

test("compound: een doel met open net is twee boxen, het midden is vrij", () => {
  const goal: CollisionShape = {
    ...legacyShape({ length_m: 3, width_m: 2, height_m: 2 }),
    kind: "compound",
    parts: [
      { offset_x: -1.4, offset_z: 0, length_m: 0.2, width_m: 2, yaw_deg: 0 },
      { offset_x: 1.4, offset_z: 0, length_m: 0.2, width_m: 2, yaw_deg: 0 },
    ],
  };
  assert.equal(localFootprintPolygons(goal).length, 2);
  const polygons = footprintPolygons(goal, 0, 0, 0);
  const middle = [boxCorners(0, 0, 0.5, 0.5, 0)];
  assert.equal(polygonsOverlap(polygons, middle), false);
  const onPost = [boxCorners(-1.4, 0, 0.5, 0.5, 0)];
  assert.equal(polygonsOverlap(polygons, onPost), true);
  // En bij rotatie 90° draaien beide delen mee.
  const rotated = footprintPolygons(goal, 0, 0, 90);
  assert.equal(polygonsOverlap(rotated, [boxCorners(0, 1.4, 0.5, 0.5, 0)]), true);
  assert.equal(polygonsOverlap(rotated, [boxCorners(-1.4, 0, 0.5, 0.5, 0)]), false);
});

test("cylinder, capsule en none", () => {
  const base = legacyShape({ length_m: 1, width_m: 1, height_m: 1 });
  const cylinder = footprintPolygons({ ...base, kind: "cylinder" }, 0, 0, 0)[0];
  assert.ok(cylinder.length >= 12);
  assert.ok(cylinder.every((p) => Math.abs(Math.hypot(p.x, p.z) - 0.5) < 1e-9));

  const capsule = footprintPolygons({ ...base, kind: "capsule", length_m: 2, width_m: 0.4 }, 0, 0, 0)[0];
  const xs = capsule.map((p) => p.x);
  const zs = capsule.map((p) => p.z);
  near(Math.max(...xs), 1, 1e-9);
  near(Math.max(...zs), 0.2, 1e-9);

  const none = { ...base, kind: "none" as const };
  assert.deepEqual(footprintPolygons(none, 0, 0, 0), []);
  assert.deepEqual(footprintExtents(none, 0), { minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
});

test("resolveCollisionShape: override > bewuste maatcorrectie > geometrie > oude box", () => {
  const auto = { shape: shapeFromExtent(rectExtent(0.1, 0, 3.06, 2, 0, 0, 0.3)), aabb: { length_m: 3.06, width_m: 2, height_m: 0.3 } };
  // database = GLB-bounds: de geometrie wint (met offset)
  const fromGlb = resolveCollisionShape({ db: { length_m: 3.06, width_m: 2, height_m: 0.3 }, auto });
  near(fromGlb.offset_x, 0.1);
  assert.equal(fromGlb.source, "mesh");
  // database wijkt 6 cm af: bewuste correctie, maten uit de database, positie uit de geometrie
  const corrected = resolveCollisionShape({ db: { length_m: 3, width_m: 2, height_m: 0.3 }, auto });
  near(corrected.length_m, 3);
  near(corrected.offset_x, 0.1);
  assert.equal(corrected.source, "db");
  // override wint altijd
  const overridden = resolveCollisionShape({ db: { length_m: 3, width_m: 2, height_m: 0.3 }, auto, override: { reason: "test", kind: "none" } });
  assert.equal(overridden.kind, "none");
  assert.equal(overridden.source, "override");
  // geen profiel: de oude gecentreerde box
  const legacy = resolveCollisionShape({ db: { length_m: 1, width_m: 2, height_m: 3 } });
  assert.equal(legacy.offset_x, 0);
  assert.equal(legacy.source, "db");
});

test("compareShapeToMesh: de oude box wijkt af, de nieuwe niet", () => {
  const extent = rectExtent(0.5, -0.3, 1, 0.4, 20, 0.1, 0.9);
  const ideal = shapeFromExtent(extent);
  const old = legacyShape({ length_m: 1.3, width_m: 0.8, height_m: 0.8 });
  const before = compareShapeToMesh(old, extent);
  assert.ok(before.centerOffset > 0.5);
  assert.ok(before.protrudingPoints > 0 || before.volumeDeltaPct > 5);
  const after = compareShapeToMesh(ideal, extent);
  assert.ok(after.centerOffset < 1e-3);
  assert.equal(after.protrudingPoints, 0);
  assert.ok(Math.abs(after.volumeDeltaPct) < 1);
});

// ---------------------------------------------------------------------------
// Zichtbare nodes, instances (three.js)
// ---------------------------------------------------------------------------

function box(w: number, h: number, d: number) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
}

test("meten: verborgen nodes tellen niet mee, ook niet via een verborgen parent", () => {
  const root = new THREE.Group();
  const visible = box(1, 1, 1);
  visible.position.set(0, 0.5, 0);
  const hiddenMesh = box(4, 4, 4);
  hiddenMesh.visible = false;
  const hiddenGroup = new THREE.Group();
  hiddenGroup.visible = false;
  const inHidden = box(5, 5, 5);
  hiddenGroup.add(inHidden);
  root.add(visible, hiddenMesh, hiddenGroup, new THREE.PointLight(), new THREE.PerspectiveCamera(), new THREE.Group());

  const extent = measureMeshExtent(root, { useCache: false });
  assert.ok(extent);
  const xs = extent.hull.map((p) => p.x);
  near(Math.min(...xs), -0.5, 1e-6);
  near(Math.max(...xs), 0.5, 1e-6);
  near(extent.minY, 0, 1e-6);
  near(extent.maxY, 1, 1e-6);
});

test("meten: vertex-nauwkeurig bij gedraaide kinderen (geen opgeblazen AABB) en lege groepen geven null", () => {
  const root = new THREE.Group();
  const bar = box(2, 0.1, 0.1);
  bar.rotation.y = THREE.MathUtils.degToRad(45);
  root.add(bar);
  const extent = measureMeshExtent(root, { useCache: false });
  assert.ok(extent);
  const shape = shapeFromExtent(extent);
  // Oriented: 2 × 0,1 — niet de world-AABB van ~1,48 × 1,48.
  near(Math.max(shape.length_m, shape.width_m), 2, 1e-3);
  near(Math.min(shape.length_m, shape.width_m), 0.1, 1e-3);
  assert.equal(measureMeshExtent(new THREE.Group(), { useCache: false }), null);
});

test("meten: instanced meshes (pionnen) tellen elke instantie", () => {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), new THREE.MeshBasicMaterial(), 2);
  mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-3, 0.15, 0));
  mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(3, 0.15, 0));
  const root = new THREE.Group();
  root.add(mesh);
  const extent = measureMeshExtent(root, { useCache: false });
  assert.ok(extent);
  const xs = extent.hull.map((p) => p.x);
  near(Math.min(...xs), -3.1, 1e-6);
  near(Math.max(...xs), 3.1, 1e-6);
});

test("pionnen: de procedurele geometrie komt overeen met CONE_MARKER_DIMS", () => {
  for (const [marker, { height, radius }] of Object.entries(CONE_MARKER_DIMS)) {
    const geometry =
      marker === "dopje" ? new THREE.CylinderGeometry(radius, radius, height, 20) : new THREE.ConeGeometry(radius, height, 14);
    geometry.translate(0, height / 2, 0);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    near(bounds.min.y, 0, 1e-6); // float32
    near(bounds.max.y, height, 1e-6);
    near(bounds.max.x, radius, radius * 0.03); // een veelhoek raakt de straal niet op elke as
  }
});

// ---------------------------------------------------------------------------
// Plaatsen met de nieuwe vormen; bestaande plattegronden verspringen niet
// ---------------------------------------------------------------------------

function lookupOf(map: Record<string, ItemDims>): DimsLookup {
  return (slug) => map[slug];
}

const MAT: ItemDims = { length_m: 2, width_m: 1, height_m: 0.3, stackable: true };
const HANGING_NET: ItemDims = {
  length_m: 6,
  width_m: 0.1,
  height_m: 0.8,
  stackable: false,
  base_m: 0.8,
};
const OFFSET_GOAL: ItemDims = { length_m: 3, width_m: 1, height_m: 2, stackable: false, offset_z: -0.6 };

test("hangend materiaal blokkeert de vloer niet en wordt niet gestapeld", () => {
  const lookup = lookupOf({ mat: MAT, net: HANGING_NET });
  // net hangt boven de mat: niet geblokkeerd, geen stapel
  const placed = resolvePlacement({
    pointer: { x: 0, z: 0 },
    dragged: { slug: "net", rot_y_deg: 0 },
    others: [item("m", "mat", 0, 0)],
    room,
    grid: 0,
    lookup,
    final: true,
  });
  assert.equal(placed.blocked, false);
  assert.equal(placed.y, 0);
  assert.equal(placed.mode === "stack", false);
  // en een mat onder het net: gewoon op de vloer
  const mat = resolvePlacement({
    pointer: { x: 0, z: 0 },
    dragged: { slug: "mat", rot_y_deg: 0 },
    others: [item("n", "net", 0, 0)],
    room,
    grid: 0,
    lookup,
    final: true,
  });
  assert.equal(mat.blocked, false);
  assert.equal(mat.y, 0);
});

test("stapelen rekent met de onderkant: een item op een zacht-verzonken basis", () => {
  const SUNK: ItemDims = { length_m: 1, width_m: 1, height_m: 1, stackable: true, base_m: -0.04 };
  const lookup = lookupOf({ sunk: SUNK, mat: MAT });
  const items = recomputeStackedYs([item("a", "sunk", 0, 0), item("b", "mat", 0, 0, 0, 0.5)], lookup);
  // bovenkant basis = 0 + (−0,04) + 1 = 0,96
  near(items.find((i) => i.id === "b")!.y, 0.96);
});

test("bestaande plattegronden: x/z blijven staan bij laden en stapelhoogtes veranderen niet voor gewone items", () => {
  const lookup = lookupOf({ mat: MAT, goal: OFFSET_GOAL });
  const saved = [item("a", "mat", 1, 2), item("b", "mat", 1, 2, 0, 0.3), item("c", "goal", -5, 4, 90)];
  const loaded = recomputeStackedYs(saved, lookup);
  for (const before of saved) {
    const after = loaded.find((i) => i.id === before.id)!;
    assert.equal(after.x, before.x);
    assert.equal(after.z, before.z);
    near(after.y, before.y);
  }
});

test("kamerbegrenzing gebruikt de verschoven voetafdruk", () => {
  const lookup = lookupOf({ goal: OFFSET_GOAL });
  // Doel (offset z −0,6, breedte 1): voetafdruk loopt van z−1,1 tot z−0,1. Op z = −14,5 steekt hij buiten (−15,6).
  const { items, moved } = clampItemsToRoom([item("g", "goal", 0, -14.5)], room, lookup);
  assert.equal(moved, 1);
  near(items[0].z, -15 + 1.1, 1e-9);
});

test("plaatsen: de cursor houdt het midden van de voetafdruk vast en blijft binnen de kamer", () => {
  const lookup = lookupOf({ goal: OFFSET_GOAL });
  const shape = { ...OFFSET_GOAL, kind: "box" as const, offset_x: 0, offset_z: -0.6, base_m: 0, yaw_deg: 0, source: "db" as const };
  const origin = originForCenter(shape, 0, 0, 0);
  const result = resolvePlacement({ pointer: origin, dragged: { slug: "goal", rot_y_deg: 0 }, others: [], room, grid: 0, lookup });
  near(result.x, 0);
  near(result.z, 0.6);
  // tegen de achterwand: voetafdrukrand (niet de pivot) komt op de muur
  const wall = resolvePlacement({ pointer: { x: 0, z: -14.45 + 0.6 }, dragged: { slug: "goal", rot_y_deg: 0 }, others: [], room, grid: 0, lookup });
  near(wall.z + -0.6 - 0.5, -15, 1e-9); // voetafdruk-minZ = z + offset − halve breedte
});
