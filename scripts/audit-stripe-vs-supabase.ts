// ALLEEN-LEZEN audit: vergelijkt Stripe-abonnementen met de toegang in Supabase.
//
//   npm run audit:betalingen            (of: node --experimental-strip-types \
//     --experimental-loader=./scripts/lib/path-alias-loader.mjs --env-file=.env.local \
//     scripts/audit-stripe-vs-supabase.ts [--days 60])
//
// Schrijft data/audit-betalingen.csv (+ data/audit-handmatig.csv met voorstellen).
// Die bestanden bevatten persoonsgegevens: lokaal houden, niet committen (data/ staat in .gitignore).
// In de console staan alleen aantallen per categorie.

import { mkdirSync, writeFileSync } from "node:fs";

import { auditRecords, short, summarize, type AuditRow } from "@/lib/stripe/audit";
import { fetchStripeRecords, fetchSupabase, stripeReadOnly, supabaseReadOnly } from "./lib/stripe-audit-data.ts";

const days = Number(process.argv[process.argv.indexOf("--days") + 1]) || 60;

const csv = (v: unknown) => {
  const s = String(v ?? "");
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (cells: unknown[]) => cells.map(csv).join(",");

async function main() {
  const stripe = stripeReadOnly();
  const supabase = supabaseReadOnly();
  const [{ records }, { users, links }] = await Promise.all([fetchStripeRecords(stripe, { recentDays: days }), fetchSupabase(supabase)]);
  const rows: AuditRow[] = auditRecords(records, users, links);

  mkdirSync("data", { recursive: true });
  const head = ["stripe_klant", "email", "plan", "stripe_status", "startdatum", "laatst_betaald", "supabase_gebruiker_gevonden", "supabase_pro", "supabase_type", "afwijking", "gekoppeld_via", "gebruiker_id", "opmerking"];
  writeFileSync(
    "data/audit-betalingen.csv",
    [line(head), ...rows.map((r) => line([short(r.record.customerId), r.record.email, r.record.plan, r.record.status, r.record.startedAt?.slice(0, 10), r.record.lastPaidAt?.slice(0, 10), r.userId ? "ja" : "nee", r.userPaid === null ? "" : r.userPaid ? "ja" : "nee", r.userType, r.deviation, r.linkedBy, short(r.userId), r.notes.join("; ")]))].join("\n"),
  );

  const manual = rows.filter((r) => r.deviation === "geen account gevonden");
  writeFileSync(
    "data/audit-handmatig.csv",
    [line(["stripe_klant", "email", "naam", "plan", "stripe_status", "voorgestelde_gebruiker_id", "reden_voorstel"]), ...manual.map((r) => line([short(r.record.customerId), r.record.email, r.record.name, r.record.plan, r.record.status, r.proposal?.userId ?? "", r.proposal?.reason ?? "geen voorstel"]))].join("\n"),
  );

  const s = summarize(rows);
  console.log(`\nStripe-records: ${records.length} · Supabase-gebruikers: ${users.length}\n`);
  for (const [k, v] of Object.entries(s)) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log("\nGeschreven: data/audit-betalingen.csv, data/audit-handmatig.csv (bevatten persoonsgegevens — niet delen of committen).\n");
}

main().catch((error) => {
  console.error("Audit mislukt:", error instanceof Error ? error.message : "onbekende fout");
  process.exit(1);
});
