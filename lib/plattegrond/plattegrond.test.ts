import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FORMAT_NAME, FORMAT_VERSION, buildEnvelope, exportFileName, roundScene, slugifyTitle, stringifyEnvelope } from "@/lib/plattegrond/format";
import { parsePlattegrondJson } from "@/lib/plattegrond/validate";
import type { Floorplan3dData } from "@/types/floorplan3d";

const scene: Floorplan3dData = {
  version: 1,
  room: { width_m: 24, length_m: 14, environment: { type: "gymzaal", layout: "standaard", hidden: ["muur_voor"] } },
  items: [
    { id: "a", slug: "turnbank", x: 0.1 + 0.2, y: 0, z: 1.23456789, rot_y_deg: 90, rot_x_deg: 15.55555 },
    { id: "b", slug: "mat", x: -3, y: 0.4, z: 2, rot_y_deg: 0, locked: true },
  ],
  coneFields: [
    { id: "f", type: "coneField", x: 1, z: 2, rot_y_deg: 0, width_m: 12, length_m: 20, interval_m: 3, distribution: "even", marker: "pion", color: "#ff5a1f", corner_color: null },
  ],
};
const known = new Set(["turnbank", "mat"]);
const exported = (s = scene, title = "Mijn zaal") => stringifyEnvelope(buildEnvelope(s, title, new Date("2026-10-28T10:00:00Z")));

describe("export", () => {
  it("rondt af en houdt een vaste sleutelvolgorde aan", () => {
    const text = exported();
    assert.ok(!text.includes("0.30000000000000004"));
    assert.ok(text.includes('"x": 0.3'));
    const envelope = JSON.parse(text);
    assert.deepEqual(Object.keys(envelope), ["format", "version", "exportedAt", "title", "scene"]);
    assert.deepEqual(Object.keys(envelope.scene), ["version", "room", "items", "coneFields"]);
    assert.deepEqual(Object.keys(envelope.scene.items[0]).slice(0, 6), ["id", "slug", "x", "y", "z", "rot_y_deg"]);
    assert.equal(envelope.format, FORMAT_NAME);
    assert.equal(envelope.version, FORMAT_VERSION);
    assert.ok(text.includes('\n  "scene": {'), "2 spaties inspringing");
  });

  it("bevat geen persoons- of omgevingsgegevens", () => {
    const text = exported();
    for (const forbidden of ["user_id", "activiteit", "token", "email"]) assert.ok(!text.includes(forbidden), forbidden);
  });

  it("maakt een nette bestandsnaam", () => {
    assert.equal(slugifyTitle("Café-opstelling Groep 5/6!"), "cafe-opstelling-groep-5-6");
    assert.equal(exportFileName("Mijn zaal", new Date("2026-10-28T10:00:00Z")), "plattegrond-mijn-zaal-2026-10-28.json");
    assert.equal(exportFileName("   ", new Date("2026-10-28T10:00:00Z")), "plattegrond-plattegrond-2026-10-28.json");
  });
});

