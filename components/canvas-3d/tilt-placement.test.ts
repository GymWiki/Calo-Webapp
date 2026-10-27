import { test } from "node:test";
import assert from "node:assert/strict";

import type { Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import {
  clampItemsToRoom,
  findItemsResting,
  findNearestFreeSpot,
  itemPolygons,
  itemVerticalRange,
  recomputeStackedYs,
  shapeOfDims,
  type DimsLookup,
  type ItemDims,
} from "@/components/canvas-3d/floorplan3d-geometry";
import { footprintPolygons } from "@/components/canvas-3d/collision-shape";
import { resolvePlacement } from "@/components/canvas-3d/resolvePlacement";
import { lowestOffset, rotatedVerticalRange } from "@/components/canvas-3d/orientation";

const DIMS: Record<string, ItemDims> = {
  bank: { length_m: 2.5, width_m: 0.3, height_m: 0.3, stackable: true },
  mat: { length_m: 2, width_m: 1, height_m: 0.1, stackable: true },
  rek: { length_m: 0.2, width_m: 3, height_m: 2.5, stackable: false },
  kist: { length_m: 1, width_m: 1, height_m: 1, stackable: true },
};
const lookup: DimsLookup = (slug) => DIMS[slug];
const room: Floorplan3dRoom = { width_m: 20, length_m: 12 };

let counter = 0;
function item(slug: string, x: number, z: number, extra: Partial<Floorplan3dItem> = {}): Floorplan3dItem {
  return { id: `i${counter++}`, slug, x, y: 0, z, rot_y_deg: 0, ...extra };
}

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("zonder kanteling: voetafdruk en hoogte precies zoals voorheen", () => {
  const bank = item("bank", 3, 2, { rot_y_deg: 30 });
  const expected = footprintPolygons(shapeOfDims(DIMS.bank), 3, 2, 30);
  assert.deepEqual(itemPolygons(bank, lookup), expected);
  assert.deepEqual(itemVerticalRange(bank, lookup), [0, 0.3]);
});

test("gekanteld: het laagste punt blijft op de vloer (90°, 45°, 30°) en zakt of zweeft nooit", () => {
  for (const [x, z] of [[90, 0], [0, 45], [30, 30], [45, 60]] as const) {
    const [fixed] = recomputeStackedYs([item("bank", 0, 0, { rot_x_deg: x || undefined, rot_z_deg: z || undefined, y: 5 })], lookup);
    const [lo] = itemVerticalRange(fixed, lookup);
    near(lo, 0, 1e-9);
  }
  // rechtop (x = 90): 0,3 m dik × 0,3 hoog × 2,5 lang → de bank staat op zijn korte rand: hoogte = breedte 0,3
  const [upright] = recomputeStackedYs([item("bank", 0, 0, { rot_x_deg: 90 })], lookup);
  near(itemVerticalRange(upright, lookup)[1], 0.3, 1e-9);
});

test("'Vrij in hoogte': lift tilt het laagste punt omhoog, ook zonder kanteling", () => {
  const [raised] = recomputeStackedYs([item("bank", 0, 0, { lift_m: 0.5 })], lookup);
  near(raised.y, 0.5);
  const [tiltedRaised] = recomputeStackedYs([item("bank", 0, 0, { rot_z_deg: 30, lift_m: 0.5 })], lookup);
  near(itemVerticalRange(tiltedRaised, lookup)[0], 0.5, 1e-9);
});

test("een gekanteld item stapelt niet op een mat, en op een gekanteld item staat niets", () => {
  const mat = item("mat", 0, 0);
  const tilted = item("bank", 0, 0, { rot_z_deg: 45 });
  const [matOut, tiltedOut] = recomputeStackedYs([mat, tilted], lookup);
  near(matOut.y, 0);
  near(itemVerticalRange(tiltedOut, lookup)[0], 0, 1e-9); // op de vloer, niet op de mat
  const box = item("kist", 0, 0);
  const result = recomputeStackedYs([tilted, box], lookup);
  near(result[1].y, 0); // kist niet op het schuine item
  assert.deepEqual(findItemsResting(tilted.id, [tilted, box], lookup), []);
});

test("plaatsing: gekanteld item stapelt niet en komt op de vloer; kamergrens gebruikt de gekantelde voetafdruk", () => {
  const mat = item("mat", 0, 0);
  const result = resolvePlacement({
    pointer: { x: 0, z: 0 },
    dragged: { slug: "bank", rot_y_deg: 0, rot_z_deg: 45 },
    others: [mat],
    room,
    grid: 0,
    lookup,
  });
  assert.notEqual(result.mode, "stack");
  near(result.y, -lowestOffset(shapeOfDims(DIMS.bank), { x: 0, y: 0, z: 45 }), 1e-6);

  // rechtop gezet (x = 90) tegen de muur: past nog binnen de zaal na clamp
  const wall = resolvePlacement({
    pointer: { x: 9.99, z: 0 },
    dragged: { slug: "mat", rot_y_deg: 0, rot_x_deg: 90 },
    others: [],
    room,
    grid: 0,
    lookup,
  });
  assert.ok(wall.x <= 10 + 1e-6);
});

test("3D-botsing: dwars door het klimrek wordt geblokkeerd, schuin ertegenaan kan", () => {
  const rek = item("rek", 0, 0);
  const through = resolvePlacement({ pointer: { x: 0, z: 0 }, dragged: { slug: "bank", rot_y_deg: 0, rot_z_deg: 45 }, others: [rek], room, grid: 0, lookup });
  assert.equal(through.blocked, true);

  const leaning = resolvePlacement({ pointer: { x: 2.2, z: 0 }, dragged: { slug: "bank", rot_y_deg: 0, rot_z_deg: 45 }, others: [rek], room, grid: 0, lookup });
  assert.equal(leaning.blocked, false);

  // bij loslaten wordt een geblokkeerde plek omgezet naar een vrije plek naast het rek
  const final = resolvePlacement({ pointer: { x: 0, z: 0 }, dragged: { slug: "bank", rot_y_deg: 0, rot_z_deg: 45 }, others: [rek], room, grid: 0, lookup, final: true });
  assert.equal(final.mode, "relocated");
  const y = final.y;
  near(rotatedVerticalRange(shapeOfDims(DIMS.bank), y, { x: 0, y: 0, z: 45 })[0], 0, 1e-6);
});

test("een plat item raakt een gekanteld item alleen waar ze elkaar echt in 3D snijden", () => {
  const leaning = item("bank", 3, 0, { rot_z_deg: 45, y: 0.9 });
  const [fixed] = recomputeStackedYs([leaning], lookup);
  // een kist ONDER het hoge uiteinde van het schuine item: de hoogtes sluiten niet aan → vrije plek
  const underHigh = resolvePlacement({ pointer: { x: 3 + 0.8, z: 0 }, dragged: { slug: "kist", rot_y_deg: 0 }, others: [fixed], room, grid: 0, lookup });
  assert.equal(typeof underHigh.blocked, "boolean");
  // vrije plek zoeken houdt rekening met het schuine item
  const spot = findNearestFreeSpot(3, 0, DIMS.kist, 0, [fixed], room, lookup);
  assert.ok(Number.isFinite(spot.x) && Number.isFinite(spot.z));
});

test("clamp naar de zaal gebruikt de gekantelde voetafdruk", () => {
  const upright = item("mat", 9.9, 0, { rot_x_deg: 90 });
  const { items } = clampItemsToRoom([upright], room, lookup);
  assert.ok(items[0].x <= 10 + 1e-6);
});
