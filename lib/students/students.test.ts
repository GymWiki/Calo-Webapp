import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dimsForSlug, dimsOf, findItemsResting, recomputeStackedYs, type DimsLookup } from "@/components/canvas-3d/floorplan3d-geometry";
import {
  DEFAULT_POSE_ID,
  STUDENT_COLORS,
  STUDENT_COLOR_PATTERN,
  STUDENT_POSES,
  STUDENT_CATEGORIES,
  filterPoses,
  studentCategoriesInUse,
  studentSportLabel,
  studentSportsOf,
  isStudentSlug,
  libraryPersonModels,
  poseIdOfSlug,
  poseOfSlug,
  studentLibraryModel,
  studentModels,
  studentScale,
  studentSlug,
  upgradeStudentItem,
} from "@/lib/students/catalog";
import { resolvePlacement } from "@/components/canvas-3d/resolvePlacement";
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
      assert.ok(model.model_url.includes(".glb") && model.model_url.includes("/students/"));
      assert.ok(model.preview_url.includes(".png"));
    }
  });

  it("toont in de bibliotheek één Leerling-kaartje", () => {
    const card = studentLibraryModel(models);
    assert.equal(card?.naam, "Leerling");
    assert.equal(card?.slug, studentSlug(DEFAULT_POSE_ID));
    const legacy = { ...models[0], slug: "leerling_blauw", categorie: "personen" };
    assert.deepEqual(libraryPersonModels([...models, legacy]).map((m) => m.slug), [studentSlug(DEFAULT_POSE_ID)]);
    assert.deepEqual(libraryPersonModels([legacy]), [], "de oude losse personen komen niet meer in de bibliotheek");
    assert.deepEqual(STUDENT_POSES.slice(0, 1).map((pose) => pose.id), [DEFAULT_POSE_ID], "de standaard leerling staat eerst");
    assert.equal(DEFAULT_POSE_ID, "standaard");
    assert.ok(STUDENT_POSES.some((pose) => pose.id === "hardlopen"));
  });
});

