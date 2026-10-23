// Audit van de collision-vormen van ALLE 3D-assets: laadt elk GLB, leidt de
// vorm af uit de echte zichtbare geometrie en vergelijkt die met wat de
// editor tot nu toe gebruikte (een gecentreerde box met de maten uit de
// database). Schrijft optioneel de gegenereerde profielen en het rapport.
//
//   npm run audit:collision                  rapport in de console (lokale bestanden)
//   npm run audit:collision -- --source=db   GLB's + maten zoals ze nu in Supabase staan
//   npm run audit:collision -- --write       ook collision-profiles.generated.ts en docs/collision-audit.md
//   npm run audit:collision -- --check       faalt als een asset FAIL is of het profiel verouderd is
//
// Tolerantie: afwijking > 2 cm of > 5% volume = FAIL (zie collision-shape.ts).

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  aabbDims,
  compareShapeToMesh,
  convexHull,
  footprintPolygons,
  legacyShape,
  resolveCollisionShape,
  shapeFromExtent,
  type CollisionShape,
  type MeshExtent,
  type Point,
  type ShapeComparison,
} from "@/components/canvas-3d/collision-shape";
import { COLLISION_OVERRIDES } from "@/components/canvas-3d/collision-overrides";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const IMPORT_DIR = path.join(ROOT, "materiaal-import");
const PROFILES_PATH = path.join(ROOT, "components", "canvas-3d", "collision-profiles.generated.ts");
const REPORT_PATH = path.join(ROOT, "docs", "collision-audit.md");

const TOL_M = 0.02;
const TOL_VOLUME_PCT = 5;
const ROTATIONS = [0, 30, 45, 90];

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const source = option("--source") ?? "local";
const only = option("--only")?.split(",");

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

type Asset = { slug: string; glb: Uint8Array; db: { length_m: number; width_m: number; height_m: number }; dbSource: string };

const round3 = (v: number) => Math.round(v * 1000) / 1000;

// ----------------------------------------------------------------------------
// Assets laden
// ----------------------------------------------------------------------------

async function importerDims(glb: Uint8Array, overrides: { length_m?: number; width_m?: number; height_m?: number }) {
  // Exact de berekening van scripts/import-materials.mts: bounds van de hele scene.
  const document = await io.readBinary(glb);
  const scene = document.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  const computed = { length_m: round3(max[0] - min[0]), width_m: round3(max[2] - min[2]), height_m: round3(max[1] - min[1]) };
  const hasAll = overrides.length_m !== undefined && overrides.width_m !== undefined && overrides.height_m !== undefined;
  return {
    dims: hasAll
      ? { length_m: overrides.length_m!, width_m: overrides.width_m!, height_m: overrides.height_m! }
      : { length_m: overrides.length_m ?? computed.length_m, width_m: overrides.width_m ?? computed.width_m, height_m: overrides.height_m ?? computed.height_m },
    computed,
  };
}

async function loadLocal(): Promise<Asset[]> {
  const files = (await readdir(IMPORT_DIR)).filter((f) => f.endsWith(".glb")).sort();
  const assets: Asset[] = [];
  for (const file of files) {
    const slug = file.replace(/\.glb$/, "");
    const glb = new Uint8Array(await readFile(path.join(IMPORT_DIR, file)));
    let overrides = {};
    try {
      overrides = JSON.parse(await readFile(path.join(IMPORT_DIR, `${slug}.json`), "utf8"));
    } catch {
      // geen overrides
    }
    const { dims } = await importerDims(glb, overrides);
    assets.push({ slug, glb, db: dims, dbSource: "lokaal (importer-berekening)" });
  }
  return assets;
}

