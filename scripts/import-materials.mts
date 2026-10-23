// Vult public.material_models (zie supabase/migrations/material_models_3d.sql)
// vanuit bestanden die de gebruiker ZELF in materiaal-import/ (.gitignored,
// niet in de repo) plaatst — bewust GEEN automatische overname vanuit
// public.materials: alleen 3D-modellen die hier als bestand staan, komen in
// de tabel terecht.
//
// Per item verwacht dit script, gegroepeerd op bestandsnaam-zonder-extensie
// ("slug", alleen a-z/0-9/_):
//   materiaal-import/<slug>.glb    (verplicht — het 3D-model, meters, Y-up,
//                                   oorsprong op de vloer, gecentreerd)
//   materiaal-import/<slug>.png    (verplicht — de preview/thumbnail)
//   materiaal-import/<slug>.json   (optioneel — overrides, zie hieronder)
//
// Een item zonder zowel .glb als .png wordt overgeslagen (met waarschuwing).
//
// JSON-overrides (alle velden optioneel):
//   { "naam": "Kast 6", "categorie": "opslag", "length_m": 1.42,
//     "width_m": 0.83, "height_m": 1.35, "stackable": false,
//     "sort_order": 10, "material_id": "<uuid van public.materials>" }
//
// length_m/width_m/height_m worden, als ze niet in de JSON staan, berekend
// uit de wereld-bounding-box van het GLB (X->length, Z->width, Y->height),
// afgerond op millimeters. Gebruik een JSON-override voor items met een
// uitstekend onderdeel (bv. een pedaal) dat de bbox groter maakt dan de
// "echte" afmeting die voor stapel/botsing-logica moet gelden.
//
// Ontbreekt "naam", dan wordt die afgeleid van de slug ("kast_6" -> "Kast 6").
// Ontbreekt "categorie", dan is de default "overig".
//
// Her-draaien overschrijft (upsert op slug / storage-pad).
//
// Gebruik:
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/import-materials.mts [opties]
//
// Opties:
//   --dry-run       Alleen tonen wat er zou gebeuren (afmetingen, naam,
//                    categorie, link naar materials), geen upload/schrijving.
//   --only=<slug>   Alleen dit ene item verwerken (herhaalbaar niet nodig,
//                    comma-separated: --only=kast_6,mat_groot).
//
// Vereist NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY in
// .env.local (de service-role key wordt UITSLUITEND door dit script
// gebruikt, nooit in client-code — bypasst RLS om de door select-only-
// policy beschermde material_models-tabel en de write-dichte
// materials-3d-bucket te vullen).

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IMPORT_DIR = path.join(__dirname, "..", "materiaal-import");
const BUCKET = "materials-3d";
const TABLE = "material_models";

const MAX_GLB_BYTES = 5 * 1024 * 1024; // 5MB — waarschuwing, geen harde stop
const MAX_PNG_BYTES = 500 * 1024; // 500KB — waarschuwing, geen harde stop
const SLUG_PATTERN = /^[a-z0-9_]+$/;

type JsonOverrides = {
  naam?: string;
  categorie?: string;
  length_m?: number;
  width_m?: number;
  height_m?: number;
  stackable?: boolean;
  sort_order?: number;
  material_id?: string;
};

type ParsedArgs = {
  dryRun: boolean;
  only: Set<string> | undefined;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { dryRun: false, only: undefined };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--only=")) {
      args.only = new Set(
        arg
          .slice("--only=".length)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    } else {
      console.warn(`Onbekende optie genegeerd: ${arg}`);
    }
  }
  return args;
}

function deriveNameFromSlug(slug: string): string {
  const [first, ...rest] = slug.split("_");
  const capitalizedFirst = first.charAt(0).toUpperCase() + first.slice(1);
  return [capitalizedFirst, ...rest].join(" ");
}

function roundToMm(meters: number): number {
  return Math.round(meters * 1000) / 1000;
}

type DiscoveredItem = {
  slug: string;
  glbPath: string;
  pngPath: string | null;
  jsonPath: string | null;
};

