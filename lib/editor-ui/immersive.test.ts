import assert from "node:assert/strict";
import { test } from "node:test";

import { isImmersiveRoute } from "@/lib/editor-ui/immersive";

test("de editorroute is schermvullend; andere pagina's houden hun navigatie", () => {
  assert.equal(isImmersiveRoute("/plattegrond-3d"), true);
  assert.equal(isImmersiveRoute("/plattegrond-3d/nieuw"), true);
  for (const path of ["/dashboard", "/plattegrond-3dx", "/activiteit/1", "/", "", null, undefined]) assert.equal(isImmersiveRoute(path), false, String(path));
});
