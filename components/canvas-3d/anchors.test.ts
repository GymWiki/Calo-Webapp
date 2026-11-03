import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ANCHOR_HEIGHT_STEP_M,
  anchorPosition,
  anchorsForSlug,
  clampAnchorHeight,
  fallbackAnchors,
  isCompatible,
  nearestAnchor,
  parseAnchorNodeName,
  type AnchorDef,
} from "@/components/canvas-3d/anchors";
import { ANCHOR_PROFILES } from "@/components/canvas-3d/anchors.generated";
import { COLLISION_PROFILES } from "@/components/canvas-3d/collision-profiles.generated";
import type { DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import { localToWorld, rotateAboutWorldAxis, type Vec3 } from "@/components/canvas-3d/orientation";
import {
  MIGRATION_TOLERANCE_M,
  SAG_FACTOR,
  anchorAt,
  anchorLocal,
  anchorWorld,
  createRope,
  migrateRopes,
  ropeCurvePoints,
  ropeEndpoints,
  snapToAnchor,
} from "@/components/canvas-3d/rope";
import { floorplan3dDataSchema, type Floorplan3dItem, type Rope } from "@/types/floorplan3d";
import { shapeOfDims } from "@/components/canvas-3d/floorplan3d-geometry";

const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

/** Dims-lookup op basis van de echte collision-profielen (dezelfde vormen als in de editor). */
const lookup: DimsLookup = (slug) => {
  const p = COLLISION_PROFILES[slug]?.shape;
  if (!p) return { length_m: 1, width_m: 0.5, height_m: 2, stackable: true };
  return { length_m: p.length_m, width_m: p.width_m, height_m: p.height_m, offset_x: p.offset_x, offset_z: p.offset_z, base_m: p.base_m, yaw_deg: p.yaw_deg, stackable: false };
};
const item = (id: string, slug: string, x: number, z: number, extra: Partial<Floorplan3dItem> = {}): Floorplan3dItem => ({ id, slug, x, y: 0, z, rot_y_deg: 0, ...extra });

const KORFBAL = "korfbalpaal_compleet_250";

test("het probleemobject: een touw aan de korfbalpaal komt uit aan de paal, niet aan de rand van de gele korf", () => {
  const paal = item("k1", KORFBAL, 4, 2);
  // De korf steekt 51 cm uit (x tot 0,51 m) op 2,22–2,50 m: wie op de korfrand klikt, raakt hier het model.
  const rim: Vec3 = [4 + 0.5, 2.45, 2.15];
  const anchor = anchorAt(paal, rim, lookup);
  assert.equal(anchor.anchor, "paal_top");
  const world = anchorWorld(anchor, [paal], lookup)!;
  near(world[0], 4); // de paal staat op x=0 van het model, niet 50 cm daarnaast
  near(world[2], 2);
  assert.ok(world[1] < 2.2, `onder de korf (${world[1]})`);
});

test("een anchor draait en kantelt mee met het item (volledige transform)", () => {
  const paal = item("k1", KORFBAL, 1, 2, { rot_y_deg: 30 });
  const def = anchorsForSlug(KORFBAL, shapeOfDims(lookup(KORFBAL)!))[0];
  for (const rot of [{ x: 0, y: 0, z: 0 }, { x: 0, y: 90, z: 0 }, { x: 0, y: 45, z: 0 }, { x: 0, y: 30, z: 0 }, { x: 20, y: 135, z: -15 }]) {
    const tilted = { ...paal, rot_y_deg: rot.y, rot_x_deg: rot.x, rot_z_deg: rot.z };
    const anchor = anchorAt(tilted, [1, 1, 2], lookup);
    const world = anchorWorld(anchor, [tilted], lookup)!;
    const expected = localToWorld(shapeOfDims(lookup(KORFBAL)!), [tilted.x, tilted.y, tilted.z], rot, anchorPosition(def, anchor.height));
    near(world[0], expected[0]);
    near(world[1], expected[1]);
    near(world[2], expected[2]);
  }
  // Heading 90° draait een anchor naast de pivot mee: (x,0,z) → (z,0,-x).
  const off: AnchorDef = { id: "t", label: "t", pos: [1, 1, 0], types: ["touw"], source: "config" };
  const shape = shapeOfDims({ length_m: 2, width_m: 1, height_m: 2, stackable: true });
  const w = localToWorld(shape, [0, 0, 0], { x: 0, y: 90, z: 0 }, anchorPosition(off));
  near(w[0], 0);
  near(w[2], -1);
  assert.ok(rotateAboutWorldAxis);
});

test("hoogteverstelbaar: de gekozen hoogte wordt op stappen van 5 cm gezet en tussen min en max geklemd", () => {
  const defs = ANCHOR_PROFILES.volleybalpalen_mobiel_set.anchors;
  const pole = defs[0];
  assert.ok(pole.adjustable);
  const max = pole.adjustable!.max;
  assert.equal(clampAnchorHeight(pole, 99), max);
  assert.equal(clampAnchorHeight(pole, -5), pole.adjustable!.min);
  const hit = nearestAnchor(defs, [pole.pos[0] + 0.03, 2.43, pole.pos[2]], "net")!;
  assert.equal(hit.def.id, pole.id);
  near(hit.height!, 2.45, 1e-9); // 2,43 → dichtstbijzijnde stap van 5 cm
  assert.ok(Math.abs(hit.height! / ANCHOR_HEIGHT_STEP_M - Math.round(hit.height! / ANCHOR_HEIGHT_STEP_M)) < 1e-9);
  // Bewaard in het touw en bij het berekenen gebruikt: het touw volgt de paal op die hoogte.
  const paal = item("v1", "volleybalpalen_mobiel_set", 0, 0);
  const anchor = anchorAt(paal, [pole.pos[0], 1.4, pole.pos[2]], lookup, "net");
  assert.equal(anchor.height, 1.4);
  const world = anchorWorld(anchor, [paal], lookup, "net")!;
  near(world[1], 1.4);
  near(world[0], pole.pos[0]);
});

test("een verbinding volgt beide palen bij verplaatsen, draaien en kopiëren", () => {
  const a = item("a", "volleybalpalen_mobiel_set", 0, 0);
  const b = item("b", KORFBAL, 8, 0);
  const rope = createRope("t", anchorAt(a, [-0.8, 2, 0], lookup), anchorAt(b, [8.4, 2.4, 0.1], lookup));
  const before = ropeEndpoints(rope, [a, b], lookup)!;
  const moved = ropeEndpoints(rope, [{ ...a, x: 3, z: 2 }, { ...b, rot_y_deg: 90 }], lookup)!;
  near(moved.a[0] - before.a[0], 3);
  near(moved.a[2] - before.a[2], 2);
  near(moved.b[0], 8); // de paal draait om zichzelf: het punt blijft op de paal
  // Kopiëren: dezelfde anchor-id's op nieuwe item-id's geven dezelfde positie.
  const copyA = { ...a, id: "a2", x: 10 };
  const copy = ropeEndpoints({ ...rope, a: { ...rope.a, item: "a2" } }, [copyA, b], lookup)!;
  near(copy.a[0] - 10, before.a[0]);
});

test("schemaformaat: anchor, hoogte en soort blijven bewaard; oude uiteinden (alleen local) blijven geldig", () => {
  const base = { version: 1, room: { width_m: 10, length_m: 10 }, items: [], coneFields: [] };
  const rope: Rope = { id: "t", kind: "lint", a: { item: "a", local: [0, 1, 0], anchor: "paal_1", height: 1.2 }, b: { item: "b", local: [0, 1, 0] } };
  const parsed = floorplan3dDataSchema.parse({ ...base, ropes: [rope] }).ropes[0];
  assert.equal(parsed.a.anchor, "paal_1");
  assert.equal(parsed.a.height, 1.2);
  assert.equal(parsed.kind, "lint");
  assert.equal(parsed.b.anchor, undefined);
});

test("migratie: een oud uiteinde op de korfrand gaat naar de paal; melding bij een verschuiving boven de tolerantie; idempotent", () => {
  const paal = item("k1", KORFBAL, 0, 0);
  const other = item("o1", "pion_oranje_wit_gestreept", 5, 0);
  const legacy: Rope = { id: "r1", a: { item: "k1", local: [0.5, 2.45, 0.1] }, b: { item: "o1", local: [0.1, 0.2, 0] } };
  const { ropes, changes } = migrateRopes([legacy], [paal, other], lookup);
  assert.equal(ropes[0].a.anchor, "paal_top");
  assert.equal(ropes[0].b.anchor, "top");
  const first = changes.find((c) => c.end === "a")!;
  assert.ok(first.exceeded, "ruim meer dan de tolerantie verschoven");
  assert.ok(first.shiftM > MIGRATION_TOLERANCE_M);
  const again = migrateRopes(ropes, [paal, other], lookup);
  assert.equal(again.changes.length, 0);
  assert.deepEqual(again.ropes, ropes);
});

test("een verwijderde of onbekende anchor geeft de opgeslagen positie terug (veilige terugval)", () => {
  const paal = item("k1", KORFBAL, 0, 0);
  const local = anchorLocal({ item: "k1", local: [0.2, 1.1, 0], anchor: "bestaat_niet" }, paal, lookup);
  assert.deepEqual(local, [0.2, 1.1, 0]);
});

test("noodoplossing: een asset zonder anchors krijgt het midden van de bovenkant, nooit een rand of hoek", () => {
  const shape = { offset_x: 0.1, offset_z: -0.2, base_m: 0, height_m: 1.2 };
  const [fallback] = fallbackAnchors(shape);
  assert.deepEqual(fallback.pos, [0.1, 1.2, -0.2]);
  assert.equal(fallback.source, "fallback");
  const unknown = anchorsForSlug("bestaat-helemaal-niet", { ...shape });
  assert.equal(unknown[0].id, "fallback_top");
});

test("soorten: een lint en een touw gebruiken touw-anchors, een net alleen net-anchors; lint hangt niet door", () => {
  assert.ok(isCompatible(["touw"], "lint"));
  assert.ok(isCompatible(["haak"], "touw"));
  assert.ok(!isCompatible(["touw"], "net"));
  assert.ok(isCompatible(["net"], "net"));
  const touw = ropeCurvePoints([0, 1.5, 0], [8, 1.5, 0], 24, "touw");
  const lint = ropeCurvePoints([0, 1.5, 0], [8, 1.5, 0], 24, "lint");
  assert.ok(touw[12][1] < 1.5 - 0.05);
  near(lint[12][1], 1.5, 1e-9);
  assert.equal(SAG_FACTOR.net, 0);
});

test("Blender-naamconventie: anchor_<type>_<naam>", () => {
  assert.deepEqual(parseAnchorNodeName("anchor_lint_top"), { types: ["lint"], id: "lint_top", label: "Lint: top" });
  assert.equal(parseAnchorNodeName("anchor_net_links")?.id, "net_links");
  assert.equal(parseAnchorNodeName("anchor_haak_midden_2")?.id, "haak_midden_2");
  assert.equal(parseAnchorNodeName("anchor_onzin_top"), null);
  assert.equal(parseAnchorNodeName("Cylinder.001"), null);
});

test("snapToAnchor geeft het bevestigingspunt, de afstand en de anchor-id (voor de markering tijdens het slepen)", () => {
  const paal = item("k1", KORFBAL, 0, 0);
  const snap = snapToAnchor(paal, [0.45, 2.4, 0], lookup);
  assert.equal(snap.anchorId, "paal_top");
  assert.ok(snap.distance > 0.3, "het geklikte punt (korfrand) ligt ver van het bevestigingspunt");
  near(snap.world[0], 0);
});

test("de gegenereerde anchors zijn consistent: unieke id's, eindige posities, geldig verstelbaar bereik, een standaard-anchor", () => {
  for (const [slug, profile] of Object.entries(ANCHOR_PROFILES)) {
    assert.ok(profile.anchors.length > 0, `${slug}: geen anchors`);
    const ids = new Set<string>();
    for (const a of profile.anchors) {
      assert.ok(!ids.has(a.id), `${slug}: dubbele id ${a.id}`);
      ids.add(a.id);
      assert.ok(a.pos.every(Number.isFinite), `${slug}/${a.id}: positie`);
      assert.ok(a.types.length > 0);
      if (a.adjustable) assert.ok(a.adjustable.min < a.adjustable.max && a.pos[1] >= a.adjustable.min - 1e-6 && a.pos[1] <= a.adjustable.max + 1e-6, `${slug}/${a.id}: bereik`);
    }
    assert.ok(profile.anchors.some((a) => a.default), `${slug}: geen standaard-anchor`);
  }
  assert.ok(Object.keys(ANCHOR_PROFILES).length >= 200);
});
