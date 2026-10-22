// Eenmalig backfill-script: vult `slug` en `seo_summary` voor bestaande
// goedgekeurde, publieke, niet-AI-gegenereerde activiteiten die nog geen
// van beide (of één van beide) hebben — vrijwel altijd de 203 oorspronkelijke
// GymWiki-bibliotheekactiviteiten (author_id null), die nooit door
// checkActivityQuality zijn gelopen (dat draait alleen bij een gebruikers-
// indiening). Zie supabase/migrations/activiteiten_public_seo.sql: de
// public.activiteiten_publiek-view (de enige leesweg voor de nieuwe
// /activiteiten/[slug]-pagina's) toont een rij pas zodra BEIDE gevuld zijn.
//
// Schrijft `slug` altijd (goedkoop, geen AI nodig) en `seo_summary` via
// CHECK_MODEL (gpt-4o-mini) — één aanroep per activiteit, geen
// accept/reject-beoordeling (de activiteit is al goedgekeurd), zie
// lib/ai/seoSummaryPrompt.ts (GEDEELD met de live checkActivityQuality-
// prompt in lib/ai/activityQualityCheck.ts, zodat beide nooit uiteenlopen).
//
// Gebruik:
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/backfill-activity-seo.mts [opties]
//
// Opties:
//   --dry-run          Alleen tonen wat er zou gebeuren (incl. de slugs die
//                       gegenereerd zouden worden), geen AI-aanroepen of
//                       database-schrijvingen.
//   --limit=N          Beperk tot de eerste N activiteiten.
//   --ids=id1,id2,...  Alleen deze specifieke activiteit-id's.
//
// Vereist SUPABASE_SERVICE_ROLE_KEY (bypasst RLS om alle in aanmerking
// komende rijen te vinden/bij te werken, ongeacht author_id) en
// OPENAI_API_KEY (behalve bij --dry-run).

import { createClient } from "@supabase/supabase-js";
import {
  SEO_SUMMARY_ONLY_SYSTEM_PROMPT,
  buildSeoSummaryUserMessage,
  seoSummaryOnlyResultSchema,
  type SeoSummaryInput,
} from "../lib/ai/seoSummaryPrompt.ts";
import { CHECK_MODEL, getOpenAIClient } from "../lib/ai/openai-client.ts";

const CALL_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  const args = {
    dryRun: false,
    limit: undefined as number | undefined,
    ids: undefined as string[] | undefined,
  };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg.startsWith("--limit=")) args.limit = Number(arg.slice("--limit=".length));
    else if (arg.startsWith("--ids="))
      args.ids = arg
        .slice("--ids=".length)
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
  }
  return args;
}

const MAX_SLUG_LENGTH = 80;

// Zelfde algoritme als lib/services/activitySlug.ts (bewust hier
// gedupliceerd i.p.v. geïmporteerd — dat bestand heeft geen @/-aliased
// imports zelf, maar wél `@supabase/supabase-js`'s SupabaseClient-type
// puur voor typing; simpeler om deze kleine, puur-functionele helper hier
// lokaal te houden dan een extra relatief-importpad te onderhouden).
function slugifyTitle(titel: string): string {
  const base = titel
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return base || "activiteit";
}

type ActivityRow = {
  id: string;
  titel: string;
  leerlijn: string | null;
  doel: string | null;
  beschrijving: string | null;
  categorie: string | null;
  beginsituatie: string | null;
  veld: string | null;
  materiaal: string[] | null;
  regels: string[] | null;
  slug: string | null;
  seo_summary: string | null;
};

function toSeoSummaryInput(activity: ActivityRow): SeoSummaryInput {
  return {
    titel: activity.titel,
    leerlijn: activity.leerlijn ?? "",
    doel: activity.doel ?? "",
    beschrijving: activity.beschrijving ?? "",
    categorie: activity.categorie ?? undefined,
    beginsituatie: activity.beginsituatie ?? undefined,
    veld: activity.veld ?? undefined,
    materiaal: activity.materiaal ?? undefined,
    regels: activity.regels ?? undefined,
  };
}

