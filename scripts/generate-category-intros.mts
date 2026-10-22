// Eenmalig (en herbruikbaar bij nieuwe leerlijnen/groepen) script: genereert
// en bewaart de intro-tekst voor elke publieke categoriepagina
// (/leerlijn/[leerlijn], /groep/[groep] — zie app/leerlijn/[leerlijn]/
// page.tsx en app/groep/[groep]/page.tsx) in public.categorie_intro (zie
// supabase/migrations/categorie_intro.sql). Draait NA
// scripts/backfill-activity-seo.mts (leest activiteiten_publiek, dus
// activiteiten moeten al een slug/seo_summary hebben) — leerlijnen/groepen
// zonder enige publieke activiteit worden overgeslagen (geen categorie-
// pagina zonder inhoud).
//
// Gebruik:
//   node --experimental-strip-types --env-file=.env.local \
//     scripts/generate-category-intros.mts [opties]
//
// Opties:
//   --dry-run   Alleen tonen welke leerlijnen/groepen een intro zouden
//               krijgen (en hoeveel activiteiten elk heeft), geen
//               AI-aanroepen of database-schrijvingen.
//   --force     Ook leerlijnen/groepen die al een intro hebben opnieuw
//               genereren (standaard: alleen ontbrekende).
//
// Vereist SUPABASE_SERVICE_ROLE_KEY (schrijft naar categorie_intro, dat
// geen insert/update-policy voor anon/authenticated heeft) en
// OPENAI_API_KEY (behalve bij --dry-run).

import { createClient } from "@supabase/supabase-js";
import { CHECK_MODEL, getOpenAIClient } from "../lib/ai/openai-client.ts";

const CALL_DELAY_MS = 250;

// Zelfde vaste mapping als types/activity.ts's DOELGROEP_LABELS/
// DOELGROEP_SLUGS — hier lokaal herhaald (geen @/-alias onder kale
// node-executie, zie scripts/backfill-activity-seo.mts voor dezelfde
// beperking).
const DOELGROEP_LABELS: Record<number, string> = {
  1: "Groep 1/2",
  2: "Groep 3/4",
  3: "Groep 5/6",
  4: "Groep 7/8",
  5: "Onderbouw",
  6: "Bovenbouw",
};
const DOELGROEP_SLUGS: Record<number, string> = {
  1: "groep-1-2",
  2: "groep-3-4",
  3: "groep-5-6",
  4: "groep-7-8",
  5: "onderbouw",
  6: "bovenbouw",
};

function slugifyTitle(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return base || "categorie";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  const args = { dryRun: false, force: false };
  for (const arg of argv) {
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--force") args.force = true;
  }
  return args;
}

type CategoryTarget = { type: "leerlijn" | "groep"; slug: string; label: string; count: number };

const INTRO_SYSTEM_PROMPT =
  "Je schrijft een korte introductietekst voor een categoriepagina van GymWiki, een gedeelde " +
  "activiteitenbibliotheek voor bewegingsonderwijs (gebouwd door vakleerkrachten LO en " +
  "CALO-studenten). Schrijf 150-250 woorden Nederlands die uitleggen wat een leerkracht op deze " +
  "pagina vindt en waarom dat nuttig is bij het voorbereiden van een gymles. Gebruik natuurlijke, " +
  "concrete taal (geen keyword stuffing) — vermeld het aantal activiteiten, het soort content " +
  "(lesdoel, doelgroep, materiaal — noem NIET de volledige uitwerking/speelregels/leerhulp, die " +
  "blijven achter de betaalmuur), en waarom een gestructureerde, door vakleerkrachten " +
  "gecontroleerde bibliotheek waardevol is. Antwoord uitsluitend met de introtekst zelf, geen " +
  "opsomming, geen titel, geen aanhalingstekens.";

