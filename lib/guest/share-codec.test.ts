import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MAX_SHARE_URL_CHARS,
  buildShareLink,
  compactFloorplan,
  decodeFloorplan,
  encodeFloorplan,
  readShareToken,
} from "@/lib/guest/share-codec";
import type { Floorplan3dData } from "@/types/floorplan3d";

function plan(count: number): Floorplan3dData {
  return {
    version: 1,
    room: { width_m: 15, length_m: 27 },
    items: Array.from({ length: count }, (_, i) => ({
      id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
      slug: i % 2 ? "turnbank_1_los" : "turnmat_200x100x6",
      x: -6.123456 + i * 0.37,
      y: 0,
      z: 3.141592 - i * 0.21,
      rot_y_deg: (i * 15) % 360,
      ...(i % 5 === 0 ? { rot_x_deg: 30.04, lift_m: 0.5 } : {}),
    })),
    coneFields: [
      { id: "f1", type: "coneField", x: 1, z: 2, rot_y_deg: 0, width_m: 8, length_m: 6, interval_m: 1.5, distribution: "even", marker: "pion", color: "#f97316", corner_color: null },
    ],
    ropes: [{ id: "t1", a: { item: "00000000-0000-4000-8000-000000000000", local: [0.1, 1.2, 0] }, b: { item: "00000000-0000-4000-8000-000000000001", local: [0, 0.9, -0.2] } }],
  };
}

describe("share-codec", () => {
  it("roundtrip: dezelfde plattegrond komt terug (afgerond op 3 decimalen)", async () => {
    const original = plan(12);
    const decoded = await decodeFloorplan(await encodeFloorplan(original));
    assert.deepEqual(decoded, compactFloorplan(original));
  });

  it("40 items blijven ruim onder de maximale URL-lengte", async () => {
    const token = await encodeFloorplan(plan(40));
    const link = buildShareLink("https://www.gymwiki.nl/gratis-gymzaal-plattegrond-maken", token);
    assert.ok(link.length < MAX_SHARE_URL_CHARS, `link is ${link.length} tekens`);
    assert.equal(link.tooLong, false);
    assert.ok(token.startsWith("v1."));
  });

  it("een enorme plattegrond wordt als te lang gemarkeerd", async () => {
    const token = await encodeFloorplan(plan(2500));
    assert.equal(buildShareLink("https://x.nl/p", token).tooLong, true);
  });

  it("ongeldige, afgekapte of gemanipuleerde tokens geven null (geen exception)", async () => {
    const token = await encodeFloorplan(plan(5));
    assert.equal(await decodeFloorplan("rommel"), null);
    assert.equal(await decodeFloorplan("v1."), null);
    assert.equal(await decodeFloorplan("x9.AAAA"), null);
    assert.equal(await decodeFloorplan(token.slice(0, token.length - 12)), null);
    assert.equal(await decodeFloorplan("u1." + Buffer.from('{"version":1,"room":{"width_m":-1}}').toString("base64url")), null);
  });

  it("een uitgepakt bestand boven de limiet wordt geweigerd (zip-bomb)", async () => {
    const huge = { ...plan(1), items: [{ ...plan(1).items[0], slug: "a".repeat(600_000) }] };
    const raw = new TextEncoder().encode(JSON.stringify(huge));
    const stream = new CompressionStream("deflate-raw");
    const writer = stream.writable.getWriter();
    void writer.write(raw).then(() => writer.close());
    const packed = new Uint8Array(await new Response(stream.readable).arrayBuffer());
    assert.equal(await decodeFloorplan(`v1.${Buffer.from(packed).toString("base64url")}`), null);
  });

  it("readShareToken leest #p= uit de hash", () => {
    assert.equal(readShareToken("#p=v1.abc-_9"), "v1.abc-_9");
    assert.equal(readShareToken("#x=1&p=u1.zzz"), "u1.zzz");
    assert.equal(readShareToken(""), null);
    assert.equal(readShareToken("#andere=1"), null);
  });
});
