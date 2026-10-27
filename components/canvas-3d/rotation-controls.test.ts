import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { orientationFor } from "@/components/canvas-3d/asset-orientation";
import { rotationMatrix } from "@/components/canvas-3d/orientation";
import {
  angleDelta,
  applyPose,
  poseAllowed,
  rotateWithGizmo,
  snapAngle,
  stepAxis,
  withAxis,
} from "@/components/canvas-3d/rotation-controls";

const FREE = orientationFor({ slug: "bank", categorie: "toestellen" });
const FLAT = orientationFor({ slug: "pion_oranje", categorie: "klein_materiaal", subgroep: "afzetten" });

describe("rotation-controls", () => {
  it("snapt op het raster en laat vrij draaien met 0", () => {
    assert.equal(snapAngle(22, 15), 15);
    assert.equal(snapAngle(23, 15), 30);
    assert.equal(snapAngle(22.3, 0), 22.3);
  });

  it("stapt per as: Y wrapt, X klemt op ±90, Z wrapt naar ±180", () => {
    assert.equal(stepAxis({ x: 0, y: 350, z: 0 }, "y", 15, FREE).y, 5);
    assert.equal(stepAxis({ x: 80, y: 0, z: 0 }, "x", 30, FREE).x, 90);
    assert.equal(stepAxis({ x: 0, y: 0, z: 170 }, "z", 30, FREE).z, -160);
    assert.equal(stepAxis({ x: 0, y: 0, z: 0 }, "z", -90, FREE).z, -90);
  });

  it("negeert kantelen voor assets die plat moeten blijven, maar draait wel", () => {
    assert.deepEqual(withAxis({ x: 0, y: 0, z: 0 }, "x", 45, FLAT), { x: 0, y: 0, z: 0 });
    assert.equal(withAxis({ x: 0, y: 0, z: 0 }, "y", 90, FLAT).y, 90);
  });

  it("snelle standen houden de draairichting, Reset zet alles terug", () => {
    const current = { x: 20, y: 120, z: -30 };
    assert.deepEqual(applyPose("plat", current, FREE), { x: 0, y: 120, z: 0 });
    assert.deepEqual(applyPose("rechtop", current, FREE), { x: 90, y: 120, z: 0 });
    assert.deepEqual(applyPose("schuin30", current, FREE), { x: 30, y: 120, z: 0 });
    // Langwerpig (bank 3 × 0,4): een uiteinde omhoog = kanteling om Z.
    const bench = { length_m: 3, width_m: 0.4 };
    assert.deepEqual(applyPose("schuin30", current, FREE, bench), { x: 0, y: 120, z: 30 });
    assert.deepEqual(applyPose("rechtop", current, FREE, bench), { x: 0, y: 120, z: 90 });
    // Mat (6 × 4): rechtop op de lange rand = kanteling om X.
    assert.deepEqual(applyPose("rechtop", current, FREE, { length_m: 6, width_m: 4 }), { x: 90, y: 120, z: 0 });
    assert.deepEqual(applyPose("opkop", current, FREE), { x: 0, y: 120, z: 180 });
    assert.deepEqual(applyPose("reset", current, FREE), { x: 0, y: 0, z: 0 });
    assert.equal(poseAllowed("rechtop", FLAT), false);
    assert.equal(poseAllowed("plat", FLAT), true);
  });

  it("respecteert maxTiltDeg", () => {
    const limited = { allowTilt: true, maxTiltDeg: 30 };
    assert.equal(applyPose("rechtop", { x: 0, y: 0, z: 0 }, limited).x, 30);
    assert.equal(applyPose("rechtop", { x: 0, y: 0, z: 0 }, limited, { length_m: 3, width_m: 0.4 }).z, 30);
    assert.equal(poseAllowed("rechtop", limited), false);
    assert.equal(poseAllowed("schuin30", limited), true);
  });

  it("ring-rotatie: wereld-Y met snapping geeft een veelvoud van de stap", () => {
    const next = rotateWithGizmo({ x: 0, y: 10, z: 0 }, "y", 47, { local: false, snapDeg: 15, config: FREE });
    assert.equal(next.y, 60);
    const free = rotateWithGizmo({ x: 0, y: 10, z: 0 }, "y", 47, { local: false, snapDeg: 0, config: FREE });
    assert.ok(Math.abs(free.y - 57) < 1e-3);
  });

  it("ring-rotatie wereld vs lokaal verschilt zodra het item gedraaid is", () => {
    const start = { x: 0, y: 90, z: 0 };
    const world = rotateWithGizmo(start, "x", 30, { local: false, snapDeg: 0, config: FREE });
    const local = rotateWithGizmo(start, "x", 30, { local: true, snapDeg: 0, config: FREE });
    // Lokaal kantelt het item om zijn eigen X-as (= Euler x); wereld-X is bij 90° heading de zijwaartse kanteling.
    assert.ok(Math.abs(local.x - 30) < 1e-3 && Math.abs(local.z) < 1e-3);
    assert.ok(Math.abs(world.z + 30) < 1e-3 || Math.abs(world.z - 30) < 1e-3);
    assert.ok(Math.abs(world.x) < 1e-3);
  });

  it("ring-rotatie van een plat asset kantelt nooit", () => {
    const next = rotateWithGizmo({ x: 0, y: 0, z: 0 }, "x", 45, { local: false, snapDeg: 15, config: FLAT });
    assert.equal(next.x, 0);
    assert.equal(next.z, 0);
  });

  it("totale rotatie na stap + omgekeerde stap is weer de beginstand (matrix)", () => {
    const start = { x: 25, y: 70, z: -10 };
    const there = rotateWithGizmo(start, "z", 40, { local: false, snapDeg: 0, config: FREE });
    const back = rotateWithGizmo(there, "z", -40, { local: false, snapDeg: 0, config: FREE });
    const a = rotationMatrix(start);
    const b = rotationMatrix(back);
    for (let i = 0; i < 9; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-4);
  });

  it("angleDelta neemt de korte weg", () => {
    assert.equal(angleDelta(350, 10), 20);
    assert.equal(angleDelta(10, 350), -20);
    assert.equal(angleDelta(0, 180), 180);
  });
});
