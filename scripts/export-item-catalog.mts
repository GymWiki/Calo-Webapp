// Schrijft docs/ai-item-catalog.json + docs/ai-item-catalog.compact.json.
//
//   npm run export:item-catalog              -> leest public.material_models (ALLEEN select,
//                                               actieve rijen; vereist NEXT_PUBLIC_SUPABASE_URL +
//                                               SUPABASE_SERVICE_ROLE_KEY in .env.local)
//   npm run export:item-catalog -- --dev     -> gebruikt de 3 dev-placeholders uit
//                                               components/canvas-3d/devPlaceholderModels.ts
//                                               (alleen zolang er geen echte data is)

import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { buildCatalog, compactCatalog, estimateTokens, type CatalogSourceRow } from "@/lib/plattegrond/catalog";
import { DEV_PLACEHOLDER_MODELS } from "@/components/canvas-3d/devPlaceholderModels";

const docs = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
const dev = process.argv.includes("--dev");

let rows: CatalogSourceRow[];
let meta: Record<string, unknown>;

if (dev) {
  rows = DEV_PLACEHOLDER_MODELS.map((m) => ({
    slug: m.slug, naam: m.naam, categorie: m.categorie,
    length_m: m.length_m, width_m: m.width_m, height_m: m.height_m, stackable: m.stackable,
    bron: "components/canvas-3d/devPlaceholderModels.ts (dev-placeholder, geen echt GLB-model)",
  }));
  meta = {
    bron: "DEV-PLACEHOLDERS — public.material_models was niet uitleesbaar bij het genereren van dit bestand",
    waarschuwing: "Dit zijn NIET de productie-items. Draai `npm run export:item-catalog` met service-role-toegang om de echte catalogus te genereren.",
  };
} else {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist (of gebruik --dev).");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("material_models")
    .select("slug, naam, categorie, length_m, width_m, height_m, stackable, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("naam", { ascending: true });
  if (error) {
    console.error(`Kon material_models niet lezen: ${error.message}`);
    process.exit(1);
  }
  rows = (data ?? []).map((r) => ({
    slug: r.slug, naam: r.naam, categorie: r.categorie,
    length_m: Number(r.length_m), width_m: Number(r.width_m), height_m: Number(r.height_m),
    stackable: r.stackable, bron: "public.material_models",
  }));
  meta = { bron: "public.material_models (active = true)", gegenereerd: new Date().toISOString() };
}

const catalog = buildCatalog(rows, meta);
const full = JSON.stringify(catalog, null, 2);
const compact = JSON.stringify(compactCatalog(catalog));
writeFileSync(path.join(docs, "ai-item-catalog.json"), full + "\n");
writeFileSync(path.join(docs, "ai-item-catalog.compact.json"), compact + "\n");
console.log(`${rows.length} item(s). Volledig ≈ ${estimateTokens(full)} tokens, compact ≈ ${estimateTokens(compact)} tokens (grove schatting: tekens/4).`);
