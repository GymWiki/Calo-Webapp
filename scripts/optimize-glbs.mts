// Verkleint GLB's voor mobiel: Meshopt-compressie van de geometrie, textures als WebP
// (max. 1024 px), dubbele data en ongebruikte onderdelen eruit. De app laadt dit zonder
// aanpassing (drei's useGLTF decodeert Meshopt; three ondersteunt EXT_texture_webp).
//
//   node --experimental-strip-types scripts/optimize-glbs.mts [--dir=materiaal-import] [--out=<map>] [--only=slug1,slug2] [--report=pad.md]
//
// Zonder --out is het een dry-run: alleen meten wat het scheelt. Met --out komen de
// geoptimaliseerde bestanden in die map (de originelen blijven onaangeroerd). Dit script uploadt
// NIETS: controleer eerst visueel en zet ze daarna met `npm run import:materials` in Supabase.

import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=") || "true"];
  }),
);
const dir = path.resolve(String(args.dir ?? "materiaal-import"));
const outDir = args.out ? path.resolve(String(args.out)) : null;
const only = args.only ? new Set(String(args.only).split(",")) : null;

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

const files = (await readdir(dir)).filter((name) => name.endsWith(".glb") && (!only || only.has(name.replace(/\.glb$/, "")))).sort();
if (outDir) await mkdir(outDir, { recursive: true });

type Row = { slug: string; before: number; after: number };
const rows: Row[] = [];

for (const name of files) {
  const source = path.join(dir, name);
  const before = (await stat(source)).size;
  const document = await io.read(source);
  await document.transform(
    dedup(),
    prune(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [1024, 1024], quality: 85 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  const bytes = await io.writeBinary(document);
  if (outDir) await writeFile(path.join(outDir, name), bytes);
  rows.push({ slug: name.replace(/\.glb$/, ""), before, after: bytes.byteLength });
}

const mb = (n: number) => (n / 1048576).toFixed(2);
const totalBefore = rows.reduce((sum, row) => sum + row.before, 0);
const totalAfter = rows.reduce((sum, row) => sum + row.after, 0);
const worst = [...rows].sort((a, b) => b.after - a.after).slice(0, 8);
const biggestWin = [...rows].sort((a, b) => b.before - b.after - (a.before - a.after)).slice(0, 8);

const lines = [
  `# GLB-optimalisatie (${outDir ? "geschreven naar " + path.relative(process.cwd(), outDir) : "dry-run"})`,
  "",
  `${rows.length} bestanden: ${mb(totalBefore)} MB → ${mb(totalAfter)} MB (−${(100 * (1 - totalAfter / totalBefore)).toFixed(0)}%).`,
  "",
  "| Grootste na optimalisatie | Voor | Na |",
  "| --- | ---: | ---: |",
  ...worst.map((row) => `| ${row.slug} | ${mb(row.before)} MB | ${mb(row.after)} MB |`),
  "",
  "| Grootste winst | Voor | Na |",
  "| --- | ---: | ---: |",
  ...biggestWin.map((row) => `| ${row.slug} | ${mb(row.before)} MB | ${mb(row.after)} MB |`),
  "",
];
console.log(lines.join("\n"));
if (args.report) await writeFile(path.resolve(String(args.report)), lines.join("\n"), "utf8");
