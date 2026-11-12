import assert from "node:assert/strict";
import { test } from "node:test";

import { gripOf } from "@/lib/constants/gripPoints";

const dims = { length_m: 0.22, width_m: 0.22, height_m: 0.22 };

test("ballen: pakbaar, greep in het midden; reuzenbal en zware toestellen niet", () => {
  const ball = gripOf({ slug: "basketbal_maat_5", categorie: "ballen", ...dims });
  assert.deepEqual([ball.pakbaar, ball.grip], [true, [0, 0.11, 0]]);
  assert.equal(gripOf({ slug: "kin_ball_reuzenbal", categorie: "ballen", length_m: 1.2, width_m: 1.2, height_m: 1.2 }).pakbaar, false);
  assert.equal(gripOf({ slug: "turnkast_4_delig", categorie: "toestellen", length_m: 1.4, width_m: 0.8, height_m: 0.9 }).pakbaar, false);
  assert.equal(gripOf({ slug: "turnmat_200x100x6", categorie: "matten", length_m: 2, width_m: 1, height_m: 0.06 }).pakbaar, false);
});

test("sticks en rackets: pakbaar, greep bij het uiteinde van de lengteas; een override met reden wint", () => {
  const racket = gripOf({ slug: "tennisracket_standaard", categorie: "klein_materiaal", subgroep: "sticks_rackets", length_m: 0.68, width_m: 0.28, height_m: 0.03 });
  assert.equal(racket.pakbaar, true);
  assert.ok(racket.grip[0] < 0 && Math.abs(racket.grip[0] + 0.68 / 2 - 0.12) < 1e-9);
  const override = gripOf({ slug: "kin_ball_reuzenbal", categorie: "ballen", length_m: 1.2, width_m: 1.2, height_m: 1.2 });
  assert.equal(override.bron, "config");
  assert.ok(override.reden.length > 5);
});
