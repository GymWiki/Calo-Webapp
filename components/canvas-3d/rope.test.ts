import { test } from "node:test";
import assert from "node:assert/strict";

import { anchorAt, anchorWorld, canConnect, createRope, removeRopesOfItems, ropeEndpoints, ropeLength, ropesWithItems, withAnchor } from "@/components/canvas-3d/rope";
import { worldToLocal, localToWorld } from "@/components/canvas-3d/orientation";
import type { DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { floorplan3dDataSchema, type Floorplan3dItem } from "@/types/floorplan3d";

const lookup: DimsLookup = () => ({ length_m: 1, width_m: 0.5, height_m: 2, stackable: true });
const item = (id: string, x: number, z: number, extra: Partial<Floorplan3dItem> = {}): Floorplan3dItem => ({ id, slug: "paal", x, y: 0, z, rot_y_deg: 0, ...extra });
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("wereld → lokaal is het omgekeerde van lokaal → wereld, ook gedraaid en gekanteld", () => {
  const shape = { length_m: 1, width_m: 0.5, height_m: 2, offset_x: 0.1, offset_z: -0.2, base_m: 0 } as Parameters<typeof localToWorld>[0];
  for (const rot of [{ x: 0, y: 0, z: 0 }, { x: 0, y: 70, z: 0 }, { x: 25, y: 130, z: -40 }, { x: 90, y: 300, z: 15 }]) {
    const local: [number, number, number] = [0.3, 1.4, -0.1];
    const world = localToWorld(shape, [3, 0.5, -2], rot, local);
    const back = worldToLocal(shape, [3, 0.5, -2], rot, world);
    near(back[0], local[0]);
    near(back[1], local[1]);
    near(back[2], local[2]);
  }
});

test("het uiteinde blijft op zijn punt van het item zitten als het item verplaatst en gedraaid wordt", () => {
  const paal = item("p1", 2, 3);
  const anchor = anchorAt(paal, [2.2, 1.5, 3.1], lookup);
  assert.equal(anchor.item, "p1");
  const first = anchorWorld(anchor, [paal], lookup)!;
  near(first[0], 2.2);
  near(first[1], 1.5);
  near(first[2], 3.1);

  // 4 m verder: het uiteinde schuift 4 m mee.
  const moved = anchorWorld(anchor, [{ ...paal, x: 6 }], lookup)!;
  near(moved[0], 6.2);
  near(moved[1], 1.5);
  // 90° gedraaid: het punt draait mee om de pivot van het item.
  // (lokaal 0,2 / 1,5 / 0,1 t.o.v. de pivot; heading 90° draait x naar −z en z naar +x)
  const turned = anchorWorld(anchor, [{ ...paal, rot_y_deg: 90 }], lookup)!;
  near(turned[0], 2 + 0.1);
  near(turned[1], 1.5);
  near(turned[2], 3 - 0.2);
});

test("een touw loopt tussen twee items en volgt ze allebei", () => {
  const a = item("a", 0, 0);
  const b = item("b", 10, 0);
  const rope = createRope("t1", anchorAt(a, [0, 1.8, 0], lookup), anchorAt(b, [10, 1.8, 0], lookup));
  const ends = ropeEndpoints(rope, [a, b], lookup)!;
  near(ropeLength(ends.a, ends.b), 10);
  const moved = ropeEndpoints(rope, [a, { ...b, z: 4 }], lookup)!;
  near(ropeLength(moved.a, moved.b), Math.hypot(10, 4));
  assert.equal(ropeEndpoints(rope, [a], lookup), null, "zonder een van de items is er geen touw");
});

test("een touw zit nooit aan twee kanten aan hetzelfde item, en verdwijnt met zijn item", () => {
  const a = item("a", 0, 0);
  const b = item("b", 5, 0);
  const c = item("c", 9, 0);
  assert.equal(canConnect({ item: "a", local: [0, 0, 0] }, { item: "a", local: [0, 1, 0] }), false);
  assert.equal(canConnect({ item: "a", local: [0, 0, 0] }, { item: "b", local: [0, 1, 0] }), true);
  const ab = createRope("ab", anchorAt(a, [0, 1, 0], lookup), anchorAt(b, [5, 1, 0], lookup));
  const bc = createRope("bc", anchorAt(b, [5, 1, 0], lookup), anchorAt(c, [9, 1, 0], lookup));
  assert.deepEqual(removeRopesOfItems([ab, bc], new Set(["a"])).map((rope) => rope.id), ["bc"]);
  assert.deepEqual(removeRopesOfItems([ab, bc], new Set(["b"])).map((rope) => rope.id), []);
  assert.deepEqual(ropesWithItems([ab, bc], [a, b]).map((rope) => rope.id), ["ab"]);
});

test("een uiteinde omzetten naar een ander item laat het andere uiteinde staan", () => {
  const a = item("a", 0, 0);
  const b = item("b", 5, 0);
  const c = item("c", 9, 0);
  const rope = createRope("t", anchorAt(a, [0, 1, 0], lookup), anchorAt(b, [5, 1, 0], lookup));
  const next = withAnchor(rope, "b", anchorAt(c, [9, 1, 0], lookup));
  assert.equal(next.a.item, "a");
  assert.equal(next.b.item, "c");
});

test("het dataformaat: touwen zijn optioneel (oude plattegronden) en worden gevalideerd", () => {
  const base = { version: 1, room: { width_m: 10, length_m: 10 }, items: [], coneFields: [] };
  assert.deepEqual(floorplan3dDataSchema.parse(base).ropes, []);
  const rope = { id: "t", a: { item: "a", local: [0, 1, 0] }, b: { item: "b", local: [0, 1, 0] } };
  assert.equal(floorplan3dDataSchema.parse({ ...base, ropes: [rope] }).ropes.length, 1);
  assert.equal(floorplan3dDataSchema.safeParse({ ...base, ropes: [{ id: "t", a: { item: "a" }, b: rope.b }] }).success, false);
});
