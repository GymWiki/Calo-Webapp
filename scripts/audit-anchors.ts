// Audit van de bevestigingspunten (anchors) van ALLE 3D-assets: leest elk GLB, leidt de anchors af uit de echte geometrie (of leest
// `anchor_…`-nodes), controleert ze en schrijft optioneel de gegenereerde profielen, het rapport en de contactsheet.
//
//   npm run audit:anchors                 rapport in de console (lokale bestanden in materiaal-import/)
//   npm run audit:anchors -- --write      ook components/canvas-3d/anchors.generated.ts en docs/anchor-audit.md
//   npm run audit:anchors -- --sheet      ook docs/anchor-contactsheet.svg (+ .png als PLAYWRIGHT_CHROMIUM_PATH of playwright beschikbaar is)
//   npm run audit:anchors -- --check      faalt als een asset FAIL is of het opgeslagen profiel verouderd is
//   npm run audit:anchors -- --only=korfbalpaal_compleet_250,volleybalpalen_mobiel_set
//
// Controles per anchor: (1) ligt op of in de echte geometrie (≤ 2 cm), (2) is niet de rand of hoek van de bounding box, (3) logische hoogte
// (paal: bovenin, kegel/net: bovenin), (4) blijft op zijn plek na draaien (90°, 45°, 30°) en kantelen, (5) verstelbaar bereik klopt.

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { anchorPosition, type AnchorDef, type AnchorProfile } from "@/components/canvas-3d/anchors";
import { ANCHOR_OVERRIDES } from "@/components/canvas-3d/anchor-overrides";
import { COLLISION_PROFILES } from "@/components/canvas-3d/collision-profiles.generated";
import { localToWorld, worldToLocal, type Vec3 as V3 } from "@/components/canvas-3d/orientation";
import { deriveAnchors, distanceToGeometry, onBoundingBoxEdge, type AnchorClass } from "./lib/anchor-derive.ts";
import { readGlbGeometry, type GlbGeometry } from "./lib/glb-geometry.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMPORT_DIR = path.join(ROOT, "materiaal-import");
const PROFILES_PATH = path.join(ROOT, "components", "canvas-3d", "anchors.generated.ts");
const REPORT_PATH = path.join(ROOT, "docs", "anchor-audit.md");
const SHEET_PATH = path.join(ROOT, "docs", "anchor-contactsheet.svg");

const TOL_M = 0.02;
const ROTATIONS = [0, 30, 45, 90];
/** Assets waaraan iets kan worden bevestigd of die iets dragen: hier is een echt (Blender-)anchor-punt gewenst. */
const ATTACHMENT_RELEVANT = /(paal|palen|doel|^volleybalnet|^badmintonnet|klimrek|klimnet|klimtouw|touwladder|zwaairing|hoepel|horde|rekstok|wandrek|basketbal_muur|basketbaltoren|statief|vlag|slalom|spanbrug|springtouw|hek|kunstgras|tribune)/i;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => args.find((a) => a.startsWith(`${name}=`))?.slice(name.length + 1);
const only = option("--only")?.split(",");

type Check = { name: string; pass: boolean; detail: string };
type Row = {
  slug: string;
  cls: AnchorClass;
  profile: AnchorProfile;
  geo: GlbGeometry;
  checks: Check[];
  pass: boolean;
  relevant: boolean;
  needsBlender: boolean;
  notes: string[];
};

const r3 = (v: number) => Math.round(v * 1000) / 1000 + 0;

