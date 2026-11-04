import assert from "node:assert/strict";
import { test } from "node:test";

import { WALL_MOUNT_NODE, backFacePoint, correctWallMount, frontNormal, WALL_RACK_FRONT_SHIFT_M } from "@/components/canvas-3d/wall-mount";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test("de echte nodes uit gymzaal_standaard: voorheen wees de console de zaal in; na de correctie raakt de achterkant de wand (± 1 cm) en wijst de voorkant de zaal in", () => {
  // Wandrek_1 uit de GLB: x −5,5, z −6,92, 180° om Y; Muur_Achter midden z −7,11, binnenkant (zaalkant) op −6,97.
  const before = { x: -5.5, z: -6.92, yawDeg: 180 };
  const wallInner = -7.11 + 0.14;
  // Voorheen: de voorkant wees naar de wand (−z) en de achterkant (console) lag in de zaal.
  assert.ok(frontNormal(before.yawDeg).z < 0);
  assert.ok(backFacePoint(before).z > before.z);
  const after = correctWallMount(before);
  assert.ok(frontNormal(after.yawDeg).z > 0, "voorkant wijst de zaal in (+z)");
  assert.ok(Math.abs(backFacePoint(after).z - wallInner) <= 0.01, `achterkant ${backFacePoint(after).z} raakt de wand ${wallInner}`);
  near(after.x, before.x);
  near(WALL_RACK_FRONT_SHIFT_M, 0.09, 1e-9);
});

test("alle wandrek-nodes van de drie zalen (1 zaal, 2×2, 4 achter elkaar) volgen dezelfde regel", () => {
  const cases = [
    { z: -6.92, wallCenter: -7.11 }, // standaard
    { z: -13.92, wallCenter: -14.11 }, // 2×2 (achterwand)
    { z: -27.92, wallCenter: -28.11 }, // 4×1 (achterwand)
  ];
  for (const { z, wallCenter } of cases) {
    const after = correctWallMount({ x: 0, z, yawDeg: 180 });
    assert.ok(Math.abs(backFacePoint(after).z - (wallCenter + 0.14)) <= 0.01);
    assert.ok(frontNormal(after.yawDeg).z > 0.999);
  }
});

test("correctie is spiegelsymmetrisch voor de andere wanden (de voorkant wijst steeds van de wand af)", () => {
  // Een wandrek op de rechterwand (x = +12), model nog 180° te veel gedraaid: voorkant wees naar +x (de wand in) → na de correctie naar −x.
  const rightWall = correctWallMount({ x: 11.92, z: 0, yawDeg: 90 });
  assert.ok(frontNormal(rightWall.yawDeg).x < 0);
  const leftWall = correctWallMount({ x: -11.92, z: 0, yawDeg: -90 });
  assert.ok(frontNormal(leftWall.yawDeg).x > 0);
});

test("alleen Wandrek*-nodes worden gecorrigeerd", () => {
  for (const name of ["Wandrek_1", "Wandrek_Zaal_1_A", "Wandrek_Zaal_4_B"]) assert.ok(WALL_MOUNT_NODE.test(name), name);
  for (const name of ["Muur_Achter", "Basketbal_Installatie_Links", "Turnbank_1", "Vloer_Basis"]) assert.equal(WALL_MOUNT_NODE.test(name), false, name);
});
