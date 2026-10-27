// Beheer van de indeling van 3D-items in bulk, via CSV (opent in Excel):
//
//   export  [bestand.csv]   Schrijft alle items met categorie, subgroep, sporten
//                           en tags (standaard docs/library-taxonomy.csv).
//   import  <bestand.csv>   Toont per item wat er zou veranderen (dry-run).
//           --apply         Schrijft de wijzigingen naar Supabase.
//
// Kolommen: slug;naam;categorie;subgroep;sporten;tags — sporten en tags
// gescheiden door "|". Geldige waarden staan in lib/constants/libraryTaxonomy.ts;
// elk item heeft verplicht een categorie en minstens één sport (of "algemeen").
// Alleen bestaande slugs worden aangepast; `naam` is informatief en wordt niet
// teruggeschreven. Item-id's en slugs veranderen nooit.
//
//   npm run library:csv -- export
//   npm run library:csv -- import docs/library-taxonomy.csv [--apply]

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import { parseCsv, serializeCsv, type TaxonomyRow } from "../lib/library/csv.ts";
import { classifyModel } from "../lib/library/classify.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_EXPORT = path.join(__dirname, "..", "docs", "library-taxonomy.csv");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);
const apply = rest.includes("--apply");
const fileArg = rest.find((arg) => !arg.startsWith("--"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig (.env.local).");
const supabase = createClient(url, serviceKey);

type Row = { id: string; slug: string; naam: string; categorie: string; categorie_oud: string | null; subgroep: string | null; sporten: string[]; tags: string[] };

async function loadRows(): Promise<Row[]> {
  const { data, error } = await supabase
    .from("material_models")
    .select("id, slug, naam, categorie, categorie_oud, subgroep, sporten, tags")
    .order("slug");
  if (error) {
    if (error.code === "42703") fail("De taxonomie-kolommen bestaan nog niet: voer eerst supabase/migrations/material_models_taxonomy.sql uit.");
    fail(`Kon items niet ophalen: ${error.message}`);
  }
  return data as Row[];
}

if (command === "export") {
  const rows = await loadRows();
  const out: TaxonomyRow[] = rows.map((row) => {
    // Nog niet gemigreerde items: toon de automatische indeling als startpunt.
    const migrated = row.sporten.length > 0;
    const auto = migrated ? null : classifyModel({ slug: row.slug, naam: row.naam, categorie_oud: row.categorie_oud ?? row.categorie });
    return {
      slug: row.slug,
      naam: row.naam,
      categorie: auto?.categorie ?? row.categorie,
      subgroep: auto ? auto.subgroep : row.subgroep,
      sporten: auto?.sporten ?? row.sporten,
      tags: auto?.tags ?? row.tags,
    };
  });
  const target = fileArg ? path.resolve(fileArg) : DEFAULT_EXPORT;
  await writeFile(target, serializeCsv(out), "utf8");
  console.log(`${out.length} items geëxporteerd naar ${path.relative(process.cwd(), target)}.`);
} else if (command === "import") {
  if (!fileArg) fail("Geef een CSV-bestand op: npm run library:csv -- import <bestand.csv> [--apply]");
  const parsed = parseCsv(await readFile(path.resolve(fileArg), "utf8"));
  for (const error of parsed.errors) console.error(`✗ regel ${error.line} (${error.slug || "?"}): ${error.messages.join("; ")}`);
  if (parsed.errors.length > 0) fail(`${parsed.errors.length} ongeldige regel(s); niets weggeschreven.`);

  const existing = new Map((await loadRows()).map((row) => [row.slug, row]));
  const unknown = parsed.rows.filter((row) => !existing.has(row.slug));
  for (const row of unknown) console.warn(`! ${row.slug}: bestaat niet in de database, overgeslagen`);

  const changes = parsed.rows.flatMap((row) => {
    const current = existing.get(row.slug);
    if (!current) return [];
    const same =
      current.categorie === row.categorie &&
      (current.subgroep ?? null) === row.subgroep &&
      current.sporten.join("|") === row.sporten.join("|") &&
      current.tags.join("|") === row.tags.join("|");
    return same ? [] : [{ row, current }];
  });

  for (const { row, current } of changes) {
    console.log(`~ ${row.slug}: ${current.categorie}${current.subgroep ? ` > ${current.subgroep}` : ""} → ${row.categorie}${row.subgroep ? ` > ${row.subgroep}` : ""} [${row.sporten.join(", ")}]`);
  }
  console.log(`\n${changes.length} wijziging(en) van ${parsed.rows.length} regels.`);

  if (!apply) {
    console.log("(dry-run: niets gewijzigd. Draai met --apply om weg te schrijven.)");
  } else {
    let failed = 0;
    for (const { row, current } of changes) {
      const { error } = await supabase
        .from("material_models")
        .update({ categorie: row.categorie, subgroep: row.subgroep, sporten: row.sporten, tags: row.tags, categorie_oud: current.categorie_oud ?? current.categorie })
        .eq("id", current.id);
      if (error) {
        failed++;
        console.error(`  ✗ ${row.slug}: ${error.message}`);
      }
    }
    console.log(`Klaar: ${changes.length - failed} bijgewerkt, ${failed} mislukt.`);
    process.exit(failed > 0 ? 1 : 0);
  }
} else {
  fail("Gebruik: library-taxonomy-csv.mts export [bestand.csv] | import <bestand.csv> [--apply]");
}