async function loadFromDb(): Promise<Asset[]> {
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig voor --source=db.");
  const supabase = createClient(url, key);
  const { data, error } = await supabase.from("material_models").select("slug, model_path, length_m, width_m, height_m").order("slug");
  if (error) throw error;
  const assets: Asset[] = [];
  for (const row of data ?? []) {
    const response = await fetch(`${url}/storage/v1/object/public/materials-3d/${row.model_path}`);
    if (!response.ok) {
      console.warn(`Overgeslagen: ${row.slug} (${response.status})`);
      continue;
    }
    assets.push({
      slug: row.slug,
      glb: new Uint8Array(await response.arrayBuffer()),
      db: { length_m: Number(row.length_m), width_m: Number(row.width_m), height_m: Number(row.height_m) },
      dbSource: "Supabase",
    });
  }
  return assets;
}

// ----------------------------------------------------------------------------
// Zichtbare geometrie uit het GLB (vertex-nauwkeurig, in de ruimte van het item)
// ----------------------------------------------------------------------------

type Mat = number[];
const IDENTITY: Mat = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function multiply(a: Mat, b: Mat): Mat {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
}

type Diagnostics = {
  meshNodes: number;
  emptyLeaves: number;
  nonUniformScale: number;
  shear: number;
  skinned: number;
  instanced: number;
  sunkOrFloating: boolean;
};

async function extractExtent(glb: Uint8Array): Promise<{ extent: MeshExtent; diagnostics: Diagnostics; vertexCount: number }> {
  const document = await io.readBinary(glb);
  const scene = document.getRoot().listScenes()[0];
  const diagnostics: Diagnostics = { meshNodes: 0, emptyLeaves: 0, nonUniformScale: 0, shear: 0, skinned: 0, instanced: 0, sunkOrFloating: false };
  const hullPoints: Point[] = [];
  let minY = Infinity;
  let maxY = -Infinity;
  let vertexCount = 0;

  const visit = (node: ReturnType<typeof scene.listChildren>[number], parent: Mat) => {
    const world = multiply(parent, node.getMatrix() as Mat);
    const scale = node.getScale() as number[];
    if (Math.max(...scale.map(Math.abs)) / Math.max(Math.min(...scale.map(Math.abs)), 1e-9) > 1.001) diagnostics.nonUniformScale++;
    const columns = [0, 1, 2].map((c) => [world[c * 4], world[c * 4 + 1], world[c * 4 + 2]]);
    const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(dot(columns[i], columns[j])) / (Math.sqrt(dot(columns[i], columns[i])) * Math.sqrt(dot(columns[j], columns[j])) + 1e-12) > 0.01) {
        diagnostics.shear++;
        break;
      }
    }
    const mesh = node.getMesh();
    if (mesh) {
      diagnostics.meshNodes++;
      if (node.getSkin()) diagnostics.skinned++;
      if (node.getExtension("EXT_mesh_gpu_instancing")) diagnostics.instanced++;
      const local: Point[] = [];
      const vertex = [0, 0, 0];
      for (const primitive of mesh.listPrimitives()) {
        const position = primitive.getAttribute("POSITION");
        if (!position) continue;
        for (let i = 0; i < position.getCount(); i++) {
          position.getElement(i, vertex);
          const x = world[0] * vertex[0] + world[4] * vertex[1] + world[8] * vertex[2] + world[12];
          const y = world[1] * vertex[0] + world[5] * vertex[1] + world[9] * vertex[2] + world[13];
          const z = world[2] * vertex[0] + world[6] * vertex[1] + world[10] * vertex[2] + world[14];
          local.push({ x, z });
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          vertexCount++;
        }
      }
      // Per mesh de hull nemen houdt het geheugen klein.
      hullPoints.push(...convexHull(local));
    } else if (node.listChildren().length === 0) {
      diagnostics.emptyLeaves++;
    }
    for (const child of node.listChildren()) visit(child, world);
  };
  for (const node of scene.listChildren()) visit(node, IDENTITY);

  if (hullPoints.length === 0) throw new Error("Geen zichtbare geometrie");
  diagnostics.sunkOrFloating = Math.abs(minY) > 0.02;
  return { extent: { hull: convexHull(hullPoints), minY, maxY }, diagnostics, vertexCount };
}

