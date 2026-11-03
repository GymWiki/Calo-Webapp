import { readFile } from "node:fs/promises";
import { readGlbGeometry } from "./lib/glb-geometry.ts";
import { deriveAnchors, distanceToGeometry } from "./lib/anchor-derive.ts";
for (const slug of process.argv.slice(2)) {
  const geo = await readGlbGeometry(new Uint8Array(await readFile(`materiaal-import/${slug}.glb`)));
  const d = deriveAnchors(slug, geo);
  console.log(slug, d.cls, d.notes.join("; "));
  for (const a of d.anchors) console.log("  ", a.id.padEnd(12), JSON.stringify(a.pos), a.adjustable ? `h ${a.adjustable.min}-${a.adjustable.max}` : "", `d=${(distanceToGeometry(a.pos, geo.parts) * 100).toFixed(1)}cm`, a.source);
}
