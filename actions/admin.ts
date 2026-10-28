"use server";

import { revalidatePath } from "next/cache";

import { getAdminContext } from "@/lib/auth/admin";
import { RESTORABLE_COLUMNS, activityEditSchema, bulkPatch, bulkSchema, stateSchema } from "@/lib/beheer/schemas";
import { canChangeState, stateToColumns } from "@/lib/beheer/state";
import { floorplanVersionsSelect } from "@/lib/services/adminFloorplans";

// Beheeracties (alleen admin/owner). Elke actie: rol server-side controleren (database), invoer valideren met zod, rate limit,
// en schrijven met de gewone sessie — RLS (public.is_admin()) is de echte grens, er is geen service-role-sleutel nodig.
// Elke wijziging komt via databasetriggers in public.audit_log (supabase/migrations/admin_roles_audit.sql).

type Result<T = object> = ({ error: string } | ({ success: true } & T));
const GENERIC = "Opslaan is mislukt. Probeer het opnieuw.";
const fail = (error: string) => ({ error }) as const;

function refresh(id?: string) {
  revalidatePath("/beheer");
  if (id) {
    revalidatePath(`/beheer/activiteiten/${id}`);
    revalidatePath(`/activiteit/${id}`);
  }
  revalidatePath("/activiteiten");
  revalidatePath("/");
}

export async function adminUpdateActivity(id: string, input: unknown): Promise<Result> {
  const ctx = await getAdminContext({ write: true });
  if ("error" in ctx) return ctx;
  const parsed = activityEditSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ongeldige invoer.");
  const { error, data } = await ctx.supabase.from("activiteiten").update(parsed.data).eq("id", id).select("id");
  if (error || !data?.length) return fail(GENERIC);
  refresh(id);
  return { success: true };
}

export async function adminSetActivityState(id: string, target: unknown): Promise<Result> {
  const ctx = await getAdminContext({ write: true });
  if ("error" in ctx) return ctx;
  const state = stateSchema.safeParse(target);
  if (!state.success) return fail("Onbekende status.");
  const { data: current } = await ctx.supabase.from("activiteiten").select("visibility").eq("id", id).maybeSingle();
  if (!current) return fail("Activiteit niet gevonden.");
  if (!canChangeState(current)) return fail("Teamactiviteiten wisselen niet van status via het beheer.");
  const { error, data } = await ctx.supabase.from("activiteiten").update(stateToColumns(state.data)).eq("id", id).select("id");
  if (error || !data?.length) return fail(GENERIC);
  refresh(id);
  return { success: true };
}

export async function adminBulkUpdate(input: unknown): Promise<Result<{ updated: number }>> {
  const ctx = await getAdminContext({ write: true });
  if ("error" in ctx) return ctx;
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Ongeldige invoer.");
  if (parsed.data.state) {
    const { data: team } = await ctx.supabase.from("activiteiten").select("id").in("id", parsed.data.ids).eq("visibility", "team");
    if (team?.length) return fail(`${team.length} teamactiviteit(en) in de selectie: haal die uit de selectie om de status te wijzigen.`);
  }
  const { error, data } = await ctx.supabase.from("activiteiten").update(bulkPatch(parsed.data)).in("id", parsed.data.ids).select("id");
  if (error) return fail(GENERIC);
  refresh();
  return { success: true, updated: data?.length ?? 0 };
}

export async function adminSoftDelete(id: string, restore = false): Promise<Result> {
  const ctx = await getAdminContext({ write: true });
  if ("error" in ctx) return ctx;
  const patch = restore ? { deleted_at: null, deleted_by: null } : { deleted_at: new Date().toISOString(), deleted_by: ctx.user.id };
  const { error, data } = await ctx.supabase.from("activiteiten").update(patch).eq("id", id).select("id");
  if (error || !data?.length) return fail(GENERIC);
  refresh(id);
  return { success: true };
}