// ----------------------------------------------------------------------------
// Beoordelen
// ----------------------------------------------------------------------------

function verdict(c: ShapeComparison): { pass: boolean; why: string[] } {
  const why: string[] = [];
  if (c.centerOffset > TOL_M) why.push(`middelpunt ${(c.centerOffset * 100).toFixed(1)} cm verschoven`);
  if (Math.abs(c.baseOffset) > TOL_M) why.push(`onderkant ${(c.baseOffset * 100).toFixed(1)} cm te laag/hoog`);
  const axes = ["lengte", "breedte", "hoogte"];
  c.sizeDelta.forEach((d, i) => {
    if (Math.abs(d) > TOL_M) why.push(`${axes[i]} ${d > 0 ? "+" : ""}${(d * 100).toFixed(1)} cm`);
  });
  if (Math.abs(c.volumeDeltaPct) > TOL_VOLUME_PCT) why.push(`volume ${c.volumeDeltaPct > 0 ? "+" : ""}${c.volumeDeltaPct.toFixed(0)}%`);
  if (c.protrudingPoints > 0) why.push(`mesh steekt buiten de vorm (${c.protrudingPoints} punten)`);
  return { pass: why.length === 0, why };
}

function causeOf(args: { before: ShapeComparison; db: Asset["db"]; precise: Asset["db"]; ideal: CollisionShape; diagnostics: Diagnostics }): string[] {
  const { before, db, precise, ideal, diagnostics } = args;
  const causes: string[] = [];
  if (Math.abs(before.baseOffset) > TOL_M) {
    causes.push(ideal.base_m > 0 ? `hangend/verhoogd (onderkant ${ideal.base_m.toFixed(2)} m)` : `onderkant onder de vloer (${ideal.base_m.toFixed(2)} m)`);
  }
  if (before.centerOffset > TOL_M) causes.push(`pivot niet gecentreerd (${(ideal.offset_x * 100).toFixed(0)}/${(ideal.offset_z * 100).toFixed(0)} cm)`);
  else if (before.centerOffset > 0.002 || before.protrudingPoints > 0) {
    causes.push(`pivot licht verschoven (${(ideal.offset_x * 100).toFixed(1)}/${(ideal.offset_z * 100).toFixed(1)} cm): mesh steekt buiten de gecentreerde box`);
  }
  if (Math.abs(ideal.yaw_deg) > 0.5) causes.push(`model schuin gemodelleerd (${ideal.yaw_deg.toFixed(1)}°)`);
  const dbOver = Math.max(db.length_m - precise.length_m, db.width_m - precise.width_m, db.height_m - precise.height_m);
  if (dbOver > TOL_M) causes.push(`importer-bounds te groot (+${(dbOver * 100).toFixed(0)} cm door geroteerde nodes)`);
  const dbUnder = Math.min(db.length_m - precise.length_m, db.width_m - precise.width_m, db.height_m - precise.height_m);
  if (dbUnder < -TOL_M) causes.push(`database-maat kleiner dan de mesh (${(dbUnder * 100).toFixed(0)} cm)`);
  if (diagnostics.nonUniformScale > 0) causes.push("niet-uniforme schaal in het GLB");
  if (diagnostics.shear > 0) causes.push("shear in de nodehiërarchie");
  if (diagnostics.skinned > 0) causes.push("skinned mesh");
  if (diagnostics.instanced > 0) causes.push("instanced mesh");
  return causes;
}

