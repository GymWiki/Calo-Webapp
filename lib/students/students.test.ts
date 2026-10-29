import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dimsForSlug, dimsOf, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import {
  DEFAULT_POSE_ID,
  STUDENT_COLORS,
  STUDENT_COLOR_PATTERN,
  STUDENT_POSES,
  filterPoses,
  isStudentSlug,
  libraryPersonModels,
  poseIdOfSlug,
  studentLibraryModel,
  studentModels,
  studentScale,
  studentSlug,
} from "@/lib/students/catalog";
import { SHIRT_FRAGMENT } from "@/components/students/student-shader";
import { buildEnvelope, stringifyEnvelope } from "@/lib/plattegrond/format";
import { parsePlattegrondJson } from "@/lib/plattegrond/validate";
import { floorplan3dItemSchema, type Floorplan3dData, type Floorplan3dItem } from "@/types/floorplan3d";

const models = studentModels("https://example.test/storage/materials-3d");
const lookup: DimsLookup = (slug) => {
  const model = models.find((candidate) => candidate.slug === slug);
  return model ? { length_m: model.length_m, width_m: model.width_m, height_m: model.height_m, stackable: false } : undefined;
};

describe("pose-catalogus", () => {
  it("heeft poses met unieke id's, labels en minstens één sport", () => {
    assert.ok(STUDENT_POSES.length >= 15);
    assert.equal(new Set(STUDENT_POSES.map((pose) => pose.id)).size, STUDENT_POSES.length);
    for (const pose of STUDENT_POSES) {
      assert.match(pose.id, /^[a-z0-9_]+$/);
      assert.ok(pose.label.length > 0);
      assert.ok(pose.sporten.length > 0);
      assert.ok(pose.height_m > 0.5 && pose.height_m < 2.2, `${pose.id} hoogte ${pose.height_m}`);
    }
    assert.ok(STUDENT_POSES.some((pose) => pose.id === DEFAULT_POSE_ID), "de standaardpose bestaat");
  });

  it("slug ↔ pose-id", () => {
    assert.equal(studentSlug("hockey"), "leerling_pose_hockey");
    assert.equal(poseIdOfSlug("leerling_pose_hockey"), "hockey");
    assert.equal(poseIdOfSlug("turnbank"), null);
    assert.ok(isStudentSlug("leerling_pose_rennen"));
    assert.ok(!isStudentSlug("leerling_blauw"), "de oudere losse leerlingen zijn geen poses");
  });

  it("filtert op sport en zoekterm", () => {
    const basket = filterPoses(STUDENT_POSES, { sport: "basketbal" });
    assert.ok(basket.length >= 1 && basket.every((pose) => pose.sporten.includes("basketbal")));
    const zoek = filterPoses(STUDENT_POSES, { query: "hockey" });
    assert.ok(zoek.length >= 2);
    assert.equal(filterPoses(STUDENT_POSES, { query: "bestaat-niet" }).length, 0);
    assert.equal(filterPoses(STUDENT_POSES, {}).length, STUDENT_POSES.length);
  });

  it("maakt MaterialModel-rijen in de categorie personen, niet stapelbaar", () => {
    assert.equal(models.length, STUDENT_POSES.length);
    for (const model of models) {
      assert.equal(model.categorie, "personen");
      assert.equal(model.stackable, false);
      assert.ok(model.model_url.endsWith(".glb") && model.model_url.includes("/students/"));
      assert.ok(model.preview_url.endsWith(".png"));
    }
  });

  it("toont in de bibliotheek één Leerling-kaartje", () => {
    const card = studentLibraryModel(models);
    assert.equal(card?.naam, "Leerling");
    assert.equal(card?.slug, studentSlug(DEFAULT_POSE_ID));
    const legacy = { ...models[0], slug: "leerling_blauw", categorie: "personen" };
    assert.deepEqual(libraryPersonModels([...models, legacy]).map((m) => m.slug), [studentSlug(DEFAULT_POSE_ID)]);
    assert.deepEqual(libraryPersonModels([legacy]), [], "de oude losse personen komen niet meer in de bibliotheek");
    assert.ok(!STUDENT_POSES.some((pose) => ["staand", "hardlopen"].includes(pose.id)), "alleen de nieuwe ontwerpen");
  });
});