async function generateIntro(target: CategoryTarget): Promise<string> {
  const client = getOpenAIClient();
  const subject =
    target.type === "leerlijn"
      ? `de leerlijn "${target.label}"`
      : `activiteiten geschikt voor ${target.label}`;

  const completion = await client.chat.completions.create({
    model: CHECK_MODEL,
    messages: [
      { role: "system", content: INTRO_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Schrijf de introtekst voor de categoriepagina over ${subject}. Er staan momenteel ${target.count} publieke activiteiten op deze pagina.`,
      },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Geen antwoord van de introtekst-generatie ontvangen.");
  }
  return text;
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

  const { data: activities, error } = await supabase
    .from("activiteiten_publiek")
    .select("leerlijn, doelgroep");
  if (error) {
    console.error("Ophalen van publieke activiteiten mislukt:", error.message);
    process.exit(1);
  }

  const leerlijnCounts = new Map<string, number>();
  const groepCounts = new Map<number, number>();
  for (const row of activities ?? []) {
    const leerlijn = row.leerlijn as string | null;
    if (leerlijn) leerlijnCounts.set(leerlijn, (leerlijnCounts.get(leerlijn) ?? 0) + 1);
    for (const code of (row.doelgroep as number[] | null) ?? []) {
      groepCounts.set(code, (groepCounts.get(code) ?? 0) + 1);
    }
  }

  const targets: CategoryTarget[] = [
    ...[...leerlijnCounts.entries()].map(
      ([label, count]): CategoryTarget => ({ type: "leerlijn", slug: slugifyTitle(label), label, count }),
    ),
    ...[...groepCounts.entries()]
      .filter(([code]) => DOELGROEP_LABELS[code])
      .map(
        ([code, count]): CategoryTarget => ({
          type: "groep",
          slug: DOELGROEP_SLUGS[code],
          label: DOELGROEP_LABELS[code],
          count,
        }),
      ),
  ];

  if (targets.length === 0) {
    console.log("Geen leerlijnen/groepen gevonden met publieke activiteiten.");
    return;
  }

  const { data: existing, error: existingError } = await supabase
    .from("categorie_intro")
    .select("type, slug");
  if (existingError) {
    console.error("Ophalen van bestaande categorie-intro's mislukt:", existingError.message);
    process.exit(1);
  }
  const existingKeys = new Set((existing ?? []).map((row) => `${row.type}:${row.slug}`));

  const todo = args.force ? targets : targets.filter((t) => !existingKeys.has(`${t.type}:${t.slug}`));

  console.log(`${targets.length} categorieën gevonden, ${todo.length} te genereren.`);

  if (args.dryRun) {
    console.log("── Dry run — geen AI-aanroepen of schrijvingen ─────");
    for (const target of todo) {
      console.log(`  ${target.type}/${target.slug}  "${target.label}"  (${target.count} activiteiten)`);
    }
    console.log("─────────────────────────────────────────────────────");
    return;
  }

  let created = 0;
  let failed = 0;

  for (const target of todo) {
    try {
      const introText = await generateIntro(target);
      const { error: upsertError } = await supabase.from("categorie_intro").upsert(
        {
          type: target.type,
          slug: target.slug,
          label: target.label,
          intro_text: introText,
        },
        { onConflict: "type,slug" },
      );
      if (upsertError) {
        failed += 1;
        console.error(`  ✗ ${target.type}/${target.slug}:`, upsertError.message);
      } else {
        created += 1;
        console.log(`  ✓ ${target.type}/${target.slug} — "${target.label}"`);
      }
    } catch (err) {
      failed += 1;
      console.error(`  ✗ ${target.type}/${target.slug}:`, err instanceof Error ? err.message : err);
    }

    await sleep(CALL_DELAY_MS);
  }

  console.log("── Resultaat ────────────────────────────────────────");
  console.log(`Aangemaakt/bijgewerkt: ${created}/${todo.length}`);
  console.log(`Mislukt:               ${failed}`);
  console.log("─────────────────────────────────────────────────────");
}

main().catch((err) => {
  console.error("Onverwachte fout:", err);
  process.exit(1);
});