function suggestFix(causes: string[], ideal: CollisionShape): string {
  if (causes.length === 0) return "-";
  const fixes: string[] = [];
  if (causes.some((c) => c.startsWith("hangend") || c.startsWith("onderkant"))) fixes.push("base_m uit geometrie (automatisch)");
  if (causes.some((c) => c.startsWith("pivot"))) fixes.push("offset uit geometrie (automatisch); Blender: origin naar onderkant-midden");
  if (causes.some((c) => c.startsWith("model schuin"))) fixes.push(`oriented box (yaw ${ideal.yaw_deg.toFixed(1)}°); Blender: rotatie toepassen (Ctrl+A)`);
  if (causes.some((c) => c.startsWith("importer-bounds"))) fixes.push("maten uit echte vertices i.p.v. accessor-bounds");
  if (causes.some((c) => c.startsWith("database-maat"))) fixes.push("override met reden of GLB/maat corrigeren");
  if (causes.some((c) => c.includes("schaal") || c.includes("shear"))) fixes.push("Blender: Apply Scale (Ctrl+A)");
  return fixes.join("; ");
}

type Row = {
  slug: string;
  db: Asset["db"];
  precise: Asset["db"];
  ideal: CollisionShape;
  beforeShape: CollisionShape;
  afterShape: CollisionShape;
  before: ShapeComparison;
  after: ShapeComparison;
  beforeVerdict: { pass: boolean; why: string[] };
  afterVerdict: { pass: boolean; why: string[] };
  causes: string[];
  fix: string;
  overridden: boolean;
  aabbInflation45: number;
  scaleOk: boolean;
  diagnostics: Diagnostics;
  extent: MeshExtent;
};

function polygonArea(poly: Point[]) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p.x * q.z - q.x * p.z;
  }
  return Math.abs(s) / 2;
}

function scaleCheck(extent: MeshExtent): boolean {
  // Uniform 2× en niet-uniform (1.5, 1, 0.7): de afgeleide vorm van de geschaalde mesh moet
  // overeenkomen met de analytisch geschaalde vorm (alleen voor niet-gedraaide vormen).
  const base = shapeFromExtent(extent);
  if (Math.abs(base.yaw_deg) > 0.5) return true; // gedraaide vorm + niet-uniforme schaal = shear: niet ondersteund
  for (const [sx, sy, sz] of [[2, 2, 2], [1.5, 1, 0.7]]) {
    const scaled = shapeFromExtent({
      hull: extent.hull.map((p) => ({ x: p.x * sx, z: p.z * sz })),
      minY: extent.minY * sy,
      maxY: extent.maxY * sy,
    });
    if (Math.abs(scaled.length_m - base.length_m * sx) > 0.002 || Math.abs(scaled.width_m - base.width_m * sz) > 0.002 || Math.abs(scaled.height_m - base.height_m * sy) > 0.002) return false;
  }
  return true;
}

async function audit(assets: Asset[]): Promise<Row[]> {
  const rows: Row[] = [];
  for (const asset of assets) {
    if (only && !only.includes(asset.slug)) continue;
    const { extent, diagnostics } = await extractExtent(asset.glb);
    const ideal = shapeFromExtent(extent);
    const precise = aabbDims(extent);
    const preciseRounded = { length_m: round3(precise.length_m), width_m: round3(precise.width_m), height_m: round3(precise.height_m) };

    const beforeShape = legacyShape(asset.db);
    const override = COLLISION_OVERRIDES[asset.slug] ?? null;
    const afterShape = resolveCollisionShape({ db: asset.db, auto: { shape: ideal, aabb: preciseRounded }, override });

    // "Voor" en "na" worden beide tegen de echte mesh gemeten; een override mag bewust afwijken.
    const before = compareShapeToMesh(beforeShape, extent);
    const after = compareShapeToMesh(afterShape, extent);
    const beforeVerdict = verdict(before);
    const afterVerdict = override ? { pass: true, why: [`override: ${override.reason}`] } : verdict(after);

    const polygon = footprintPolygons(afterShape, 0, 0, 45)[0] ?? [];
    const aabbArea = polygon.length ? (() => {
      const xs = polygon.map((p) => p.x);
      const zs = polygon.map((p) => p.z);
      return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...zs) - Math.min(...zs));
    })() : 0;
    const causes = beforeVerdict.pass ? [] : causeOf({ before, db: asset.db, precise: preciseRounded, ideal, diagnostics });
    rows.push({
      slug: asset.slug,
      db: asset.db,
      precise: preciseRounded,
      ideal,
      beforeShape,
      afterShape,
      before,
      after,
      beforeVerdict,
      afterVerdict,
      causes,
      fix: suggestFix(causes, ideal),
      overridden: Boolean(override),
      aabbInflation45: polygon.length ? aabbArea / Math.max(polygonArea(polygon), 1e-9) : 1,
      scaleOk: scaleCheck(extent),
      diagnostics,
      extent,
    });
  }
  return rows;
}

