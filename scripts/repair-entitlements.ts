// Herstelt de pro-status van klanten die bij Stripe betaald hebben, op basis
// van de Stripe-subscription (bron van waarheid). Idempotent.
//
//   Droog (standaard, schrijft NIETS):
//     npm run repair:entitlements
//   Alleen SQL laten genereren (data/repair-entitlements.sql, om zelf te draaien):
//     npm run repair:entitlements -- --sql
//   Echt toepassen (pas NA een back-up, zie docs/stripe-herstel.md):
//     npm run repair:entitlements -- --apply --i-have-a-backup
//
//   --include-email-matches   ook klanten die alléén op exact e-mailadres gekoppeld zijn
//   --days 60                 hoe ver terug "recent betaald" kijkt
//
// Klanten zonder koppeling (ander e-mailadres e.d.) worden NOOIT automatisch
// gekoppeld: ze staan met een voorstel in data/repair-handmatig.csv.
// Output bevat persoonsgegevens: lokaal houden (data/ staat in .gitignore).

import { mkdirSync, writeFileSync } from "node:fs";

import { auditRecords, short, summarize, type AuditRow } from "@/lib/stripe/audit";
import { supabaseBillingDeps } from "@/lib/stripe/adapter";
import { syncLifetime, syncSubscription, type BillingDeps, type SubscriptionRow } from "@/lib/stripe/sync";
import { fetchStripeRecords, fetchSupabase, stripeReadOnly, supabaseReadOnly } from "./lib/stripe-audit-data.ts";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const wantSql = args.has("--sql");
const includeEmail = args.has("--include-email-matches");
const days = Number(process.argv[process.argv.indexOf("--days") + 1]) || 60;

if (apply && !args.has("--i-have-a-backup")) {
  console.error("\n✖ --apply vereist ook --i-have-a-backup (maak eerst een back-up: zie docs/stripe-herstel.md).\n");
  process.exit(1);
}

const q = (v: string | null) => (v === null ? "null" : `'${v.replace(/'/g, "''")}'`);

function sqlFor(rows: SubscriptionRow[]): string {
  const stmts = rows.map((r) => {
    const status = r.status === "trialing" ? "active" : r.status; // compatibel met het huidige productieschema
    return [
      `insert into public.subscriptions (user_id, stripe_customer_id, stripe_subscription_id, status, subscription_type, current_period_end)`,
      `values (${q(r.user_id)}, ${q(r.stripe_customer_id)}, ${q(r.stripe_subscription_id)}, ${q(status)}, ${q(r.subscription_type)}, ${q(r.current_period_end)})`,
      `on conflict (user_id) do update set stripe_customer_id = excluded.stripe_customer_id, stripe_subscription_id = excluded.stripe_subscription_id,`,
      `  status = excluded.status, subscription_type = excluded.subscription_type, current_period_end = excluded.current_period_end;`,
      `update public.users set subscription_status = 'paid_subscriber', subscription_type = ${q(r.subscription_type)}`,
      ` where id = ${q(r.user_id)} and (subscription_status <> 'paid_subscriber' or subscription_type <> ${q(r.subscription_type)}) and subscription_type <> 'lifetime';`,
    ].join("\n");
  });
  return `-- Gegenereerd door scripts/repair-entitlements.ts. Idempotent. Draai NA een back-up.\nbegin;\n\n${stmts.join("\n\n")}\n\ncommit;\n`;
}

async function main() {
  const stripe = stripeReadOnly();
  const supabase = supabaseReadOnly();
  const [{ records, facts }, { users, links }] = await Promise.all([fetchStripeRecords(stripe, { recentDays: days }), fetchSupabase(supabase)]);
  const rows: AuditRow[] = auditRecords(records, users, links);

  const eligible = rows.filter((r) => r.deviation === "betaald maar geen pro" && r.userId && (r.linkedBy !== "e-mail" || includeEmail));
  const emailOnly = rows.filter((r) => r.deviation === "betaald maar geen pro" && r.linkedBy === "e-mail" && !includeEmail);
  const manual = rows.filter((r) => r.deviation === "geen account gevonden" || (r.deviation === "e-mail komt niet overeen" && r.record.expectedPaid && !r.userPaid));

  // Schrijfacties verzamelen i.p.v. uitvoeren (dry-run/sql); bij --apply echt schrijven.
  const planned: SubscriptionRow[] = [];
  const log: BillingDeps["log"] = () => undefined;
  const base = supabaseBillingDeps(supabase, null, log);
  const deps: BillingDeps = apply
    ? base
    : {
        ...base,
        async writeSubscriptionRow(row) {
          planned.push(row);
        },
        async setUserAccess() {},
        async markTrialUsed() {},
      };

  let changed = 0;
  let skipped = 0;
  for (const row of eligible) {
    const rec = row.record;
    const result =
      rec.kind === "lifetime"
        ? await syncLifetime(deps, { paymentStatus: "paid", customerId: rec.customerId || null, hints: { metadataUserId: row.userId } })
        : await syncSubscription(deps, facts.get(rec.subscriptionId!)!, { metadataUserId: row.userId });
    if (result.kind === "synced" && result.paid) {
      changed++;
      console.log(`  ${apply ? "TOEGEPAST" : "ZOU WIJZIGEN"}  gebruiker ${short(row.userId)} → pro (${result.plan}), stripe ${short(rec.subscriptionId ?? rec.customerId)}, gekoppeld via ${row.linkedBy}`);
    } else {
      skipped++;
      console.log(`  OVERGESLAGEN  gebruiker ${short(row.userId)}: ${result.kind === "ignored" || result.kind === "unlinked" ? result.reason : result.kind}`);
    }
  }

  mkdirSync("data", { recursive: true });
  const csv = (v: unknown) => (/[",\n]/.test(String(v ?? "")) ? `"${String(v).replace(/"/g, '""')}"` : String(v ?? ""));
  writeFileSync(
    "data/repair-handmatig.csv",
    ["stripe_klant,email,naam,plan,stripe_status,afwijking,voorgestelde_gebruiker_id,reden_voorstel", ...[...manual, ...emailOnly].map((r) => [short(r.record.customerId), r.record.email, r.record.name, r.record.plan, r.record.status, r.deviation, r.proposal?.userId ?? r.userId ?? "", r.proposal?.reason ?? (r.linkedBy === "e-mail" ? "exact zelfde e-mailadres (gebruik --include-email-matches)" : "geen voorstel")].map(csv).join(","))].join("\n"),
  );
  if (wantSql || !apply) {
    writeFileSync("data/repair-entitlements.sql", sqlFor(planned));
  }

  console.log(`\n${apply ? "TOEGEPAST" : "DRY-RUN (er is niets geschreven)"} — te herstellen: ${changed}, overgeslagen: ${skipped}`);
  console.log(`Handmatig af te handelen: ${manual.length} · alleen op e-mail gekoppeld (niet automatisch): ${emailOnly.length}`);
  console.log("Samenvatting audit:", JSON.stringify(summarize(rows)));
  if (!apply) console.log("SQL-alternatief: data/repair-entitlements.sql · handmatige lijst: data/repair-handmatig.csv (persoonsgegevens, niet delen/committen)\n");
}

main().catch((error) => {
  console.error("Herstel mislukt:", error instanceof Error ? error.message : "onbekende fout");
  process.exit(1);
});
