// Eenmalige (en herbruikbare) taalcheck/optimalisatie-batch voor de
// `activiteiten`-tabel: corrigeert spelling/grammatica en herschrijft
// onduidelijke formuleringen via AI (CHECK_MODEL, zie lib/ai/openai-
// client.ts), maar schrijft NOOIT direct naar de live tabel — elk voorstel
// belandt in `activiteiten_taalcheck_voorstellen` en wacht daar op een
// expliciete review-goedkeuring (zie app/(protected)/beheer/taalcheck)
// vóórdat het daadwerkelijk wordt toegepast (actions/adminTaalcheck.ts).
//
// De eigenlijke prompt/schema/veldenlijst leven in lib/ai/
// languageCheckPrompt.ts — GEDEELD met lib/ai/languageCheck.ts (de
// Next.js-app-kant, voor toekomstig hergebruik als losse controle-stap).
// Dit script importeert die module rechtstreeks (met expliciete .ts-
// extensie, zie hieronder) i.p.v. via de "@/..."-alias, want het draait
// via Node's ingebouwde TypeScript-ondersteuning
// (`--experimental-strip-types`), die geen tsconfig-paden kent — alleen
// gewone relatieve/package-imports. lib/ai/languageCheckPrompt.ts heeft
// bewust GEEN eigen relatieve imports (alleen het "zod"-package), zodat
// die importketen hier overal oplost.
//
// Gebruik:
//   OPENAI_API_KEY=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node --experimental-strip-types --env-file=.env.local \
//     scripts/taalcheck-batch.mts [opties]
//
// Opties:
//   --dry-run           Alleen de kosteninschatting tonen, geen AI-aanroepen
//                        of database-schrijvingen.
//   --limit=N            Beperk tot de eerste N activiteiten (voor een
//                        steekproef) — samen met --dry-run ook te gebruiken
//                        om snel een inschatting voor een kleine batch te
//                        zien.
//   --ids=id1,id2,...    Alleen deze specifieke activiteit-id's (bijv. de
//                        bekende "Badminton - Vakbal"-activiteit).
//   --user-id=<uuid>     Aan welke gebruiker de ai_usage-logregels worden
//                        toegeschreven — standaard de library-admin (zie
//                        DEFAULT_USER_ID hieronder), zelfde patroon als
//                        lib/adminAccess.ts se e-mail-allowlist.
//
// Het service-role-sleutel is vereist (bypasst RLS voor het bulk lezen van
// alle activiteiten en schrijven naar de admin-only taalcheck-
// voorstellen-tabel) en wordt bewust NIET in de repo bewaard — haal 'm op
// via Project Settings > API in het Supabase-dashboard.

import { createClient } from "@supabase/supabase-js";
import {
  LANGUAGE_CHECK_FIELDS,
  LANGUAGE_CHECK_SYSTEM_PROMPT,
  arrayFieldToText,
  languageCheckResultSchema,
  type LanguageCheckField,
} from "../lib/ai/languageCheckPrompt.ts";
import { CHECK_MODEL, getOpenAIClient } from "../lib/ai/openai-client.ts";

// gpt-4o-mini-tarieven, USD per 1.000.000 tokens — zelfde cijfers als
// lib/ai/modelPricing.ts (hier lokaal gehouden i.p.v. geïmporteerd, want
// dat bestand heeft zelf weer een extensieloze relatieve import die niet
// oplost onder kale node-executie; zie de toelichting bovenaan). Bij een
// tariefwijziging hier én daar bijwerken.
const GPT_4O_MINI_INPUT_PER_MILLION = 0.15;
const GPT_4O_MINI_OUTPUT_PER_MILLION = 0.6;

// De library-admin (lib/adminAccess.ts se enige toegestane e-mail,
// pieter.kluvers06@gmail.com) — aan wie de ai_usage-logregels van deze
// batch worden toegeschreven, tenzij --user-id anders aangeeft.
const DEFAULT_USER_ID = "8da00f54-0cf9-454e-a067-b79bd51f6bca";

const TABLE = "activiteiten";
const PROPOSALS_TABLE = "activiteiten_taalcheck_voorstellen";
const CALL_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseArgs(argv: string[]) {
  const args = {
    dryRun: false,
    limit: undefined as number | undefined,
    ids: undefined as string[] | undefined,
    userId: DEFAULT_USER_ID,
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
    else if (arg.startsWith("--user-id=")) args.userId = arg.slice("--user-id=".length);
  }
  return args;
}

