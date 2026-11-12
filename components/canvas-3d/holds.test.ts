import assert from "node:assert/strict";
import { test } from "node:test";

import { applyHolds, gripWorld, holdPlacement, nearestHand, occupiedHands, releaseFromStudent, HAND_SNAP_RADIUS_M, type GripFor } from "@/components/canvas-3d/holds";
import { HAND_POINTS } from "@/lib/students/handpoints.generated";
import { handWorld } from "@/lib/students/hands";
import type { Floorplan3dItem } from "@/types/floorplan3d";

const student = (extra: Partial<Floorplan3dItem> = {}): Floorplan3dItem => ({ id: "s1", slug: "leerling_pose_standaard", x: 2, y: 0, z: 3, rot_y_deg: 0, ...extra });
const ball = (extra: Partial<Floorplan3dItem> = {}): Floorplan3dItem => ({ id: "b1", slug: "basketbal_maat_5", x: 0, y: 0, z: 0, rot_y_deg: 0, ...extra });
const gripFor: GripFor = () => ({ pakbaar: true, grip: [0, 0.11, 0] });

test("de handpunten staan voor (bijna) elke pose in het gegenereerde bestand", () => {
  assert.ok(Object.keys(HAND_POINTS).length >= 38);
  assert.ok(HAND_POINTS.standaard.links && HAND_POINTS.standaard.rechts);
});

test("handpunt wereld: meegedraaid, geschaald en op de plek van de leerling", () => {
  const base = handWorld(student(), "links")!;
  const turned = handWorld(student({ rot_y_deg: 90 }), "links")!;
  assert.ok(Math.abs(Math.hypot(base[0] - 2, base[2] - 3) - Math.hypot(turned[0] - 2, turned[2] - 3)) < 1e-9, "afstand tot het lichaam blijft gelijk");
  assert.ok(Math.abs(base[1] - turned[1]) < 1e-9);
  const small = handWorld(student({ size: "klein" }), "links")!;
  assert.ok(Math.abs(small[1] - base[1] * (1.2 / 1.4)) < 1e-9, "klein = 1,2 m i.p.v. middel 1,4 m");
});

test("snappen: binnen de straal klikt de bal aan de dichtstbijzijnde hand; ver weg niet; bezette hand wordt gemeld", () => {
  const s = student();
  const hand = handWorld(s, "rechts")!;
  const grip: [number, number, number] = [0, 0.11, 0];
  const near = ball({ x: hand[0] + 0.05, y: hand[1] - 0.11, z: hand[2] });
  const snap = nearestHand(near, grip, [s, near]);
  assert.ok(snap && snap.hand === "rechts" && snap.studentId === "s1" && snap.occupiedBy === null);
  assert.equal(nearestHand(ball({ x: hand[0] + HAND_SNAP_RADIUS_M + 0.2, y: hand[1], z: hand[2] }), grip, [s]), null);
  const other = ball({ id: "b2", houdt_vast: { leerling: "s1", hand: "rechts" } });
  assert.equal(nearestHand(near, grip, [s, near, other])?.occupiedBy, "b2");
});

test("vastklikken: het greeppunt ligt precies op het handpunt en de draaiing volgt de leerling", () => {
  const s = student({ rot_y_deg: 40 });
  const placement = holdPlacement(s, "links", [0, 0.11, 0])!;
  const held = ball({ ...placement });
  const at = gripWorld(held, [0, 0.11, 0]);
  const hand = handWorld(s, "links")!;
  assert.ok(Math.hypot(at[0] - hand[0], at[1] - hand[1], at[2] - hand[2]) < 0.002);
  assert.equal(held.rot_y_deg, 40);
});

test("de koppeling volgt de leerling bij verplaatsen, draaien, schalen en posewissel", () => {
  const hold = { leerling: "s1", hand: "rechts" as const };
  const pick = (s: Floorplan3dItem) => applyHolds([s, ball({ houdt_vast: hold })], gripFor).items[1];
  const handOf = (s: Floorplan3dItem) => handWorld(s, "rechts")!;
  for (const s of [student(), student({ x: 7, z: -2 }), student({ rot_y_deg: 130 }), student({ size: "groot" }), student({ slug: "leerling_pose_hardlopen" })]) {
    const held = pick(s);
    const at = gripWorld(held, [0, 0.11, 0]);
    const expected = handOf(s);
    assert.ok(Math.hypot(at[0] - expected[0], at[2] - expected[2]) < 0.002, `${s.slug} ${s.x} ${s.rot_y_deg} ${s.size}`);
    assert.ok(Math.abs(at[1] - Math.max(expected[1], 0.11)) < 0.002 || at[1] >= 0);
  }
});

test("loslaten: leerling verwijderd of pose zonder hand → het object blijft staan en de koppeling vervalt", () => {
  const held = ball({ x: 1, y: 1, z: 1, lift_m: 1, houdt_vast: { leerling: "weg", hand: "links" } });
  const result = applyHolds([held], gripFor);
  assert.deepEqual(result.released, [{ id: "b1", reason: "leerling-weg" }]);
  assert.equal(result.items[0].houdt_vast, undefined);
  assert.deepEqual([result.items[0].x, result.items[0].y, result.items[0].z], [1, 1, 1]);
  const withHold = [student(), ball({ houdt_vast: { leerling: "s1", hand: "links" } })];
  assert.equal(releaseFromStudent(withHold, "s1")[1].houdt_vast, undefined);
});

test("onpakbaar object of twee objecten in één hand: de koppeling vervalt, niets wordt stil vervangen", () => {
  const s = student();
  assert.equal(applyHolds([s, ball({ houdt_vast: { leerling: "s1", hand: "links" } })], () => ({ pakbaar: false, grip: [0, 0, 0] })).released[0].reason, "niet-pakbaar");
  const two = applyHolds([s, ball({ houdt_vast: { leerling: "s1", hand: "links" } }), ball({ id: "b2", houdt_vast: { leerling: "s1", hand: "links" } })], gripFor);
  assert.deepEqual(two.released, [{ id: "b2", reason: "hand-bezet" }]);
  assert.equal(occupiedHands(two.items, "s1").size, 1);
});

test("alles klopt: applyHolds levert dezelfde lijst terug (geen onnodige wijziging) en oude plattegronden (zonder houdt_vast) blijven gelijk", () => {
  const plain = [student(), ball()];
  assert.equal(applyHolds(plain, gripFor).items, plain);
  const once = applyHolds([student(), ball({ houdt_vast: { leerling: "s1", hand: "rechts" } })], gripFor).items;
  assert.equal(applyHolds(once, gripFor).items, once);
});