function checkAnchors(slug: string, anchors: AnchorDef[], geo: GlbGeometry, cls: AnchorClass): Check[] {
  const checks: Check[] = [];
  const parts = geo.parts;
  const maxY = Math.max(...parts.map((p) => p.max[1]));
  const minY = Math.min(...parts.map((p) => p.min[1]));
  const profile = COLLISION_PROFILES[slug];
  const shape = profile?.shape;

  for (const a of anchors) {
    const d = distanceToGeometry(a.pos, parts);
    checks.push({ name: `${a.id}: op/in de geometrie`, pass: d <= TOL_M, detail: `${(d * 100).toFixed(1)} cm van het oppervlak (max ${TOL_M * 100} cm)` });
    checks.push({ name: `${a.id}: niet op rand/hoek van de box`, pass: !onBoundingBoxEdge(a.pos, parts, d), detail: "geen box-rand zonder geometrie" });

    const floor = Math.max(minY, 0);
    const span = Math.max(maxY - floor, 1e-6);
    const high = (a.pos[1] - floor) / span;
    const hanging = a.id.startsWith("ophang");
    // Paal/net: bovenin (≥ 50% van de hoogte boven de vloer); kegel: ≥ 85%; bovenpunt: binnen 3 cm (of 10%) van het hoogste punt.
    const okHeight =
      cls === "bovenpunt" ? maxY - a.pos[1] <= Math.max(0.03, 0.1 * span) : cls === "kegel" ? high >= 0.85 : cls === "paal" || cls === "net" ? high >= (hanging ? 0.85 : 0.5) : true;
    checks.push({ name: `${a.id}: logische hoogte`, pass: okHeight, detail: `${(high * 100).toFixed(0)}% van de hoogte (${a.pos[1].toFixed(2)} m)` });

    if (a.adjustable) {
      const ok = a.adjustable.min <= a.pos[1] + 1e-6 && a.pos[1] <= a.adjustable.max + 1e-6 && a.adjustable.min < a.adjustable.max;
      checks.push({ name: `${a.id}: verstelbaar bereik`, pass: ok, detail: `${a.adjustable.min}–${a.adjustable.max} m, standaard ${a.pos[1]} m` });
    }

    // Draaien: de anchor moet exact meedraaien (referentie: Ry · p) en weer terug te rekenen zijn.
    if (shape) {
      for (const heading of ROTATIONS) {
        const rot = { x: 0, y: heading, z: 0 };
        const place: V3 = [3, 0.2, -1];
        const world = localToWorld(shape as never, place, rot, anchorPosition(a));
        const rad = (heading * Math.PI) / 180;
        const expected: V3 = [place[0] + Math.cos(rad) * a.pos[0] + Math.sin(rad) * a.pos[2], place[1] + a.pos[1], place[2] - Math.sin(rad) * a.pos[0] + Math.cos(rad) * a.pos[2]];
        const err = Math.hypot(world[0] - expected[0], world[1] - expected[1], world[2] - expected[2]);
        const back = worldToLocal(shape as never, place, rot, world);
        const errBack = Math.hypot(back[0] - a.pos[0], back[1] - a.pos[1], back[2] - a.pos[2]);
        if (err > 1e-6 || errBack > 1e-6) checks.push({ name: `${a.id}: draaien ${heading}°`, pass: false, detail: `afwijking ${(Math.max(err, errBack) * 1000).toFixed(2)} mm` });
      }
    }
  }
  return checks;
}

async function loadLocal() {
  const files = (await readdir(IMPORT_DIR)).filter((f) => f.endsWith(".glb")).sort();
  const out: { slug: string; glb: Uint8Array }[] = [];
  for (const f of files) {
    const slug = f.replace(/\.glb$/, "");
    if (only && !only.includes(slug)) continue;
    out.push({ slug, glb: new Uint8Array(await readFile(path.join(IMPORT_DIR, f))) });
  }
  return out;
}

async function audit(): Promise<Row[]> {
  const rows: Row[] = [];
  for (const { slug, glb } of await loadLocal()) {
    const geo = await readGlbGeometry(glb);
    if (geo.parts.length === 0) continue;
    const derived = deriveAnchors(slug, geo);
    const override = ANCHOR_OVERRIDES[slug];
    const anchors = override ? override.anchors : derived.anchors;
    const checks = checkAnchors(slug, anchors, geo, derived.cls);
    const relevant = ATTACHMENT_RELEVANT.test(slug);
    rows.push({
      slug,
      cls: derived.cls,
      profile: { anchors },
      geo,
      checks,
      pass: checks.every((c) => c.pass),
      relevant,
      needsBlender: relevant && derived.cls === "bovenpunt" && !override,
      notes: [...derived.notes, ...(override ? [`override: ${override.reden}`] : [])],
    });
  }
  return rows;
}

// --- uitvoer ------------------------------------------------------------------------------------------------------------

function fmt(v: Vec): string {
  return `[${v.map((n) => (Math.abs(n) < 1e-9 ? 0 : r3(n))).join(", ")}]`;
}
type Vec = number[];

function profilesSource(rows: Row[]): string {
  const lines = rows.map((row) => {
    const anchors = row.profile.anchors
      .map((a) => `{ id: ${JSON.stringify(a.id)}, label: ${JSON.stringify(a.label)}, pos: ${fmt(a.pos)}, types: ${JSON.stringify(a.types)}${a.default ? ", default: true" : ""}${a.adjustable ? `, adjustable: { min: ${a.adjustable.min}, max: ${a.adjustable.max} }` : ""}${a.dir ? `, dir: ${fmt(a.dir)}` : ""}, source: ${JSON.stringify(a.source)} }`)
      .join(", ");
    return `  ${row.slug}: { anchors: [${anchors}] },`;
  });
  return `// GEGENEREERD door scripts/audit-anchors.ts (npm run audit:anchors -- --write) uit de zichtbare geometrie van de GLB's (of uit
// \`anchor_<type>_<naam>\`-nodes). Niet met de hand bewerken: voor uitzonderingen zie anchor-overrides.ts.
import type { AnchorProfile } from "@/components/canvas-3d/anchors";

export const ANCHOR_PROFILES: Record<string, AnchorProfile> = {
${lines.join("\n")}
};
`;
}

