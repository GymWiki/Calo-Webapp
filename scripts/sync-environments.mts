// Houdt de omgevingen (gymzaal, sportveld, atletiekbaan, zwembad) gelijk met de GLB's uit de Drive. Eén commando na elke wijziging:
//
//   npm run sync:environments -- --upload
//
// Bronbestanden: omgeving-import/<naam>.glb (niet in git, kopie van de Drive-map). Het script
//   1. leest per GLB de nodenamen (zoals three's GLTFLoader ze noemt) en een inhoudshash,
//   2. schrijft components/canvas-3d/environment-nodes.ts (nodenamen + versies) — commit dat bestand,
//   3. met --upload: zet de GLB's in de bucket materials-3d/environments/ (overschrijft).
// De hash komt als ?v=… achter de model-URL (environmentModelUrl), zodat een nieuwe versie direct na het deployen overal
// geladen wordt, ook in plattegronden die al bestonden, en niet pas na het verlopen van de browsercache.
// Vereist voor --upload: NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY (.env.local).

import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const IMPORT_DIR = "omgeving-import";
const BUCKET = "materials-3d";
const OUTPUT = "components/canvas-3d/environment-nodes.ts";
const upload = process.argv.includes("--upload");

/** Zoals three's PropertyBinding.sanitizeNodeName: spaties → "_", en de tekens [ ] . : / vallen weg. */
function sanitize(name: string): string {
  return name.replace(/\s/g, "_").replace(/[[\].:/]/g, "");
}

function nodeNames(glb: Buffer): string[] {
  const jsonLength = glb.readUInt32LE(12);
  const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8")) as { nodes?: { name?: string }[] };
  return [...new Set((json.nodes ?? []).map((node) => node.name).filter((name): name is string => Boolean(name)).map(sanitize))].sort();
}

const files = (await readdir(IMPORT_DIR)).filter((name) => name.endsWith(".glb")).sort();
if (files.length === 0) {
  console.error(`Geen .glb-bestanden in ${IMPORT_DIR}/.`);
  process.exit(1);
}

const nodes: Record<string, string[]> = {};
const versions: Record<string, string> = {};
const bodies = new Map<string, Buffer>();
for (const file of files) {
  const body = await readFile(path.join(IMPORT_DIR, file));
  const id = file.replace(/\.glb$/, "");
  bodies.set(file, body);
  nodes[id] = nodeNames(body);
  versions[id] = createHash("sha1").update(body).digest("hex").slice(0, 8);
  console.log(`${id.padEnd(30)} ${String(nodes[id].length).padStart(4)} nodes  v=${versions[id]}  ${(body.length / 1024).toFixed(0)} KB`);
}

function wrap(list: string[]): string {
  const lines: string[] = [];
  let line = "   ";
  for (const name of list.map((entry) => ` ${JSON.stringify(entry)},`)) {
    if (line.length + name.length > 112) {
      lines.push(line);
      line = "   ";
    }
    line += name;
  }
  lines.push(line);
  return lines.join("\n");
}

const header = `// GEGENEREERD door \`npm run sync:environments\` uit de GLB's in materials-3d/environments/ (omgeving-import/): niet met de hand
// aanpassen. Nodenamen na de naam-schoning van three's GLTFLoader (spaties -> "_", de tekens [ ] . : / verdwijnen); gebruikt door
// environment-kinds.ts en environments.ts om onderdelen (belijning, banen, ...) aan/uit te zetten op nodenaam. ENVIRONMENT_VERSIONS =
// inhoudshash per GLB, als ?v=… achter de model-URL (zie environmentModelUrl) zodat een gewijzigd GLB meteen overal wordt geladen.
`;
const body = [
  header,
  "export const ENVIRONMENT_NODES: Record<string, string[]> = {",
  ...Object.entries(nodes).map(([id, list]) => `  ${id}: [\n${wrap(list)}\n  ],`),
  "};",
  "",
  "export const ENVIRONMENT_VERSIONS: Record<string, string> = {",
  ...Object.entries(versions).map(([id, version]) => `  ${id}: ${JSON.stringify(version)},`),
  "};",
  "",
].join("\n");
await writeFile(OUTPUT, body);
console.log(`→ ${OUTPUT} bijgewerkt`);

if (upload) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht voor --upload.");
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });
  let failed = 0;
  for (const [file, data] of bodies) {
    const { error } = await supabase.storage.from(BUCKET).upload(`environments/${file}`, data, { contentType: "model/gltf-binary", upsert: true, cacheControl: "3600" });
    if (error) {
      failed += 1;
      console.error(`  ✗ ${file} — ${error.message}`);
    } else console.log(`  ✓ environments/${file}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}
