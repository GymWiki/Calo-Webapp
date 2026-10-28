import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { audiences, faq, features, hero, howItWorks, meta, problems } from "@/content/landing.nl";
import { buildLandingStructuredData } from "@/lib/landing/structured-data";
import { pickPreview } from "@/lib/services/landing";
import type { PublicActivity } from "@/lib/services/publicActivities";

type Node = Record<string, unknown> & { "@type": string };
const graph = buildLandingStructuredData(new Date("2026-10-28T00:00:00Z"))["@graph"] as Node[];
const byType = (type: string) => graph.find((n) => n["@type"] === type)!;

const activity = (id: string, over: Partial<PublicActivity> = {}): PublicActivity => ({
  id, slug: id, titel: id, seo_summary: "x".repeat(120), doel: null, doelgroep: [1], leerlijn: "Tikspelen", categorie: "Spel",
  materiaal: null, base_materials: null, rule_materials: null, afbeelding: "https://x.supabase.co/a.jpg", public_since: null, created_at: "2026-01-01", like_count: 0, ...over,
});

describe("landing-content", () => {
  it("title en description hebben een zinnige lengte", () => {
    assert.ok(meta.title.length >= 50 && meta.title.length <= 62, `title ${meta.title.length}`);
    assert.ok(meta.description.length >= 120 && meta.description.length <= 165, `description ${meta.description.length}`);
  });

  it("heeft de afgesproken aantallen blokken", () => {
    assert.equal(problems.items.length, 3);
    assert.equal(howItWorks.steps.length, 3);
    assert.ok(features.items.length >= 4 && features.items.length <= 5);
    assert.ok(faq.items.length >= 6 && faq.items.length <= 8);
    assert.equal(hero.title, "Alle activiteiten voor je gymles op één plek");
  });

  it("noemt geen doelgroepen of functies waarvoor geen bewijs is", () => {
    const all = JSON.stringify({ audiences, features, faq }).toLowerCase();
    for (const forbidden of ["buitenschoolse", "voortgezet onderwijs", "revolutionair", "de beste"]) assert.ok(!all.includes(forbidden), forbidden);
  });
});

describe("landing JSON-LD", () => {
  it("bevat Organization, WebSite, SoftwareApplication en FAQPage", () => {
    for (const type of ["Organization", "WebSite", "SoftwareApplication", "FAQPage"]) assert.ok(byType(type), type);
  });

  it("FAQPage is letterlijk dezelfde tekst als de zichtbare FAQ", () => {
    const entities = byType("FAQPage").mainEntity as { name: string; acceptedAnswer: { text: string } }[];
    assert.equal(entities.length, faq.items.length);
    entities.forEach((q, i) => {
      assert.equal(q.name, faq.items[i].question);
      assert.equal(q.acceptedAnswer.text, faq.items[i].answer);
    });
  });

  it("SoftwareApplication claimt alleen web en heeft een gratis aanbod", () => {
    const app = byType("SoftwareApplication");
    assert.equal(app.operatingSystem, "Web");
    const offers = app.offers as { price: string }[];
    assert.equal(offers[0].price, "0");
    assert.ok(offers.every((o) => /^\d+$/.test(o.price)));
  });

  it("is serialiseerbaar", () => {
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(buildLandingStructuredData())));
  });
});

describe("pickPreview", () => {
  it("zet activiteiten met 3D-plattegrond eerst en slaat activiteiten zonder afbeelding over", () => {
    const list = [
      activity("a", { like_count: 9 }),
      activity("b", { afbeelding: "https://x.supabase.co/storage/v1/object/public/floorplan-previews/b.webp", like_count: 1 }),
      activity("c", { afbeelding: null, like_count: 99 }),
      activity("d", { like_count: 3 }),
    ];
    assert.deepEqual(pickPreview(list, 3).map((x) => x.id), ["b", "a", "d"]);
  });
});