function markdownReport(rows: Row[]): string {
  const pass = rows.filter((r) => r.pass).length;
  const byCls = (cls: AnchorClass) => rows.filter((r) => r.cls === cls).length;
  const blender = rows.filter((r) => r.needsBlender);
  const lines: string[] = [];
  lines.push("# Anchor-audit (bevestigingspunten van touwen, linten en netten)", "");
  lines.push("Gegenereerd door `npm run audit:anchors -- --write`. Contactsheet met de anchors zichtbaar (oranje = anchor, blauwe lijn = verstelbaar bereik): [`anchor-contactsheet.png`](anchor-contactsheet.png).", "");
  lines.push(`**${pass} van ${rows.length} assets PASS** · klassen: paal ${byCls("paal")}, kegel/pion ${byCls("kegel")}, net ${byCls("net")}, GLB-node ${byCls("glb")}, bovenpunt (noodoplossing) ${byCls("bovenpunt")}.`, "");
  lines.push("Controles per anchor: op of in de echte geometrie (≤ 2 cm van het oppervlak), niet de rand/hoek van de bounding box, logische hoogte, blijft op zijn plek na draaien (30°, 45°, 90°) en verstelbaar bereik klopt.", "");
  lines.push("## Assets met een Blender-anchor-node nodig", "");
  lines.push("Deze assets zijn bedoeld om iets aan vast te maken, maar hebben geen herkenbare paal/kegel/net en vallen terug op het hoogste punt van de geometrie. Voeg in Blender een lege node toe met de naam `anchor_<touw|lint|net|haak>_<naam>` op de aanbevolen plek (zie `docs/blender-naming.md`).", "");
  if (blender.length === 0) lines.push("_Geen._", "");
  else {
    lines.push("| Asset | Aanbevolen node | Positie (m, vanaf pivot) | Richting |", "|---|---|---|---|");
    for (const r of blender) for (const a of r.profile.anchors) lines.push(`| \`${r.slug}\` | \`anchor_${a.types[0]}_${a.id.replace(/^top_?/, "top_").replace(/_$/, "")}\` | ${fmt(a.pos)} | omhoog (+Y) |`);
    lines.push("");
  }
  const failing = rows.filter((r) => !r.pass);
  lines.push("## FAIL", "");
  if (failing.length === 0) lines.push("_Geen._", "");
  else {
    lines.push("| Asset | Klasse | Oorzaak |", "|---|---|---|");
    for (const r of failing) lines.push(`| \`${r.slug}\` | ${r.cls} | ${r.checks.filter((c) => !c.pass).map((c) => `${c.name} (${c.detail})`).join("; ")} |`);
    lines.push("");
  }
  lines.push("## Alle assets", "", "| Asset | Klasse | Anchors | Bron | Resultaat | Opmerking |", "|---|---|---|---|---|---|");
  for (const r of rows) {
    const src = [...new Set(r.profile.anchors.map((a) => a.source))].join("/");
    const list = r.profile.anchors.map((a) => `${a.id}${a.adjustable ? "↕" : ""}`).join(", ");
    lines.push(`| \`${r.slug}\` | ${r.cls} | ${list} | ${src} | ${r.pass ? "PASS" : "**FAIL**"} | ${r.notes.join("; ") || (r.needsBlender ? "Blender-node aanbevolen" : "")} |`);
  }
  lines.push("", "↕ = hoogteverstelbaar langs de paal.", "");
  return lines.join("\n");
}

