import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { DEV_PLACEHOLDER_MODELS } from "@/components/canvas-3d/devPlaceholderModels";
import { dimsLookupFromModels, recomputeStackedYs } from "@/components/canvas-3d/floorplan3d-geometry";
import { bouwPlattegrond, cirkel, naastElkaar, raster, rij, tegenWand, veldAfzetten } from "@/lib/plattegrond/builders";
import { catalogLookup, type Catalog } from "@/lib/plattegrond/catalog";
import { validatePlattegrond } from "@/lib/plattegrond/validate";
import { floorplan3dDataSchema } from "@/types/floorplan3d";

const lookup = dimsLookupFromModels(DEV_PLACEHOLDER_MODELS);
const ROOM = { width_m: 15, length_m: 27 };
const errors = (data: unknown) => validatePlattegrond(data, lookup).filter((i) => i.severity === "error");
const plan = (items: unknown[], room = ROOM) => ({ version: 1, room, items });
const it = (o: Record<string, unknown>) => ({ id: "a", slug: "__dev_mat", x: 0, y: 0, z: 0, rot_y_deg: 0, ...o });

test("builders: rij legt items randje-aan-randje", () => {
  const items = rij({ slug: "__dev_mat", aantal: 3, van: { x: -3, z: 0 }, richting: "+x" }, lookup);
  assert.deepEqual(items.map((i) => i.x), [-3, 0, 3]);
  assert.deepEqual(errors(plan(items)), []);
});

test("builders: rij met 90° gebruikt de gedraaide uitgestrektheid", () => {
  const items = rij({ slug: "__dev_mat", aantal: 2, van: { x: 0, z: -3 }, richting: "+z", rot_y_deg: 90 }, lookup);
  assert.deepEqual(items.map((i) => i.z), [-3, 0]); // lengte 3 ligt nu langs z
  assert.deepEqual(errors(plan(items)), []);
});

test("builders: raster", () => {
  const items = raster({ slug: "__dev_kast", rijen: 2, kolommen: 3, van: { x: -2, z: -1 }, stapX: 2, stapZ: 2 }, lookup);
  assert.equal(items.length, 6);
  assert.deepEqual([items[0].x, items[0].z, items[5].x, items[5].z], [-2, -1, 2, 1]);
  assert.deepEqual(errors(plan(items)), []);
});

test("builders: tegenWand staat vlak tegen de wand", () => {
  const [bank] = tegenWand({ slug: "__dev_bank", room: ROOM, wand: "maxZ" }, lookup);
  assert.equal(bank.z, 13.5 - 0.135);
  const [bankX] = tegenWand({ slug: "__dev_bank", room: ROOM, wand: "minX" }, lookup);
  assert.equal(bankX.rot_y_deg, 90);
  assert.equal(bankX.x, -7.5 + 0.135);
  assert.deepEqual(errors(plan([bank, { ...bankX, id: "b", z: 5 }])), []);
});

test("builders: cirkel — 4 items, tangent-rotatie op 15°-stap", () => {
  const items = cirkel({ slug: "__dev_kast", aantal: 4, midden: { x: 0, z: 0 }, straal: 4 }, lookup);
  assert.deepEqual(items.map((i) => [i.x, i.z]), [[4, 0], [0, 4], [-4, 0], [0, -4]]);
  assert.ok(items.every((i) => i.rot_y_deg % 15 === 0));
  assert.deepEqual(errors(plan(items)), []);
});

test("builders: naastElkaar", () => {
  const [basis] = rij({ slug: "__dev_mat", aantal: 1, van: { x: 0, z: 0 }, richting: "+x" }, lookup);
  const naast = naastElkaar({ basis, slug: "__dev_bank", kant: "+z", tussenruimte: 0.5, id: "b" }, lookup);
  assert.equal(naast.z, 1 + 0.5 + 0.135);
  assert.deepEqual(errors(plan([basis, naast])), []);
});

test("builders: veldAfzetten hoeken / omtrek / raster", () => {
  const base = { slug: "__dev_kast", midden: { x: 0, z: 0 }, breedte: 10, lengte: 20 };
  assert.equal(veldAfzetten({ ...base, modus: "hoeken" }, lookup).length, 4);
  const omtrek = veldAfzetten({ ...base, modus: "omtrek", maxAfstand: 5 }, lookup);
  assert.equal(omtrek.length, 12); // 2×2 + 2×4 segmenten = 12 unieke punten
  assert.equal(new Set(omtrek.map((i) => `${i.x},${i.z}`)).size, 12);
  assert.equal(veldAfzetten({ ...base, modus: "raster", rijen: 3, kolommen: 3 }, lookup).length, 9);
  assert.throws(() => veldAfzetten({ ...base, modus: "omtrek" }, lookup), /maxAfstand/);
});

test("builders: onbekend item-id geeft een duidelijke fout", () => {
  assert.throws(() => rij({ slug: "nope", aantal: 1, van: { x: 0, z: 0 }, richting: "+x" }, lookup), /nope/);
});

test("builders: bouwPlattegrond levert door het schema geaccepteerde data", () => {
  const data = bouwPlattegrond(
    { room: ROOM, onderdelen: [{ type: "tegenWand", slug: "__dev_bank", wand: "minZ", aantal: 2, tussenruimte: 1 }, { type: "item", slug: "__dev_mat", x: 0, z: 0, id: "m" }] },
    lookup,
  );
  assert.ok(floorplan3dDataSchema.safeParse(data).success);
  assert.deepEqual(errors(data), []);
});

