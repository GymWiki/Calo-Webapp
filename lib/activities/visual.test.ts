import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  floorplanHasContent,
  getActivityImageUrl,
  getActivityVisual,
  withFloorplanThumbnail,
  type FloorplanInput,
} from "@/lib/activities/visual";

const room = { width_m: 10, length_m: 8 };
const item = { id: "i1", slug: "mat", x: 0, y: 0, z: 0, rot_y_deg: 0 };
const plan = (data: unknown): FloorplanInput => ({ id: "fp1", naam: "Plattegrond", ownerId: "u1", data, previewUrl: "https://x/fp1.jpg" });
const filled = plan({ version: 1, room, items: [item], coneFields: [] });
const empty = plan({ version: 1, room, items: [], coneFields: [] });
const withCones = plan({ version: 1, room, items: [], coneFields: [{ id: "f", type: "coneField", x: 0, z: 0, rot_y_deg: 0, width_m: 4, length_m: 4, interval_m: 1, distribution: "even", marker: "pion", color: "#f97316", corner_color: null }] });
const IMG = { afbeelding: "https://x/a.webp", diagram_image_url: null };

describe("getActivityVisual", () => {
  it("3D-plattegrond met inhoud wint van de afbeelding (beide aanwezig)", () => {
    const visual = getActivityVisual(IMG, filled, () => undefined);
    assert.equal(visual.type, "3d");
    if (visual.type === "3d") assert.equal(visual.plattegrond.id, "fp1");
  });

  it("alleen 3D: 3D", () => {
    assert.equal(getActivityVisual({}, filled, () => undefined).type, "3d");
  });

  it("alleen afbeelding: de afbeelding, ongewijzigd", () => {
    assert.deepEqual(getActivityVisual(IMG, null), { type: "image", url: "https://x/a.webp" });
    assert.deepEqual(getActivityVisual(IMG), { type: "image", url: "https://x/a.webp" });
  });

  it("geen van beide: none", () => {
    assert.deepEqual(getActivityVisual({ afbeelding: null, diagram_image_url: null }, null), { type: "none" });
    assert.deepEqual(getActivityVisual({ afbeelding: "  ", diagram_image_url: "" }), { type: "none" });
  });

  it("ongeldige 3D-JSON: terugval op de afbeelding met een waarschuwing", () => {
    const warnings: string[] = [];
    const visual = getActivityVisual(IMG, plan({ rommel: true }), (m) => warnings.push(m));
    assert.deepEqual(visual, { type: "image", url: "https://x/a.webp" });
    assert.equal(warnings.length, 1);
    assert.match(warnings[0], /ongeldige data/);
  });

  it("ongeldige 3D-JSON zonder afbeelding: none", () => {
    assert.deepEqual(getActivityVisual({}, plan(null), () => undefined), { type: "none" });
  });

  it("lege 3D-plattegrond: terugval op de afbeelding met een waarschuwing", () => {
    const warnings: string[] = [];
    assert.deepEqual(getActivityVisual(IMG, empty, (m) => warnings.push(m)), { type: "image", url: "https://x/a.webp" });
    assert.match(warnings[0], /leeg/);
  });

  it("alleen afgezette velden (geen items) telt als inhoud", () => {
    assert.equal(getActivityVisual({}, withCones, () => undefined).type, "3d");
  });
});

describe("afbeelding-keuze en thumbnails", () => {
  it("afbeelding gaat voor diagram_image_url; terugval op diagram_image_url", () => {
    assert.equal(getActivityImageUrl({ afbeelding: "a", diagram_image_url: "d" }), "a");
    assert.equal(getActivityImageUrl({ afbeelding: null, diagram_image_url: "d" }), "d");
    assert.equal(getActivityImageUrl({}), null);
  });

  it("withFloorplanThumbnail vervangt het beeld alleen in het geheugen en laat het origineel intact", () => {
    const activity = { id: "1", afbeelding: "a", diagram_image_url: "d" };
    const result = withFloorplanThumbnail(activity, "https://x/fp.jpg");
    assert.deepEqual(result, { id: "1", afbeelding: "https://x/fp.jpg", diagram_image_url: null });
    assert.deepEqual(activity, { id: "1", afbeelding: "a", diagram_image_url: "d" });
  });

  it("zonder thumbnail blijft de activiteit hetzelfde object", () => {
    const activity = { afbeelding: "a" };
    assert.equal(withFloorplanThumbnail(activity, null), activity);
    assert.equal(withFloorplanThumbnail(activity, undefined), activity);
  });

  it("floorplanHasContent", () => {
    assert.equal(floorplanHasContent({ items: [], coneFields: [] }), false);
  });
});
