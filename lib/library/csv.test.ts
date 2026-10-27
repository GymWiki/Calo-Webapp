import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCsv, parseCsvCells, serializeCsv, type TaxonomyRow } from "@/lib/library/csv";

const rows: TaxonomyRow[] = [
  { slug: "basketbal_maat_7", naam: "Basketbal maat 7", categorie: "ballen", subgroep: "basketbal", sporten: ["basketbal"], tags: ["bal", "basketbal"] },
  { slug: "pion_gestreept", naam: 'Pion "oranje"; wit', categorie: "klein_materiaal", subgroep: "afzetten", sporten: ["algemeen"], tags: ["lijn afzetten"] },
  { slug: "turnmat", naam: "Turnmat", categorie: "matten", subgroep: null, sporten: ["turnen"], tags: [] },
];

test("csv: serialiseren en weer inlezen geeft dezelfde rijen (ook met ; en aanhalingstekens)", () => {
  const parsed = parseCsv(serializeCsv(rows));
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.rows, rows);
});

test("csv: kolomvolgorde, BOM en \\r\\n zijn toegestaan", () => {
  const text = "﻿categorie;slug;naam;sporten;tags;subgroep\r\nballen;bal_x;Bal X;basketbal;a|b;basketbal\r\n";
  const parsed = parseCsv(text);
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.rows[0], { slug: "bal_x", naam: "Bal X", categorie: "ballen", subgroep: "basketbal", sporten: ["basketbal"], tags: ["a", "b"] });
});

test("csv: ongeldige regels worden gemeld en niet meegenomen", () => {
  const text = [
    "slug;naam;categorie;subgroep;sporten;tags",
    "ok;Ok;ballen;;algemeen;",
    "geen_sport;X;ballen;;;",
    "slechte_cat;X;bestaat_niet;;algemeen;",
    "ok;Dubbel;ballen;;algemeen;",
    ";Zonder slug;ballen;;algemeen;",
  ].join("\n");
  const parsed = parseCsv(text);
  assert.deepEqual(parsed.rows.map((row) => row.slug), ["ok"]);
  assert.deepEqual(parsed.errors.map((error) => error.line), [3, 4, 5, 6]);
});

test("csv: ontbrekende kolommen en leeg bestand", () => {
  assert.equal(parseCsv("slug;naam\nx;y").errors.length, 1);
  assert.equal(parseCsv("").errors.length, 1);
  assert.deepEqual(parseCsvCells('a;"b;c";d\n'), [["a", "b;c", "d"]]);
});
