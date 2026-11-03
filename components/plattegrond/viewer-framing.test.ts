import assert from "node:assert/strict";
import { test } from "node:test";

import type { DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { DEFAULT_VIEW, azimuthDegOf, poseFor } from "@/components/plattegrond/viewer-camera";
import {
  FRAMING_MARGIN,
  chooseDefaultAzimuth,
  framingFill,
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
  const framing = computeFraming({ items, room, aspect: 1.7, mode: "top", lookup, azimuthDeg: 0 });
  const contentWidth = 11; // x van -5,5 ± 0,5
  const fill = contentWidth / framing.visibleWidthM;
  assert.ok(fill > 0.7 && fill <= 0.85, `vulling ${(fill * 100).toFixed(0)}%`);
});

test("zeer brede opstelling (24 × 2 m): breedte bepaalt het kader, niets wordt afgesneden", () => {
  const items = [item("a", "balk", -9, 0), item("b", "balk", 9, 0)];
  const framing = computeFraming({ items, room, aspect: 1.7, mode: "top", lookup, azimuthDeg: 0 });
  const bounds = contentBounds(items, [], lookup)!;
  assert.ok(framing.visibleWidthM >= (bounds.maxX - bounds.minX) * FRAMING_MARGIN - 1e-9);
  assert.ok(framing.visibleHeightM >= bounds.maxZ - bounds.minZ, "hoogte past ook");
});

test("zeer hoge opstelling (2 × 14 m) in een breed kader: de hoogte bepaalt het kader", () => {
  const items = [item("a", "kast", 0, -6.5), item("b", "kast", 0, 6.5)];
  const bounds = contentBounds(items, [], lookup)!;
  const wide = computeFraming({ items, room, aspect: 1.7, mode: "top", lookup, azimuthDeg: 0 });
  near(wide.visibleHeightM, (bounds.maxZ - bounds.minZ) * FRAMING_MARGIN, 1e-3);
  const portrait = computeFraming({ items, room, aspect: 0.8, mode: "top", lookup, azimuthDeg: 0 });
  assert.ok(portrait.visibleWidthM < wide.visibleWidthM, "op een staand scherm past het in een smaller kader");
  near(portrait.visibleHeightM, wide.visibleHeightM, 1e-3);
});

test("mobiel (staand) en desktop (breed): het kader past zich aan de verhouding aan", () => {
  const items = [item("a", "kast", -6, 0), item("b", "kast", 6, 0)];
  const desktop = computeFraming({ items, room, aspect: 1.8, mode: "top", lookup, azimuthDeg: 0 });
  const phone = computeFraming({ items, room, aspect: 1.0, mode: "top", lookup, azimuthDeg: 0 });
  assert.ok(phone.visibleWidthM >= desktop.visibleWidthM - 1e-9);
  for (const framing of [desktop, phone]) assert.ok(framing.visibleWidthM >= 13 * FRAMING_MARGIN - 1e-9, "alles past in de breedte");
});

test("velden tellen mee in het kader", () => {
  const framing = computeFraming({ items: [], fields: [field(0, 0, 10, 20)], room, aspect: 1.7, mode: "top", lookup, azimuthDeg: 0 });
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
  near(framing.polarDeg, 57); // hoge opstelling (net, kast van > 2 m): iets lager kijken zodat de hoogte zichtbaar is
  assert.ok(framing.position[1] > framing.target[1], "de camera staat boven het doelpunt");
  assert.ok(framing.target[1] > 0, "het doelpunt ligt op halve hoogte van de inhoud");
});

test("standaard: azimut 40° en kanteling 50° bij een neutraal arrangement (ook voor een langgerekte opstelling: geen rechte blik meer)", () => {
  const neutral = [item("a", "kast", -1, 0), item("b", "kast", 1, 1)];
  const framing = computeFraming({ items: neutral, room, aspect: 1.7, mode: "3d", lookup });
  assert.equal(Math.abs(framing.azimuthDeg), 40);
  near(framing.polarDeg, 50);
  const long = computeFraming({ items: [item("a", "balk", -9, 0), item("b", "balk", 9, 0)], room, aspect: 1.7, mode: "3d", lookup });
  assert.equal(Math.abs(long.azimuthDeg), 40, "geen kandidaat 20° of 0° meer");
});

test("chooseDefaultAzimuth: symmetrisch, leeg en twijfel → rechts (+40); meeste inhoud links → −40; eigen kijkrichting gaat voor", () => {
  assert.equal(chooseDefaultAzimuth([], room), 40);
  assert.equal(chooseDefaultAzimuth([item("a", "kast", -3, 0), item("b", "kast", 3, 0)], room), 40);
  assert.equal(chooseDefaultAzimuth([item("a", "kast", -6, 0), item("b", "kast", -5, 1), item("c", "kast", 4, 0)], room), -40);
  assert.equal(chooseDefaultAzimuth([item("a", "kast", 6, 0), item("b", "kast", 5, 1), item("c", "kast", -4, 0)], room), 40);
  assert.equal(chooseDefaultAzimuth([item("a", "kast", -6, 0)], { ...room, view_azimuth_deg: -25 }), -25);
});

test("het bovenaanzicht houdt de azimut van de standaard, en 3D, Reset en dubbelklik komen op dezelfde basisstand uit", () => {
  const items = [item("a", "kast", -6, 0), item("b", "kast", -5, 1), item("c", "kast", 4, 0)];
  const three = initialViewFor({ items, room, aspect: 1.7, lookup, mode: "3d" });
  const top = initialViewFor({ items, room, aspect: 1.7, lookup, mode: "top" });
  assert.equal(three.azimuthBase, top.azimuthBase);
  assert.equal(three.polarBase, top.polarBase);
  assert.equal(three.azimuthBase, -40);
  assert.equal(azimuthDegOf(top), -40);
});

test("diagonale blik: de hele inhoud blijft binnen het kader (breed, hoog, smal; desktop- en mobiel-aspect)", () => {
  const sets = [
    [item("a", "balk", -9, 0), item("b", "balk", 9, 0)],
    [item("a", "kast", 0, -6.5), item("b", "kast", 0, 6.5)],
    [item("a", "kast", -1, 0), item("b", "kast", 1, 1)],
    [item("n", "net", -8, 4), item("a", "kast", -6, 5), item("b", "kast", 6, -5)],
  ];
  for (const items of sets) for (const aspect of [1.7, 0.6]) for (const mode of ["3d", "top"] as const) {
    const framing = computeFraming({ items, room, aspect, mode, lookup });
    assert.ok(framingFill(framing) <= 1 / FRAMING_MARGIN + 1e-9, `${mode} ${aspect}: vulling ${framingFill(framing).toFixed(2)}`);
  }
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

test("polar-regel: vlakke indeling steiler (38°), toestellen/netten lager (57°), tussenin 50°", () => {
  assert.equal(computeFraming({ items: [item("a", "kist", 0, 0)], room, aspect: 1.7, mode: "3d", lookup }).polarDeg, 38);
  assert.equal(computeFraming({ items: [item("a", "kast", 0, 0)], room, aspect: 1.7, mode: "3d", lookup }).polarDeg, 50);
  assert.equal(computeFraming({ items: [item("a", "net", 0, 0)], room, aspect: 1.7, mode: "3d", lookup }).polarDeg, 57);
});