// ----------------------------------------------------------------------------
// Rapport
// ----------------------------------------------------------------------------

const cm = (m: number) => (m * 100).toFixed(1);

function consoleTable(rows: Row[]) {
  const failing = rows.filter((r) => !r.beforeVerdict.pass);
  console.log(`\nAssets: ${rows.length} · VOOR: ${rows.length - failing.length} PASS, ${failing.length} FAIL · NA: ${rows.filter((r) => r.afterVerdict.pass).length} PASS, ${rows.filter((r) => !r.afterVerdict.pass).length} FAIL\n`);
  console.table(
    failing.map((r) => ({
      asset: r.slug,
      "offset cm (x,z)": `${cm(r.ideal.offset_x)}, ${cm(r.ideal.offset_z)}`,
      "onderkant cm": cm(r.ideal.base_m),
      yaw: r.ideal.yaw_deg.toFixed(1),
      voor: "FAIL",
      na: r.afterVerdict.pass ? "PASS" : "FAIL",
      oorzaak: r.causes.join("; "),
    })),
  );
}

function causeCounts(rows: Row[]) {
  const counts = new Map<string, number>();
  for (const row of rows) for (const cause of new Set(row.causes.map((c) => c.replace(/\(.*\)/, "").trim()))) counts.set(cause, (counts.get(cause) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function markdownReport(rows: Row[]): string {
  const failing = rows.filter((r) => !r.beforeVerdict.pass);
  const lines: string[] = [];
  lines.push("# Collision-audit 3D-assets", "");
  lines.push("Gegenereerd door `npm run audit:collision -- --write` (scripts/audit-collision.mts). Niet met de hand bewerken.", "");
  lines.push(`Tolerantie: afwijking > ${TOL_M * 100} cm of > ${TOL_VOLUME_PCT}% volume = FAIL. Bron database-maten: ${source === "db" ? "Supabase" : "lokale importer-berekening"}.`, "");
  lines.push("## Samenvatting", "");
  lines.push("| | Voor (oude box uit de database) | Na (vorm uit geometrie + overrides) |", "|---|---|---|");
  lines.push(`| PASS | ${rows.length - failing.length} | ${rows.filter((r) => r.afterVerdict.pass).length} |`);
  lines.push(`| FAIL | ${failing.length} | ${rows.filter((r) => !r.afterVerdict.pass).length} |`);
  lines.push(`| Totaal | ${rows.length} | ${rows.length} |`, "");
  lines.push("### Oorzaken (voor), aantal assets", "");
  for (const [cause, count] of causeCounts(rows)) lines.push(`- ${cause}: ${count}`);
  lines.push("", `Assets met overrides: ${rows.filter((r) => r.overridden).map((r) => `\`${r.slug}\``).join(", ") || "geen"}.`, "");
  const noScale = rows.filter((r) => !r.scaleOk);
  lines.push(`Schaaltest (uniform 2× en 1,5/1/0,7): ${noScale.length === 0 ? "alle assets OK" : `afwijkend: ${noScale.map((r) => r.slug).join(", ")}`}.`, "");
  const inflation = rows.filter((r) => r.aabbInflation45 > 1.1);
  lines.push(`Een world-AABB (oude aanpak) is bij 45° rotatie gemiddeld ${(rows.reduce((s, r) => s + r.aabbInflation45, 0) / rows.length).toFixed(2)}× zo groot als de oriented box; ${inflation.length} assets > 10% groter.`, "");
  lines.push("## Assets die VOOR de fix FAIL waren", "");
  lines.push("| Asset | Voor | Na | Oorzaak | Fix |", "|---|---|---|---|---|");
  for (const r of failing) {
    lines.push(`| \`${r.slug}\` | FAIL (${r.beforeVerdict.why.join(", ")}) | ${r.afterVerdict.pass ? "PASS" : "FAIL"}${r.overridden ? " (override)" : ""} | ${r.causes.join("; ")} | ${r.fix} |`);
  }
  lines.push("", "## Alle assets", "", "| Asset | Voor | Na | Maten na (l×b×h cm) | Offset x,z (cm) | Onderkant (cm) | Yaw |", "|---|---|---|---|---|---|---|");
  for (const r of rows) {
    const s = r.afterShape;
    lines.push(`| \`${r.slug}\` | ${r.beforeVerdict.pass ? "PASS" : "FAIL"} | ${r.afterVerdict.pass ? "PASS" : "FAIL"} | ${cm(s.length_m)}×${cm(s.width_m)}×${cm(s.height_m)} | ${cm(s.offset_x)}, ${cm(s.offset_z)} | ${cm(s.base_m)} | ${s.yaw_deg.toFixed(1)}° |`);
  }
  lines.push("");
  return lines.join("\n");
}

