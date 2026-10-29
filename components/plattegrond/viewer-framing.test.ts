import assert from "node:assert/strict";
import { test } from "node:test";

import type { DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { DEFAULT_VIEW, azimuthDegOf, poseFor } from "@/components/plattegrond/viewer-camera";
import {
  FRAMING_MARGIN,
  MIN_SPAN_X_M,
  computeFraming,
  contentBounds,
  framingContent,
  initialViewFor,
  resolveViewMode,
  suggestViewMode,
  wallNodes,
  wallsToHide,
} from "@/components/plattegrond/viewer-framing";
import type { ConeField, Floorplan3dItem } from "@/types/floorplan3d";

const room = { width_m: 24, length_m: 14 };
const lookup: DimsLookup = (slug) => ({ length_m: slug === "balk" ? 6 : 1, width_m: slug === "balk" ? 0.4 : 1, height_m: slug === "net" ? 2.4 : slug === "kast" ? 1.2 : 0.4, stackable: false });
const item = (id: string, slug: string, x: number, z: number): Floorplan3dItem => ({ id, slug, x, y: 0, z, rot_y_deg: 0 });
const field = (x: number, z: number, width = 8, length = 12): ConeField => ({ id: `f${x}${z}`, type: "coneField", x, z, rot_y_deg: 0, width_m: width, length_m: length, interval_m: 2, distribution: "even", marker: "pion", color: "#ff5a1f", corner_color: null });
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ≈ ${b}`);

test("lege zaal: valt terug op de hele zaal", () => {
  const framing = computeFraming({ items: [], room, aspect: 1.7, mode: "3d", lookup });
  assert.equal(framing.empty, true);
  near(framing.target[0], 0);
  near(framing.target[2], 0);
  assert.ok(framing.visibleWidthM >= room.width_m, "de hele breedte past");
  assert.equal(computeFraming({ items: [], room, aspect: 1.7, mode: "auto", lookup }).mode, "3d");
});

test("één item: het kader blijft redelijk groot (geen absurde zoom) en staat op het item", () => {
  const framing = computeFraming({ items: [item("a", "kast", 3, -2)], room, aspect: 1.7, mode: "3d", lookup });
  assert.equal(framing.empty, false);
  near(framing.target[0], 3, 1e-9);
  near(framing.target[2], -2, 1e-9);
  assert.ok(framing.visibleWidthM >= MIN_SPAN_X_M * FRAMING_MARGIN * 0.6, `breedte ${framing.visibleWidthM}`);
  assert.ok(framing.visibleWidthM < room.width_m);
});

test("items in een hoek: het doelpunt ligt bij de inhoud, niet in het midden van de zaal", () => {
  const items = [item("a", "kast", -9, 5), item("b", "kast", -7, 6), item("c", "kast", -8, 4)];
  const framing = computeFraming({ items, room, aspect: 1.7, mode: "top", lookup });
  assert.ok(framing.target[0] < -6 && framing.target[2] > 3, `doel ${framing.target}`);
  const hele = computeFraming({ items: [], room, aspect: 1.7, mode: "top", lookup });
  assert.ok(framing.visibleWidthM < hele.visibleWidthM / 1.8, "veel dichterbij dan de hele zaal");
});

test("de inhoud vult ongeveer 75–85% van het kader (bovenaanzicht, breed kader)", () => {
  const items = [item("a", "kast", -5, 0), item("b", "kast", 5, 0), item("c", "kast", 0, 3), item("d", "kast", 0, -3)];
  const framing = computeFraming({ items, room, aspect: 1.7, mode: "top", lookup });
  const contentWidth = 11; // x van -5,5 ± 0,5
  const fill = contentWidth / framing.visibleWidthM;
  assert.ok(fill > 0.7 && fill <= 0.85, `vulling ${(fill * 100).toFixed(0)}%`);
});

test("zeer brede opstelling (24 × 2 m): breedte bepaalt het kader, niets wordt afgesneden", () => {
  const items = [item("a", "balk", -9, 0), item("b", "balk", 9, 0)];
  const framing = computeFraming({ items, room, aspect: 1.7, mode: "top", lookup });
  const bounds = contentBounds(items, [], lookup)!;
  assert.ok(framing.visibleWidthM >= (bounds.maxX - bounds.minX) * FRAMING_MARGIN - 1e-9);
  assert.ok(framing.visibleHeightM >= bounds.maxZ - bounds.minZ, "hoogte past ook");
});

test("zeer hoge opstelling (2 × 14 m) in een breed kader: de hoogte bepaalt het kader", () => {
  const items = [item("a", "kast", 0, -6.5), item("b", "kast", 0, 6.5)];
  const bounds = contentBounds(items, [], lookup)!;
  const wide = computeFraming({ items, room, aspect: 1.7, mode: "top", lookup });
  near(wide.visibleHeightM, (bounds.maxZ - bounds.minZ) * FRAMING_MARGIN, 1e-3);
  const portrait = computeFraming({ items, room, aspect: 0.8, mode: "top", lookup });
  assert.ok(portrait.visibleWidthM < wide.visibleWidthM, "op een staand scherm past het in een smaller kader");
  near(portrait.visibleHeightM, wide.visibleHeightM, 1e-3);
});

test("mobiel (staand) en desktop (breed): het kader past zich aan de verhouding aan", () => {
  const items = [item("a", "kast", -6, 0), item("b", "kast", 6, 0)];
  const desktop = computeFraming({ items, room, aspect: 1.8, mode: "top", lookup });
  const phone = computeFraming({ items, room, aspect: 1.0, mode: "top", lookup });
  assert.ok(phone.visibleWidthM >= desktop.visibleWidthM - 1e-9);
  for (const framing of [desktop, phone]) assert.ok(framing.visibleWidthM >= 13 * FRAMING_MARGIN - 1e-9, "alles past in de breedte");
});

test("velden tellen mee in het kader", () => {
  const framing = computeFraming({ items: [], fields: [field(0, 0, 10, 20)], room, aspect: 1.7, mode: "top", lookup });
  assert.equal(framing.empty, false);
  assert.ok(framing.visibleHeightM >= 20, "het hele veld past");
});

test("auto: altijd schuin, ook bij een vlakke indeling", () => {
  assert.equal(suggestViewMode([], [field(0, 0)], lookup), "3d", "alleen een afgezet veld");
  assert.equal(suggestViewMode([item("a", "balk", 0, 0)], [], lookup), "3d", "lage toestellen/matten");
  assert.equal(suggestViewMode([item("a", "balk", 0, 0), item("n", "net", 0, 0)], [], lookup), "3d", "een net maakt het ruimtelijk");
  assert.equal(suggestViewMode([item("k", "kast", 0, 0)], [], lookup), "3d");
  assert.equal(suggestViewMode([], [], lookup), "3d");
  assert.equal(resolveViewMode("top", [item("n", "net", 0, 0)], [], lookup), "top", "per plattegrond te overschrijven");
  assert.equal(resolveViewMode("3d", [], [field(0, 0)], lookup), "3d");
  assert.equal(resolveViewMode(undefined, [item("n", "net", 0, 0)], [], lookup), "3d");
});

test("schuine weergave: camera 40° boven de horizon en de hele inhoud (met hoogte) in beeld", () => {
  const items = [item("n", "net", 0, 0), item("a", "kast", 4, 2)];
  const framing = computeFraming({ items, room, aspect: 1.7, mode: "3d", lookup });
  assert.equal(framing.mode, "3d");
  near(framing.polarDeg, 50);
  assert.ok(framing.position[1] > framing.target[1], "de camera staat boven het doelpunt");
  assert.ok(framing.target[1] > 0, "het doelpunt ligt op halve hoogte van de inhoud");
});

test("de kijkrichting is nooit slechter dan de standaard (45°); een compacte opstelling houdt 45°", () => {
  const items = [item("a", "balk", -9, 0), item("b", "balk", 9, 0)];
  const long = computeFraming({ items, room, aspect: 1.7, mode: "3d", lookup });
  const standaard = computeFraming({ items, room, aspect: 1.7, mode: "3d", lookup, azimuthDeg: 45 });
  assert.ok(long.visibleWidthM <= standaard.visibleWidthM + 1e-9, `${long.visibleWidthM} vs ${standaard.visibleWidthM}`);
  assert.ok([0, 20, 45].includes(long.azimuthDeg));
  const compact = computeFraming({ items: [item("a", "kast", -1, 0), item("b", "kast", 1, 1)], room, aspect: 1.7, mode: "3d", lookup });
  const compactStandaard = computeFraming({ items: [item("a", "kast", -1, 0), item("b", "kast", 1, 1)], room, aspect: 1.7, mode: "3d", lookup, azimuthDeg: 45 });
  assert.ok(compact.visibleWidthM <= compactStandaard.visibleWidthM + 1e-9);
});

test("initialViewFor en poseFor: de viewer start ingekaderd, reset keert terug naar die stand", () => {
  const items = [item("n", "net", -8, 4), item("a", "kast", -6, 5)];
  const view = initialViewFor({ items, room, aspect: 1.7, lookup });
  assert.equal(view.preset, "3d");
  const content = framingContent({ items, room, lookup });
  const viewport = { width: 900, height: 480 };
  const framed = poseFor(view, room, viewport, content);
  const whole = poseFor(DEFAULT_VIEW, room, viewport);
  assert.ok(framed.target && framed.target[0] < -5, "kijkt naar de inhoud");
  assert.ok(framed.zoom > whole.zoom * 1.8, `ingezoomd: ${framed.zoom} vs ${whole.zoom}`);
  near(framed.azimuthDeg, azimuthDegOf(view));
  const zoomedIn = poseFor({ ...view, zoom: 2 }, room, viewport, content);
  near(zoomedIn.zoom, framed.zoom * 2, 1e-9);
});

test("muren voor de camera worden weggelaten, alleen in de schuine weergave", () => {
  assert.deepEqual(wallsToHide(45, "3d").sort(), ["rechts", "voor"]);
  assert.deepEqual(wallsToHide(135, "3d").sort(), ["achter", "rechts"]);
  assert.deepEqual(wallsToHide(0, "3d"), ["voor"]);
  assert.deepEqual(wallsToHide(45, "top"), []);
  const nodes = wallNodes({ type: "gymzaal", layout: "standaard" }, ["voor", "rechts"]);
  assert.equal(nodes.length, 2);
  assert.ok(nodes.every((name) => name.startsWith("Muur")));
  assert.deepEqual(wallNodes({ type: "sportveld", layout: "school" }, ["voor"]), []);
  assert.deepEqual(wallNodes(undefined, ["voor"]), []);
});
