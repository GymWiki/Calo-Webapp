// Verwerkt de leerling-poses uit de Drive (Blender/Tripo-exports) tot lichte, uniforme GLB's voor de 3D-editor.
//
//   node --experimental-strip-types scripts/process-students.mts [--src=<map>] [--out=<map>] [--tris=6000] [--tex=512] [--thumbs]
//
// Bron: een lokale map met de GLB's uit de Drive (standaard materiaal-import/leerlingen-bron/), de poses staan in
// lib/students/poses.json (id, label, sporten, bestandsnaam). Per pose:
//   - pivot = onderkant-midden van de VOETAFDRUK van het lichaam (percentielen, dus een hockeystick of racket verschuift
//     het middelpunt niet), voorkant +Z, schaal 1 = meter (de modellen zijn 1,8 m; de editor schaalt naar klein/middel/groot);
//   - geometrie versimpeld tot ±--tris driehoeken (UV-naden blijven dicht), textures: alleen de kleurtexture, WebP, --tex px
//     (normal/metallic-roughness vervallen: met zo weinig driehoeken tonen ze niets meer), Meshopt-gecomprimeerd;
//   - collision-maten (lichaam, niet de uitstekende uitrusting) naar lib/students/poses.generated.json.
// Uitvoer in --out (standaard materiaal-import/leerlingen/): <id>.glb en, met --thumbs, <id>.png (via headless Chromium).
// Dit script schrijft NIETS naar Supabase. Uploaden doe je zelf met `npm run upload:students` (zie docs/students.md).

import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { NodeIO, getBounds, type Document, type Node } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";
import { renderThumbnails } from "./lib/student-thumbnails.mts";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=") || "true"];
  }),
);
const srcDir = path.resolve(String(args.src ?? "materiaal-import/leerlingen-bron"));
const outDir = path.resolve(String(args.out ?? "materiaal-import/leerlingen"));
const targetTris = Number(args.tris ?? 6000);
const texSize = Number(args.tex ?? 512);
const only = args.only ? new Set(String(args.only).split(",")) : null;

type PoseConfig = { id: string; label: string; sporten: string[]; file: string; sort?: number };
const catalog = JSON.parse(await readFile("lib/students/poses.json", "utf8")) as { poses: PoseConfig[] };

await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder });

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
}

/** Alle vertexposities in wereldcoördinaten (transforms toegepast), x/z/y apart. */
function worldVertices(document: Document): { xs: number[]; ys: number[]; zs: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const zs: number[] = [];
  const visit = (node: Node) => {
    const mesh = node.getMesh();
    if (mesh) {
      const m = node.getWorldMatrix();
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute("POSITION");
        if (!position) continue;
        const v = [0, 0, 0];
        for (let i = 0; i < position.getCount(); i++) {
          position.getElement(i, v);
          xs.push(m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12]);
          ys.push(m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13]);
          zs.push(m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14]);
        }
      }
    }
    node.listChildren().forEach(visit);
  };
  document.getRoot().getDefaultScene()!.listChildren().forEach(visit);
  return { xs, ys, zs };
}

function triangleCount(document: Document): number {
  let tris = 0;
  for (const mesh of document.getRoot().listMeshes())
    for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION")!.getCount()) / 3;
  return Math.round(tris);
}

await mkdir(outDir, { recursive: true });
const generated: Record<string, unknown> = {};
const rows: string[] = [];

for (const pose of catalog.poses) {
  if (only && !only.has(pose.id)) continue;
  const source = path.join(srcDir, pose.file);
  try {
    await stat(source);
  } catch {
    console.warn(`OVERGESLAGEN ${pose.id}: ${pose.file} niet gevonden in ${srcDir}`);
    continue;
  }
  const before = (await stat(source)).size;
  const document = await io.read(source);
  const root = document.getRoot();
  if (root.listSkins().length > 0) throw new Error(`${pose.file} heeft een skin: bak de pose eerst (scripts/blender/bake-pose.py).`);
  const trisBefore = triangleCount(document);

  // Pivot: onderkant-midden van de lichaamsvoetafdruk (10e–90e percentiel van x en z).
  const { xs, ys, zs } = worldVertices(document);
  const sx = [...xs].sort((a, b) => a - b);
  const sz = [...zs].sort((a, b) => a - b);
  const x0 = percentile(sx, 0.1);
  const x1 = percentile(sx, 0.9);
  const z0 = percentile(sz, 0.1);
  const z1 = percentile(sz, 0.9);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const minY = Math.min(...ys);
  for (const node of root.getDefaultScene()!.listChildren()) {
    const t = node.getTranslation();
    node.setTranslation([t[0] - cx, t[1] - minY, t[2] - cz]);
  }

  await document.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, targetTris / trisBefore), error: 0.01 }),
    dedup(),
    prune(),
  );
  // Eén kleurtexture, geen normal/metallic-roughness: lichte, matte stof/huid.
  for (const material of root.listMaterials()) {
    material.setNormalTexture(null).setMetallicRoughnessTexture(null).setOcclusionTexture(null).setEmissiveTexture(null);
    material.setMetallicFactor(0).setRoughnessFactor(0.85).setDoubleSided(false);
  }
  await document.transform(
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [texSize, texSize], quality: 82 }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );

  const bounds = getBounds(root.getDefaultScene()!);
  const height = bounds.max[1] - bounds.min[1];
  const bytes = await io.writeBinary(document);
  await writeFile(path.join(outDir, `${pose.id}.glb`), bytes);
  const body = { length_m: Math.max(0.35, +(x1 - x0).toFixed(3)), width_m: Math.max(0.3, +(z1 - z0).toFixed(3)), height_m: +height.toFixed(3) };
  generated[pose.id] = { ...body, tris: triangleCount(document), bytes: bytes.byteLength, version: createHash("sha1").update(bytes).digest("hex").slice(0, 8) };
  rows.push(`${pose.id.padEnd(22)} ${(before / 1024).toFixed(0).padStart(6)} KB → ${(bytes.byteLength / 1024).toFixed(0).padStart(4)} KB   ${trisBefore} → ${triangleCount(document)} driehoeken   ${body.length_m}×${body.width_m}×${body.height_m} m`);
}

console.log(rows.join("\n"));
if (!only) await writeFile("lib/students/poses.generated.json", JSON.stringify(generated, null, 2) + "\n");
else console.log("(--only: poses.generated.json niet bijgewerkt)");
if (args.thumbs) await renderThumbnails(outDir, Object.keys(generated));
