import { test } from "node:test";
import assert from "node:assert/strict";

import type { ConeField, Floorplan3dRoom } from "@/types/floorplan3d";
import {
  clampFieldToRoom,
  computeConePositions,
  coneMaterialTotals,
  coneSideInfo,
  createFieldFromCorners,
  fieldLabel,
  fieldWorldCorners,
  resizeFieldFromCorner,
  snapFieldMove,
  snapFieldPoint,
  summarizeConeField,
} from "@/components/canvas-3d/cone-field";

const room = { width_m: 30, length_m: 20 } as Floorplan3dRoom;
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

function field(overrides: Partial<ConeField> = {}): ConeField {
  return createFieldFromCorners("f1", { x: -5, z: -10 }, { x: 5, z: 10 }, overrides);
}

function unique(points: { x: number; z: number }[]): number {
  return new Set(points.map((p) => `${p.x.toFixed(6)}:${p.z.toFixed(6)}`)).size;
}

test("hoeken zijn altijd aanwezig en komen niet dubbel voor", () => {
  const { corners, edges } = computeConePositions({ width: 10, length: 20, interval: 2 });
  assert.equal(corners.length, 4);
  assert.deepEqual(
    corners.map((c) => [c.x, c.z]),
    [
      [-5, -10],
      [5, -10],
      [5, 10],
      [-5, 10],
    ],
  );
  assert.equal(unique([...corners, ...edges]), corners.length + edges.length);
});

test("10 x 20 m met 2 m geeft 30 pionnen in totaal", () => {
  const { corners, edges } = computeConePositions({ width: 10, length: 20, interval: 2 });
  assert.equal(corners.length + edges.length, 30);
});

test("zijde korter dan het interval: alleen hoekpionnen (n = 1)", () => {
  const { corners, edges } = computeConePositions({ width: 1, length: 1, interval: 2 });
  assert.equal(corners.length, 4);
  assert.equal(edges.length, 0);

  // Ook met een lange zijde en een korte zijde: de korte zijde heeft n = 1.
  const mixed = computeConePositions({ width: 1, length: 10, interval: 2 });
  assert.equal(mixed.corners.length, 4);
  assert.equal(mixed.edges.length, 2 * 4); // 2 lange zijden × (n=5 → 4 tussenpionnen)
});

test("niet-deelbare maten: 9 m geeft n = 5 en interval 1,8 m (gelijkmatig)", () => {
  const info = coneSideInfo({ width: 9, length: 10, interval: 2 });
  assert.equal(info[0].segments, 5);
  near(info[0].interval, 1.8);
  assert.equal(info[1].segments, 5);
  near(info[1].interval, 2);

  const { edges } = computeConePositions({ width: 9, length: 10, interval: 2 });
  // Onderste zijde (z = -5): punten op x = -4,5 + k·1,8.
  const bottom = edges.filter((p) => Math.abs(p.z + 5) < 1e-9).map((p) => p.x).sort((a, b) => a - b);
  assert.equal(bottom.length, 4);
  near(bottom[0], -4.5 + 1.8);
  near(bottom[3], -4.5 + 4 * 1.8);
});

test("exact interval: elke d meter vanaf de hoek, kortere laatste ruimte", () => {
  const info = coneSideInfo({ width: 9, length: 10, interval: 2, mode: "exact" });
  assert.equal(info[0].segments, 5); // 2+2+2+2+1
  near(info[0].interval, 2);
  near(info[0].lastInterval, 1);
  assert.equal(info[1].segments, 5); // 2·5 = 10: geen korte rest
  near(info[1].lastInterval, 2);

  const { edges } = computeConePositions({ width: 9, length: 10, interval: 2, mode: "exact" });
  const bottom = edges.filter((p) => Math.abs(p.z + 5) < 1e-9).map((p) => p.x).sort((a, b) => a - b);
  assert.deepEqual(bottom.map((x) => Number((x + 4.5).toFixed(6))), [2, 4, 6, 8]);
});

test("kleine of nul-afmetingen geven geen crash en geen dubbele pionnen", () => {
  for (const [width, length] of [
    [0, 0],
    [0, 5],
    [5, 0],
    [0.001, 0.001],
    [-3, 4],
    [Number.NaN, 4],
    [Number.POSITIVE_INFINITY, 4],
  ]) {
    const result = computeConePositions({ width, length, interval: 2 });
    assert.ok(result.corners.length >= 1);
    assert.equal(unique([...result.corners, ...result.edges]), result.corners.length + result.edges.length);
  }
  assert.equal(computeConePositions({ width: 0, length: 0, interval: 2 }).corners.length, 1);
  // Ongeldig interval valt terug op de standaard i.p.v. oneindig veel pionnen.
  for (const interval of [0, -1, Number.NaN]) {
    const { corners, edges } = computeConePositions({ width: 10, length: 20, interval });
    assert.equal(corners.length + edges.length, 30);
  }
  // Absurd klein interval blijft begrensd.
  const dense = computeConePositions({ width: 100, length: 100, interval: 0.0001 });
  assert.ok(dense.corners.length + dense.edges.length <= 4 * 1000);
});

