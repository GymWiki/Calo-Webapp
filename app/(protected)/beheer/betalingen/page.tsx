import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdminPage } from "@/lib/auth/admin";
import { createServiceClient } from "@/utils/supabase/service";

export const metadata = { title: "Betalingen — Beheer — GymWiki", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const short = (id: string | null) => (id ? `${id.slice(0, 8)}…` : "—");
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleString("nl-NL", { dateStyle: "short", timeStyle: "short" }) : "—");

// Alleen NAMEN/aanwezigheid van configuratie — nooit waarden.
const CONFIG = [
  ["SUPABASE_SERVICE_ROLE_KEY", "Zonder deze key kan de webhook niets wegschrijven (alle betalingen blijven zonder pro)."],
  ["STRIPE_SECRET_KEY", "Nodig voor checkout en de webhook."],
  ["STRIPE_WEBHOOK_SECRET", "Handtekeningcontrole van de webhook; moet bij het live-endpoint horen."],
  ["STRIPE_PRICE_MONTHLY", "Price-ID maandelijks (plan-herkenning)."],
  ["STRIPE_PRICE_YEARLY", "Price-ID jaarlijks."],
  ["STRIPE_PRICE_LIFETIME", "Price-ID lifetime."],
] as const;

export default async function BetalingenPage() {
  await requireAdminPage();

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    supabase = null;
  }

  const [events, noPro, proNoRow] = supabase
    ? await Promise.all([
        supabase.from("stripe_events").select("id, type, status, detail, processed_at").in("status", ["failed", "unlinked"]).order("processed_at", { ascending: false }).limit(50),
        // Betaalde (actieve/proef) abonnementsrij, maar gebruiker is geen pro.
        supabase.from("subscriptions").select("user_id, status, subscription_type, stripe_subscription_id, updated_at, users!inner(subscription_status)").in("status", ["active", "trialing"]).neq("users.subscription_status", "paid_subscriber").limit(50),
        supabase.from("users").select("id, subscription_type, created_at").eq("subscription_status", "paid_subscriber").limit(200),
      ])
    : [null, null, null];

  const rowUserIds = supabase
    ? new Set(((await supabase.from("subscriptions").select("user_id")).data ?? []).map((r) => r.user_id as string))
    : new Set<string>();
  const proZonderRij = (proNoRow?.data ?? []).filter((u) => !rowUserIds.has(u.id as string));

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8 sm:py-10">
      <PageHeader eyebrow="Beheer" title="Betalingen" description="Controle op betalingen die geen pro-status kregen. Geen persoonsgegevens op deze pagina." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuratie (alleen aanwezigheid)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {CONFIG.map(([name, why]) => {
            const ok = Boolean(process.env[name]);
            return (
              <p key={name} className="flex items-start gap-2">
                {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="ingesteld" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="ontbreekt" />}
                <span>
                  <code className="font-mono text-xs">{name}</code> — {ok ? "ingesteld" : <strong className="text-destructive">ONTBREEKT.</strong>} <span className="text-muted-foreground">{ok ? "" : why}</span>
                </span>
              </p>
            );
          })}
        </CardContent>
      </Card>

      {!supabase ? (
        <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          De service-role client kan niet worden aangemaakt, dus deze pagina en de Stripe-webhook kunnen niets lezen of schrijven.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mislukte of niet-koppelbare Stripe-events ({events?.data?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {events?.error ? (
                <p className="text-sm text-muted-foreground">Tabel <code>stripe_events</code> bestaat nog niet (migratie <code>stripe_events.sql</code> is nog niet gedraaid).</p>
              ) : (events?.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Geen mislukte events.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3">Tijd</th><th className="pr-3">Event</th><th className="pr-3">Type</th><th className="pr-3">Status</th><th>Reden</th></tr></thead>
                  <tbody>
                    {(events?.data ?? []).map((e) => (
                      <tr key={e.id as string} className="border-t"><td className="py-1 pr-3 whitespace-nowrap">{date(e.processed_at as string)}</td><td className="pr-3 font-mono text-xs">{short(e.id as string)}</td><td className="pr-3">{e.type as string}</td><td className="pr-3">{e.status as string}</td><td>{(e.detail as string | null) ?? "—"}</td></tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actief abonnement, maar gebruiker niet pro ({noPro?.data?.length ?? 0})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {(noPro?.data ?? []).length === 0 ? <p className="text-muted-foreground">Geen afwijkingen.</p> : (noPro?.data ?? []).map((r) => (
                <p key={r.user_id as string} className="font-mono text-xs">gebruiker {short(r.user_id as string)} · {r.status as string} · {r.subscription_type as string} · bijgewerkt {date(r.updated_at as string)}</p>
              ))}
              <p className="pt-2 text-xs text-muted-foreground">Herstel met <code>npm run repair:entitlements</code> (zie docs/stripe-herstel.md) of laat de gebruiker op “Abonnement synchroniseren” klikken.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pro zonder abonnementsrij ({proZonderRij.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              {proZonderRij.length === 0 ? <p className="text-muted-foreground">Geen.</p> : proZonderRij.map((u) => (
                <p key={u.id as string} className="font-mono text-xs">gebruiker {short(u.id as string)} · type {u.subscription_type as string} (handmatig, legacy, of webhook mislukt tussen de gebruikers- en abonnementsupdate)</p>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
