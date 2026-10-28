// Zet een hoog-niveau spec ({ room, onderdelen: [...] }, zie lib/plattegrond/builders.ts)
// om naar geldige plattegrond-JSON op stdout.
//
// Gebruik:  npm run build:plattegrond -- spec.json [--catalog=pad.json] > uit.json

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bouwPlattegrond, type PlattegrondSpec } from "@/lib/plattegrond/builders";
import { catalogLookup, type Catalog } from "@/lib/plattegrond/catalog";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const catalogArg = args.find((a) => a.startsWith("--catalog="));
const file = args.find((a) => !a.startsWith("--"));
if (!file) {
  console.error("Gebruik: npm run build:plattegrond -- spec.json [--catalog=pad.json]");
  process.exit(2);
}
const catalogPath = catalogArg ? catalogArg.slice("--catalog=".length) : path.join(root, "docs", "ai-item-catalog.json");
const lookup = catalogLookup(JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog);
try {
  console.log(JSON.stringify(bouwPlattegrond(JSON.parse(readFileSync(file, "utf8")) as PlattegrondSpec, lookup), null, 2));
} catch (cause) {
  console.error(`FOUT: ${(cause as Error).message}`);
  process.exit(1);
}