/** Definitief verwijderen: alleen na het intypen van de exacte titel (ook server-side gecontroleerd). */
export async function adminHardDelete(id: string, titleConfirmation: string): Promise<Result> {
  const ctx = await getAdminContext({ write: true });
  if ("error" in ctx) return ctx;
  const { data: activity } = await ctx.supabase.from("activiteiten").select("titel").eq("id", id).maybeSingle();
  if (!activity) return fail("Activiteit niet gevonden.");
  if (titleConfirmation.trim() !== String(activity.titel).trim()) return fail("De ingetypte titel komt niet overeen.");
  const { error, data } = await ctx.supabase.from("activiteiten").delete().eq("id", id).select("id");
  if (error || !data?.length) return fail(GENERIC);
  refresh();
  return { success: true };
}

/** Zet één wijziging uit het auditlog terug (alleen bewerkbare kolommen); de terugzetting komt zelf ook in het log. */
export async function adminRestoreAuditChange(auditId: number, field?: string): Promise<Result> {
  const ctx = await getAdminContext({ write: true });
  if ("error" in ctx) return ctx;
  const { data: entry } = await ctx.supabase.from("audit_log").select("entity_type, entity_id, action, changes").eq("id", auditId).maybeSingle();
  if (!entry || entry.entity_type !== "activiteit" || entry.action !== "update") return fail("Deze wijziging kan niet worden teruggezet.");
  const changes = entry.changes as Record<string, { old: unknown; new: unknown }>;
  const patch: Record<string, unknown> = {};
  for (const [column, change] of Object.entries(changes)) {
    if (field && column !== field) continue;
    if (RESTORABLE_COLUMNS.includes(column)) patch[column] = change.old;
  }
  if (Object.keys(patch).length === 0) return fail("Geen terug te zetten velden in deze wijziging.");
  const { error, data } = await ctx.supabase.from("activiteiten").update(patch).eq("id", entry.entity_id).select("id");
  if (error || !data?.length) return fail(GENERIC);
  refresh(entry.entity_id);
  return { success: true };
}

export async function adminRemoveActivityImage(id: string): Promise<Result> {
  const ctx = await getAdminContext({ write: true });
  if ("error" in ctx) return ctx;
  const { error, data } = await ctx.supabase.from("activiteiten").update({ afbeelding: null }).eq("id", id).select("id");
  if (error || !data?.length) return fail(GENERIC);
  refresh(id);
  return { success: true };
}

/** Koppelt een plattegrond aan een activiteit, of maakt hem los (activityId = null). */
export async function adminLinkFloorplan(floorplanId: string, activityId: string | null): Promise<Result> {
  const ctx = await getAdminContext({ write: true });
  if ("error" in ctx) return ctx;
  if (activityId) {
    const { data: activity } = await ctx.supabase.from("activiteiten").select("id, author_id").eq("id", activityId).maybeSingle();
    if (!activity) return fail("Activiteit niet gevonden.");
    // Alleen een plattegrond van de auteur of van een beheerder wordt bij de activiteit getoond (zie floorplans_curated_by_admin.sql).
    const { data: floorplan } = await ctx.supabase.from("floorplans_3d").select("user_id").eq("id", floorplanId).maybeSingle();
    if (!floorplan) return fail("Plattegrond niet gevonden.");
    const { data: curator } = await ctx.supabase.rpc("is_curator", { p_user_id: floorplan.user_id });
    if (floorplan.user_id !== activity.author_id && curator !== true) {
      return fail("Alleen een plattegrond van de auteur of van een beheerder kan hieraan worden gekoppeld. Maak anders een nieuwe plattegrond.");
    }
  }
  const { error, data } = await ctx.supabase.from("floorplans_3d").update({ activiteit_id: activityId }).eq("id", floorplanId).select("id");
  if (error || !data?.length) return fail(GENERIC);
  refresh(activityId ?? undefined);
  return { success: true };
}

export async function adminListFloorplanVersions(floorplanId: string): Promise<Result<{ versions: { id: string; version: number; naam: string; saved_at: string; items: number; replaced_by_name: string | null }[] }>> {
  const ctx = await getAdminContext();
  if ("error" in ctx) return ctx;
  return { success: true, versions: await floorplanVersionsSelect(ctx.supabase, floorplanId) };
}

export async function adminRestoreFloorplanVersion(versionId: string): Promise<Result> {
  const ctx = await getAdminContext({ write: true });
  if ("error" in ctx) return ctx;
  const { error } = await ctx.supabase.rpc("restore_floorplan_version", { p_version_id: versionId });
  if (error) return fail("Terugzetten is mislukt.");
  return { success: true };
}
