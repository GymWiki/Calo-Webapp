import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveDeepLink } from "@/lib/mobile/deepLinks";

test("universal link naar gymwiki.nl geeft pad + query", () => {
  assert.equal(resolveDeepLink("https://www.gymwiki.nl/activiteit/abc?x=1"), "/activiteit/abc?x=1");
  assert.equal(resolveDeepLink("https://gymwiki.nl/"), "/");
});
test("eigen schema", () => {
  assert.equal(resolveDeepLink("com.mycompany.gymwiki://activiteit/123"), "/activiteit/123");
  assert.equal(resolveDeepLink("com.mycompany.gymwiki://pro"), "/pro");
});
test("vreemde hosts, schema's en API-paden worden geweigerd", () => {
  assert.equal(resolveDeepLink("https://evil.example/activiteit/1"), null);
  assert.equal(resolveDeepLink("javascript:alert(1)"), null);
  assert.equal(resolveDeepLink("https://www.gymwiki.nl/api/stripe/webhook"), null);
  assert.equal(resolveDeepLink("niet-een-url"), null);
});
