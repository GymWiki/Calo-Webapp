import { test } from "node:test";
import assert from "node:assert/strict";

import {
  LIBRARY_CATEGORIES,
  PERSONS_ID,
  SPORT_IDS,
  isValidCategory,
  validateTaxonomy,
} from "@/lib/constants/libraryTaxonomy";
import { classifyModel } from "@/lib/library/classify";
import {
  editDistance,
  filterItems,
  groupByCategory,
  matchesQuery,
  normalizeText,
  sportCounts,
  stemWord,
  type LibraryItemMeta,
} from "@/lib/library/search";

const classify = (slug: string, oud: string, naam = slug.replace(/_/g, " ")) => classifyModel({ slug, naam, categorie_oud: oud });

function item(slug: string, oud: string, naam?: string): LibraryItemMeta & { slug: string } {
  const result = classify(slug, oud, naam);
  return { slug, naam: naam ?? slug.replace(/_/g, " "), categorie: result.categorie, subgroep: result.subgroep, sporten: result.sporten, tags: result.tags };
}

test("taxonomie: 7 materiaalcategorieën, personen apart, unieke id's", () => {
  assert.equal(LIBRARY_CATEGORIES.length, 7);
  assert.ok(!LIBRARY_CATEGORIES.some((category) => category.id === PERSONS_ID));
  assert.equal(new Set(LIBRARY_CATEGORIES.map((category) => category.id)).size, 7);
  assert.ok(isValidCategory(PERSONS_ID));
});

test("validateTaxonomy: categorie en minstens één sport zijn verplicht", () => {
  assert.deepEqual(validateTaxonomy({ categorie: "ballen", subgroep: "basketbal", sporten: ["basketbal"] }), []);
  assert.ok(validateTaxonomy({ categorie: "", subgroep: null, sporten: ["algemeen"] }).length > 0);
  assert.ok(validateTaxonomy({ categorie: "ballen", subgroep: null, sporten: [] }).length > 0);
  assert.ok(validateTaxonomy({ categorie: "ballen", subgroep: "bestaat_niet", sporten: ["algemeen"] }).length > 0);
  assert.ok(validateTaxonomy({ categorie: "ballen", subgroep: null, sporten: ["curling"] }).length > 0);
  assert.ok(validateTaxonomy({ categorie: "onzin", subgroep: null, sporten: ["algemeen"] }).length > 0);
});

test("classify: voorbeeld uit de brief — Basketbal maat 5 → Ballen > Basketbal, sport basketbal", () => {
  const result = classify("basketbal_maat_5", "ballen", "Basketbal maat 5");
  assert.equal(result.categorie, "ballen");
  assert.equal(result.subgroep, "basketbal");
  assert.deepEqual(result.sporten, ["basketbal"]);
  assert.equal(result.zeker, true);
});

test("classify: ballen krijgen de juiste subgroep", () => {
  assert.equal(classify("voetbal_veld_maat_5", "ballen").subgroep, "voetbal");
  assert.equal(classify("zaalvoetbal_futsalbal_plofbal", "ballen").subgroep, "voetbal");
  assert.equal(classify("volleybal_zaal", "ballen").subgroep, "volley_hand");
  assert.equal(classify("handbal_maat_2", "ballen").subgroep, "volley_hand");
  assert.equal(classify("tennisbal_standaard", "ballen").subgroep, "overig");
  const korf = classify("korfbal_maat_5", "ballen");
  assert.equal(korf.subgroep, "overig");
  assert.equal(korf.zeker, false);
});

test("classify: oude sportcategorieën worden doelen & netten met die sport", () => {
  for (const [slug, oud, sport] of [
    ["basketbaltoren_mobiel_senior", "basketbal", "basketbal"],
    ["korfbalpaal_compleet_350", "korfbal", "korfbal"],
    ["badmintonnet_los_610", "badminton", "badminton"],
    ["volleybalpalen_mobiel_set", "volleybal", "volleybal"],
  ] as const) {
    const result = classify(slug, oud);
    assert.equal(result.categorie, "doelen_netten", slug);
    assert.ok(result.sporten.includes(sport), slug);
  }
  assert.deepEqual(classify("veldvoetbaldoel_500x200_verplaatsbaar", "doelen").sporten, ["voetbal"]);
  assert.deepEqual(classify("veldhockeydoel_366x214_verplaatsbaar", "doelen").sporten, ["hockey"]);
});