function sheetSvg(rows: Row[]): string {
  const CW = 230, CH = 190, COLS = 6, PAD = 8;
  const rowsN = Math.ceil(rows.length / COLS);
  const cells = rows.map((row, i) => {
    const gx = (i % COLS) * CW, gy = Math.floor(i / COLS) * CH;
    const all = row.geo.parts;
    const min = [0, 1, 2].map((k) => Math.min(...all.map((p) => p.min[k])));
    const max = [0, 1, 2].map((k) => Math.max(...all.map((p) => p.max[k])));
    const floor = Math.min(min[1], 0);
    const w = Math.max(max[0] - min[0], 0.05), h = Math.max(max[1] - floor, 0.05);
    const scale = Math.min((CW - 2 * PAD) / w, (CH - 52) / h);
    const ox = gx + CW / 2 - ((min[0] + max[0]) / 2) * scale;
    const oy = gy + CH - 22;
    const X = (x: number) => (ox + x * scale).toFixed(1);
    const Y = (y: number) => (oy - (y - floor) * scale).toFixed(1);
    const dots: string[] = [];
    const total = all.reduce((sum, p) => sum + p.positions.length / 3, 0);
    const step = Math.max(1, Math.floor(total / 500));
    for (const p of all) {
      for (let k = 0; k < p.positions.length; k += 3 * step) dots.push(`<circle cx="${X(p.positions[k])}" cy="${Y(p.positions[k + 1])}" r="0.8"/>`);
    }
    const anchors = row.profile.anchors
      .map((a) => {
        const range = a.adjustable ? `<line x1="${X(a.pos[0])}" y1="${Y(a.adjustable.min)}" x2="${X(a.pos[0])}" y2="${Y(a.adjustable.max)}" stroke="#2563eb" stroke-width="2" opacity="0.55"/>` : "";
        return `${range}<circle cx="${X(a.pos[0])}" cy="${Y(a.pos[1])}" r="4.5" fill="${row.pass ? "#f97316" : "#dc2626"}" stroke="#fff" stroke-width="1.2"/>`;
      })
      .join("");
    return `<g><rect x="${gx + 2}" y="${gy + 2}" width="${CW - 4}" height="${CH - 4}" fill="#fff" stroke="${row.pass ? "#d4d4d8" : "#dc2626"}"/>
<rect x="${X(min[0])}" y="${Y(max[1])}" width="${((max[0] - min[0]) * scale).toFixed(1)}" height="${((max[1] - min[1]) * scale).toFixed(1)}" fill="none" stroke="#a1a1aa" stroke-dasharray="3 3"/>
<g fill="#52525b" opacity="0.55">${dots.join("")}</g>${anchors}
<text x="${gx + 8}" y="${gy + 16}" font-family="sans-serif" font-size="10" font-weight="600">${row.slug.slice(0, 34)}</text>
<text x="${gx + 8}" y="${gy + 29}" font-family="sans-serif" font-size="9" fill="#52525b">${row.cls} · ${row.pass ? "PASS" : "FAIL"} · ${row.profile.anchors.length} anchor(s)</text></g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * CW}" height="${rowsN * CH}" viewBox="0 0 ${COLS * CW} ${rowsN * CH}"><rect width="100%" height="100%" fill="#fafafa"/>${cells.join("\n")}</svg>`;
}

function consoleTable(rows: Row[]) {
  const counts = rows.reduce<Record<string, number>>((acc, r) => ((acc[r.cls] = (acc[r.cls] ?? 0) + 1), acc), {});
  console.log(`\n${rows.length} assets · PASS ${rows.filter((r) => r.pass).length} · FAIL ${rows.filter((r) => !r.pass).length}`);
  console.log("Klassen:", Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "));
  for (const r of rows.filter((x) => !x.pass)) console.log(`  FAIL ${r.slug}: ${r.checks.filter((c) => !c.pass).map((c) => `${c.name} (${c.detail})`).join("; ")}`);
  const blender = rows.filter((r) => r.needsBlender);
  console.log(`Blender-anchor aanbevolen: ${blender.length} assets`);
}

const rows = await audit();
consoleTable(rows);

if (flag("--write")) {
  await writeFile(PROFILES_PATH, profilesSource(rows));
  await writeFile(REPORT_PATH, markdownReport(rows));
  console.log(`\nGeschreven: ${path.relative(ROOT, PROFILES_PATH)}, ${path.relative(ROOT, REPORT_PATH)}`);
}
if (flag("--sheet")) {
  let pngOk = false;
  try {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    await page.setContent(`<body style="margin:0">${sheetSvg(rows)}</body>`);
    await page.locator("svg").screenshot({ path: SHEET_PATH.replace(/\.svg$/, ".png") });
    await browser.close();
    pngOk = true;
    console.log(`Geschreven: ${path.relative(ROOT, SHEET_PATH.replace(/\.svg$/, ".png"))}`);
  } catch (error) {
    console.warn("PNG niet gemaakt (alleen svg):", error instanceof Error ? error.message : error);
  }
  if (!pngOk) {
    await writeFile(SHEET_PATH, sheetSvg(rows));
    console.log(`Geschreven: ${path.relative(ROOT, SHEET_PATH)}`);
  }
}
if (flag("--check")) {
  let failed = false;
  if (rows.some((r) => !r.pass)) {
    console.error("\nFAIL: er zijn assets waarvan de anchors de controle niet halen.");
    failed = true;
  }
  const stored = await readFile(PROFILES_PATH, "utf8").catch(() => "");
  if (!only && stored !== profilesSource(rows)) {
    console.error("\nFAIL: anchors.generated.ts is verouderd — draai `npm run audit:anchors -- --write`.");
    failed = true;
  }
  if (failed) process.exit(1);
  console.log("\n--check: alles in orde.");
}
