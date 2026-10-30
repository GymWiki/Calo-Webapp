import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_VIEW,
  ORBIT_DEG_PER_PX,
  POLAR_3D_DEG,
  POLAR_MAX_DEG,
  POLAR_TOP_DEG,
  SNAP_TOP_DEG,
  ZOOM_MAX,
  ZOOM_MIN,
  azimuthDegOf,
  cameraPosition,
  canZoomIn,
  canZoomOut,
  currentPolarDeg,
  dragBy,
  fitZoom,
  lerpPose,
  orbitBy,
  panBy,
  poseFor,
  resetView,
  rotateStep,
  tiltTo,
  wheelZoom,
  withPreset,
  zoomBy,
} from "@/components/plattegrond/viewer-camera";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("draaien is onbeperkt (je kunt rond blijven gaan) en een kwartslag zet het slepen weer op 0", () => {
  let view = DEFAULT_VIEW;
  view = dragBy(view, 500);
  near(view.offsetDeg, 140);
  near(azimuthDegOf(view) % 360, (45 + 140) % 360);
  view = dragBy(view, -1000);
  assert.ok(Math.abs(view.offsetDeg) < 360);
  const rotated = rotateStep(view, 1);
  assert.equal(rotated.offsetDeg, 0);
  near(azimuthDegOf(rotated) - azimuthDegOf({ ...view, offsetDeg: 0 }), 90);
});

test("kantelen is begrensd en springt vlak bij de bovenkant naar exact bovenaanzicht", () => {
  const start = { ...DEFAULT_VIEW, preset: "3d" as const };
  near(currentPolarDeg(start), POLAR_3D_DEG);
  assert.equal(tiltTo(start, 200).polarDeg, POLAR_MAX_DEG);
  assert.equal(tiltTo(start, -50).polarDeg, POLAR_TOP_DEG);
  assert.equal(tiltTo(start, SNAP_TOP_DEG - 1).polarDeg, POLAR_TOP_DEG, "bijna van boven = exact van boven");
  near(tiltTo(start, 30).polarDeg ?? 0, 30);
});

test("slepen draait (horizontaal) en kantelt (verticaal), in dezelfde richting als de editor: omlaag slepen = hoger kijken", () => {
  const view = orbitBy(DEFAULT_VIEW, 50, 0);
  near(view.offsetDeg, -50 * ORBIT_DEG_PER_PX); // naar rechts slepen = camera naar links, zoals de editor
  near(currentPolarDeg(view), POLAR_3D_DEG);
  const higher = orbitBy(DEFAULT_VIEW, 0, 40);
  assert.ok(currentPolarDeg(higher) < POLAR_3D_DEG, "omlaag slepen: camera hoger (kleinere hoek vanaf verticaal)");
  const lower = orbitBy(DEFAULT_VIEW, 0, -40);
  assert.ok(currentPolarDeg(lower) > POLAR_3D_DEG);
  assert.ok(currentPolarDeg(orbitBy(DEFAULT_VIEW, 0, -10_000)) <= POLAR_MAX_DEG);
});

test("verschuiven: de inhoud beweegt met de aanwijzer mee, ook na draaien", () => {
  // Bovenaanzicht zonder draaiing (azimut 0): schermrechts = +x, schermomhoog = -z.
  const top = { ...DEFAULT_VIEW, preset: "top" as const };
  const right = panBy(top, 100, 0, 0.1);
  near(right.panX ?? 0, -10, 1e-6); // inhoud 10 m naar rechts → doelpunt 10 m naar links
  near(right.panZ ?? 0, 0, 1e-6);
  const down = panBy(top, 0, 100, 0.1);
  near(down.panX ?? 0, 0, 1e-6);
  near(down.panZ ?? 0, -10, 1e-3); // omlaag slepen: het doelpunt schuift "vooruit" (schermomhoog)
  const turned = panBy({ ...top, step: 1 }, 100, 0, 0.1); // 90° gedraaid: schermrechts = -z
  near(turned.panX ?? 0, 0, 1e-6);
  near(turned.panZ ?? 0, 10, 1e-6);
  const twice = panBy(right, 100, 0, 0.1);
  near(twice.panX ?? 0, -20, 1e-6);
});

test("pose volgt kanteling en verschuiving; zoom en doelpunt komen uit de beginstand", () => {
  const content = { framing: () => ({ target: [2, 1, 3] as [number, number, number], visibleWidthM: 10 }) };
  const room = { width_m: 24, length_m: 14 };
  const viewport = { width: 800, height: 480 };
  const base = poseFor(DEFAULT_VIEW, room, viewport, content);
  const turned = poseFor({ ...DEFAULT_VIEW, offsetDeg: 120, polarDeg: 20, panX: -3, panZ: 4 }, room, viewport, content);
  near(turned.zoom, base.zoom, 1e-9); // draaien/kantelen "pompt" het beeld niet
  near(turned.polarDeg, 20);
  near(turned.azimuthDeg, base.azimuthDeg + 120);
  assert.deepEqual(turned.target, [-1, 1, 7]);
});

test("zoom met het wiel is gelijkmatig, begrensd en kan ver inzoomen", () => {
  const zoomedIn = wheelZoom(DEFAULT_VIEW, -300);
  assert.ok(zoomedIn.zoom > 1.5 && zoomedIn.zoom < 2);
  near(wheelZoom(zoomedIn, 300).zoom, 1, 1e-9); // omgekeerd = precies terug
  let view = DEFAULT_VIEW;
  for (let i = 0; i < 100; i++) view = wheelZoom(view, -400);
  near(view.zoom, ZOOM_MAX);
  for (let i = 0; i < 200; i++) view = wheelZoom(view, 400);
  near(view.zoom, ZOOM_MIN);
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

test("de draairichting komt overeen met OrbitControls in de editor: naar rechts slepen verplaatst de camera naar links", () => {
  // Een toenemend azimut verplaatst de camera naar rechts (vanuit de camera gezien); slepen naar rechts moet het dus verlagen.
  const before = azimuthDegOf(DEFAULT_VIEW);
  assert.ok(azimuthDegOf(orbitBy(DEFAULT_VIEW, 40, 0)) < before);
  assert.ok(azimuthDegOf(orbitBy(DEFAULT_VIEW, -40, 0)) > before);
});
