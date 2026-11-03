import assert from "node:assert/strict";
import { test } from "node:test";

import { fitOrthoZoom } from "@/components/canvas-3d/camera-fit";

test("de zaal past met marge in het canvas, in portret en landschap", () => {
  const room = { width_m: 24, length_m: 14 };
  for (const size of [{ width: 390, height: 734 }, { width: 360, height: 530 }, { width: 1200, height: 700 }]) {
    const zoom = fitOrthoZoom(room, 45, 38, size, 1.05);
    assert.ok(zoom > 0 && Number.isFinite(zoom));
    // projectie van de zaal in pixels past binnen het canvas
    const diag = (room.width_m + room.length_m) * Math.SQRT1_2;
    assert.ok(diag * zoom <= size.width + 1, `breedte ${diag * zoom} ≤ ${size.width}`);
  }
});

test("perspectief: afstand groeit met de zaal en past in portret en landschap", async () => {
  const { fitPerspectiveDistance } = await import("@/components/canvas-3d/camera-fit");
  const room = { width_m: 24, length_m: 14 };
  const portrait = fitPerspectiveDistance(room, 40, 38, 390 / 734, 50, 1.12);
  const wide = fitPerspectiveDistance(room, 40, 52, 1200 / 700, 50, 1.2);
  assert.ok(portrait > 5 && wide > 5);
  assert.ok(fitPerspectiveDistance({ width_m: 48, length_m: 28 }, 40, 38, 390 / 734, 50, 1.12) > portrait * 1.8);
});
