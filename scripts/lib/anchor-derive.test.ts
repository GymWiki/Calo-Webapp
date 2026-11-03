import assert from "node:assert/strict";
import { test } from "node:test";

import { deriveAnchors, distanceToGeometry, onBoundingBoxEdge, pointTriangleDistance, topAnchors } from "./anchor-derive.ts";
import type { GlbGeometry, GlbPart, Vec3 } from "./glb-geometry.ts";

/** Een gesloten doos als mesh-deel (12 driehoeken). */
function box(name: string, min: Vec3, max: Vec3): GlbPart {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const v = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const t = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5];
  return { name, color: null, positions: Float32Array.from(v), triangles: Uint32Array.from(t), min, max };
}
const geo = (parts: GlbPart[]): GlbGeometry => ({ parts, anchorNodes: [], nodeNames: parts.map((p) => p.name) });
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("paal met een brede korf bovenop: het touw komt onder de korf aan de paal uit, niet aan de korfrand", () => {
  const paal = box("Buis", [-0.03, 0, -0.03], [0.03, 2.4, 0.03]);
  const korf = box("Korf", [-0.04, 2.22, -0.22], [0.51, 2.5, 0.22]);
  const d = deriveAnchors("korfbalpaal_test", geo([paal, korf]));
  assert.equal(d.cls, "paal");
  const [a] = d.anchors;
  near(a.pos[0], 0);
  near(a.pos[2], 0);
  assert.ok(a.pos[1] < 2.22 && a.pos[1] > 2.0, `onder de korf: ${a.pos[1]}`);
  assert.ok(a.adjustable && a.adjustable.max === a.pos[1]);
  assert.ok(distanceToGeometry(a.pos, [paal, korf]) <= 0.02, "op de paal");
  assert.ok(Math.abs(a.pos[0] - 0.51) > 0.4, "niet aan de korfrand");
});

test("een set met twee palen en een net ertussen: de band langs de paal verlaagt het aanhechtpunt niet", () => {
  const l = box("Paal_L", [-0.8 - 0.04, 0, -0.04], [-0.8 + 0.04, 2.55, 0.04]);
  const r = box("Paal_R", [0.8 - 0.04, 0, -0.04], [0.8 + 0.04, 2.55, 0.04]);
  const net = box("Net", [-0.8, 1.0, -0.005], [0.8, 2.43, 0.005]);
  const d = deriveAnchors("volleybalpalen_test", geo([l, r, net]));
  assert.equal(d.cls, "paal");
  assert.equal(d.anchors.length, 2);
  for (const a of d.anchors) near(a.pos[1], 2.55);
  assert.ok(d.anchors[0].pos[0] < d.anchors[1].pos[0]);
});

test("een net (los): linker- en rechterbovenhoek van het net, op de echte geometrie", () => {
  const net = box("Net", [-5.25, 1.0, -0.01], [5.25, 2.43, 0.01]);
  const d = deriveAnchors("volleybalnet_test_los", geo([net]));
  assert.equal(d.cls, "net");
  assert.deepEqual(d.anchors.map((a) => a.id), ["net_links", "net_rechts"]);
  assert.ok(d.anchors.every((a) => a.types.includes("net")));
  assert.ok(d.anchors.every((a) => distanceToGeometry(a.pos, [net]) <= 0.02));
});

test("een platte mat: het bovenpunt is het midden van het bovenvlak, niet een hoek van de box", () => {
  const mat = box("Mat", [-1, 0, -0.5], [1, 0.06, 0.5]);
  const [a] = topAnchors([mat]);
  near(a.pos[0], 0, 1e-3);
  near(a.pos[2], 0, 1e-3);
  near(a.pos[1], 0.06);
  assert.equal(a.source, "fallback");
  assert.ok(!onBoundingBoxEdge(a.pos, [mat], distanceToGeometry(a.pos, [mat])));
});

test("hangende delen (ring): het ophangpunt zit op het touw bovenaan, geen paal met schuifbereik", () => {
  const touw = box("Touw", [-0.01, 2.0, -0.01], [0.01, 4.0, 0.01]);
  const d = deriveAnchors("zwaairingen_test", geo([touw]));
  assert.equal(d.cls, "paal");
  assert.ok(d.anchors[0].id.startsWith("ophang"));
  assert.equal(d.anchors[0].adjustable, undefined);
  near(d.anchors[0].pos[1], 4.0);
});

test("een anchor-node in het GLB wint van de afleiding", () => {
  const paal = box("Buis", [-0.03, 0, -0.03], [0.03, 2.4, 0.03]);
  const g = { ...geo([paal]), anchorNodes: [{ name: "anchor_lint_haak_boven", position: [0, 1.9, 0] as Vec3, direction: [0, 1, 0] as Vec3 }, { name: "anchor_kapot", position: [0, 0, 0] as Vec3, direction: [0, 1, 0] as Vec3 }] };
  const d = deriveAnchors("welk_asset", g);
  assert.equal(d.cls, "glb");
  assert.equal(d.anchors.length, 1);
  assert.equal(d.anchors[0].id, "lint_haak_boven");
  assert.equal(d.anchors[0].source, "glb");
});

test("geometrie-metingen: binnen een gesloten deel is de afstand 0; buiten klopt de afstand; een hoek van de box zonder geometrie valt op", () => {
  const b = box("B", [0, 0, 0], [1, 1, 1]);
  assert.equal(distanceToGeometry([0.5, 0.5, 0.5], [b]), 0);
  near(distanceToGeometry([0.5, 1.2, 0.5], [b]), 0.2);
  near(pointTriangleDistance([0, 0, 1], [0, 0, 0], [1, 0, 0], [0, 1, 0]), 1);
  // L-vorm: de hoek van de omhullende box ligt in de lege ruimte.
  const l = [box("A", [0, 0, 0], [1, 0.1, 0.1]), box("B", [0, 0, 0], [0.1, 1, 0.1])];
  const corner: Vec3 = [1, 1, 0];
  assert.ok(onBoundingBoxEdge(corner, l, distanceToGeometry(corner, l)));
});
