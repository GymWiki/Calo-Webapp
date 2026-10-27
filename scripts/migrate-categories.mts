// Deelt alle bestaande 3D-items (public.material_models) in volgens de nieuwe
// bibliotheekindeling (lib/constants/libraryTaxonomy.ts) met de automatische
// classifier (lib/library/classify.ts).
//
//   Dry-run (standaard): schrijft ALLEEN docs/category-migration-review.md en
//   toont een overzicht; er wordt niets in de database gewijzigd.
//   --apply            Schrijft categorie, subgroep, sporten en tags weg.
//                      Vereist dat supabase/migrations/material_models_taxonomy.sql
//                      al is uitgevoerd. De oude categorie blijft bewaard in
//                      `categorie_oud` tot de eigenaar akkoord geeft.
//   --all              Met --apply: ook items opnieuw indelen die al een
//                      indeling hebben (anders blijft handmatig werk staan).
//
// Item-id's en slugs veranderen NOOIT: opgeslagen plattegronden en
// activiteiten verwijzen via slug, dus die blijven werken.
//
// Gebruik:
//   node --experimental-strip-types --experimental-loader=./scripts/lib/path-alias-loader.mjs \
//     --env-file=.env.local scripts/migrate-categories.mts [--apply] [--all]
// (of: npm run migrate:categories -- [--apply] [--all])

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

import {
  LIBRARY_CATEGORIES,
  PERSONS_CATEGORY,
  categoryLabel,
  sportLabel,
  subgroupLabel,
  validateTaxonomy,
} from "../lib/constants/libraryTaxonomy.ts";
import { classifyModel, type Classification } from "../lib/library/classify.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = path.join(__dirname, "..", "docs", "category-migration-review.md");

const apply = process.argv.includes("--apply");
const all = process.argv.includes("--all");

type Row = {
  id: string;
  slug: string;
  naam: string;
  categorie: string;
  categorie_oud?: string | null;
  sporten?: string[] | null;
};

type Entry = { row: Row; oud: string; result: Classification };

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn nodig (.env.local).");

const supabase = createClient(url, serviceKey);

async function loadRows(): Promise<{ rows: Row[]; hasTaxonomyColumns: boolean }> {
  const withTaxonomy = await supabase
    .from("material_models")
    .select("id, slug, naam, categorie, categorie_oud, sporten")
    .order("slug");
  if (!withTaxonomy.error) return { rows: withTaxonomy.data as Row[], hasTaxonomyColumns: true };
  if (withTaxonomy.error.code !== "42703") fail(`Kon items niet ophalen: ${withTaxonomy.error.message}`);

  const plain = await supabase.from("material_models").select("id, slug, naam, categorie").order("slug");
  if (plain.error) fail(`Kon items niet ophalen: ${plain.error.message}`);
  return { rows: plain.data as Row[], hasTaxonomyColumns: false };
}

function describe(result: Classification): string {
  const sub = result.subgroep ? ` > ${subgroupLabel(result.categorie, result.subgroep)}` : "";
  return `${categoryLabel(result.categorie)}${sub}`;
}