test("samenvatting en label: 'Veld 12 x 20 m, 30 pionnen'", () => {
  const f = field({ width_m: 12, length_m: 20, interval_m: 2 });
  // 12 m → n=6 (5 tussen), 20 m → n=10 (9 tussen): 2·5 + 2·9 + 4 = 32
  assert.equal(summarizeConeField(f).total, 32);
  const f2 = field({ width_m: 10, length_m: 20 });
  assert.equal(fieldLabel(f2), "Veld 10 x 20 m, 30 pionnen");
});

test("materiaal nodig: per type en kleur, hoekkleur apart geteld", () => {
  const a = field({ color: "#f97316" });
  const b = field({ id: "f2", color: "#2563eb", corner_color: "#ffffff" });
  const rows = coneMaterialTotals([a, b]);
  const get = (color: string) => rows.find((r) => r.color === color)?.count ?? 0;
  assert.equal(get("#f97316"), 30);
  assert.equal(get("#2563eb"), 26);
  assert.equal(get("#ffffff"), 4);
});

test("wereldhoeken volgen de three.js-rotatie", () => {
  const f = createFieldFromCorners("r", { x: -1, z: -2 }, { x: 1, z: 2 }, { rot_y_deg: 90 });
  const corners = fieldWorldCorners(f);
  // rotation.y = +90°: lokaal (x,z) → (z, −x). Lokale hoek (−1,−2) → (−2, 1).
  near(corners[0].x, -2);
  near(corners[0].z, 1);
});

test("snap: hoek snapt eerst aan zaalrand, dan aan een ander veld, anders raster", () => {
  const ctx = { grid: 0.5 as const, room, others: [] as ConeField[] };
  const wall = snapFieldPoint({ x: 14.9, z: 3.2 }, ctx);
  assert.equal(wall.x, 15);
  assert.equal(wall.z, 3); // raster 0,5

  const other = field({ id: "o", x: 0, z: 0 }); // hoeken op x = ±5, z = ±10
  const snapped = snapFieldPoint({ x: 5.1, z: -9.9 }, { ...ctx, grid: 0.1, others: [other] });
  near(snapped.x, 5);
  near(snapped.z, -10);

  // Buiten de zaal wordt teruggezet.
  const outside = snapFieldPoint({ x: 40, z: -40 }, ctx);
  assert.deepEqual(outside, { x: 15, z: -10 });
});

test("verplaatsen: randen snappen en het veld blijft binnen de zaal", () => {
  const f = field();
  const ctx = { grid: 0.5 as const, room, others: [] as ConeField[] };
  const moved = snapFieldMove(f, { x: 9.9, z: 0 }, ctx); // rechterrand zou op 14,9 liggen → 15
  near(moved.x, 10);
  const far = snapFieldMove(f, { x: 100, z: 100 }, ctx);
  const b = fieldWorldCorners(far);
  assert.ok(b.every((p) => Math.abs(p.x) <= 15 + 1e-9 && Math.abs(p.z) <= 10 + 1e-9));
});

test("clamp: veld dat niet past wordt proportioneel verkleind en verschoven", () => {
  const big = field({ width_m: 40, length_m: 10, x: 0, z: 0 });
  const { field: fitted, shrunk, changed } = clampFieldToRoom(big, room);
  assert.ok(shrunk && changed);
  near(fitted.width_m, 30);
  near(fitted.length_m, 7.5);

  const ok = field({ width_m: 4, length_m: 4, x: 0, z: 0 });
  assert.equal(clampFieldToRoom(ok, room).changed, false);

  const edge = field({ width_m: 4, length_m: 4, x: 14, z: 0 });
  near(clampFieldToRoom(edge, room).field.x, 13);
});

test("hoek slepen houdt de tegenoverliggende hoek vast (ook geroteerd)", () => {
  for (const rot of [0, 30, 90]) {
    const f = createFieldFromCorners("r", { x: -2, z: -1 }, { x: 2, z: 1 }, { rot_y_deg: rot });
    const before = fieldWorldCorners(f);
    const target = { x: before[2].x + 1, z: before[2].z + 1 };
    const next = resizeFieldFromCorner(f, 2, target);
    const after = fieldWorldCorners(next);
    near(after[0].x, before[0].x, 1e-6);
    near(after[0].z, before[0].z, 1e-6);
    near(after[2].x, target.x, 1e-6);
    near(after[2].z, target.z, 1e-6);
  }
  // Niet kleiner dan het minimum.
  const tiny = resizeFieldFromCorner(field(), 2, { x: -5, z: -10 });
  assert.ok(tiny.width_m >= 0.5 && tiny.length_m >= 0.5);
});