function profilesSource(rows: Row[]): string {
  const entries = rows
    .map((r) => {
      const s = r.ideal;
      return `  ${r.slug}: { shape: { length_m: ${s.length_m}, width_m: ${s.width_m}, height_m: ${s.height_m}, offset_x: ${s.offset_x}, offset_z: ${s.offset_z}, base_m: ${s.base_m}, yaw_deg: ${s.yaw_deg} }, aabb: { length_m: ${r.precise.length_m}, width_m: ${r.precise.width_m}, height_m: ${r.precise.height_m} } },`;
    })
    .join("\n");
  return `// GEGENEREERD door scripts/audit-collision.mts (npm run audit:collision -- --write)
// uit de zichtbare geometrie van de GLB's. Niet met de hand bewerken: voor
// uitzonderingen zie collision-overrides.ts.

export type CollisionProfile = {
  shape: { length_m: number; width_m: number; height_m: number; offset_x: number; offset_z: number; base_m: number; yaw_deg: number };
  /** Axis-aligned maten van de zichtbare geometrie (om bewuste maatcorrecties in de database te herkennen). */
  aabb: { length_m: number; width_m: number; height_m: number };
};

export const COLLISION_PROFILES: Record<string, CollisionProfile> = {
${entries}
};
`;
}

const assets = source === "db" ? await loadFromDb() : await loadLocal();
const rows = await audit(assets);
consoleTable(rows);
console.log("Oorzaken (voor):", causeCounts(rows).map(([c, n]) => `${c}: ${n}`).join(" | "));

if (flag("--write")) {
  await writeFile(PROFILES_PATH, profilesSource(rows));
  await writeFile(REPORT_PATH, markdownReport(rows));
  console.log(`\nGeschreven: ${path.relative(ROOT, PROFILES_PATH)}, ${path.relative(ROOT, REPORT_PATH)}`);
}
if (flag("--json")) await writeFile(path.join(ROOT, "audit-collision.json"), JSON.stringify(rows.map(({ extent, ...rest }) => rest), null, 1));
if (flag("--check") && rows.some((r) => !r.afterVerdict.pass)) {
  console.error("\nFAIL: er zijn assets zonder passende vorm of override.");
  process.exit(1);
}