type ActivityRow = {
  id: string;
  titel: string;
  doel: string | null;
  beginsituatie: string | null;
  beschrijving: string | null;
  aandachtspunten: string | null;
  deelnemers_regels: string | null;
  plaatje_praatje: string | null;
  loopt: string[] | null;
  lukt: string[] | null;
  leeft: string[] | null;
  regels: string[] | null;
  materiaal: string[] | null;
};

type CheckableEntry = {
  activityId: string;
  activityTitle: string;
  field: LanguageCheckField;
  isArray: boolean;
  originalText: string; // array-velden: newline-joined, zie arrayFieldToText
};

// Zeer ruwe schatting (~4 tekens per token, Nederlandse tekst) — puur voor
// de kosteninschatting VOORAF; de daadwerkelijke kosten na afloop komen uit
// de echte completion.usage-tokentellingen (zie runBatch).
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

const PROMPT_OVERHEAD_TOKENS = Math.ceil(LANGUAGE_CHECK_SYSTEM_PROMPT.length / 4);
// Output is doorgaans ongeveer even lang als de input (gecorrigeerde tekst)
// plus een korte "reason"-toelichting.
function estimateOutputTokens(inputTextTokens: number): number {
  return inputTextTokens + 40;
}

function buildCheckableEntries(activities: ActivityRow[]): CheckableEntry[] {
  const entries: CheckableEntry[] = [];
  for (const activity of activities) {
    for (const { field, isArray } of LANGUAGE_CHECK_FIELDS) {
      const value = activity[field];
      if (isArray) {
        const items = (value as string[] | null) ?? [];
        if (items.length === 0) continue;
        entries.push({
          activityId: activity.id,
          activityTitle: activity.titel,
          field,
          isArray: true,
          originalText: arrayFieldToText(items),
        });
      } else {
        const text = (value as string | null) ?? "";
        if (text.trim().length === 0) continue;
        entries.push({
          activityId: activity.id,
          activityTitle: activity.titel,
          field,
          isArray: false,
          originalText: text,
        });
      }
    }
  }
  return entries;
}

function printCostEstimate(entries: CheckableEntry[], activityCount: number) {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  for (const entry of entries) {
    const textTokens = estimateTokens(entry.originalText);
    totalInputTokens += textTokens + PROMPT_OVERHEAD_TOKENS;
    totalOutputTokens += estimateOutputTokens(textTokens);
  }
  const estimatedCost =
    (totalInputTokens / 1_000_000) * GPT_4O_MINI_INPUT_PER_MILLION +
    (totalOutputTokens / 1_000_000) * GPT_4O_MINI_OUTPUT_PER_MILLION;

  console.log("── Kosteninschatting ──────────────────────────────");
  console.log(`Activiteiten:        ${activityCount}`);
  console.log(`Te controleren velden: ${entries.length}`);
  console.log(`Model:                ${CHECK_MODEL}`);
  console.log(
    `Geschatte tokens:     ~${totalInputTokens.toLocaleString("nl-NL")} input, ~${totalOutputTokens.toLocaleString("nl-NL")} output`,
  );
  console.log(`Geschatte kosten:     ~$${estimatedCost.toFixed(4)}`);
  console.log("────────────────────────────────────────────────────");
}

