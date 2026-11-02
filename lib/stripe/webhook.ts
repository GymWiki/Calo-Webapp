// Verwerking van een Stripe-webhook. De route (app/api/stripe/webhook) is
// dun; alles wat testbaar moet zijn staat hier, met geïnjecteerde deps.
//
// Gedrag:
//  - handtekening ongeldig → 400 (Stripe probeert niet opnieuw);
//  - config ontbreekt → 500 met duidelijke melding (Stripe probeert opnieuw,
//    en het staat in de logs — nooit stil falen);
//  - verwerking faalt → event als 'failed' vastgelegd + 500 (Stripe retry);
//  - bekend event-id dat al is verwerkt → 200 zonder werk (idempotent);
//  - gebeurtenis zonder koppeling aan een gebruiker → 200 maar vastgelegd als
//    'unlinked' (zichtbaar in /beheer/betalingen; eindeloos retryen helpt niet).

import { syncLifetime, syncSubscription, type BillingDeps, type SyncResult } from "@/lib/stripe/sync";
import type { SubscriptionFacts } from "@/lib/stripe/entitlements";

/** Minimale Stripe-eventvorm die we gebruiken (los van SDK-types). */
export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export type EventStatus = "processed" | "failed" | "unlinked" | "ignored";

export interface EventStore {
  /** true als dit event-id al eerder met succes is verwerkt. */
  alreadyProcessed(eventId: string): Promise<boolean>;
  record(eventId: string, type: string, status: EventStatus, detail: string | null): Promise<void>;
}

export interface WebhookDeps {
  secret: string | undefined;
  /** Gooit bij ongeldige handtekening. */
  constructEvent(rawBody: string, signature: string, secret: string): StripeEventLike;
  retrieveSubscription(id: string): Promise<SubscriptionFacts | null>;
  billing: BillingDeps;
  events: EventStore;
  log: (message: string, fields?: Record<string, string | number | boolean | null>) => void;
}

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.trial_will_end",
  "invoice.paid",
  "invoice.payment_succeeded",
  "invoice.payment_failed",
] as const;

const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const idOf = (v: unknown): string | null => (typeof v === "string" ? v : v && typeof v === "object" ? str((v as { id?: unknown }).id) : null);

function invoiceSubscriptionId(invoice: Record<string, unknown>): string | null {
  const parent = invoice.parent as { subscription_details?: { subscription?: unknown } } | undefined;
  return idOf(parent?.subscription_details?.subscription) ?? idOf(invoice.subscription);
}

/** Subscription uit het event zelf als terugval wanneer ophalen faalt (bv. net verwijderd). */
function factsFromEventObject(o: Record<string, unknown>): SubscriptionFacts | null {
  const id = str(o.id);
  if (!id || !str(o.status)) return null;
  const item = (o.items as { data?: Array<Record<string, unknown>> } | undefined)?.data?.[0];
  const end = (item?.current_period_end ?? o.current_period_end) as number | undefined;
  const price = item?.price as { id?: string; recurring?: { interval?: string } } | undefined;
  const iso = (n: unknown) => (typeof n === "number" ? new Date(n * 1000).toISOString() : null);
  return {
    id,
    customerId: idOf(o.customer),
    status: o.status as SubscriptionFacts["status"],
    currentPeriodEnd: iso(end),
    cancelAtPeriodEnd: o.cancel_at_period_end === true,
    trialEnd: iso(o.trial_end),
    priceId: price?.id ?? null,
    interval: price?.recurring?.interval ?? null,
    metadata: (o.metadata as Record<string, string>) ?? {},
  };
}

async function process(deps: WebhookDeps, event: StripeEventLike): Promise<SyncResult | null> {
  const obj = event.data.object;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const meta = (obj.metadata as Record<string, string> | null) ?? {};
      const hints = {
        metadataUserId: meta.userId ?? meta.user_id ?? null,
        clientReferenceId: str(obj.client_reference_id),
        email: str((obj.customer_details as { email?: unknown } | null)?.email),
      };
      if (obj.mode === "payment") {
        return syncLifetime(deps.billing, { paymentStatus: String(obj.payment_status), customerId: idOf(obj.customer), hints });
      }
      const subId = idOf(obj.subscription);
      if (obj.mode !== "subscription" || !subId) return null;
      const sub = await deps.retrieveSubscription(subId);
      if (!sub) throw new Error(`subscription ${subId} niet op te halen`);
      return syncSubscription(deps.billing, sub, hints, { replaceOld: true });
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.trial_will_end": {
      const subId = str(obj.id);
      if (!subId) return null;
      const sub = (await deps.retrieveSubscription(subId).catch(() => null)) ?? factsFromEventObject(obj);
      if (!sub) throw new Error(`subscription ${subId} onbekend`);
      // Bij 'deleted' is het event zelf leidend (retrieve kan nog 'active' tonen in een race).
      return syncSubscription(deps.billing, event.type === "customer.subscription.deleted" ? { ...sub, status: "canceled" } : sub);
    }
    case "invoice.paid":
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const subId = invoiceSubscriptionId(obj);
      if (!subId) return null;
      const sub = await deps.retrieveSubscription(subId);
      if (!sub) throw new Error(`subscription ${subId} niet op te halen`);
      // Een mislukte teamfactuur zet het team direct op past_due (bestaand gedrag).
      if (event.type === "invoice.payment_failed") {
        const team = await deps.billing.findTeamBySubscription(subId);
        if (team) {
          await deps.billing.updateTeam(team.id, { status: "past_due", current_period_end: sub.currentPeriodEnd });
          return { kind: "team", teamId: team.id };
        }
      }
      return syncSubscription(deps.billing, sub);
    }
    default:
      return null;
  }
}

export async function handleStripeWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  if (!deps.secret) {
    deps.log("STRIPE_WEBHOOK_SECRET ontbreekt");
    return Response.json({ error: "STRIPE_WEBHOOK_SECRET ontbreekt in deze omgeving." }, { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  const raw = await request.text(); // ruwe body: nodig voor de handtekening
  let event: StripeEventLike;
  try {
    if (!signature) throw new Error("geen stripe-signature");
    event = deps.constructEvent(raw, signature, deps.secret);
  } catch {
    deps.log("ongeldige webhook-handtekening (verkeerde secret, test/live-mix of gewijzigde body?)");
    return Response.json({ error: "Ongeldige webhook-signature." }, { status: 400 });
  }

  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) {
    return Response.json({ received: true, ignored: event.type });
  }

  try {
    if (await deps.events.alreadyProcessed(event.id)) {
      return Response.json({ received: true, duplicate: true });
    }
    const result = await process(deps, event);
    const status: EventStatus = !result ? "ignored" : result.kind === "unlinked" ? "unlinked" : result.kind === "ignored" ? "ignored" : "processed";
    await deps.events.record(event.id, event.type, status, result && "reason" in result ? result.reason : null).catch(() => undefined);
    return Response.json({ received: true, result: result?.kind ?? "none" });
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 300) : "onbekende fout";
    deps.log("webhook-verwerking mislukt", { event: event.id, type: event.type, reason });
    await deps.events.record(event.id, event.type, "failed", reason).catch(() => undefined);
    return Response.json({ error: "Verwerking mislukt; Stripe probeert opnieuw." }, { status: 500 });
  }
}
