import { test } from "node:test";
import assert from "node:assert/strict";

import {
  angleFromCenterDeg,
  decideSheetSnap,
  draftStorageKey,
  isDoubleTap,
  isTapDelta,
  layoutForWidth,
  resolveQuality,
  shouldOfferDraft,
  snapRotationDeg,
} from "@/components/canvas-3d/mobile/mobile-logic";

test("layout: telefoon < 640, tablet 640–1023, desktop ≥ 1024", () => {
  assert.equal(layoutForWidth(375), "phone");
  assert.equal(layoutForWidth(639), "phone");
  assert.equal(layoutForWidth(640), "tablet");
  assert.equal(layoutForWidth(820), "tablet");
  assert.equal(layoutForWidth(1023), "tablet");
  assert.equal(layoutForWidth(1024), "desktop");
  assert.equal(layoutForWidth(1440), "desktop");
});

test("rotatie: snap op 15° en normaliseren", () => {
  assert.equal(snapRotationDeg(7), 0);
  assert.equal(snapRotationDeg(8), 15);
  assert.equal(snapRotationDeg(-10), 345);
  assert.equal(snapRotationDeg(362), 0);
  assert.equal(snapRotationDeg(40, 90), 0);
  assert.equal(snapRotationDeg(50, 90), 90);
});

test("rotatiehandvat: hoek volgt de three.js-conventie (lokale +x wijst naar het punt)", () => {
  assert.equal(angleFromCenterDeg(0, 0, 1, 0), 0); // +x
  assert.equal(angleFromCenterDeg(0, 0, 0, -1), 90); // −z → rotation.y = +90°
  assert.equal(angleFromCenterDeg(0, 0, -1, 0), 180);
  assert.equal(angleFromCenterDeg(0, 0, 0, 1), 270);
  // controle met de itemrotatie zelf: lokale +x na rotatie θ is (cosθ, −sinθ)
  for (const deg of [0, 30, 90, 135, 250]) {
    const rad = (deg * Math.PI) / 180;
    assert.ok(Math.abs(angleFromCenterDeg(2, 3, 2 + Math.cos(rad), 3 - Math.sin(rad)) - deg) < 1e-9, String(deg));
  }
});

test("drawer: tik wisselt half/vol, omlaag sluit of verkleint, omhoog vergroot", () => {
  assert.equal(decideSheetSnap("half", 0), "full");
  assert.equal(decideSheetSnap("full", 2), "half");
  assert.equal(decideSheetSnap("half", 120), "close");
  assert.equal(decideSheetSnap("full", 120), "half");
  assert.equal(decideSheetSnap("half", -120), "full");
  assert.equal(decideSheetSnap("half", 40), "half");
  assert.equal(decideSheetSnap("full", -40), "full");
});

test("kwaliteit: hoog/laag/auto en zwakke toestellen", () => {
  assert.deepEqual(resolveQuality({ setting: "hoog", devicePixelRatio: 3, lowEndDevice: false, autoFactor: 0 }), { dpr: 2, antialias: true });
  assert.deepEqual(resolveQuality({ setting: "laag", devicePixelRatio: 3, lowEndDevice: false, autoFactor: 1 }), { dpr: 1, antialias: false });
  assert.deepEqual(resolveQuality({ setting: "auto", devicePixelRatio: 3, lowEndDevice: false, autoFactor: 1 }), { dpr: 2, antialias: true });
  assert.deepEqual(resolveQuality({ setting: "auto", devicePixelRatio: 3, lowEndDevice: true, autoFactor: 1 }), { dpr: 1.5, antialias: false });
  const dropped = resolveQuality({ setting: "auto", devicePixelRatio: 2, lowEndDevice: false, autoFactor: 0 });
  assert.equal(dropped.dpr, 1);
  assert.equal(dropped.antialias, false);
  assert.equal(resolveQuality({ setting: "hoog", devicePixelRatio: 1, lowEndDevice: false, autoFactor: 1 }).dpr, 1);
});

test("dubbeltik: binnen 350 ms en 30 px", () => {
  const a = { time: 1000, x: 100, y: 100 };
  assert.equal(isDoubleTap(null, a), false);
  assert.equal(isDoubleTap(a, { time: 1200, x: 110, y: 105 }), true);
  assert.equal(isDoubleTap(a, { time: 1500, x: 100, y: 100 }), false);
  assert.equal(isDoubleTap(a, { time: 1100, x: 200, y: 100 }), false);
  assert.equal(isTapDelta(2), true);
  assert.equal(isTapDelta(20), false);
});

test("kladversie: alleen aanbieden als hij afwijkt en iets bevat", () => {
  const loaded = { naam: "A", room: { w: 1 }, items: [], coneFields: [] };
  assert.equal(shouldOfferDraft(null, loaded), false);
  assert.equal(shouldOfferDraft({ savedAt: 1, naam: "A", room: { w: 1 }, items: [], coneFields: [] }, loaded), false);
  assert.equal(shouldOfferDraft({ savedAt: 1, naam: "B", room: { w: 1 }, items: [], coneFields: [] }, loaded), false); // leeg
  assert.equal(shouldOfferDraft({ savedAt: 1, naam: "A", room: { w: 1 }, items: [{ id: "x" }], coneFields: [] }, loaded), true);
  assert.equal(draftStorageKey(null), "gymwiki.floorplan3d.draft.nieuw");
  assert.equal(draftStorageKey("abc"), "gymwiki.floorplan3d.draft.abc");
});
