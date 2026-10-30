import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import {
  CLIPBOARD_FORMAT,
  PASTE_OFFSET_M,
  buildClipboard,
  clipboardBounds,
  clipboardMessage,
  parseClipboard,
  pasteClipboard,
  serializeClipboard,
} from "@/lib/plattegrond/clipboard";
import type { ConeField, Floorplan3dItem } from "@/types/floorplan3d";

const lookup: DimsLookup = () => ({ length_m: 1, width_m: 1, height_m: 1, stackable: true });
const room = { width_m: 24, length_m: 14 };
let counter = 0;
const createId = () => `nieuw-${++counter}`;

const item = (id: string, x: number, z: number, extra: Partial<Floorplan3dItem> = {}): Floorplan3dItem => ({ id, slug: "mat", x, y: 0, z, rot_y_deg: 0, ...extra });
const field: ConeField = { id: "veld", type: "coneField", x: 2, z: 1, rot_y_deg: 0, width_m: 4, length_m: 6, interval_m: 2, distribution: "even", marker: "pion", color: "#ff5a1f", corner_color: null };

describe("kopiëren", () => {
  it("maakt een diepe kopie met alle velden", () => {
    const original = item("a", 1, 2, { rot_x_deg: 15, rot_z_deg: -10, lift_m: 0.4, locked: true, color: "#2563eb", size: "groot" });
    const payload = buildClipboard([original], [field]);
    assert.equal(payload.format, CLIPBOARD_FORMAT);
    assert.deepEqual(payload.items[0], original);
    original.x = 99;
    assert.equal(payload.items[0].x, 1, "latere wijzigingen raken het klembord niet");
  });
});

describe("plakken", () => {
  it("behoudt alle eigenschappen en geeft nieuwe unieke id's", () => {
    const original = item("a", 1, 2, { rot_y_deg: 90, rot_x_deg: 15, rot_z_deg: -10, lift_m: 0.4, locked: true, slug: "leerling_pose_staand", color: "#2563eb", size: "groot" });
    const result = pasteClipboard(buildClipboard([original], [field]), { room, lookup, grid: 0.1, createId });
    const [copy] = result.items;
    assert.notEqual(copy.id, original.id);
    assert.notEqual(result.coneFields[0].id, field.id);
    assert.equal(new Set([copy.id, result.coneFields[0].id]).size, 2);
    for (const key of ["slug", "rot_y_deg", "rot_x_deg", "rot_z_deg", "lift_m", "locked", "color", "size"] as const) assert.equal(copy[key], original[key], key);
    assert.equal(result.coneFields[0].width_m, field.width_m);
    assert.equal(result.coneFields[0].marker, field.marker);
  });

  it("schuift standaard 0,5 m op en elke volgende plak verder", () => {
    const payload = buildClipboard([item("a", 0, 0)], []);
    const first = pasteClipboard(payload, { room, lookup, pasteIndex: 1, createId });
    const second = pasteClipboard(payload, { room, lookup, pasteIndex: 2, createId });
    assert.equal(first.items[0].x, PASTE_OFFSET_M);
    assert.equal(second.items[0].x, 2 * PASTE_OFFSET_M);
    assert.equal(second.items[0].z, 2 * PASTE_OFFSET_M);
  });

  it("plakt op de muispositie (midden van de groep) en snapt aan het raster", () => {
    const payload = buildClipboard([item("a", 0, 0), item("b", 4, 0)], []);
    const result = pasteClipboard(payload, { room, lookup, grid: 0.5, target: { x: 3.13, z: -2.02 }, createId });
    const xs = result.items.map((i) => i.x);
    assert.equal(xs[1] - xs[0], 4, "onderlinge afstand blijft gelijk");
    assert.equal((xs[0] + xs[1]) / 2 % 0.5, 0, "gesnapt op het raster");
    assert.ok(Math.abs((xs[0] + xs[1]) / 2 - 3) <= 0.25 + 1e-9);
  });

  it("houdt de onderlinge afstanden bij meerdere objecten (ook velden)", () => {
    const payload = buildClipboard([item("a", 0, 0), item("b", 3, 1.5)], [field]);
    const result = pasteClipboard(payload, { room, lookup, grid: 0.1, createId });
    assert.ok(Math.abs(result.items[1].x - result.items[0].x - 3) < 1e-9);
    assert.ok(Math.abs(result.items[1].z - result.items[0].z - 1.5) < 1e-9);
    assert.ok(Math.abs(result.coneFields[0].x - result.items[0].x - 2) < 1e-9);
  });

  it("blijft binnen de zaal: de hele groep schuift terug", () => {
    const payload = buildClipboard([item("a", 11, 0), item("b", 8, 0)], []);
    const result = pasteClipboard(payload, { room, lookup, pasteIndex: 3, createId });
    const bounds = clipboardBounds(result.items, [], lookup)!;
    assert.ok(bounds.maxX <= room.width_m / 2 + 1e-9, `maxX ${bounds.maxX}`);
    assert.ok(result.clamped);
    assert.ok(Math.abs(result.items[0].x - result.items[1].x - 3) < 1e-9, "afstand blijft 3 m");
  });

  it("eigen verschuiving (dupliceren) gaat boven muis en plakteller", () => {
    const payload = buildClipboard([item("a", 0, 0)], []);
    const result = pasteClipboard(payload, { room, lookup, target: { x: 5, z: 5 }, pasteIndex: 4, offset: { x: 0.5, z: 0.5 }, createId });
    assert.deepEqual([result.items[0].x, result.items[0].z], [0.5, 0.5]);
  });
});