test("validator: geldige plattegrond, ook in envelop met aannames", () => {
  assert.deepEqual(errors(plan([it({})])), []);
  assert.deepEqual(errors({ aannames: ["x"], plattegrond: plan([it({})]) }), []);
});

test("validator: schemafouten met pad", () => {
  const issues = validatePlattegrond({ version: 2, room: { width_m: 0, length_m: 5 }, items: [{ id: "a" }] }, lookup);
  const paths = issues.map((i) => i.path);
  assert.ok(paths.includes("version") && paths.includes("room.width_m") && paths.includes("items.0.slug"));
});

test("validator: onbekende velden (scale, rotation) zijn een fout", () => {
  const issues = errors(plan([it({ scale: 2, rotation: { x: 0, y: 0, z: 0 } })]));
  assert.ok(issues.some((i) => i.path === "items[0].scale"));
  assert.ok(issues.some((i) => i.path === "items[0].rotation"));
});

test("validator: onbekend item-id en dubbel id", () => {
  const issues = errors(plan([it({ slug: "verzonnen" }), it({ slug: "__dev_mat" }), it({ slug: "__dev_kast", x: 5 }), it({ x: 9 })]));
  assert.ok(issues.some((i) => i.path === "items[0].slug"));
  assert.ok(issues.some((i) => /Dubbel item-id/.test(i.message)));
});

test("validator: buiten de zaal (gedraaid telt de AABB)", () => {
  assert.equal(errors(plan([it({ x: 6.1 })])).length, 1); // 6.1 + 1.5 > 7.5
  assert.deepEqual(errors(plan([it({ x: 6 })])), []); // precies tegen de wand mag
  assert.equal(errors(plan([it({ x: 6.2, z: 0, rot_y_deg: 90 })])).length, 0); // 90°: halve breedte 1.0 → 7.2
  assert.equal(errors(plan([it({ x: 6.6, rot_y_deg: 90 })])).length, 1);
});

test("validator: overlap vs. precies tegen elkaar", () => {
  assert.equal(errors(plan([it({ id: "a" }), it({ id: "b", x: 2.9 })])).filter((i) => /Overlapt/.test(i.message)).length, 1);
  assert.deepEqual(errors(plan([it({ id: "a" }), it({ id: "b", x: 3 })])), []);
});

test("validator: rotatie niet op 15°-stap is een fout, buiten 0–360 een waarschuwing", () => {
  assert.equal(errors(plan([it({ rot_y_deg: 10 })])).length, 1);
  const warn = validatePlattegrond(plan([it({ rot_y_deg: 450 })]), lookup);
  assert.ok(warn.every((i) => i.severity === "warning") && warn.length === 1);
});

test("validator: NaN/Infinity en negatieve y", () => {
  assert.ok(errors(plan([it({ x: Infinity })])).some((i) => i.path === "items[0].x"));
  assert.ok(errors(plan([it({ y: -1 })])).some((i) => i.path === "items[0].y"));
});

test("validator: gestapeld item mag, zwevend niet, met waarschuwing over de app-bug", () => {
  const stacked = plan([it({ id: "a" }), it({ id: "b", slug: "__dev_bank", y: 0.3 })]);
  assert.deepEqual(errors(stacked), []);
  assert.ok(validatePlattegrond(stacked, lookup).some((i) => i.severity === "warning" && /recomputeStackedYs/.test(i.message)));
  assert.equal(errors(plan([it({ y: 1 })])).length, 1);
});

test("schema.json en zod hebben dezelfde velden", () => {
  const schema = JSON.parse(readFileSync("docs/plattegrond.schema.json", "utf8"));
  assert.deepEqual(schema.required, ["version", "room", "items"]);
  assert.deepEqual(schema.properties.room.required, ["width_m", "length_m"]);
  assert.deepEqual(schema.properties.items.items.required, ["id", "slug", "x", "y", "z", "rot_y_deg"]);
  assert.deepEqual(Object.keys(schema.properties.items.items.properties), ["id", "slug", "x", "y", "z", "rot_y_deg"]);
});

test("catalogus-bestand laadt en verwijst naar bestaande afmetingen", () => {
  const catalog = JSON.parse(readFileSync("docs/ai-item-catalog.json", "utf8")) as Catalog;
  const cl = catalogLookup(catalog);
  for (const m of DEV_PLACEHOLDER_MODELS) assert.equal(cl(m.slug)?.height_m, m.height_m);
});

test("alle voorbeeldbestanden in docs/voorbeelden valideren zonder fouten", () => {
  const cl = catalogLookup(JSON.parse(readFileSync("docs/ai-item-catalog.json", "utf8")) as Catalog);
  const files = readdirSync("docs/voorbeelden").filter((f) => f.endsWith(".json") && !f.endsWith(".spec.json"));
  assert.ok(files.length >= 5);
  for (const f of files) {
    const bad = validatePlattegrond(JSON.parse(readFileSync(`docs/voorbeelden/${f}`, "utf8")), cl).filter((i) => i.severity === "error");
    assert.deepEqual(bad, [], f);
    // "Laden" zoals de editor: schema-parse + y-herberekening mag niets verschuiven.
    const raw = JSON.parse(readFileSync(`docs/voorbeelden/${f}`, "utf8"));
    const parsed = floorplan3dDataSchema.parse(raw.plattegrond ?? raw);
    assert.deepEqual(recomputeStackedYs(parsed.items, cl), parsed.items, f);
  }
});