describe("oudere plattegronden", () => {
  const base = { id: "a", x: 1, y: 0, z: 2, rot_y_deg: 30 };

  it("laadt oude leerling-slugs als de standaard leerling (kleurvariant wordt shirtkleur)", () => {
    assert.deepEqual(upgradeStudentItem({ ...base, slug: "leerling_pose_staand" }), { ...base, slug: "leerling_pose_standaard" });
    assert.deepEqual(upgradeStudentItem({ ...base, slug: "leerling_rood" }), { ...base, slug: "leerling_pose_standaard", color: "#dc2626" });
    assert.equal(upgradeStudentItem({ ...base, slug: "leerling_staand_rust" }).slug, "leerling_pose_standaard");
    assert.equal(upgradeStudentItem({ ...base, slug: "leerling_rennen" }).slug, "leerling_pose_hardlopen");
  });

  it("verandert verder niets: positie, rotatie, eigen kleur en andere items blijven gelijk", () => {
    const own = { ...base, slug: "leerling_blauw", color: "#ff00ff", size: "klein" as const };
    assert.deepEqual(upgradeStudentItem(own), { ...own, slug: "leerling_pose_standaard" });
    const mat = { ...base, slug: "turnmat" };
    assert.equal(upgradeStudentItem(mat), mat, "hetzelfde object terug");
    const bench = { ...base, slug: "leerling_zittend_turnbank" };
    assert.equal(upgradeStudentItem(bench), bench, "de bank zit in het model: blijft zoals hij is");
    const current = { ...base, slug: "leerling_pose_hockey", color: "#16a34a" };
    assert.equal(upgradeStudentItem(current), current);
  });

  it("import van een oude plattegrond maakt er de standaard leerling van", () => {
    const text = JSON.stringify({ version: 1, room: { width_m: 24, length_m: 14 }, items: [{ ...base, slug: "leerling_geel" }], coneFields: [] });
    const result = parsePlattegrondJson(text, { knownSlugs: new Set(models.map((model) => model.slug)) });
    assert.ok(result.ok);
    assert.deepEqual(result.warnings.filter((w) => w.code === "onbekend-item"), []);
    assert.equal(result.scene.items[0].slug, "leerling_pose_standaard");
    assert.equal(result.scene.items[0].color, "#facc15");
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
    const slug = studentSlug("standaard");
    const base = lookup(slug)!;
    const small = dimsForSlug(slug, "klein", lookup)!;
    const big = dimsForSlug(slug, "groot", lookup)!;
    assert.ok(small.height_m < big.height_m);
    assert.ok(Math.abs(big.height_m - 1.6) < 0.02, `groot ≈ 1,6 m (was ${big.height_m})`);
    assert.ok(Math.abs(dimsForSlug(slug, undefined, lookup)!.height_m - 1.4) < 0.02, "zonder size: middel");
    assert.ok(base.height_m > big.height_m, "de staande leerling zelf is 1,8 m");
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
  const scene: Floorplan3dData = { version: 1, room: { width_m: 24, length_m: 14 }, items, coneFields: [], ropes: [] };
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

describe("beweegcategorieën en zoeken", () => {
  it("elke pose heeft een bekende categorie en de basisposes staan onder standaard", () => {
    const known = new Set<string>(STUDENT_CATEGORIES.map((category) => category.id));
    for (const pose of STUDENT_POSES) assert.ok(known.has(pose.categorie), `${pose.id}: ${pose.categorie}`);
    const standaard = filterPoses(STUDENT_POSES, { categorie: "standaard" }).map((pose) => pose.id);
    for (const id of ["standaard", "hardlopen", "juichen", "zittend"]) assert.ok(standaard.includes(id), id);
  });

  it("categorieën zonder poses (zwemmen, klimmen) verschijnen niet in het menu, de overige in vaste volgorde", () => {
    const inUse = studentCategoriesInUse().map((category) => category.id);
    assert.deepEqual(inUse.filter((id) => ["standaard", "spel", "atletiek", "turnen", "zelfverdediging"].includes(id)), ["standaard", "spel", "atletiek", "turnen", "zelfverdediging"]);
    for (const category of studentCategoriesInUse()) assert.ok(category.count > 0);
    assert.equal(studentCategoriesInUse().reduce((sum, category) => sum + category.count, 0), STUDENT_POSES.length);
  });

  it("filtert op categorie, sport en zoekwoord (ook meerdere woorden en de sportnaam)", () => {
    const judo = filterPoses(STUDENT_POSES, { categorie: "zelfverdediging" });
    assert.ok(judo.length >= 3 && judo.every((pose) => pose.sporten.includes("judo")));
    assert.ok(filterPoses(STUDENT_POSES, { query: "judo" }).length >= judo.length);
    assert.ok(filterPoses(STUDENT_POSES, { query: "turnen" }).every((pose) => pose.categorie === "turnen" || pose.sporten.includes("turnen")));
    assert.ok(filterPoses(STUDENT_POSES, { query: "spel basketbal" }).every((pose) => pose.categorie === "spel" && pose.sporten.includes("basketbal")));
    assert.equal(filterPoses(STUDENT_POSES, { categorie: "atletiek", sport: "basketbal" }).length, 0);
    assert.ok(filterPoses(STUDENT_POSES, { query: "Tafeltennis" }).some((pose) => pose.id === "tafeltennis"));
  });

  it("sporten per set poses: zonder 'algemeen', op naam, en met nette namen voor sporten buiten de bibliotheek", () => {
    const sports = studentSportsOf(STUDENT_POSES);
    assert.ok(!sports.includes("algemeen"));
    assert.ok(sports.includes("judo") && sports.includes("basketbal"));
    assert.equal(studentSportLabel("judo"), "Judo");
    assert.equal(studentSportLabel("basketbal"), "Basketbal");
    assert.deepEqual(studentSportsOf(filterPoses(STUDENT_POSES, { categorie: "zelfverdediging" })), ["judo"]);
  });
});

describe("zittende leerling op een bank", () => {
  // Turnbank van 0,32 m hoog; de leerling-poses komen uit de echte catalogus (zitvlak van `zittend` = 0,42 m bij 1,8 m).
  const BANK = { length_m: 3.6, width_m: 0.27, height_m: 0.32, stackable: true };
  const benchLookup: DimsLookup = (slug) => (slug === "turnbank" ? BANK : lookup(slug));
  const bank = { id: "b", slug: "turnbank", x: 0, y: 0, z: 0, rot_y_deg: 0 };
  const zitter = (size?: "klein" | "middel" | "groot") => ({ id: "s", slug: studentSlug("zittend"), x: 0, y: 0, z: 0, rot_y_deg: 0, ...(size ? { size } : {}) });

  it("de pose zittend heeft een zitvlak, staande poses niet; het zitvlak schaalt mee met de grootte", () => {
    assert.ok((poseOfSlug(studentSlug("zittend"))?.seat_m ?? 0) > 0.3);
    assert.equal(poseOfSlug(studentSlug("standaard"))?.seat_m, undefined);
    const klein = dimsOf(zitter("klein"), benchLookup).seat_m!;
    const groot = dimsOf(zitter("groot"), benchLookup).seat_m!;
    assert.ok(klein < groot);
    assert.equal(dimsOf({ ...zitter(), slug: studentSlug("standaard") }, benchLookup).seat_m, undefined);
  });

  it("op een bank rust het zitvlak op de bovenkant: de voeten staan op of vlak boven de vloer, niet op de bank", () => {
    const [, op] = recomputeStackedYs([bank, zitter()], benchLookup);
    assert.ok(op.y < 0.05, `y = ${op.y}: de voeten horen bij de vloer te blijven`);
    // Een lage leerling (klein) op dezelfde bank: de voeten hangen hooguit een paar cm boven de vloer, zitvlak op de bank.
    const [, klein] = recomputeStackedYs([bank, zitter("klein")], benchLookup);
    const seat = dimsOf(zitter("klein"), benchLookup).seat_m!;
    assert.ok(Math.abs(klein.y + seat - BANK.height_m) < 1e-9 || klein.y === 0);
  });

  it("een staande leerling staat nog steeds met zijn voeten op de bank", () => {
    const staand = { ...zitter(), slug: studentSlug("standaard") };
    const [, op] = recomputeStackedYs([bank, staand], benchLookup);
    assert.ok(Math.abs(op.y - BANK.height_m) < 1e-9);
  });

  it("een hoge ondergrond (stapel banken): het zitvlak komt op de bovenkant, de leerling zit dus hoger", () => {
    const stapel = { ...bank, slug: "stapel" };
    const hoog = (slug: string) => (slug === "stapel" ? { ...BANK, height_m: 1.28 } : benchLookup(slug));
    const [, op] = recomputeStackedYs([stapel, zitter()], hoog);
    const seat = dimsOf(zitter(), hoog).seat_m!;
    assert.ok(Math.abs(op.y - (1.28 - seat)) < 1e-9);
  });

  it("de zittende leerling reist mee als de bank verplaatst wordt", () => {
    const items = recomputeStackedYs([bank, zitter("klein")], benchLookup);
    assert.ok(findItemsResting("b", items, benchLookup).includes("s"));
  });

  it("slepen of neerzetten op een bank geeft dezelfde hoogte als het herberekenen bij het laden", () => {
    const result = resolvePlacement({
      pointer: { x: 0.1, z: 0 },
      dragged: { slug: studentSlug("zittend"), rot_y_deg: 0, size: "groot" },
      others: [bank],
      room: { width_m: 20, length_m: 20 },
      grid: 0,
      lookup: benchLookup,
    });
    assert.equal(result.mode, "stack");
    const [, geladen] = recomputeStackedYs([bank, { ...zitter("groot"), x: result.x, z: result.z }], benchLookup);
    assert.ok(Math.abs(result.y - geladen.y) < 1e-9, `${result.y} ≠ ${geladen.y}`);
    // Staand op dezelfde bank staat hij hoger (voeten op de bank): zittend zit dus lager.
    const staand = resolvePlacement({ pointer: { x: 0.1, z: 0 }, dragged: { slug: studentSlug("standaard"), rot_y_deg: 0, size: "groot" }, others: [bank], room: { width_m: 20, length_m: 20 }, grid: 0, lookup: benchLookup });
    assert.ok(result.y < staand.y);
  });
});