describe("systeemklembord", () => {
  const payload = buildClipboard([item("a", 1, 2, { color: "#ff0000" })], [field]);

  it("serialiseert en leest terug", () => {
    const parsed = parseClipboard(serializeClipboard(payload));
    assert.ok(parsed.ok);
    assert.deepEqual(parsed.payload, payload);
  });

  it("weigert vreemde data met een nette melding", () => {
    for (const text of ["", "hallo", "{}", '{"format":"iets-anders"}', "[1,2,3]"]) {
      const parsed = parseClipboard(text);
      assert.ok(!parsed.ok, text);
      assert.match(parsed.error, /GymWiki/);
    }
    const kapot = parseClipboard(JSON.stringify({ format: CLIPBOARD_FORMAT, version: 1, items: [{ id: "a" }], coneFields: [] }));
    assert.ok(!kapot.ok);
    const leeg = parseClipboard(JSON.stringify({ format: CLIPBOARD_FORMAT, version: 1, items: [], coneFields: [] }));
    assert.ok(!leeg.ok);
    const toekomst = parseClipboard(JSON.stringify({ ...payload, version: 2 }));
    assert.ok(!toekomst.ok);
  });

  it("meldingen in het Nederlands", () => {
    assert.equal(clipboardMessage(1, "gekopieerd"), "1 object gekopieerd");
    assert.equal(clipboardMessage(3, "geplakt"), "3 objecten geplakt");
    assert.equal(clipboardMessage(2, "geknipt"), "2 objecten geknipt");
  });
});

describe("touwen in het klembord", () => {
  const a = { id: "a", slug: "paal", x: 0, y: 0, z: 0, rot_y_deg: 0 };
  const b = { id: "b", slug: "paal", x: 4, y: 0, z: 0, rot_y_deg: 0 };
  const ab = { id: "t1", a: { item: "a", local: [0, 1.5, 0] as [number, number, number] }, b: { item: "b", local: [0, 1.5, 0] as [number, number, number] } };
  const bc = { id: "t2", a: { item: "b", local: [0, 1.2, 0] as [number, number, number] }, b: { item: "c", local: [0, 1.2, 0] as [number, number, number] } };
  const lookup = () => ({ length_m: 1, width_m: 1, height_m: 2, stackable: true });

  it("neemt alleen touwen mee waarvan beide items meegaan", () => {
    const payload = buildClipboard([a, b], [], [ab, bc]);
    assert.deepEqual(payload.ropes.map((rope) => rope.id), ["t1"]);
  });

  it("de geplakte kopie hangt aan de kopieën, niet aan de originelen, en houdt het punt op het item", () => {
    let n = 0;
    const result = pasteClipboard(buildClipboard([a, b], [], [ab]), { room: { width_m: 30, length_m: 30 }, lookup, createId: () => `n${++n}`, offset: { x: 1, z: 1 } });
    assert.equal(result.ropes.length, 1);
    const ids = new Set(result.items.map((item) => item.id));
    assert.ok(ids.has(result.ropes[0].a.item) && ids.has(result.ropes[0].b.item));
    assert.notEqual(result.ropes[0].a.item, "a");
    assert.deepEqual(result.ropes[0].a.local, [0, 1.5, 0]);
    assert.notEqual(result.ropes[0].id, "t1");
  });

  it("oudere klembordinhoud zonder touwen blijft leesbaar", () => {
    const text = JSON.stringify({ format: "gymwiki-clipboard", version: 1, items: [a], coneFields: [] });
    const parsed = parseClipboard(text);
    assert.ok(parsed.ok);
    if (parsed.ok) assert.deepEqual(parsed.payload.ropes, []);
  });
});
