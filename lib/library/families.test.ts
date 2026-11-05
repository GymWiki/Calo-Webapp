import assert from "node:assert/strict";
import { test } from "node:test";

import { defaultMaat, familyOfSlug, ITEM_FAMILIES } from "@/lib/constants/itemFamilies";
import { COLLISION_PROFILES } from "@/components/canvas-3d/collision-profiles.generated";
import { buildFamilyCards, maatOptions, resolvePlacementModel, slugForMaat } from "@/lib/library/families";
import { filterItems } from "@/lib/library/search";
import type { MaterialModel } from "@/types/materialModel";

function model(slug: string, naam: string, extra: Partial<MaterialModel> = {}): MaterialModel {
  return { id: slug, slug, material_id: null, naam, categorie: "toestellen", subgroep: null, sporten: ["turnen"], tags: [], model_url: "", preview_url: "", length_m: 1, width_m: 1, height_m: 1, stackable: false, sort_order: 0, ...extra };
}
const all = ITEM_FAMILIES.flatMap((family) => family.maten.flatMap((maat) => (maat.slug ? [model(maat.slug, `${family.naam} ${maat.label}`)] : [])));

test("elke maat-slug hoort bij precies één familie en elk id is uniek", () => {
  const seen = new Set<string>();
  for (const family of ITEM_FAMILIES) {
    assert.ok(family.maten.some((maat) => maat.id === family.standaard && maat.slug), `${family.id}: standaardmaat heeft een model`);
    assert.equal(new Set(family.maten.map((maat) => maat.id)).size, family.maten.length, `${family.id}: unieke maat-id's`);
    for (const maat of family.maten) {
      if (!maat.slug) continue;
      assert.ok(!seen.has(maat.slug), `${maat.slug} komt maar één keer voor`);
      seen.add(maat.slug);
      assert.equal(familyOfSlug(maat.slug)?.family.id, family.id);
      assert.ok(COLLISION_PROFILES[maat.slug], `${maat.slug} bestaat in de catalogus (collision-profiel)`);
    }
  }
});

test("alias-tabel: alle bestaande item-id's blijven hun eigen slug houden (geen herschrijving)", () => {
  for (const family of ITEM_FAMILIES) for (const maat of family.maten) if (maat.slug) assert.equal(slugForMaat(maat.slug, maat.id), maat.slug);
});

test("een familie wordt één kaart; losse items blijven ongewijzigd", () => {
  const loose = model("pion_test", "Pion test");
  const { cards, memberToCard } = buildFamilyCards([...all, loose]);
  assert.equal(cards.length, ITEM_FAMILIES.length + 1);
  const turnkast = cards.find((card) => card.familyId === "turnkast");
  assert.equal(turnkast?.naam, "Turnkast");
  assert.equal(turnkast?.maten, 7);
  assert.equal(turnkast?.slug, "turnkast_4_delig", "kaart = standaardmaat");
  assert.equal(memberToCard.get("turnkast_6_delig_1_recht"), "turnkast_4_delig");
  assert.deepEqual(cards.find((card) => card.slug === "pion_test"), loose);
});

test("een familie met één aanwezig model blijft een gewoon item", () => {
  const { cards } = buildFamilyCards([model("basketbal_maat_5", "Basketbal maat 5")]);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].familyId, undefined);
  assert.equal(cards[0].naam, "Basketbal maat 5");
});

test("zoeken op een maatnaam vindt de familie", () => {
  const { cards } = buildFamilyCards(all);
  for (const [query, family] of [["maat 5", "basketbal"], ["4 delen", "turnkast"], ["6 delig", "turnkast"], ["3,66", "veldhockeydoel"], ["12 meter", "lange_mat"]] as const) {
    const hits = filterItems(cards, { query, sports: [] });
    assert.ok(hits.some((card) => card.familyId === family), `"${query}" vindt ${family}`);
  }
});

test("plaatsen gebruikt de laatst gebruikte maat, anders de standaardmaat", () => {
  const { cards } = buildFamilyCards(all);
  const card = cards.find((entry) => entry.familyId === "turnkast")!;
  assert.equal(resolvePlacementModel(card, all, {}).slug, "turnkast_4_delig");
  assert.equal(resolvePlacementModel(card, all, { turnkast: "delen_6" }).slug, "turnkast_6_delig_1_recht");
  assert.equal(resolvePlacementModel(card, all, { turnkast: "bestaat_niet" }).slug, "turnkast_4_delig");
});

test("maatmenu: maten zonder model staan gedimd erbij; geen menu voor losse items", () => {
  const menu = maatOptions("basketbal_maat_5", all);
  assert.ok(menu);
  assert.deepEqual(menu.options.map((option) => [option.maat.id, Boolean(option.model), option.current]), [["maat_5", true, true], ["maat_6", false, false], ["maat_7", true, false]]);
  assert.equal(maatOptions("pion_test", all), null);
  assert.equal(slugForMaat("basketbal_maat_5", "maat_6"), null, "maat zonder model wisselt niet");
  assert.equal(slugForMaat("basketbal_maat_5", "maat_7"), "basketbal_maat_7");
  assert.equal(slugForMaat("pion_test", "maat_7"), null);
});

test("de turnkast wordt per deel 0,21 m hoger (opbouw uit delen: basis voor een latere modulaire kast)", () => {
  const heights = ["turnkast_2_delig", "turnkast_3_delig", "turnkast_4_delig", "turnkast_5_delig", "turnkast_6_delig_1_recht", "turnkast_7_delig_2_recht"].map((slug) => COLLISION_PROFILES[slug].shape.height_m);
  for (let index = 1; index < heights.length; index++) assert.ok(Math.abs(heights[index] - heights[index - 1] - 0.21) < 0.005, `deel ${index + 2}`);
  assert.equal(defaultMaat(ITEM_FAMILIES.find((family) => family.id === "turnkast")!).id, "delen_4");
});
