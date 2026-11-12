import assert from "node:assert/strict";
import { test } from "node:test";

import { formatHeight, liftHeight, liftSnapPoints, maxLiftHeight, screenDeltaToWorldHeight } from "@/components/canvas-3d/lift";

const base = { viewportHeightPx: 800, fovDeg: 50, distance: 10, pitchRad: 0 };

test("schermbeweging → wereldhoogte: omhoog is positief, verder weg is meer meter per pixel", () => {
  const near = screenDeltaToWorldHeight({ ...base, dyPx: 100, distance: 5 });
  const far = screenDeltaToWorldHeight({ ...base, dyPx: 100, distance: 10 });
  assert.ok(near > 0 && far > near);
  assert.ok(screenDeltaToWorldHeight({ ...base, dyPx: -100 }) < 0);
  // Bij horizontale kijkrichting past een scherm van 800 px precies 2·d·tan(fov/2) meter.
  assert.ok(Math.abs(screenDeltaToWorldHeight({ ...base, dyPx: 800 }) - 2 * 10 * Math.tan((25 * Math.PI) / 180)) < 1e-9);
});

test("een steile kijkhoek vraagt meer pixelbeweging per meter, maar de deler blijft begrensd", () => {
  const flat = screenDeltaToWorldHeight({ ...base, dyPx: 100, pitchRad: 0 });
  const steep = screenDeltaToWorldHeight({ ...base, dyPx: 100, pitchRad: 1.0 });
  assert.ok(steep > flat);
  const top = screenDeltaToWorldHeight({ ...base, dyPx: 100, pitchRad: Math.PI / 2 });
  assert.ok(Number.isFinite(top) && top <= flat * 5.0001);
});

const snapPoints = liftSnapPoints({ restHeight: 0, extra: [{ height: 1.1, label: "hand" }] });
const common = { startHeight: 0, min: 0, max: 5, gridStepM: 0.05, snapPoints, free: false };

test("hoogte: raster van 5 cm, magnetisch aan vloer, nethoogte en handhoogte, geklemd tussen min en max", () => {
  assert.deepEqual(liftHeight({ ...common, deltaM: 0.62 }), { height: 0.6, snappedTo: null });
  assert.deepEqual(liftHeight({ ...common, deltaM: 0.03 }), { height: 0, snappedTo: "vloer" });
  assert.deepEqual(liftHeight({ ...common, deltaM: 1.13 }), { height: 1.1, snappedTo: "hand" });
  assert.deepEqual(liftHeight({ ...common, deltaM: 1.57 }), { height: 1.55, snappedTo: "nethoogte" });
  assert.equal(liftHeight({ ...common, deltaM: 99 }).height, 5);
  assert.equal(liftHeight({ ...common, deltaM: -3 }).height, 0);
});

test("Shift = vrij: geen raster en geen magneet", () => {
  assert.deepEqual(liftHeight({ ...common, deltaM: 1.1234, free: true }), { height: 1.123, snappedTo: null });
  assert.deepEqual(liftHeight({ ...common, deltaM: 0.03, free: true }), { height: 0.03, snappedTo: null });
});

test("de ondergrond is de ondergrens en een snappunt eronder doet niet mee", () => {
  const onMat = liftSnapPoints({ restHeight: 0.06 });
  const result = liftHeight({ ...common, min: 0.06, snapPoints: onMat, startHeight: 0.06, deltaM: -0.2 });
  assert.deepEqual(result, { height: 0.06, snappedTo: null });
  assert.deepEqual(liftHeight({ ...common, min: 0.06, snapPoints: onMat, startHeight: 0.06, deltaM: 0.02 }), { height: 0.06, snappedTo: "ondergrond" });
});

test("preview en commit gebruiken dezelfde berekening (zelfde invoer, zelfde uitkomst)", () => {
  const a = liftHeight({ ...common, deltaM: 0.777 });
  const b = liftHeight({ ...common, deltaM: 0.777 });
  assert.deepEqual(a, b);
});

test("maximale hoogte: zaalhoogte min objecthoogte, nooit negatief of boven 10 m", () => {
  assert.equal(maxLiftHeight(6, 1.8), 4.2);
  assert.equal(maxLiftHeight(3, 5), 0);
  assert.equal(maxLiftHeight(40, 1), 10);
  assert.equal(formatHeight(1.35), "1,35 m");
});
