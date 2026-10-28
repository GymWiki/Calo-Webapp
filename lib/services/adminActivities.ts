import type { SupabaseClient } from "@supabase/supabase-js";

import { PAGE_SIZE, SORTS, type ListFilters, type StatusFilter } from "@/lib/beheer/list";
import { deriveState, type ActivityState } from "@/lib/beheer/state";

// Gegevens voor de beheerlijst en het bewerkscherm. Draait met de gewone sessie: de beheerders-RLS-policies
// (supabase/migrations/admin_roles_audit.sql) laten een admin alles lezen; voor anderen levert dit niets op.

export type AdminListRow = {
  id: string;
  titel: string;
  categorie: string | null;
  leerlijn: string | null;
  status: string;
  visibility: string;
  author_id: string | null;
  authorName: string | null;
  afbeelding: string | null;
  like_count: number;
  updated_at: string;
  deleted_at: string | null;
  has3d: boolean;
  state: ActivityState;
};

const LIST_COLUMNS = "id, titel, categorie, leerlijn, status, visibility, author_id, afbeelding, like_count, updated_at, deleted_at";
const SAFE_ID = /^[A-Za-z0-9_-]+$/;

export const EDIT_COLUMNS =
  "id, titel, doel, beginsituatie, beschrijving, arrangement, aandachtspunten, plaatje_praatje, deelnemers_regels, categorie, leerlijn, beweegthema, niveau, doelgroep, materiaal, base_materials, rule_materials, regels, loopt, lukt, leeft, min_participants, participants_bench, afbeelding, status, visibility, author_id, team_id, deleted_at, created_at, updated_at, like_count, is_ai_generated";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;

function applyStatus(query: Query, status: StatusFilter | ""): Query {
  switch (status) {
    case "concept": return query.eq("status", "draft").is("deleted_at", null);
    case "in-beoordeling": return query.eq("status", "pending").is("deleted_at", null);
    case "afgewezen": return query.eq("status", "rejected").is("deleted_at", null);
    case "gepubliceerd": return query.eq("status", "approved").eq("visibility", "public").is("deleted_at", null);
    case "gearchiveerd": return query.eq("status", "approved").neq("visibility", "public").is("deleted_at", null);
    case "verwijderd": return query.not("deleted_at", "is", null);
    default: return query.is("deleted_at", null); // standaard zonder zacht verwijderde
  }
}

async function floorplanActivityIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from("floorplans_3d").select("activiteit_id").not("activiteit_id", "is", null);
  return [...new Set((data ?? []).map((r) => r.activiteit_id as string).filter((id) => SAFE_ID.test(id)))];
}

function applyFilters(query: Query, f: ListFilters, withFloorplan: string[]): Query {
  let q = applyStatus(query, f.status);
  if (f.q) q = q.ilike("titel", `%${f.q}%`);
  if (f.categorie) q = q.eq("categorie", f.categorie);
  if (f.leerlijn) q = q.eq("leerlijn", f.leerlijn);
  if (f.afbeelding === "ja") q = q.not("afbeelding", "is", null);
  if (f.afbeelding === "nee") q = q.is("afbeelding", null);
  if (f.plattegrond === "ja") q = withFloorplan.length ? q.in("id", withFloorplan) : q.eq("id", "__geen__");
  if (f.plattegrond === "nee" && withFloorplan.length) q = q.not("id", "in", `(${withFloorplan.join(",")})`);
  return q;
}

