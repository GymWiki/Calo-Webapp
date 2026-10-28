import assert from "node:assert/strict";
import test from "node:test";

import { TOOL_DESCRIPTION, TOOL_FAQ, TOOL_TITLE, buildToolStructuredData } from "@/lib/guest/seo-content";

type Node = Record<string, unknown> & { "@type": string };
const graph = buildToolStructuredData()["@graph"] as Node[];
const byType = (type: string) => graph.find((n) => n["@type"] === type)!;

test("titel en beschrijving hebben een zinnige lengte", () => {
  assert.ok(TOOL_TITLE.length >= 40 && TOOL_TITLE.length <= 62, `titel ${TOOL_TITLE.length} tekens`);
  assert.ok(TOOL_DESCRIPTION.length >= 120 && TOOL_DESCRIPTION.length <= 160, `beschrijving ${TOOL_DESCRIPTION.length} tekens`);
});

test("FAQ heeft 8–10 vragen en het schema bevat dezelfde tekst", () => {
  assert.ok(TOOL_FAQ.length >= 8 && TOOL_FAQ.length <= 10);
  const faq = byType("FAQPage").mainEntity as { name: string; acceptedAnswer: { text: string } }[];
  assert.equal(faq.length, TOOL_FAQ.length);
  faq.forEach((q, i) => {
    assert.equal(q.name, TOOL_FAQ[i].question);
    assert.equal(q.acceptedAnswer.text, TOOL_FAQ[i].answer);
  });
});

test("SoftwareApplication heeft de verplichte velden en is gratis", () => {
  const app = byType("SoftwareApplication");
  for (const key of ["name", "applicationCategory", "operatingSystem", "offers", "url"]) assert.ok(app[key], key);
  assert.equal((app.offers as { price: string }).price, "0");
});

test("BreadcrumbList is oplopend genummerd met absolute URL's", () => {
  const items = byType("BreadcrumbList").itemListElement as { position: number; item: string }[];
  items.forEach((it, i) => {
    assert.equal(it.position, i + 1);
    assert.match(it.item, /^https:\/\//);
  });
});

test("JSON-LD is serialiseerbaar zonder undefined", () => {
  assert.doesNotThrow(() => JSON.parse(JSON.stringify(buildToolStructuredData())));
});
