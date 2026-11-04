import assert from "node:assert/strict";
import { test } from "node:test";

import { fitPerspectiveDistance } from "@/components/canvas-3d/camera-fit";

test("perspectief: afstand groeit met de zaal en past in portret en landschap", () => {
  const room = { width_m: 24, length_m: 14 };
  const portrait = fitPerspectiveDistance(room, 40, 38, 390 / 734, 50, 1.12);
  const wide = fitPerspectiveDistance(room, 40, 52, 1200 / 700, 50, 1.2);
  assert.ok(portrait > 5 && wide > 5);
  assert.ok(fitPerspectiveDistance({ width_m: 48, length_m: 28 }, 40, 38, 390 / 734, 50, 1.12) > portrait * 1.8);
});
