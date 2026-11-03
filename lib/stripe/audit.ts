// Pure vergelijking van Stripe-betalingen met Supabase-gebruikers (voor de
// audit- en reparatiescripts). Geen I/O, geen persoonsgegevens in logs.

export type Deviation =
  | "ok"
  | "betaald maar geen pro"
  | "pro maar niet gekoppeld"
  | "geen account gevonden"
  | "e-mail komt niet overeen"
  | "dubbele klant"
  | "pro zonder Stripe-abonnement";

export interface StripeRecord {
  customerId: string;
  email: string | null;
  name: string | null;
  subscriptionId: string | null;
  kind: "subscription" | "lifetime";
  plan: string | null;
  status: string;
  startedAt: string | null;
  lastPaidAt: string | null;
  /** Moet deze klant volgens Stripe pro hebben? (deriveEntitlement of betaalde lifetime) */
  expectedPaid: boolean;
  metadataUserId: string | null;
}

export interface SupaUser {
  id: string;
  email: string | null;
  name: string | null;
  status: string; // subscription_status
  type: string; // subscription_type
}

export interface SupaLink {
  userId: string;
  customerId: string | null;
  subscriptionId: string | null;
}

export type LinkedBy = "koppeling-tabel" | "metadata" | "e-mail" | null;

export interface AuditRow {
  record: StripeRecord;
  userId: string | null;
  linkedBy: LinkedBy;
  userPaid: boolean | null;
  userType: string | null;
  deviation: Deviation;
  notes: string[];
  proposal: { userId: string; reason: string } | null;
}

const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const nameKey = (s: string | null | undefined) => norm(s).replace(/[^a-z0-9]+/g, " ").trim();
const localPart = (email: string | null | undefined) => norm(email).split("@")[0] ?? "";

/** Voorstel voor een handmatige koppeling: zelfde naam, of vrijwel gelijke e-mail-lokaal-deel. */
export function proposeMatch(record: StripeRecord, users: SupaUser[]): { userId: string; reason: string } | null {
  const rn = nameKey(record.name);
  if (rn.length >= 5) {
    const byName = users.filter((u) => nameKey(u.name) === rn);
    if (byName.length === 1) return { userId: byName[0].id, reason: "zelfde naam" };
  }
  const rl = localPart(record.email).replace(/[^a-z0-9]/g, "");
  if (rl.length >= 5) {
    const byLocal = users.filter((u) => localPart(u.email).replace(/[^a-z0-9]/g, "") === rl);
    if (byLocal.length === 1) return { userId: byLocal[0].id, reason: "zelfde deel voor de @ bij ander domein" };
  }
  return null;
}

export function auditRecords(records: StripeRecord[], users: SupaUser[], links: SupaLink[]): AuditRow[] {
  const byId = new Map(users.map((u) => [u.id, u]));
  const byEmail = new Map<string, SupaUser[]>();
  for (const u of users) {
    const k = norm(u.email);
    if (k) byEmail.set(k, [...(byEmail.get(k) ?? []), u]);
  }
  const customersPerEmail = new Map<string, Set<string>>();
  for (const r of records) {
    const k = norm(r.email);
    if (k) customersPerEmail.set(k, (customersPerEmail.get(k) ?? new Set()).add(r.customerId));
  }

  const rows: AuditRow[] = records.map((record) => {
    const notes: string[] = [];
    let user: SupaUser | null = null;
    let linkedBy: LinkedBy = null;

    const link = links.find((l) => (record.subscriptionId && l.subscriptionId === record.subscriptionId) || l.customerId === record.customerId);
    if (link && byId.has(link.userId)) {
      user = byId.get(link.userId)!;
      linkedBy = "koppeling-tabel";
    } else if (record.metadataUserId && byId.has(record.metadataUserId)) {
      user = byId.get(record.metadataUserId)!;
      linkedBy = "metadata";
    } else {
      const candidates = byEmail.get(norm(record.email)) ?? [];
      if (candidates.length === 1) {
        user = candidates[0];
        linkedBy = "e-mail";
      } else if (candidates.length > 1) notes.push("e-mailadres hoort bij meerdere accounts");
    }

    const userPaid = user ? user.status === "paid_subscriber" : null;
    if (user && linkedBy !== "e-mail" && norm(user.email) !== norm(record.email)) notes.push("e-mailadres bij Stripe wijkt af van het account");
    const dupCustomers = customersPerEmail.get(norm(record.email));
    const duplicate = (dupCustomers?.size ?? 0) > 1;
    if (duplicate) notes.push("meerdere Stripe-klanten met hetzelfde e-mailadres");

    let deviation: Deviation = "ok";
    if (!user) deviation = "geen account gevonden";
    else if (record.expectedPaid && !userPaid) deviation = "betaald maar geen pro";
    // Wel pro, maar zonder koppeling in `subscriptions` of met een afwijkend type (bv. handmatig op pro gezet):
    // verlengen, opzeggen en het plan kloppen dan niet.
    else if (record.expectedPaid && userPaid && (linkedBy !== "koppeling-tabel" || (record.plan && user.type !== record.plan))) deviation = "pro maar niet gekoppeld";
    else if (notes.some((n) => n.startsWith("e-mailadres bij Stripe"))) deviation = "e-mail komt niet overeen";
    else if (duplicate) deviation = "dubbele klant";

    return {
      record,
      userId: user?.id ?? null,
      linkedBy,
      userPaid,
      userType: user?.type ?? null,
      deviation,
      notes,
      proposal: user ? null : proposeMatch(record, users),
    };
  });

  // Pro in Supabase zonder enige Stripe-koppeling (legacy, handmatig, store of team) — informatief.
  const linked = new Set(rows.map((r) => r.userId).filter(Boolean));
  for (const u of users) {
    if (u.status === "paid_subscriber" && !linked.has(u.id)) {
      rows.push({
        record: { customerId: "", email: u.email, name: u.name, subscriptionId: null, kind: "subscription", plan: null, status: "geen Stripe-gegevens", startedAt: null, lastPaidAt: null, expectedPaid: false, metadataUserId: null },
        userId: u.id,
        linkedBy: null,
        userPaid: true,
        userType: u.type,
        deviation: "pro zonder Stripe-abonnement",
        notes: ["handmatig, legacy, team of store-abonnement?"],
        proposal: null,
      });
    }
  }
  return rows;
}

export function summarize(rows: AuditRow[]): Record<Deviation, number> {
  const out: Record<Deviation, number> = {
    ok: 0, "betaald maar geen pro": 0, "pro maar niet gekoppeld": 0, "geen account gevonden": 0, "e-mail komt niet overeen": 0, "dubbele klant": 0, "pro zonder Stripe-abonnement": 0,
  };
  rows.forEach((r) => (out[r.deviation] += 1));
  return out;
}

/** Eerste 8 tekens + …; genoeg om op te zoeken in het Stripe-dashboard, niet genoeg om te misbruiken. */
export const short = (id: string | null | undefined) => (id ? `${id.slice(0, 8)}…` : "");
