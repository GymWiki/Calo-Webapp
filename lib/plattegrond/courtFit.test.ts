import assert from "node:assert/strict";
import { test } from "node:test";

import { COURT_MARKINGS, COURT_MARKINGS_BY_ID } from "@/lib/constants/courtMarkings";
import { computeMaxCopies, fitsInHall, hallHint, invalidMarkings, misfitReason, whatFits } from "@/lib/plattegrond/courtFit";

const zaal24x14 = { width_m: 24, length_m: 14 };
const get = (id: string) => COURT_MARKINGS_BY_ID.get(id)!;

test("volleybalveld 18 × 9 m past in 24 × 14 m (vrije ruimte 2 m): precies één veld, ook in de andere oriëntatie niet", () => {
  const fit = computeMaxCopies({ markering: get("volleybal"), zaal: zaal24x14 });
  assert.equal(fit.copies, 1);
  assert.equal(fit.orientation, "lengthwise");
  assert.equal(fitsInHall({ markering: get("volleybal"), zaal: zaal24x14 }), true);
});

test("drie volleybalvelden naast elkaar passen niet in 24 × 14 m (en ook niet in een deelzaal van 2 × 2), wel in een heel grote zaal", () => {
  assert.equal(fitsInHall({ markering: get("volleybal-dwars"), zaal: zaal24x14, copies: 3 }), false);
  assert.match(misfitReason(get("volleybal-dwars"), zaal24x14, 3)!, /Past niet in 24 × 14 m: minimaal/);
  assert.equal(fitsInHall({ markering: get("volleybal-dwars"), zaal: { width_m: 24, length_m: 40 }, copies: 3 }), true);
});

test("badminton: één dubbelveld, en drie naast elkaar (13,40 m over de zaalbreedte van 14 m) passen in 24 × 14 m; vier niet", () => {
  assert.equal(computeMaxCopies({ markering: get("badminton"), zaal: zaal24x14 }).copies, 3);
  assert.equal(fitsInHall({ markering: get("badminton-dwars"), zaal: zaal24x14, copies: 3 }), true);
  assert.equal(fitsInHall({ markering: get("badminton"), zaal: zaal24x14, copies: 4 }), false);
});

test("volledig basketbalveld (28 × 15 m), volledig handbal (40 × 20 m) en volledig zaalvoetbal passen niet in 24 × 14 m", () => {
  for (const id of ["basketbal-volledig", "handbal-volledig", "zaalvoetbal-volledig"]) assert.equal(fitsInHall({ markering: get(id), zaal: zaal24x14 }), false, id);
  // maar wel in een sporthal van 47 × 26 m (KVLO-tabel) resp. een dubbele zaal
  assert.equal(fitsInHall({ markering: get("basketbal-volledig"), zaal: { width_m: 47, length_m: 26 } }), true);
  assert.equal(fitsInHall({ markering: get("handbal-volledig"), zaal: { width_m: 47, length_m: 26 } }), true);
});

test("deelzalen: een 2 × 2-complex (elke deelzaal 24 × 14 m) geeft per zaal dezelfde uitkomst; het hele complex (48 × 28 m) geeft er niet automatisch meer velden bij", () => {
  const deelzaal = { width_m: 24, length_m: 14 };
  assert.equal(computeMaxCopies({ markering: get("volleybal"), zaal: deelzaal }).copies, 1);
  // Op het geheel zou je er 4 kunnen tekenen; de regel is dat markeringen bij één deelzaal horen, dus de aanroeper gebruikt de deelzaalmaat.
  assert.equal(computeMaxCopies({ markering: get("volleybal"), zaal: { width_m: 48, length_m: 28 } }).copies >= 4, true);
});

test("kleine zalen en grenswaarden", () => {
  assert.equal(whatFits({ width_m: 10, length_m: 6 }).length, 0);
  assert.match(hallHint({ width_m: 10, length_m: 6 }), /geen van de bekende/);
  // grens: badminton dubbel 13,4 × 6,1 + 0,3 m per kant = 14,0 × 6,7
  assert.equal(fitsInHall({ markering: get("badminton"), zaal: { width_m: 14, length_m: 6.7 } }), true);
  assert.equal(fitsInHall({ markering: get("badminton"), zaal: { width_m: 13.99, length_m: 6.7 } }), false);
});

test("hint noemt wat past; ongeldige markeringen worden gevonden en onbekende ids genegeerd", () => {
  assert.match(hallHint(zaal24x14), /^Deze zaal past: .*volleybalveld/);
  assert.deepEqual(invalidMarkings(["volleybal", "volleybal-dwars", "bestaat-niet"], zaal24x14), ["volleybal-dwars"]);
});

test("config: elke regel heeft een bron, positieve maten en een unieke id", () => {
  const ids = new Set<string>();
  for (const marking of COURT_MARKINGS) {
    assert.ok(!ids.has(marking.id), marking.id);
    ids.add(marking.id);
    assert.ok(marking.source.length > 10 && marking.length_m >= marking.width_m && marking.width_m > 0 && marking.line_width_m > 0, marking.id);
  }
});