test("classify: toestellen krijgen subgroep en sport turnen", () => {
  assert.deepEqual([classify("turnbank_1_los", "banken").categorie, classify("turnbank_1_los", "banken").subgroep], ["toestellen", "banken"]);
  assert.equal(classify("turnkast_3_delig", "turnkast").subgroep, "kasten");
  assert.equal(classify("minitrampoline", "springen").subgroep, "springen");
  assert.equal(classify("rekstok_laag_school", "rekstok").subgroep, "hangen_zwaaien");
  const klim = classify("wandrek_enkel_veld", "klimmen");
  assert.equal(klim.subgroep, "klimmen");
  assert.ok(klim.sporten.includes("klimmen") && klim.sporten.includes("turnen"));
});

test("classify: personen staan buiten het materiaal", () => {
  const result = classify("leerling_blauw", "leerlingen");
  assert.equal(result.categorie, PERSONS_ID);
});

test("classify: onzekere gevallen worden gemeld, niet gegokt", () => {
  for (const [slug, oud] of [
    ["airtrack_p2_6m", "airtrack"],
    ["floorball_puck", "accessoires_doelobjecten"],
    ["zaalhockeybalk_los_2m", "doelen"],
    ["scorebord_tafelmodel", "signaleringsmateriaal"],
    ["yogamat_opgerold_set", "fitness_losse_materialen"],
    ["veldhockeystick", "sticks_rackets"],
  ] as const) {
    const result = classify(slug, oud);
    assert.equal(result.zeker, false, slug);
    assert.ok(result.reden, slug);
  }
  const unknown = classify("iets_nieuws", "heel_anders");
  assert.equal(unknown.zeker, false);
  assert.deepEqual(validateTaxonomy(unknown), []);
});

test("classify: elk resultaat is een geldige indeling (categorie + minstens één sport)", () => {
  const samples: [string, string][] = [
    ["pion_oranje_wit_gestreept", "signaleringsmateriaal"],
    ["partijhesjes_teamlintjes_set", "signaleringsmateriaal"],
    ["ballenkar_metaal_open_gevuld", "organisatiemateriaal"],
    ["handfluit_knijpfluit_hygienisch", "organisatiemateriaal"],
    ["dikke_mat_300x200x30", "matten"],
    ["kettlebell_rood_16kg", "fitness_losse_materialen"],
    ["springtouw_speedrope", "fitness_losse_materialen"],
    ["mattenkar_compleet", "opslag"],
    ["floorballstick_unihockey", "sticks_rackets"],
  ];
  for (const [slug, oud] of samples) {
    const result = classify(slug, oud);
    assert.deepEqual(validateTaxonomy(result), [], slug);
    assert.ok(result.sporten.every((sport) => SPORT_IDS.includes(sport)), slug);
  }
  assert.deepEqual(classify("floorballstick_unihockey", "sticks_rackets").sporten, ["floorball"]);
  assert.equal(classify("pion_oranje_wit_gestreept", "signaleringsmateriaal").subgroep, "afzetten");
  assert.equal(classify("springtouw_speedrope", "fitness_losse_materialen").categorie, "klein_materiaal");
  assert.equal(classify("handfluit_knijpfluit_hygienisch", "organisatiemateriaal").categorie, "klein_materiaal");
});

