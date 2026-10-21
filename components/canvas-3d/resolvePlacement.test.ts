import { test } from "node:test";
import assert from "node:assert/strict";

import type { Floorplan3dItem, Floorplan3dRoom } from "@/types/floorplan3d";
import { footprintAabb, recomputeStackedYs, type DimsLookup, type ItemDims } from "@/components/canvas-3d/floorplan3d-geometry";
import { resolvePlacement } from "@/components/canvas-3d/resolvePlacement";

// De "dikke mat" met de ECHTE afmetingen (3,00 × 2,00 × 0,30 m).
const MAT: ItemDims = { length_m: 3, width_m: 2, height_m: 0.3, stackable: true };
const BLOK: ItemDims = { length_m: 1, width_m: 1, height_m: 1, stackable: false };
const MODELS: Record<string, ItemDims> = { mat: MAT, blok: BLOK };
const lookup: DimsLookup = (slug) => MODELS[slug];
const room: Floorplan3dRoom = { width_m: 20, length_m: 20 } as Floorplan3dRoom;

function item(id: string, slug: string, x: number, z: number, rot = 0, y = 0): Floorplan3dItem {
  return { id, slug, x, y, z, rot_y_deg: rot };
}

function place(
  pointer: { x: number; z: number },
  others: Floorplan3dItem[],
  opts: { slug?: string; rot?: number; grid?: 0 | 0.1 | 0.5; final?: boolean } = {},
) {
  return resolvePlacement({
    pointer,
    dragged: { slug: opts.slug ?? "mat", rot_y_deg: opts.rot ?? 0 },
    others,
    room,
    grid: opts.grid ?? 0,
    lookup,
    final: opts.final,
  });
}

const near = (actual: number, expected: number, message?: string) =>
  assert.ok(Math.abs(actual - expected) < 1e-9, message ?? `${actual} ≠ ${expected}`);

test("twee gelijke matten: mat op mat, y = 0,30 en uitgelijnd", () => {
  const a = item("a", "mat", 0, 0);
  const result = place({ x: 0.05, z: -0.03 }, [a]);
  assert.equal(result.mode, "stack");
  near(result.y, 0.3);
  near(result.x, 0);
  near(result.z, 0);
  assert.deepEqual(result.stackedOn, ["mat"]);
  assert.match(result.log, /^stack op mat/);
});

test("stapelen op middelpunt, ook zonder 20% overlap, en een derde mat komt erbovenop", () => {
  const a = item("a", "mat", 0, 0);
  const b = item("b", "mat", 0, 0, 0, 0.3);
  const result = place({ x: 0.02, z: 0.02 }, [a, b], { final: true });
  assert.equal(result.mode, "stack");
  near(result.y, 0.6);
});

test("twee matten naast elkaar: 0 mm spleet en niet over elkaar gesprongen", () => {
  const a = item("a", "mat", 0, 0);
  // Pointer zodat er 3 cm tussen zit (binnen 8 cm) …
  const gap = place({ x: 3.03, z: 0 }, [a]);
  assert.equal(gap.mode, "edge");
  near(gap.y, 0);
  near(footprintAabb(gap.x, gap.z, 3, 2, 0).minX, footprintAabb(0, 0, 3, 2, 0).maxX, "spleet moet 0 zijn");
  // … en met 3 cm indringing (>2 cm, <20%) wordt het eruit geduwd i.p.v. gestapeld.
  const overlap = place({ x: 2.97, z: 0 }, [a]);
  assert.equal(overlap.mode, "edge");
  near(overlap.y, 0);
  near(overlap.x, 3);
});

test("rakende matten (0 mm) tellen niet als overlap en springen niet op elkaar", () => {
  const a = item("a", "mat", 0, 0);
  const result = place({ x: 3, z: 0 }, [a], { final: true });
  near(result.y, 0);
  near(result.x, 3);
  assert.equal(result.stackedOn.length, 0);
});

test("overlap kleiner dan 2 cm wordt genegeerd", () => {
  const a = item("a", "mat", 0, 0);
  const result = place({ x: 2.99, z: 0 }, [a], { grid: 0 });
  near(result.y, 0);
  assert.equal(result.blocked, false);
});