async function checkOneField(
  entry: CheckableEntry,
): Promise<{ changed: boolean; correctedText: string; reason: string; inputTokens: number; outputTokens: number }> {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: CHECK_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: LANGUAGE_CHECK_SYSTEM_PROMPT },
      { role: "user", content: entry.originalText },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Geen antwoord van de taalcheck ontvangen.");
  }

  const parsed = languageCheckResultSchema.parse(JSON.parse(raw));
  return {
    ...parsed,
    inputTokens: completion.usage?.prompt_tokens ?? 0,
    outputTokens: completion.usage?.completion_tokens ?? 0,
  };
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
    .from(TABLE)
    .select(
      "id, titel, doel, beginsituatie, beschrijving, aandachtspunten, deelnemers_regels, plaatje_praatje, loopt, lukt, leeft, regels, materiaal",
    )
    .order("id", { ascending: true });

  if (args.ids) {
    query = query.in("id", args.ids);
  }
  if (args.limit) {
    query = query.limit(args.limit);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Ophalen van activiteiten mislukt:", error.message);
    process.exit(1);
  }

  const activities = (data ?? []) as ActivityRow[];
  if (activities.length === 0) {
    console.log("Geen activiteiten gevonden voor deze selectie.");
    return;
  }

  const entries = buildCheckableEntries(activities);
  printCostEstimate(entries, activities.length);

  if (args.dryRun) {
    console.log("Dry run — geen AI-aanroepen of schrijvingen uitgevoerd.");
    return;
  }

  let proposalsCreated = 0;
  let fieldsUnchanged = 0;
  let fieldsFailed = 0;
  let actualInputTokens = 0;
  let actualOutputTokens = 0;

  // Per activiteit bijhouden of alle velden zonder fout zijn doorlopen —
  // pas dan wordt last_language_check_at gezet, zodat een gedeeltelijk
  // mislukte run bij een volgende poging opnieuw wordt meegenomen i.p.v.
  // stilzwijgend als "al gecontroleerd" te tellen.
  const activityHadFailure = new Map<string, boolean>();
  for (const activity of activities) activityHadFailure.set(activity.id, false);

  for (const entry of entries) {
    try {
      const result = await checkOneField(entry);
      actualInputTokens += result.inputTokens;
      actualOutputTokens += result.outputTokens;

      const { error: usageError } = await supabase.from("ai_usage").insert({
        user_id: args.userId,
        feature: "taalcheck",
        model: CHECK_MODEL,
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        estimated_cost_usd:
          (result.inputTokens / 1_000_000) * GPT_4O_MINI_INPUT_PER_MILLION +
          (result.outputTokens / 1_000_000) * GPT_4O_MINI_OUTPUT_PER_MILLION,
      });
      if (usageError) {
        console.error(`ai_usage loggen mislukt voor ${entry.activityId}/${entry.field}:`, usageError.message);
      }

      if (result.changed && result.correctedText.trim() !== entry.originalText.trim()) {
        const { error: insertError } = await supabase.from(PROPOSALS_TABLE).insert({
          activiteit_id: entry.activityId,
          veldnaam: entry.field,
          originele_tekst: entry.originalText,
          voorgestelde_tekst: result.correctedText,
          reden_van_wijziging: result.reason,
        });
        if (insertError) {
          console.error(
            `Voorstel opslaan mislukt voor ${entry.activityId}/${entry.field}:`,
            insertError.message,
          );
          activityHadFailure.set(entry.activityId, true);
        } else {
          proposalsCreated += 1;
          console.log(`  ✓ voorstel: ${entry.activityTitle} — ${entry.field}`);
        }
      } else {
        fieldsUnchanged += 1;
      }
    } catch (err) {
      fieldsFailed += 1;
      activityHadFailure.set(entry.activityId, true);
      console.error(
        `Taalcheck mislukt voor ${entry.activityId}/${entry.field}:`,
        err instanceof Error ? err.message : err,
      );
    }

    await sleep(CALL_DELAY_MS);
  }

  const checkedAt = new Date().toISOString();
  const activityIdsToStamp = activities
    .filter((activity) => !activityHadFailure.get(activity.id))
    .map((activity) => activity.id);
  if (activityIdsToStamp.length > 0) {
    const { error: stampError } = await supabase
      .from(TABLE)
      .update({ last_language_check_at: checkedAt })
      .in("id", activityIdsToStamp);
    if (stampError) {
      console.error("last_language_check_at bijwerken mislukt:", stampError.message);
    }
  }

  const actualCost =
    (actualInputTokens / 1_000_000) * GPT_4O_MINI_INPUT_PER_MILLION +
    (actualOutputTokens / 1_000_000) * GPT_4O_MINI_OUTPUT_PER_MILLION;

  console.log("── Resultaat ───────────────────────────────────────");
  console.log(`Activiteiten gecontroleerd (gestempeld): ${activityIdsToStamp.length}/${activities.length}`);
  console.log(`Velden gecontroleerd:  ${entries.length}`);
  console.log(`Voorstellen aangemaakt: ${proposalsCreated}`);
  console.log(`Velden zonder wijziging: ${fieldsUnchanged}`);
  console.log(`Mislukte velden:       ${fieldsFailed}`);
  console.log(`Werkelijke kosten:     ~$${actualCost.toFixed(4)}`);
  console.log("────────────────────────────────────────────────────");
  console.log(
    `Ga naar /beheer/taalcheck om de ${proposalsCreated} voorstellen te reviewen (goedkeuren/afwijzen).`,
  );
}

main().catch((err) => {
  console.error("Onverwachte fout:", err);
  process.exit(1);
});