test("zoeken: normalisatie, meervoud en typefouten", () => {
  assert.equal(normalizeText("  Pion  Gestreept! "), "pion gestreept");
  assert.equal(stemWord("ballen"), "bal");
  assert.equal(stemWord("pionnen"), "pion");
  assert.equal(stemWord("dopjes"), "dopje");
  assert.equal(stemWord("matten"), "mat");
  assert.equal(editDistance("basketbal", "basketbaal", 2), 1);

  const bal = item("basketbal_maat_5", "ballen", "Basketbal maat 5");
  const pion = item("pion_effen_kleurenset", "signaleringsmateriaal", "Pion effen kleurenset");
  const mat = item("turnmat_200x100x6", "matten", "Turnmat 200x100x6");

  assert.ok(matchesQuery(bal, "ballen"));
  assert.ok(matchesQuery(bal, "basketball"));
  assert.ok(matchesQuery(bal, "baskebal"));
  assert.ok(matchesQuery(pion, "pionnen"));
  assert.ok(matchesQuery(pion, "afzetten"));
  assert.ok(matchesQuery(mat, "matten"));
  assert.ok(matchesQuery(bal, "basket maat"));
  assert.ok(!matchesQuery(bal, "trampoline"));
  assert.ok(!matchesQuery(pion, "xyz"));
  assert.ok(matchesQuery(bal, ""));
});

test("zoeken: sporten en subgroep zijn doorzoekbaar", () => {
  const bal = item("basketbal_maat_5", "ballen");
  assert.ok(matchesQuery(bal, "overig") === false);
  assert.ok(matchesQuery(bal, "basketbal"));
  const korfbal = item("korfbal_maat_5", "ballen");
  assert.ok(matchesQuery(korfbal, "korfbal"));
});

test("filter: sporten zijn meervoudig (of), over alle categorieën heen", () => {
  const items = [
    item("basketbal_maat_5", "ballen"),
    item("basketbaltoren_mobiel_senior", "basketbal"),
    item("korfbalpaal_compleet_350", "korfbal"),
    item("turnmat_200x100x6", "matten"),
  ];
  const basket = filterItems(items, { query: "", sports: ["basketbal"] });
  assert.deepEqual(basket.map((entry) => entry.slug).sort(), ["basketbal_maat_5", "basketbaltoren_mobiel_senior"]);
  const both = filterItems(items, { query: "", sports: ["basketbal", "korfbal"] });
  assert.equal(both.length, 3);
  assert.equal(filterItems(items, { query: "paal", sports: ["basketbal", "korfbal"] }).length, 1);
  assert.equal(filterItems(items, { query: "", sports: [] }).length, 4);
});

test("sportCounts: telt per sport met zoekopdracht, zonder het sportfilter", () => {
  const items = [
    item("basketbal_maat_5", "ballen"),
    item("basketbaltoren_mobiel_senior", "basketbal"),
    item("korfbalpaal_compleet_350", "korfbal"),
    item("turnmat_200x100x6", "matten"),
  ];
  const all = sportCounts(items, "");
  assert.equal(all.total, 4);
  assert.equal(all.sports.find((sport) => sport.id === "basketbal")?.count, 2);
  assert.equal(all.sports.find((sport) => sport.id === "korfbal")?.count, 1);
  assert.equal(all.sports.find((sport) => sport.id === "volleybal"), undefined);
  const searched = sportCounts(items, "toren");
  assert.equal(searched.total, 1);
  assert.equal(searched.sports.find((sport) => sport.id === "basketbal")?.count, 1);
});

test("groupByCategory: taxonomie-volgorde, subgroepen, geen personen", () => {
  const items = [
    item("basketbal_maat_5", "ballen"),
    item("tennisbal_standaard", "ballen"),
    item("turnmat_200x100x6", "matten"),
    item("turnbank_1_los", "banken"),
    item("leerling_blauw", "leerlingen"),
  ].filter((entry) => entry.categorie !== PERSONS_ID);
  const groups = groupByCategory(items);
  assert.deepEqual(groups.map((group) => group.id), ["toestellen", "ballen", "matten"]);
  const ballen = groups.find((group) => group.id === "ballen")!;
  assert.deepEqual(ballen.subgroups.map((subgroup) => subgroup.id), ["basketbal", "overig"]);
  assert.equal(groupByCategory([item("leerling_blauw", "leerlingen")]).length, 0);
});

test("zoeken: de categorienaam zelf telt niet mee (\"mat\" vindt geen heel 'Klein materiaal')", () => {
  const pion = item("pion_effen_kleurenset", "signaleringsmateriaal", "Pion effen kleurenset");
  const mat = item("turnmat_200x100x6", "matten", "Turnmat 200x100x6");
  assert.equal(matchesQuery(pion, "mat"), false);
  assert.equal(matchesQuery(mat, "mat"), true);
});
