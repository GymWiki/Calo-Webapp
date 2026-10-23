import { test } from "node:test";
import assert from "node:assert/strict";

import { ENVIRONMENT_NODES } from "@/components/canvas-3d/environment-nodes";
import {
  ENVIRONMENT_KIND_ORDER,
  OTHER_ENVIRONMENTS,
  createEnvironment,
  defaultLayoutId,
  resolveEnvironment,
  roomForEnvironment,
} from "@/components/canvas-3d/environment-kinds";
import { GYM_LAYOUTS, isPartOn } from "@/components/canvas-3d/environments";

test("alle vier de soorten staan in de keuzelijst, gymzaal eerst", () => {
  assert.deepEqual(
    ENVIRONMENT_KIND_ORDER.map((kind) => kind.id),
    ["gymzaal", "sportveld", "atletiekbaan", "zwembad"],
  );
});

test("elke indeling wijst naar een bekend GLB met echte nodes en elk onderdeel bestaat", () => {
  for (const kind of OTHER_ENVIRONMENTS) {
    assert.ok(kind.layouts.length > 0, kind.id);
    for (const layout of kind.layouts) {
      const names = new Set(ENVIRONMENT_NODES[layout.glb]);
      assert.ok(names.size > 0, `${layout.glb} heeft nodelijst`);
      assert.ok(layout.width_m > 0 && layout.length_m > 0);
      for (const group of layout.groups) {
        assert.ok(group.parts.length > 0, `${layout.id}/${group.id} heeft onderdelen`);
        for (const part of group.parts) {
          assert.ok(part.nodes.length > 0, `${layout.id}/${part.id} heeft nodes`);
          for (const node of part.nodes) assert.ok(names.has(node), `${node} bestaat in ${layout.glb}`);
        }
      }
    }
  }
});

test("onderdelen van één indeling overlappen niet (aan/uit raakt maar één ding)", () => {
  for (const kind of OTHER_ENVIRONMENTS) {
    for (const layout of kind.layouts) {
      const seen = new Map<string, string>();
      for (const group of layout.groups) {
        for (const part of group.parts) {
          for (const node of part.nodes) {
            assert.equal(seen.get(node), undefined, `${node} zit in ${seen.get(node)} én ${part.id}`);
            seen.set(node, part.id);
          }
        }
      }
    }
  }
});

test("zwembad: elke baan is een eigen onderdeel", () => {
  const wedstrijd = OTHER_ENVIRONMENTS.find((k) => k.id === "zwembad")!.layouts.find((l) => l.id === "wedstrijdbad")!;
  const lanes = wedstrijd.groups.find((g) => g.id === "banen")!.parts;
  assert.equal(lanes.length, 5); // 125 segmenten = 5 banen × 25
  assert.ok(lanes.every((lane) => lane.nodes.length === 25));
});

test("nieuwe omgeving start met de standaardstand (extra belijning uit)", () => {
  const veld = createEnvironment("sportveld", "groot");
  assert.equal(veld.type, "sportveld");
  assert.ok(veld.hidden.includes("Belijning_Hockey_91x55"));
  assert.ok(!veld.hidden.includes("Belijning_Voetbal_100x60"));

  const gym = createEnvironment("gymzaal");
  assert.equal(gym.type, "gymzaal");
  assert.equal(gym.layout, "standaard");
  // de gymzaal verbergt standaard voor- en rechtermuur
  const standaard = GYM_LAYOUTS.standaard;
  assert.equal(isPartOn(standaard.walls.find((w) => w.side === "voor")!, gym.hidden), false);
  assert.equal(isPartOn(standaard.walls.find((w) => w.side === "achter")!, gym.hidden), true);
});

test("maten volgen de indeling; een onbekende indeling valt terug op de eerste", () => {
  assert.deepEqual(roomForEnvironment({ type: "sportveld", layout: "school" }), { width_m: 47, length_m: 27 });
  assert.deepEqual(roomForEnvironment({ type: "gymzaal", layout: "2x2" }), { width_m: 48, length_m: 28 });
  assert.equal(resolveEnvironment({ type: "zwembad", layout: "bestaat-niet" }).glb, "zwembad_instructiebad");
  assert.equal(defaultLayoutId("atletiekbaan"), "compleet");
});