describe("grootte", () => {
  it("klein/middel/groot schalen vanaf 1,8 m; standaard middel (1,4 m)", () => {
    assert.ok(Math.abs(studentScale("klein") - 1.2 / 1.8) < 1e-9);
    assert.ok(Math.abs(studentScale("middel") - 1.4 / 1.8) < 1e-9);
    assert.ok(Math.abs(studentScale("groot") - 1.6 / 1.8) < 1e-9);
    assert.equal(studentScale(undefined), studentScale("middel"));
    assert.equal(studentScale("onzin"), studentScale("middel"));
  });

  it("schaalt de collision-maten van een leerling mee, andere items niet", () => {
    const slug = studentSlug("hockey");
    const base = lookup(slug)!;
    const small = dimsForSlug(slug, "klein", lookup)!;
    const big = dimsForSlug(slug, "groot", lookup)!;
    assert.ok(small.height_m < big.height_m);
    assert.ok(Math.abs(big.height_m - 1.6) < 0.02, `groot ≈ 1,6 m (was ${big.height_m})`);
    assert.ok(Math.abs(dimsForSlug(slug, undefined, lookup)!.height_m - 1.4) < 0.02, "zonder size: middel");
    assert.ok(base.height_m > big.height_m, "het model zelf is 1,8 m");
    const other: DimsLookup = () => ({ length_m: 1, width_m: 1, height_m: 1, stackable: true });
    assert.equal(dimsForSlug("turnbank", "klein", other)!.height_m, 1);
    assert.equal(dimsOf({ id: "a", slug, x: 0, y: 0, z: 0, rot_y_deg: 0, size: "klein" }, lookup).height_m, small.height_m);
  });
});

describe("kleur", () => {
  it("teamkleuren zijn geldige hex-waarden (of de standaard)", () => {
    assert.ok(STUDENT_COLORS.some((color) => color.hex === null));
    for (const color of STUDENT_COLORS) if (color.hex) assert.match(color.hex, STUDENT_COLOR_PATTERN);
    assert.ok(STUDENT_COLORS.length >= 8);
  });

  it("de shader vervangt alleen de shirttint en behoudt de helderheid", () => {
    assert.match(SHIRT_FRAGMENT, /uShirtColor/);
    assert.match(SHIRT_FRAGMENT, /smoothstep\(0\.50, 0\.54, hue\)/);
    assert.match(SHIRT_FRAGMENT, /mix\(diffuseColor\.rgb, tinted, shirt\)/);
  });

  it("het itemschema accepteert kleur en grootte en weigert onzin", () => {
    const base = { id: "a", slug: studentSlug("hockey"), x: 0, y: 0, z: 0, rot_y_deg: 0 };
    assert.ok(floorplan3dItemSchema.safeParse({ ...base, color: "#ff0000", size: "groot" }).success);
    assert.ok(floorplan3dItemSchema.safeParse(base).success, "oude plattegronden zonder leerlingvelden blijven laden");
    assert.ok(!floorplan3dItemSchema.safeParse({ ...base, color: "rood" }).success);
    assert.ok(!floorplan3dItemSchema.safeParse({ ...base, size: "reus" }).success);
  });
});

describe("export/import met leerlingen", () => {
  const items: Floorplan3dItem[] = [
    { id: "s1", slug: studentSlug("basketbal_dribbelen"), x: 1.2345, y: 0, z: -2, rot_y_deg: 45, color: "#dc2626", size: "klein" },
    { id: "s2", slug: studentSlug("hockey"), x: 0, y: 0, z: 0, rot_y_deg: 0 },
  ];
  const scene: Floorplan3dData = { version: 1, room: { width_m: 24, length_m: 14 }, items, coneFields: [] };
  const known = new Set(models.map((model) => model.slug));

  it("roundtrip behoudt pose (slug), kleur en grootte", () => {
    const text = stringifyEnvelope(buildEnvelope(scene, "Zaal", new Date("2026-10-29T10:00:00Z")));
    const result = parsePlattegrondJson(text, { knownSlugs: known });
    assert.ok(result.ok);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.scene.items[0].slug, studentSlug("basketbal_dribbelen"));
    assert.equal(result.scene.items[0].color, "#dc2626");
    assert.equal(result.scene.items[0].size, "klein");
    assert.equal(result.scene.items[1].color, undefined);
    assert.equal(result.scene.items[1].size, undefined);
  });

  it("een onbekende pose wordt gemeld, de rest blijft staan", () => {
    const text = JSON.stringify({ ...scene, items: [...items, { id: "x", slug: "leerling_pose_bestaat_niet", x: 0, y: 0, z: 0, rot_y_deg: 0 }] });
    const result = parsePlattegrondJson(text, { knownSlugs: known });
    assert.ok(result.ok);
    assert.equal(result.scene.items.length, 2);
    assert.equal(result.unknownItems.length, 1);
  });
});
