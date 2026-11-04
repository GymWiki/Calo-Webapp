import assert from "node:assert/strict";
import { test } from "node:test";

import { floorplan3dDataSchema } from "@/types/floorplan3d";

const base = { version: 1, items: [], coneFields: [] };

test("oude plattegronden met room.view (top/3d/auto) of zonder blijven geldig en worden ongewijzigd bewaard (de waarde wordt genegeerd)", () => {
  for (const view of ["top", "3d", "auto", undefined]) {
    const room = { width_m: 24, length_m: 14, ...(view ? { view } : {}) };
    const parsed = floorplan3dDataSchema.parse({ ...base, room });
    assert.equal(parsed.room.view, view);
  }
  assert.equal(floorplan3dDataSchema.safeParse({ ...base, room: { width_m: 24, length_m: 14, view: "iets" } }).success, false);
});
