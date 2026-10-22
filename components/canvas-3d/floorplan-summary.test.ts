import { test } from "node:test";
import assert from "node:assert/strict";

import type { Floorplan3dItem } from "@/types/floorplan3d";
import { createFieldFromCorners } from "@/components/canvas-3d/cone-field";
import { summarizeFloorplan } from "@/components/canvas-3d/floorplan-summary";

const item = (id: string, slug: string): Floorplan3dItem => ({ id, slug, x: 0, y: 0, z: 0, rot_y_deg: 0 });
const names: Record<string, string> = { mat: "Dikke mat", bank: "Turnbank" };

test("lege plattegrond is leeg", () => {
  const summary = summarizeFloorplan([], [], () => undefined);
  assert.equal(summary.isEmpty, true);
  assert.equal(summary.itemTotal, 0);
  assert.equal(summary.coneTotal, 0);
});

test("items worden per soort geteld, meeste eerst, onbekende slug netjes benoemd", () => {
  const summary = summarizeFloorplan(
    [item("1", "bank"), item("2", "mat"), item("3", "mat"), item("4", "weg")],
    [],
    (slug) => names[slug],
  );
  assert.deepEqual(
    summary.items.map((row) => [row.naam, row.count]),
    [
      ["Dikke mat", 2],
      ["Onbekend materiaal", 1],
      ["Turnbank", 1],
    ],
  );
  assert.equal(summary.itemTotal, 4);
});

test("velden: label, totaal en pionnen per kleur", () => {
  const field = createFieldFromCorners("f", { x: -5, z: -10 }, { x: 5, z: 10 });
  const summary = summarizeFloorplan([], [field], () => undefined);
  assert.equal(summary.fields[0].label, "Veld 10 x 20 m, 30 pionnen");
  assert.equal(summary.coneTotal, 30);
  assert.equal(summary.coneMaterials[0].count, 30);
  assert.equal(summary.isEmpty, false);
});