async function discoverItems(): Promise<DiscoveredItem[]> {
  let entries;
  try {
    entries = await readdir(IMPORT_DIR, { withFileTypes: true });
  } catch {
    console.error(
      `Kon ${IMPORT_DIR} niet lezen. Maak de map aan en plaats er <slug>.glb + <slug>.png (+ optioneel <slug>.json) bestanden in.`,
    );
    process.exit(1);
  }

  const bySlug = new Map<string, DiscoveredItem>();
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (![".glb", ".png", ".json"].includes(ext)) continue;

    const slug = path.basename(entry.name, ext);
    if (!SLUG_PATTERN.test(slug)) {
      console.warn(`Overgeslagen: "${entry.name}" — slug "${slug}" mag alleen a-z, 0-9 en _ bevatten.`);
      continue;
    }

    const item = bySlug.get(slug) ?? { slug, glbPath: "", pngPath: null, jsonPath: null };
    const fullPath = path.join(IMPORT_DIR, entry.name);
    if (ext === ".glb") item.glbPath = fullPath;
    else if (ext === ".png") item.pngPath = fullPath;
    else if (ext === ".json") item.jsonPath = fullPath;
    bySlug.set(slug, item);
  }

  const items: DiscoveredItem[] = [];
  for (const item of bySlug.values()) {
    if (!item.glbPath || !item.pngPath) {
      console.warn(
        `Overgeslagen: "${item.slug}" mist ${!item.glbPath ? ".glb" : ".png"} — beide zijn verplicht.`,
      );
      continue;
    }
    items.push(item);
  }
  return items.sort((a, b) => a.slug.localeCompare(b.slug));
}

async function readJsonOverrides(jsonPath: string | null): Promise<JsonOverrides> {
  if (!jsonPath) return {};
  const raw = await readFile(jsonPath, "utf8");
  return JSON.parse(raw) as JsonOverrides;
}

const gltfIo = new NodeIO().registerExtensions(ALL_EXTENSIONS);

async function computeGlbDimensions(glbPath: string) {
  const document = await gltfIo.read(glbPath);
  const scene = document.getRoot().listScenes()[0];
  if (!scene) throw new Error(`Geen scene gevonden in ${glbPath}`);
  const { min, max } = getBounds(scene);
  return {
    length_m: roundToMm(max[0] - min[0]),
    width_m: roundToMm(max[2] - min[2]),
    height_m: roundToMm(max[1] - min[1]),
  };
}

type ResolvedItem = {
  slug: string;
  naam: string;
  categorie: string;
  length_m: number;
  width_m: number;
  height_m: number;
  stackable: boolean;
  sort_order: number;
  material_id: string | null;
  glbPath: string;
  pngPath: string;
  glbSize: number;
  pngSize: number;
};

