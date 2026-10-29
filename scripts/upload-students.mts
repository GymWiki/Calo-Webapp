// Zet de verwerkte leerling-poses (scripts/process-students.mts) in de Supabase-bucket `materials-3d` onder students/<id>.glb
// en students/<id>.png. Er komt GEEN rij in de database: de editor leest de poses uit lib/students/poses.json.
//
//   node --experimental-strip-types --env-file=.env.local scripts/upload-students.mts [--dir=materiaal-import/leerlingen] [--dry-run]
//
// Vereist NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY (alleen lokaal, nooit in client-code). Her-draaien overschrijft
// (upsert op pad). Dit schrijft naar PRODUCTIE-storage als je .env.local naar productie wijst: maak desgewenst eerst een kopie
// van de bucket (zie docs/students.md).

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...value] = arg.replace(/^--/, "").split("=");
    return [key, value.join("=") || "true"];
  }),
);
const dir = path.resolve(String(args.dir ?? "materiaal-import/leerlingen"));
const BUCKET = "materials-3d";

const files = (await readdir(dir)).filter((name) => /^[a-z0-9_]+\.(glb|png)$/.test(name)).sort();
if (files.length === 0) {
  console.error(`Geen .glb/.png-bestanden in ${dir}. Draai eerst: npm run process:students -- --thumbs`);
  process.exit(1);
}
console.log(`${files.length} bestanden uit ${dir} → ${BUCKET}/students/`);
if (args["dry-run"]) {
  for (const name of files) console.log(`  (dry-run) students/${name}`);
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist (behalve bij --dry-run).");
  process.exit(1);
}
const supabase = createClient(url, key);
let failed = 0;
for (const name of files) {
  const body = await readFile(path.join(dir, name));
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`students/${name}`, body, { contentType: name.endsWith(".glb") ? "model/gltf-binary" : "image/png", upsert: true, cacheControl: "3600" });
  if (error) {
    failed++;
    console.error(`  ✗ ${name}: ${error.message}`);
  } else console.log(`  ✓ students/${name}`);
}
process.exit(failed ? 1 : 0);
