import { test } from "node:test";
import assert from "node:assert/strict";

import { linkNavigationTarget } from "@/components/canvas-3d/unsaved-navigation";

const HERE = "https://gymwiki.nl/plattegrond-3d?open=abc";
const CLICK = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };

test("een link naar een andere pagina in de app verlaat de editor", () => {
  assert.equal(linkNavigationTarget({ href: "https://gymwiki.nl/dashboard" }, CLICK, HERE), "/dashboard");
  assert.equal(linkNavigationTarget({ href: "/bibliotheek?x=1#top" }, CLICK, HERE), "/bibliotheek?x=1#top");
  // andere query op dezelfde pad = een andere plattegrond openen
  assert.equal(linkNavigationTarget({ href: "/plattegrond-3d?open=def" }, CLICK, HERE), "/plattegrond-3d?open=def");
});

test("geen waarschuwing voor links die de pagina niet verlaten", () => {
  assert.equal(linkNavigationTarget({ href: "#kaart" }, CLICK, HERE), null);
  assert.equal(linkNavigationTarget({ href: "/plattegrond-3d?open=abc#x" }, CLICK, HERE), null);
  assert.equal(linkNavigationTarget({ href: "https://anders.nl/pagina" }, CLICK, HERE), null);
  assert.equal(linkNavigationTarget({ href: "mailto:info@gymwiki.nl" }, CLICK, HERE), null);
  assert.equal(linkNavigationTarget({ href: "/dashboard", target: "_blank" }, CLICK, HERE), null);
  assert.equal(linkNavigationTarget({ href: "/bestand.pdf", download: true }, CLICK, HERE), null);
});

test("nieuw tabblad of venster via toetsen of de middelste knop laat de editor met rust", () => {
  assert.equal(linkNavigationTarget({ href: "/dashboard" }, { ...CLICK, ctrlKey: true }, HERE), null);
  assert.equal(linkNavigationTarget({ href: "/dashboard" }, { ...CLICK, metaKey: true }, HERE), null);
  assert.equal(linkNavigationTarget({ href: "/dashboard" }, { ...CLICK, shiftKey: true }, HERE), null);
  assert.equal(linkNavigationTarget({ href: "/dashboard" }, { ...CLICK, button: 1 }, HERE), null);
  assert.equal(linkNavigationTarget({ href: "/dashboard", target: "_self" }, CLICK, HERE), "/dashboard");
});