async function resolveItem(item: DiscoveredItem): Promise<ResolvedItem> {
  const overrides = await readJsonOverrides(item.jsonPath);
  const computed =
    overrides.length_m !== undefined && overrides.width_m !== undefined && overrides.height_m !== undefined
      ? null
      : await computeGlbDimensions(item.glbPath);

  const glbSize = (await stat(item.glbPath)).size;
  const pngSize = (await stat(item.pngPath!)).size;

  if (glbSize > MAX_GLB_BYTES) {
    console.warn(`Waarschuwing: ${item.slug}.glb is ${(glbSize / 1024 / 1024).toFixed(1)}MB (>5MB).`);
  }
  if (pngSize > MAX_PNG_BYTES) {
    console.warn(`Waarschuwing: ${item.slug}.png is ${(pngSize / 1024).toFixed(0)}KB (>500KB).`);
  }

  return {
    slug: item.slug,
    naam: overrides.naam ?? deriveNameFromSlug(item.slug),
    categorie: overrides.categorie ?? "overig",
    length_m: overrides.length_m ?? computed!.length_m,
    width_m: overrides.width_m ?? computed!.width_m,
    height_m: overrides.height_m ?? computed!.height_m,
    stackable: overrides.stackable ?? true,
    sort_order: overrides.sort_order ?? 0,
    material_id: overrides.material_id ?? null,
    glbPath: item.glbPath,
    pngPath: item.pngPath!,
    glbSize,
    pngSize,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!args.dryRun && (!supabaseUrl || !serviceRoleKey)) {
    console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist (behalve bij --dry-run).");
    process.exit(1);
  }

  const discovered = await discoverItems();
  const filtered = args.only ? discovered.filter((i) => args.only!.has(i.slug)) : discovered;

  if (filtered.length === 0) {
    console.log("Niets te importeren — materiaal-import/ bevat geen geldige <slug>.glb + <slug>.png paren.");
    return;
  }

  const resolved: ResolvedItem[] = [];
  for (const item of filtered) {
    try {
      resolved.push(await resolveItem(item));
    } catch (cause) {
      console.error(`Mislukt: "${item.slug}" —`, cause);
    }
  }

  console.log(`\n${resolved.length} item(en) gevonden:\n`);
  const header = ["slug", "naam", "categorie", "lengte", "breedte", "hoogte", "stapelbaar"];
  const rows = resolved.map((r) => [
    r.slug,
    r.naam,
    r.categorie,
    `${r.length_m}m`,
    `${r.width_m}m`,
    `${r.height_m}m`,
    r.stackable ? "ja" : "nee",
  ]);
  const columnWidths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => row[i].length)) + 2,
  );
  const padRow = (values: string[]) => values.map((v, i) => v.padEnd(columnWidths[i])).join("");

  console.log(padRow(header));
  for (const row of rows) {
    console.log(padRow(row));
  }

  if (args.dryRun) {
    console.log("\n(--dry-run: geen uploads of database-schrijvingen uitgevoerd.)");
    return;
  }

  const supabase = createClient(supabaseUrl!, serviceRoleKey!);
  const results: { slug: string; status: "ok" | "fout"; detail?: string }[] = [];

  for (const item of resolved) {
    try {
      if (item.material_id) {
        const { data: materialRow } = await supabase
          .from("materials")
          .select("id")
          .eq("id", item.material_id)
          .maybeSingle();
        if (!materialRow) {
          console.warn(
            `"${item.slug}": material_id ${item.material_id} niet gevonden in public.materials — wordt niet gekoppeld.`,
          );
          item.material_id = null;
        }
      }

      const modelPath = `models/${item.slug}.glb`;
      const previewPath = `previews/${item.slug}.png`;

      const glbBuffer = await readFile(item.glbPath);
      const { error: glbError } = await supabase.storage
        .from(BUCKET)
        .upload(modelPath, glbBuffer, { contentType: "model/gltf-binary", upsert: true });
      if (glbError) throw glbError;

      const pngBuffer = await readFile(item.pngPath);
      const { error: pngError } = await supabase.storage
        .from(BUCKET)
        .upload(previewPath, pngBuffer, { contentType: "image/png", upsert: true });
      if (pngError) throw pngError;

      const { error: upsertError } = await supabase
        .from(TABLE)
        .upsert(
          {
            slug: item.slug,
            material_id: item.material_id,
            naam: item.naam,
            categorie: item.categorie,
            model_path: modelPath,
            preview_path: previewPath,
            length_m: item.length_m,
            width_m: item.width_m,
            height_m: item.height_m,
            stackable: item.stackable,
            sort_order: item.sort_order,
            active: true,
          },
          { onConflict: "slug" },
        );
      if (upsertError) throw upsertError;

      results.push({ slug: item.slug, status: "ok" });
    } catch (cause) {
      results.push({ slug: item.slug, status: "fout", detail: String(cause) });
    }
  }

  console.log("\nResultaat:\n");
  for (const r of results) {
    console.log(r.status === "ok" ? `  ✓ ${r.slug}` : `  ✗ ${r.slug} — ${r.detail}`);
  }

  if (results.some((r) => r.status === "fout")) {
    process.exit(1);
  }

  // De collision-vorm (offset, onderkant, draaiing) staat in een gegenereerd profiel
  // naast de code; zonder nieuw profiel valt een asset terug op de oude gecentreerde box.
  console.log(
    "\nTip: draai `npm run audit:collision -- --write` en commit components/canvas-3d/collision-profiles.generated.ts voor nieuwe of gewijzigde GLB's.",
  );
}

main();