async function generateSeoSummary(input: SeoSummaryInput): Promise<string> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: CHECK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SEO_SUMMARY_ONLY_SYSTEM_PROMPT },
      { role: "user", content: buildSeoSummaryUserMessage(input) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Geen antwoord van de seo_summary-generatie ontvangen.");
  }

  return seoSummaryOnlyResultSchema.parse(JSON.parse(raw)).seo_summary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL en SUPABASE_SERVICE_ROLE_KEY zijn vereist.");
    process.exit(1);
  }
  if (!args.dryRun && !process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is vereist (behalve bij --dry-run).");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let query = supabase
    .from("activiteiten")
    .select(
      "id, titel, leerlijn, doel, beschrijving, categorie, beginsituatie, veld, materiaal, regels, slug, seo_summary",
    )
    .eq("status", "approved")
    .eq("is_public", true)
    .eq("is_ai_generated", false)
    .or("slug.is.null,seo_summary.is.null")
    .order("id", { ascending: true });

  if (args.ids) query = query.in("id", args.ids);
  if (args.limit) query = query.limit(args.limit);

  const { data, error } = await query;
  if (error) {
    console.error("Ophalen van activiteiten mislukt:", error.message);
    process.exit(1);
  }

  const activities = (data ?? []) as ActivityRow[];
  if (activities.length === 0) {
    console.log("Geen activiteiten gevonden die nog een slug/seo_summary missen.");
    return;
  }

  console.log(`${activities.length} activiteiten missen slug en/of seo_summary.`);

  // Slugs vooraf allemaal in één keer opbouwen zodat botsingen BINNEN deze
  // batch (twee activiteiten met dezelfde titel-slug) ook worden opgevangen
  // — een los per-rij db-lookup zou dat pas bij de eerstvolgende run zien.
  const { data: existingSlugRows, error: slugFetchError } = await supabase
    .from("activiteiten")
    .select("slug")
    .not("slug", "is", null);
  if (slugFetchError) {
    console.error("Ophalen van bestaande slugs mislukt:", slugFetchError.message);
    process.exit(1);
  }
  const takenSlugs = new Set((existingSlugRows ?? []).map((row) => row.slug as string));

  function claimSlug(titel: string): string {
    const base = slugifyTitle(titel);
    let candidate = base;
    let suffix = 2;
    while (takenSlugs.has(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    takenSlugs.add(candidate);
    return candidate;
  }

  const plannedSlugs = new Map<string, string>();
  for (const activity of activities) {
    plannedSlugs.set(activity.id, activity.slug ?? claimSlug(activity.titel));
  }

  if (args.dryRun) {
    console.log("── Dry run — geen AI-aanroepen of schrijvingen ─────");
    for (const activity of activities) {
      console.log(
        `  ${activity.id}  "${activity.titel}"  slug=${plannedSlugs.get(activity.id)}` +
          (activity.seo_summary ? "" : "  (seo_summary wordt gegenereerd)"),
      );
    }
    console.log("─────────────────────────────────────────────────────");
    return;
  }

  let updated = 0;
  let failed = 0;

  for (const activity of activities) {
    try {
      const seoSummary = activity.seo_summary ?? (await generateSeoSummary(toSeoSummaryInput(activity)));

      const { error: updateError } = await supabase
        .from("activiteiten")
        .update({ slug: plannedSlugs.get(activity.id), seo_summary: seoSummary })
        .eq("id", activity.id);

      if (updateError) {
        failed += 1;
        console.error(`  ✗ ${activity.id} "${activity.titel}":`, updateError.message);
      } else {
        updated += 1;
        console.log(`  ✓ ${activity.titel} — slug=${plannedSlugs.get(activity.id)}`);
      }
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${activity.id} "${activity.titel}":`, err instanceof Error ? err.message : err);
    }

    await sleep(CALL_DELAY_MS);
  }

  console.log("── Resultaat ────────────────────────────────────────");
  console.log(`Bijgewerkt: ${updated}/${activities.length}`);
  console.log(`Mislukt:    ${failed}`);
  console.log("─────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("Onverwachte fout:", err);
  process.exit(1);
});
