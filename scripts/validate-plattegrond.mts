// Valideert 3D-plattegrond-JSON (opslagformaat van floorplans_3d.data, of de
// generatie-envelop { aannames, plattegrond }) tegen schema + catalogus + geometrie.
//
// Gebruik:  npm run validate:plattegrond -- bestand.json [meer.json] [--catalog=pad.json]
// Exitcode 1 bij minstens één fout (waarschuwingen alleen: exitcode 0).

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { catalogLookup, type Catalog } from "@/lib/plattegrond/catalog";
import { validatePlattegrond } from "@/lib/plattegrond/validate";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const catalogArg = args.find((a) => a.startsWith("--catalog="));
const files = args.filter((a) => !a.startsWith("--"));

if (files.length === 0) {
  console.error("Gebruik: npm run validate:plattegrond -- bestand.json [meer.json] [--catalog=pad.json]");
  process.exit(2);
}

const catalogPath = catalogArg ? catalogArg.slice("--catalog=".length) : path.join(root, "docs", "ai-item-catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as Catalog;
const lookup = catalogLookup(catalog);

let failed = false;
for (const file of files) {
  let issues;
  try {
    issues = validatePlattegrond(JSON.parse(readFileSync(file, "utf8")), lookup);
  } catch (cause) {
    issues = [{ severity: "error" as const, path: "(bestand)", message: `Kan niet lezen/parsen: ${(cause as Error).message}` }];
  }
  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  console.log(`${errors.length === 0 ? "OK  " : "FOUT"} ${file} — ${errors.length} fout(en), ${warnings.length} waarschuwing(en)`);
  for (const i of issues) console.log(`  ${i.severity === "error" ? "✗" : "!"} ${i.path}: ${i.message}`);
  if (errors.length > 0) failed = true;
}
process.exit(failed ? 1 : 0);