describe("import", () => {
  it("roundtrip: export → import geeft dezelfde scene (op afronding na)", () => {
    const result = parsePlattegrondJson(exported(), { knownSlugs: known });
    assert.ok(result.ok);
    assert.deepEqual(result.scene, roundScene(scene));
    assert.equal(result.title, "Mijn zaal");
    assert.deepEqual(result.warnings, []);
    // Een tweede export van het resultaat is byte-voor-byte gelijk (stabiel).
    assert.equal(exported(result.scene), exported());
  });

  it("accepteert een kale scene (kolom data uit Supabase)", () => {
    const result = parsePlattegrondJson(JSON.stringify(scene), { knownSlugs: known });
    assert.ok(result.ok);
    assert.equal(result.source, "scene");
    assert.equal(result.warnings[0].code, "zonder-envelope");
  });

  it("migreert een oudere versie automatisch", () => {
    const old = JSON.stringify({ format: FORMAT_NAME, version: 1, title: "Oud", scene: { ...scene, items: [{ id: "a", slug: "mat", x: 0, y: 0, z: 0, rot_deg_oud: 5, rot_y_deg: 0 }] } });
    const result = parsePlattegrondJson(old, {
      currentVersion: 2,
      migrations: { 1: (s) => ({ ...s, version: 1, items: (s.items as Record<string, unknown>[]).map(({ rot_deg_oud, ...rest }) => ({ ...rest, rot_y_deg: rot_deg_oud })) }) },
    });
    assert.ok(result.ok);
    assert.equal(result.migratedFrom, 1);
    assert.equal(result.scene.items[0].rot_y_deg, 5);
    assert.equal(result.warnings[0].code, "gemigreerd");
  });

  it("weigert een nieuwere versie met uitleg", () => {
    const result = parsePlattegrondJson(JSON.stringify({ format: FORMAT_NAME, version: FORMAT_VERSION + 1, title: "x", scene }));
    assert.ok(!result.ok);
    assert.equal(result.errors[0].path, "version");
    assert.match(result.errors[0].message, /nieuwere|begrijpt tot/);
  });

  it("geeft nette fouten bij ongeldige JSON en een verkeerd formaat", () => {
    const broken = parsePlattegrondJson("{ niet json");
    assert.ok(!broken.ok);
    assert.match(broken.errors[0].message, /geen geldige JSON/);
    const other = parsePlattegrondJson(JSON.stringify({ format: "iets-anders", version: 1 }));
    assert.ok(!other.ok);
    assert.equal(other.errors[0].path, "format");
    const array = parsePlattegrondJson("[]");
    assert.ok(!array.ok);
  });

  it("meldt schemafouten met pad en reden in het Nederlands", () => {
    const bad = JSON.parse(exported());
    bad.scene.items[1].x = "links";
    delete bad.scene.items[0].slug;
    bad.scene.room.width_m = -2;
    const result = parsePlattegrondJson(JSON.stringify(bad));
    assert.ok(!result.ok);
    const byPath = Object.fromEntries(result.errors.map((e) => [e.path, e.message]));
    assert.match(byPath["scene.items[1].x"], /moet een getal zijn, maar is tekst/);
    assert.match(byPath["scene.items[0].slug"], /ontbreekt/);
    assert.match(byPath["scene.room.width_m"], /groter zijn dan 0/);
  });

  it("laat onbekende items weg en waarschuwt (de rest blijft)", () => {
    const withUnknown = { ...scene, items: [...scene.items, { id: "c", slug: "bestaat_niet", x: 0, y: 0, z: 0, rot_y_deg: 0 }, { id: "d", slug: "bestaat_niet", x: 1, y: 0, z: 0, rot_y_deg: 0 }] };
    const result = parsePlattegrondJson(exported(withUnknown), { knownSlugs: known });
    assert.ok(result.ok);
    assert.equal(result.scene.items.length, 2);
    assert.deepEqual(result.unknownItems, [{ slug: "bestaat_niet", count: 2 }]);
    assert.equal(result.warnings.find((w) => w.code === "onbekend-item")?.message.includes("bestaat_niet"), true);
  });

  it("controleert slugs niet zonder catalogus en meldt items buiten de zaal", () => {
    const outside = { ...scene, items: [{ id: "a", slug: "iets", x: 40, y: 0, z: 0, rot_y_deg: 0 }] };
    const result = parsePlattegrondJson(exported(outside));
    assert.ok(result.ok);
    assert.equal(result.unknownItems.length, 0);
    assert.deepEqual(result.outsideRoom, ["a"]);
  });

  it("hernoemt dubbele id's", () => {
    const dup = { ...scene, items: [scene.items[0], { ...scene.items[1], id: "a" }] };
    const result = parsePlattegrondJson(exported(dup), { knownSlugs: known });
    assert.ok(result.ok);
    assert.deepEqual(result.scene.items.map((i) => i.id), ["a", "a-2"]);
    assert.ok(result.warnings.some((w) => w.code === "dubbel-id"));
  });
});