export async function listAdminActivities(supabase: SupabaseClient, filters: ListFilters) {
  const withFloorplan = await floorplanActivityIds(supabase);
  const sort = SORTS[filters.sort];
  const from = (filters.page - 1) * PAGE_SIZE;

  const countFor = async (status: StatusFilter | "") => {
    const { count } = await applyFilters(supabase.from("activiteiten").select("id", { count: "exact", head: true }), { ...filters, status, page: 1 }, withFloorplan);
    return count ?? 0;
  };

  const [{ data, count }, ...counts] = await Promise.all([
    applyFilters(supabase.from("activiteiten").select(LIST_COLUMNS, { count: "exact" }), filters, withFloorplan)
      .order(sort.column, { ascending: sort.ascending })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1),
    countFor(""),
    countFor("concept"),
    countFor("gepubliceerd"),
    countFor("gearchiveerd"),
    countFor("in-beoordeling"),
    countFor("afgewezen"),
    countFor("verwijderd"),
  ]);

  const rows = (data ?? []) as Omit<AdminListRow, "authorName" | "has3d" | "state">[];
  const authorIds = [...new Set(rows.map((r) => r.author_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: users } = await supabase.from("users").select("id, first_name, last_name").in("id", authorIds);
    for (const u of users ?? []) names.set(u.id, `${u.first_name} ${u.last_name}`.trim());
  }
  const with3d = new Set(withFloorplan);
  const list: AdminListRow[] = rows.map((r) => ({
    ...r,
    authorName: r.author_id ? names.get(r.author_id) ?? null : null,
    has3d: with3d.has(r.id),
    state: deriveState(r),
  }));

  const [totaal, concept, gepubliceerd, gearchiveerd, inBeoordeling, afgewezen, verwijderd] = counts;
  return { rows: list, total: count ?? 0, counts: { totaal, concept, gepubliceerd, gearchiveerd, inBeoordeling, afgewezen, verwijderd } };
}

/** Alle categorieën en leerlijnen die voorkomen (voor de filters en bulkacties). */
export async function adminFilterOptions(supabase: SupabaseClient) {
  const { data } = await supabase.from("activiteiten").select("categorie, leerlijn");
  const categorieen = new Set<string>();
  const leerlijnen = new Set<string>();
  for (const r of data ?? []) {
    if (r.categorie) categorieen.add(r.categorie);
    if (r.leerlijn) leerlijnen.add(r.leerlijn);
  }
  const sort = (s: Set<string>) => [...s].sort((a, b) => a.localeCompare(b, "nl"));
  return { categorieen: sort(categorieen), leerlijnen: sort(leerlijnen) };
}

export type AuditEntry = {
  id: number;
  at: string;
  actor: string | null;
  actorRole: string | null;
  action: string;
  changes: Record<string, { old: unknown; new: unknown }>;
};

export async function getActivityAudit(supabase: SupabaseClient, activityId: string, limit = 40): Promise<AuditEntry[]> {
  const { data } = await supabase
    .from("audit_log")
    .select("id, at, actor_id, actor_role, action, changes")
    .eq("entity_type", "activiteit")
    .eq("entity_id", activityId)
    .order("id", { ascending: false })
    .limit(limit);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.actor_id).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: users } = await supabase.from("users").select("id, first_name, last_name").in("id", ids);
    for (const u of users ?? []) names.set(u.id, `${u.first_name} ${u.last_name}`.trim());
  }
  return rows.map((r) => ({
    id: r.id as number,
    at: r.at as string,
    actor: r.actor_id ? names.get(r.actor_id) ?? "Onbekend" : null,
    actorRole: r.actor_role as string | null,
    action: r.action as string,
    changes: (r.changes ?? {}) as AuditEntry["changes"],
  }));
}

export type LinkedFloorplan = { id: string; naam: string; ownerName: string; updated_at: string };

export async function getFloorplansForAdmin(supabase: SupabaseClient, activityId: string, authorId: string | null) {
  const { data } = await supabase.from("floorplans_3d").select("id, naam, user_id, activiteit_id, updated_at").order("updated_at", { ascending: false }).limit(300);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.user_id as string))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: users } = await supabase.from("users").select("id, first_name, last_name").in("id", ids);
    for (const u of users ?? []) names.set(u.id, `${u.first_name} ${u.last_name}`.trim() || "Onbekend");
  }
  const toRow = (r: (typeof rows)[number]): LinkedFloorplan => ({ id: r.id, naam: r.naam, ownerName: names.get(r.user_id) ?? "Onbekend", updated_at: r.updated_at });
  const { data: curatorData } = await supabase.rpc("curator_ids");
  const curators = new Set<string>(Array.isArray(curatorData) ? (curatorData as string[]) : []);
  // Koppelen kan alleen met een plattegrond van de auteur of van een beheerder (anders ziet niemand hem bij de activiteit).
  const linkable = (r: (typeof rows)[number]) => r.user_id === authorId || curators.has(r.user_id);
  return {
    linked: rows.filter((r) => r.activiteit_id === activityId).map(toRow),
    available: rows.filter((r) => r.activiteit_id !== activityId && linkable(r)).map((r) => ({ ...toRow(r), linkedTo: r.activiteit_id as string | null })),
  };
}
