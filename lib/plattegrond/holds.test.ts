import assert from "node:assert/strict";
import { test } from "node:test";

import { parsePlattegrondJson } from "@/lib/plattegrond/validate";
import { buildEnvelope, stringifyEnvelope } from "@/lib/plattegrond/format";

const scene = (items: unknown[]) => ({ format: "gymwiki-plattegrond", version: 1, scene: { version: 1, room: { width_m: 24, length_m: 14 }, items, coneFields: [], ropes: [] } });
const student = { id: "s1", slug: "leerling_pose_standaard", x: 0, y: 0, z: 0, rot_y_deg: 0 };
const ball = (id: string, hold: unknown) => ({ id, slug: "basketbal_maat_5", x: 0, y: 1, z: 0, rot_y_deg: 0, lift_m: 1, houdt_vast: hold });

test("een geldige koppeling blijft; een JSON-roundtrip behoudt hem", () => {
  const result = parsePlattegrondJson(JSON.stringify(scene([student, ball("b1", { leerling: "s1", hand: "rechts" })])));
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.deepEqual(result.scene.items[1].houdt_vast, { leerling: "s1", hand: "rechts" });
  assert.equal(result.warnings.some((warning) => warning.code === "koppeling-weggelaten"), false);
  const again = parsePlattegrondJson(stringifyEnvelope(buildEnvelope(result.scene, "Test")));
  assert.ok(again.ok && again.scene.items[1].houdt_vast?.hand === "rechts");
});

test("onbekende hand wordt geweigerd; onbekende leerling of bezette hand vervalt met waarschuwing (object blijft staan)", () => {
  const badHand = parsePlattegrondJson(JSON.stringify(scene([student, ball("b1", { leerling: "s1", hand: "voet" })])));
  assert.equal(badHand.ok, false);
  const missing = parsePlattegrondJson(JSON.stringify(scene([ball("b1", { leerling: "weg", hand: "links" })])));
  assert.ok(missing.ok);
  if (missing.ok) {
    assert.equal(missing.scene.items[0].houdt_vast, undefined);
    assert.equal(missing.scene.items[0].y, 1);
    assert.ok(missing.warnings.some((warning) => warning.code === "koppeling-weggelaten"));
  }
  const busy = parsePlattegrondJson(JSON.stringify(scene([student, ball("b1", { leerling: "s1", hand: "links" }), ball("b2", { leerling: "s1", hand: "links" })])));
  assert.ok(busy.ok);
  if (busy.ok) assert.deepEqual(busy.scene.items.map((item) => Boolean(item.houdt_vast)), [false, true, false]);
});

test("oude plattegronden zonder houdt_vast laden ongewijzigd", () => {
  const result = parsePlattegrondJson(JSON.stringify(scene([student, { id: "b1", slug: "basketbal_maat_5", x: 1, y: 0, z: 1, rot_y_deg: 0 }])));
  assert.ok(result.ok);
  if (result.ok) assert.equal("houdt_vast" in result.scene.items[1], false);
});
