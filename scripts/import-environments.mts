// Uploadt de omgevings-GLB's (gymzaal) naar de publieke bucket materials-3d,
// map "environments/". Bronbestanden: omgeving-import/<naam>.glb (niet in
// git). Gebruik:
//   node --experimental-strip-types --env-file=.env.local scripts/import-environments.mts
// Vereist NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY. Her-draaien
// overschrijft. De namen moeten overeenkomen met GYM_LAYOUTS[*].glb in
// components/canvas-3d/environments.ts.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const IMPORT_DIR = "omgeving-import";
const BUCKET = "materials-3d";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn verplicht.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const files = (await readdir(IMPORT_DIR)).filter((name) => name.endsWith(".glb"));
if (files.length === 0) {
  console.error(`Geen .glb-bestanden in ${IMPORT_DIR}/.`);
  process.exit(1);
}

let failed = 0;
for (const name of files) {
  const body = await readFile(path.join(IMPORT_DIR, name));
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`environments/${name}`, body, { contentType: "model/gltf-binary", upsert: true });
  if (error) {
    failed += 1;
    console.error(`  ✗ ${name} — ${error.message}`);
  } else {
    console.log(`  ✓ ${name} (${(body.length / 1024).toFixed(0)} KB)`);
  }
}
process.exit(failed > 0 ? 1 : 0);
