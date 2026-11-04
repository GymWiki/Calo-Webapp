import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_UI_PREFS, type EditorUiPrefs, UI_PREFS_VERSION, nextToolbarPosition, parseUiPrefs, serializeUiPrefs } from "@/lib/editor-ui/layoutPrefs";

test("lege, kapotte of vreemde opslag valt veilig terug op de standaard", () => {
  for (const raw of [null, undefined, "", "geen json", "[]", "null", '{"version":99,"toolbar":"top"}']) assert.deepEqual(parseUiPrefs(raw), DEFAULT_UI_PREFS, String(raw));
});

test("roundtrip en onbekende waarden", () => {
  const prefs: EditorUiPrefs = { version: UI_PREFS_VERSION, toolbar: "top", sections: { omgeving: false, muren: true }, panels: { left: true, right: false, focus: false }, flags: { canvasToolbar: false } };
  assert.deepEqual(parseUiPrefs(serializeUiPrefs(prefs)), prefs);
  assert.equal(parseUiPrefs('{"version":1,"toolbar":"zweven","flags":{"canvasToolbar":"ja"}}').toolbar, "bottom");
  assert.equal(parseUiPrefs('{"version":1,"toolbar":"top","flags":{"canvasToolbar":"ja"}}').flags.canvasToolbar, true);
});

test("werkbalkpositie loopt rond: onder, boven, verborgen", () => {
  assert.deepEqual(["bottom", "top", "hidden", "bottom"], ["bottom", nextToolbarPosition("bottom"), nextToolbarPosition(nextToolbarPosition("bottom")), nextToolbarPosition("hidden")]);
});

test("paneelsecties en -staat: onbekende of ongeldige waarden vallen terug op de standaard", () => {
  const parsed = parseUiPrefs('{"version":1,"toolbar":"top","sections":{"a":true,"b":"ja","c":false},"panels":{"left":true,"right":"nee"}}');
  assert.deepEqual(parsed.sections, { a: true, c: false });
  assert.deepEqual(parsed.panels, { left: true, right: false, focus: false });
  // Opslag van vóór deze velden blijft geldig.
  const old = parseUiPrefs('{"version":1,"toolbar":"top","flags":{"canvasToolbar":true}}');
  assert.deepEqual(old.sections, {});
  assert.equal(old.toolbar, "top");
});
