import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_VIEW,
  DRAG_LIMIT_DEG,
  ZOOM_MAX,
  ZOOM_MIN,
  azimuthDegOf,
  cameraPosition,
  canZoomIn,
  canZoomOut,
  dragBy,
  fitZoom,
  lerpPose,
  poseFor,
  resetView,
  rotateStep,
  withPreset,
  zoomBy,
} from "@/components/plattegrond/viewer-camera";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("slepen is begrensd rond de huidige stap", () => {
  let view = DEFAULT_VIEW;
  view = dragBy(view, 500);
  assert.equal(view.offsetDeg, DRAG_LIMIT_DEG);
  view = dragBy(view, -1000);
  assert.equal(view.offsetDeg, -DRAG_LIMIT_DEG);
  // Een kwartslag zet het slepen weer op 0 en verschuift 90°.
  const rotated = rotateStep(view, 1);
  assert.equal(rotated.offsetDeg, 0);
  near(azimuthDegOf(rotated) - azimuthDegOf({ ...view, offsetDeg: 0 }), 90);
});

test("zoom blijft binnen min en max en knoppen weten wanneer ze klaar zijn", () => {
  let view = DEFAULT_VIEW;
  for (let i = 0; i < 30; i++) view = zoomBy(view, 1.25);
  near(view.zoom, ZOOM_MAX);
  assert.equal(canZoomIn(view), false);
  assert.equal(canZoomOut(view), true);
  for (let i = 0; i < 60; i++) view = zoomBy(view, 0.8);
  near(view.zoom, ZOOM_MIN);
  assert.equal(canZoomOut(view), false);
});

test("reset en presets zetten de stand terug zonder de kwartslag te verliezen", () => {
  const turned = rotateStep(dragBy(DEFAULT_VIEW, 20), 1);
  const top = withPreset(turned, "top");
  assert.equal(top.preset, "top");
  assert.equal(top.step, 1);
  assert.equal(top.offsetDeg, 0);
  assert.deepEqual(resetView(), DEFAULT_VIEW);
});

test("schuine weergave kijkt van boven-voor-rechts naar het midden", () => {
  const pose = poseFor(DEFAULT_VIEW, { width_m: 24, length_m: 14 }, { width: 800, height: 400 });
  const [x, y, z] = cameraPosition(pose.azimuthDeg, pose.polarDeg, 100);
  assert.ok(x > 0 && y > 0 && z > 0);
  near(Math.hypot(x, y, z), 100, 1e-6);
});

test("bovenaanzicht past de kamer: breedte of hoogte bepaalt de zoom", () => {
  // Zonder muurhoogte en op az=0, loodrecht omlaag: pure rechthoek.
  const wide = fitZoom({
    room: { width_m: 20, length_m: 10 },
    viewport: { width: 800, height: 800 },
    azimuthDeg: 0,
    polarDeg: 0.05,
    wallHeight: 0,
    margin: 1,
  });
  // Door het sleepbereik (±40°) is de rechthoek in het ergste geval gedraaid,
  // dus de zoom is kleiner dan bij exact uitgelijnd (800/20 = 40).
  assert.ok(wide < 40 && wide > 20, `${wide}`);
  // Hogere kamer past in een lager venster: zoom daalt.
  const lowViewport = fitZoom({
    room: { width_m: 20, length_m: 10 },
    viewport: { width: 800, height: 200 },
    azimuthDeg: 0,
    polarDeg: 0.05,
    wallHeight: 0,
    margin: 1,
  });
  assert.ok(lowViewport < wide);
});

test("overgang loopt van begin- naar eindstand", () => {
  const from = { azimuthDeg: 45, polarDeg: 54.7, zoom: 20 };
  const to = { azimuthDeg: 0, polarDeg: 0.05, zoom: 40 };
  assert.deepEqual(lerpPose(from, to, 0), from);
  const end = lerpPose(from, to, 1);
  near(end.azimuthDeg, 0);
  near(end.zoom, 40);
  const mid = lerpPose(from, to, 0.5);
  assert.ok(mid.azimuthDeg < 45 && mid.azimuthDeg > 0);
});

test("onzinnige afmetingen geven een bruikbare zoom", () => {
  const zoom = fitZoom({
    room: { width_m: 0, length_m: 0 },
    viewport: { width: 0, height: 0 },
    azimuthDeg: 45,
    polarDeg: 54.7,
  });
  assert.ok(Number.isFinite(zoom) && zoom > 0);
});
