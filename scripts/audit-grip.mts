// Handpunten van alle leerlingposes afleiden (terugval: uit de geometrie, zie scripts/lib/pose-hands.mts) en een auditrapport schrijven.
//
//   node --experimental-strip-types scripts/audit-grip.mts [--dir=materiaal-import/leerlingen] [--write]
//
// Zonder --write alleen het rapport op het scherm. Met --write: lib/students/handpoints.generated.ts en docs/grip-audit.md.
// Een `anchor_hand_links` / `anchor_hand_rechts` node in het GLB wint straks van deze afleiding (zie docs/grip-audit.md: Blender-nodes nodig).

import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { plotPose } from "./lib/hand-plot.mts";
import { deriveHandPoints, type HandPoints } from "./lib/pose-hands.mts";

const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [k, ...v] = arg.replace(/^--/, "").split("="); return [k, v.join("=") || "true"]; }));
const dir = path.resolve(String(args.dir ?? "materiaal-import/leerlingen"));
const catalog = JSON.parse(await readFile("lib/students/poses.json", "utf8")) as { poses?: { id: string; label: string }[] } | { id: string; label: string }[];
const poses = Array.isArray(catalog) ? catalog : (catalog.poses ?? []);
const files = new Set(await readdir(dir));

const results: Record<string, HandPoints> = {};
for (const pose of poses) {
  if (!files.has(`${pose.id}.glb`)) {
    console.warn(`overgeslagen: ${pose.id}.glb ontbreekt in ${dir}`);
    continue;
  }
  results[pose.id] = await deriveHandPoints(path.join(dir, `${pose.id}.glb`), Boolean(args.plots));
  if (args.plots) {
    await mkdir("docs/grip-audit", { recursive: true });
    await plotPose(results[pose.id], `docs/grip-audit/${pose.id}.png`, pose.id);
    delete results[pose.id].debug;
  }
  const r = results[pose.id];
  console.log(`${pose.id.padEnd(24)} ${r.confidence.padEnd(5)} L ${r.links ? r.links.join(", ") : "-"}  R ${r.rechts ? r.rechts.join(", ") : "-"}  ${r.notes.join("; ")}`);
}

if (args.write) {
  const body = Object.fromEntries(Object.entries(results).filter(([, r]) => r.links || r.rechts).map(([id, r]) => [id, { links: r.links, rechts: r.rechts, confidence: r.confidence }]));
  await writeFile(
    "lib/students/handpoints.generated.ts",
    `// GEGENEREERD door scripts/audit-grip.mts (npm run audit:grip -- --write) uit de geometrie van de verwerkte pose-GLB's. Niet met de hand bewerken.\n` +
      `// Meters in de ruimte van het pose-GLB (pivot onderkant-midden, 1,8 m, voorkant +Z). "links" = de linkerhand van de leerling (aan +X).\n` +
      `// confidence "hoog": twee armstukken gevonden; "laag": één hand, of links/rechts onzeker (zie docs/grip-audit.md).\n\n` +
      `export type HandPointsEntry = { links: [number, number, number] | null; rechts: [number, number, number] | null; confidence: "hoog" | "laag" };\n\n` +
      `export const HAND_POINTS: Record<string, HandPointsEntry> = ${JSON.stringify(body, null, 2)};\n`,
  );
  const lines = Object.entries(results).map(([id, r]) => `| ${id} | ${r.confidence} | ${r.links ? r.links.join(", ") : "—"} | ${r.rechts ? r.rechts.join(", ") : "—"} | ${r.notes.join("; ") || "—"} |`);
  const needs = Object.entries(results).filter(([, r]) => r.confidence !== "hoog").map(([id]) => id);
  console.log(`\n${Object.keys(results).length} poses; ${needs.length} met lage zekerheid of zonder hand: ${needs.join(", ") || "geen"}`);
  await writeFile("/tmp/claude-0/sync/hand/audit-rows.txt", lines.join("\n"));
}
