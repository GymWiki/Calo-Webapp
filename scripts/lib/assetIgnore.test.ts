import assert from "node:assert/strict";
import { test } from "node:test";

import { ASSET_IGNORE_RULES, matchAssetIgnore } from "./assetIgnore.ts";

test("zwembadbestanden worden genegeerd, op naam én op map", () => {
  for (const name of ["zwembad_25m_wedstrijdbad.glb", "pool_noodle_set.glb", "pullbuoy_tweekleurig", "waterpoloballen_set", "zwemplankje_kickboard", "reddingsboei_en_rescue_tube", "drijfmat_vlot_speelmat", "duikringen_verzwaard_set", "gatzeil_zwemdiploma", "waterbasketbal_drijvend"]) {
    assert.ok(matchAssetIgnore(name), name);
  }
  assert.ok(matchAssetIgnore("iets_onschuldigs", "Zwembad"), "bronmap Zwembad");
});

test("gewoon materiaal wordt niet genegeerd (ook geen valse treffers op baan/bal/blok)", () => {
  for (const name of ["atletiekbaan_compleet", "turnblok_120x90x60", "foamblok", "zaalverdeler", "basketbal_maat_5", "tennisbal_standaard", "judomat_200x100x4", "leerling_zittend"]) {
    assert.equal(matchAssetIgnore(name), null, name);
  }
});

test("elke regel heeft een reden", () => {
  for (const rule of ASSET_IGNORE_RULES) assert.ok(rule.reason.length > 10, rule.id);
});