function buildReport(entries: Entry[]): string {
  const uncertain = entries.filter((entry) => !entry.result.zeker);
  const lines: string[] = [];
  lines.push("# Review categorie-migratie");
  lines.push("");
  lines.push(
    "Gegenereerd door `scripts/migrate-categories.mts` (dry-run). Items waarbij de automatische indeling onzeker is, staan hieronder met de voorgestelde keuze en een reden. Niets is gewijzigd in de database zolang `--apply` niet is gedraaid; de oude categorie blijft bewaard in `categorie_oud`.",
  );
  lines.push("");
  lines.push("## Aantal items per nieuwe categorie");
  lines.push("");
  lines.push("| Categorie | Items | Subgroepen |");
  lines.push("| --- | ---: | --- |");
  for (const category of [...LIBRARY_CATEGORIES, PERSONS_CATEGORY]) {
    const inCategory = entries.filter((entry) => entry.result.categorie === category.id);
    if (inCategory.length === 0) continue;
    const subgroups = (category.subgroups ?? [])
      .map((subgroup) => {
        const count = inCategory.filter((entry) => entry.result.subgroep === subgroup.id).length;
        return count > 0 ? `${subgroup.label} ${count}` : null;
      })
      .filter(Boolean)
      .join(", ");
    lines.push(`| ${category.label} | ${inCategory.length} | ${subgroups || "—"} |`);
  }
  lines.push(`| **Totaal** | **${entries.length}** | |`);
  lines.push("");
  lines.push(`## Onzekere items (${uncertain.length})`);
  lines.push("");
  lines.push("Controleer deze; pas aan via de CSV-export/-import (`npm run library:csv`) of laat het weten.");
  lines.push("");
  lines.push("| Item | Oude categorie | Voorstel | Sporten | Reden |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const { row, oud, result } of uncertain) {
    lines.push(
      `| \`${row.slug}\` (${row.naam}) | ${oud} | ${describe(result)} | ${result.sporten.map(sportLabel).join(", ")} | ${result.reden ?? ""} |`,
    );
  }
  lines.push("");
  lines.push("## Alle items");
  lines.push("");
  lines.push("| Item | Oude categorie | Nieuwe indeling | Sporten |");
  lines.push("| --- | --- | --- | --- |");
  for (const { row, oud, result } of entries) {
    lines.push(`| \`${row.slug}\` | ${oud} | ${describe(result)} | ${result.sporten.map(sportLabel).join(", ")} |`);
  }
  lines.push("");
  return lines.join("\n");
}

const { rows, hasTaxonomyColumns } = await loadRows();
const entries: Entry[] = rows.map((row) => {
  const oud = row.categorie_oud ?? row.categorie;
  return { row, oud, result: classifyModel({ slug: row.slug, naam: row.naam, categorie_oud: oud }) };
});

const invalid = entries.filter(({ result }) =>
  validateTaxonomy({ categorie: result.categorie, subgroep: result.subgroep, sporten: result.sporten }).length > 0,
);
if (invalid.length > 0) {
  for (const { row, result } of invalid) {
    console.error(`✗ ${row.slug}: ${validateTaxonomy({ categorie: result.categorie, subgroep: result.subgroep, sporten: result.sporten }).join("; ")}`);
  }
  fail("Ongeldige indeling gevonden; niets weggeschreven.");
}

await writeFile(REPORT_PATH, buildReport(entries), "utf8");

const perCategory = new Map<string, number>();
for (const { result } of entries) perCategory.set(result.categorie, (perCategory.get(result.categorie) ?? 0) + 1);
console.log(`${entries.length} items, ${entries.filter((e) => !e.result.zeker).length} onzeker.`);
for (const category of [...LIBRARY_CATEGORIES, PERSONS_CATEGORY]) {
  console.log(`  ${category.label.padEnd(18)} ${perCategory.get(category.id) ?? 0}`);
}
console.log(`Rapport: ${path.relative(process.cwd(), REPORT_PATH)}`);

if (!apply) {
  console.log("\n(dry-run: niets gewijzigd. Draai met --apply om weg te schrijven.)");
  process.exit(0);
}

if (!hasTaxonomyColumns) {
  fail(
    "De kolommen categorie_oud/subgroep/sporten/tags bestaan nog niet. Voer eerst supabase/migrations/material_models_taxonomy.sql uit in de Supabase SQL-editor.",
  );
}

const todo = entries.filter(({ row }) => all || !row.sporten || row.sporten.length === 0);
console.log(`\n${todo.length} items worden bijgewerkt${all ? " (--all)" : ""}...`);

let failed = 0;
for (const { row, oud, result } of todo) {
  const { error } = await supabase
    .from("material_models")
    .update({
      categorie_oud: oud,
      categorie: result.categorie,
      subgroep: result.subgroep,
      sporten: result.sporten,
      tags: result.tags,
    })
    .eq("id", row.id);
  if (error) {
    failed++;
    console.error(`  ✗ ${row.slug}: ${error.message}`);
  }
}

// Controle: niets verdwenen, slugs ongewijzigd.
const after = await loadRows();
const slugsBefore = new Set(rows.map((row) => row.slug));
const missing = after.rows.filter((row) => !slugsBefore.has(row.slug)).length + (rows.length - after.rows.length);
console.log(`Klaar: ${todo.length - failed} bijgewerkt, ${failed} mislukt. Aantal items ${rows.length} → ${after.rows.length}${missing ? " ✗ AFWIJKING" : " ✓"}.`);
process.exit(failed > 0 || missing ? 1 : 0);
