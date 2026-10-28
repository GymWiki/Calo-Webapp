// Controleert een geëxporteerd plattegrond-bestand en maakt er SQL voor Supabase van. Schrijft NOOIT zelf naar een database:
// je krijgt alleen de controle en de SQL om zelf te draaien (SQL-editor of psql).
//
//   Alleen valideren:
//     npm run validate:plattegrond -- bestand.json
//   SQL genereren (standaard een dry-run: alleen tonen):
//     npm run import:plattegrond -- bestand.json --user <user-uuid> [--activiteit <activiteit-id>] [--naam "Titel"] [--out plattegrond.sql]
//   Bestaande plattegrond bijwerken i.p.v. nieuw invoegen:
//     npm run import:plattegrond -- bestand.json --id <floorplan-uuid> [--activiteit <id>]
//
// Slugs worden gecontroleerd tegen public.material_models als NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
// beschikbaar zijn (alleen lezen); zonder die variabelen wordt alleen het schema gecontroleerd.
// Exitcode 1 bij een ongeldig bestand.

import { readFile, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

import { roundScene } from "@/lib/plattegrond/format";
import { parsePlattegrondJson } from "@/lib/plattegrond/validate";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 ? args[index + 1] : undefined;
};
const file = args.find((arg, i) => !arg.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--") && !["validate-only"].includes(args[i - 1].slice(2))));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVITY_ID = /^[A-Za-z0-9_-]{1,80}$/;
const quote = (text: string) => `'${text.replace(/'/g, "''")}'`;

function die(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!file) die("Geef een bestand op: npm run import:plattegrond -- bestand.json [--user <uuid>] [--activiteit <id>]");

async function knownSlugs(): Promise<Set<string> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const { data, error } = await createClient(url, key, { auth: { persistSession: false } }).from("material_models").select("slug").eq("active", true);
  if (error || !data || data.length === 0) {
    console.warn("! Catalogus niet gelezen (geen toegang of lege lijst): slugs worden niet gecontroleerd.");
    return null;
  }
  return new Set(data.map((row) => row.slug as string));
}

const text = await readFile(file, "utf8").catch(() => die(`Kon ${file} niet lezen.`));
const slugs = await knownSlugs();
if (!slugs) console.log("i Slugs worden niet tegen de catalogus gecontroleerd (zet NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY om dat wel te doen).");
const result = parsePlattegrondJson(text, { knownSlugs: slugs });

if (!result.ok) {
  console.error(`✗ ${file} is niet geldig:`);
  for (const error of result.errors) console.error(`  - ${error.path}: ${error.message}`);
  process.exit(1);
}

const scene = roundScene(result.scene);
console.log(`✓ ${file} is geldig: "${result.title}", ${scene.items.length} items, ${scene.coneFields.length} afgezette velden, zaal ${scene.room.width_m} × ${scene.room.length_m} m.`);
for (const warning of result.warnings) console.log(`! ${warning.message}`);
if (flag("validate-only") || process.argv[1]?.includes("validate")) process.exit(0);

const naam = option("naam") ?? result.title;
const activiteit = option("activiteit");
const user = option("user");
const id = option("id");
if (activiteit && !ACTIVITY_ID.test(activiteit)) die("--activiteit mag alleen letters, cijfers, - en _ bevatten.");
if (user && !UUID.test(user)) die("--user moet een uuid zijn (public.users.id).");
if (id && !UUID.test(id)) die("--id moet een uuid zijn (floorplans_3d.id).");

const json = JSON.stringify(scene, null, 2);
if (json.includes("$plattegrond$")) die("Onverwachte tekst in de JSON; SQL niet gegenereerd.");
const data = `$plattegrond$${json}$plattegrond$::jsonb`;

const sql = id
  ? `-- Werkt een bestaande plattegrond bij. Controleer eerst met: select id, naam, user_id from public.floorplans_3d where id = '${id}';\n` +
    `update public.floorplans_3d\n   set naam = ${quote(naam)},\n       data = ${data}${activiteit ? `,\n       activiteit_id = ${quote(activiteit)}` : ""}\n where id = '${id}';\n`
  : `-- Voegt een nieuwe plattegrond toe voor één gebruiker${user ? "" : " (VUL --user IN: nu staat er een placeholder)"}.\n` +
    `insert into public.floorplans_3d (user_id, naam, activiteit_id, data)\nvalues (${user ? `'${user}'` : "'<USER_UUID>'"}, ${quote(naam)}, ${activiteit ? quote(activiteit) : "null"}, ${data});\n`;

const out = option("out");
if (out) {
  await writeFile(out, sql);
  console.log(`\nSQL geschreven naar ${out} (niets is uitgevoerd).`);
} else {
  console.log(`\n--- SQL (dry-run, niets is uitgevoerd) ---\n${sql}`);
}
console.log("Advies: maak vooraf een back-up (Supabase → Database → Backups, of `pg_dump -t public.floorplans_3d`), draai de SQL eerst op een branch/staging en controleer daarna de rij.");
