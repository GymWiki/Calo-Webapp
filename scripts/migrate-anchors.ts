// Migratie van bestaande touwen naar bevestigingspunten (anchors). ALLEEN LEZEN tegen Supabase: het script schrijft niets in de database.
// Het schrijft (1) een rapport (docs/anchor-migration-report.md, zonder namen of e-mailadressen) en (2) data/anchor-migration.sql om zelf te draaien.
//
//   npm run migrate:anchors                 rapport + SQL genereren (leest floorplans_3d en material_models met de service-role-key uit .env.local)
//
// De editor en de viewer migreren oude touwen ook zelf bij het laden (rope.ts: migrateRopes); dit script is om dat eenmalig vast te leggen in
// de database, zodat het rapport en de opgeslagen data overeenkomen. Idempotent: een plattegrond die al is gemigreerd wordt overgeslagen.

import { mkdirSync, writeFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

import { dimsLookupFromModels } from "@/components/canvas-3d/floorplan3d-geometry";
import { MIGRATION_TOLERANCE_M, migrateRopes, type RopeMigrationChange } from "@/components/canvas-3d/rope";
import type { Floorplan3dItem, Rope } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("✖ NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY ontbreken (.env.local).");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: models, error: modelError } = await supabase.from("material_models").select("*");
if (modelError) throw modelError;
const lookup = dimsLookupFromModels((models ?? []) as MaterialModel[]);

const { data: plans, error } = await supabase.from("floorplans_3d").select("id, data");
if (error) throw error;

type Affected = { id: string; oldRopes: Rope[]; newRopes: Rope[]; changes: RopeMigrationChange[] };
const affected: Affected[] = [];
let withRopes = 0;
let alreadyMigrated = 0;
for (const plan of plans ?? []) {
  const data = plan.data as { items?: Floorplan3dItem[]; ropes?: Rope[] };
  const ropes = data.ropes ?? [];
  if (ropes.length === 0) continue;
  withRopes++;
  const { ropes: migrated, changes } = migrateRopes(ropes, data.items ?? [], lookup);
  if (changes.length === 0) {
    alreadyMigrated++;
    continue;
  }
  affected.push({ id: plan.id as string, oldRopes: ropes, newRopes: migrated, changes });
}

const short = (id: string) => `${id.slice(0, 8)}…`;
const allChanges = affected.flatMap((a) => a.changes);
const exceeded = allChanges.filter((c) => c.exceeded);
const lines: string[] = [];
lines.push("# Anchor-migratie: rapport", "");
lines.push(`Gegenereerd door \`npm run migrate:anchors\` (alleen lezen). Plattegronden: ${plans?.length ?? 0} · met touwen: ${withRopes} · te migreren: ${affected.length} · al gemigreerd: ${alreadyMigrated}.`, "");
lines.push(`Uiteinden gemigreerd: ${allChanges.length}, waarvan **${exceeded.length}** meer dan ${MIGRATION_TOLERANCE_M * 100} cm verschoven (zie tabel).`, "");
lines.push("Er staan geen namen of e-mailadressen in dit rapport; plattegrond-id's zijn ingekort.", "");
lines.push("| Plattegrond | Touw | Uiteinde | Asset | Anchor | Verschoven (cm) | Boven tolerantie |", "|---|---|---|---|---|---|---|");
for (const a of affected) for (const c of a.changes) lines.push(`| ${short(a.id)} | ${short(c.ropeId)} | ${c.end} | \`${c.slug}\` | \`${c.anchorId}\` | ${(c.shiftM * 100).toFixed(1)} | ${c.exceeded ? "**ja**" : "nee"} |`);
if (affected.length === 0) lines.push("| _geen_ | | | | | | |");
lines.push("");
writeFileSync("docs/anchor-migration-report.md", lines.join("\n"));

const q = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
const sql = [
  "-- Gegenereerd door scripts/migrate-anchors.ts. Zet touwen op hun bevestigingspunt (anchor). Idempotent en veilig:",
  "-- elke update past alleen toe als de touwen nog precies zo zijn als bij het genereren (anders blijft de rij ongemoeid).",
  "-- Draai NA een back-up van public.floorplans_3d (zie docs/anchor-audit.md).",
  "begin;",
  ...affected.map((a) => `update public.floorplans_3d set data = jsonb_set(data, '{ropes}', ${q(a.newRopes)}) where id = '${a.id}' and data->'ropes' = ${q(a.oldRopes)};`),
  "commit;",
  "",
].join("\n");
mkdirSync("data", { recursive: true });
writeFileSync("data/anchor-migration.sql", sql);

console.log(`Plattegronden ${plans?.length ?? 0} · met touwen ${withRopes} · te migreren ${affected.length} · uiteinden ${allChanges.length} (boven tolerantie: ${exceeded.length})`);
console.log("Geschreven: docs/anchor-migration-report.md, data/anchor-migration.sql");