test("mat op een niet-stapelbaar item: gaat ernaast", () => {
  const blok = item("n", "blok", 0, 0);
  const dragging = place({ x: 0.1, z: 0.1 }, [blok]);
  assert.equal(dragging.blocked, true);
  assert.equal(dragging.stackedOn.length, 0);

  const dropped = place({ x: 0.1, z: 0.1 }, [blok], { final: true });
  assert.equal(dropped.mode, "relocated");
  near(dropped.y, 0);
  const fp = footprintAabb(dropped.x, dropped.z, 3, 2, 0);
  const bl = footprintAabb(0, 0, 1, 1, 0);
  const apart = fp.minX >= bl.maxX - 1e-9 || fp.maxX <= bl.minX + 1e-9 || fp.minZ >= bl.maxZ - 1e-9 || fp.maxZ <= bl.minZ + 1e-9;
  assert.ok(apart, "mat moet naast het blok liggen");
});

test("mat binnen 8 cm van een andere snapt aan; verder weg niet", () => {
  const a = item("a", "mat", 0, 0);
  const close = place({ x: 3.07, z: 0.05 }, [a]);
  assert.equal(close.mode, "edge");
  near(close.x, 3);
  near(close.z, 0); // uitgelijnd met de zijrand
  assert.deepEqual(close.edgeTargets.filter(Boolean), ["mat", "mat"]);
  assert.ok(close.log.includes("rand-snap naar mat"));

  const far = place({ x: 3.2, z: 0 }, [a], { grid: 0 });
  assert.equal(far.mode, "none");
  near(far.x, 3.2);
});

test("randsnap gaat voor rastersnap; raster alleen zonder randsnap", () => {
  const a = item("a", "mat", 0, 0);
  const result = place({ x: 3.04, z: 7.04 }, [a], { grid: 0.1 });
  near(result.x, 3); // rand wint van raster (3,0)
  near(result.z, 7); // z: geen rand in de buurt → raster
  assert.ok(result.log.includes("raster"));
});

test("twee matten 90° gedraaid: strak tegen elkaar", () => {
  const a = item("a", "mat", 0, 0, 90);
  const result = place({ x: 2.04, z: 0.03 }, [a], { rot: 90 });
  assert.equal(result.mode, "edge");
  near(result.x, 2);
  near(result.z, 0);
  const left = footprintAabb(0, 0, 3, 2, 90);
  const right = footprintAabb(result.x, result.z, 3, 2, 90);
  near(right.minX, left.maxX);
});

test("niet-90°-rotatie: geen randsnap, wél stapelen", () => {
  const a = item("a", "mat", 0, 0);
  const stacked = place({ x: 0.3, z: 0.1 }, [a], { rot: 45 });
  assert.equal(stacked.mode, "stack");
  near(stacked.y, 0.3);

  const beside = place({ x: 4.05, z: 0 }, [a], { rot: 45, grid: 0 });
  assert.equal(beside.edgeTargets.filter((t) => t !== null).length, 0);
});

test("randsnap verstoort het stapelen niet", () => {
  const a = item("a", "mat", 0, 0);
  // Dit punt ligt 7 cm van de rechter rand: zonder volgorde-regel zou de
  // snap het item naast de mat trekken i.p.v. erop te laten staan.
  const result = place({ x: 1.45, z: 0 }, [a]);
  assert.equal(result.mode, "stack");
  near(result.y, 0.3);
});

test("laden: gestapelde en naast elkaar liggende matten houden hun hoogte", () => {
  const stacked = recomputeStackedYs([item("a", "mat", 0, 0), item("b", "mat", 0, 0, 0, 0.3)], lookup);
  assert.deepEqual(stacked.map((i) => i.y).map((y) => Math.round(y * 1000) / 1000), [0, 0.3]);

  const beside = recomputeStackedYs([item("a", "mat", 0, 0), item("b", "mat", 3, 0)], lookup);
  assert.deepEqual(beside.map((i) => i.y), [0, 0]);
});
