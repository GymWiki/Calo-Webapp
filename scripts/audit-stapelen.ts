// Overzicht van alle assets: laag, kan als ondergrond dienen, mag erop gestapeld worden. Schrijft docs/stapelen-assets.csv.
// Gebruik: node --experimental-strip-types --experimental-loader=./scripts/lib/path-alias-loader.mjs scripts/audit-stapelen.ts
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

import { canRestOn, layerOf, staysAtOwnHeight, supportsOthers } from "@/lib/constants/collisionRules";

const dir = "materiaal-import";
const rows = ["slug;naam;categorie;laag;is_ondergrond;mag_erop_stapelen;db_stackable"];
for (const file of readdirSync(dir).filter((name) => name.endsWith(".json")).sort()) {
  const slug = file.replace(/\.json$/, "");
  const data = JSON.parse(readFileSync(`${dir}/${file}`, "utf8")) as { naam?: string; categorie?: string; stackable?: boolean };
  const layer = layerOf(slug, false);
  const stackable = !staysAtOwnHeight(slug, layer) && layer !== "decor" && canRestOn(layer, "toestel");
  rows.push([slug, data.naam ?? "", data.categorie ?? "", layer, supportsOthers(layer) ? "ja" : "nee", stackable ? "ja" : "nee", String(data.stackable ?? "")].join(";"));
}
writeFileSync("docs/stapelen-assets.csv", rows.join("\n") + "\n");
console.log(`${rows.length - 1} assets`);
