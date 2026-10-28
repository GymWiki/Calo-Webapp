import type { SupabaseClient } from "@supabase/supabase-js";

export type FloorplanVersionRow = { id: string; version: number; naam: string; saved_at: string; items: number; replaced_by_name: string | null };

/** Laatste versies van een plattegrond (RLS: beheerder of eigenaar), met aantal items en wie de volgende wijziging deed. */
export async function floorplanVersionsSelect(supabase: SupabaseClient, floorplanId: string): Promise<FloorplanVersionRow[]> {
  const { data } = await supabase
    .from("floorplan_versions")
    .select("id, version, naam, saved_at, replaced_by, data")
    .eq("floorplan_id", floorplanId)
    .order("version", { ascending: false })
    .limit(10);
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.replaced_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: users } = await supabase.from("users").select("id, first_name, last_name").in("id", ids);
    for (const u of users ?? []) names.set(u.id, `${u.first_name} ${u.last_name}`.trim());
  }
  return rows.map((r) => ({
    id: r.id,
    version: r.version,
    naam: r.naam,
    saved_at: r.saved_at,
    items: Array.isArray((r.data as { items?: unknown[] })?.items) ? (r.data as { items: unknown[] }).items.length : 0,
    replaced_by_name: r.replaced_by ? names.get(r.replaced_by) ?? null : null,
  }));
}

export type FloorplanAdminInfo = { floorplanId: string; ownerName: string; ownerIsSelf: boolean; activityId: string | null; activityTitle: string | null };

/** Eigenaar en gekoppelde activiteit van een plattegrond, voor de "Beheer"-badge in de editor (alleen aanroepen voor beheerders). */
export async function getFloorplanAdminInfo(supabase: SupabaseClient, floorplanId: string, currentUserId: string): Promise<FloorplanAdminInfo | null> {
  const { data: floorplan } = await supabase.from("floorplans_3d").select("user_id, activiteit_id").eq("id", floorplanId).maybeSingle();
  if (!floorplan) return null;
  const [{ data: owner }, { data: activity }] = await Promise.all([
    supabase.from("users").select("first_name, last_name").eq("id", floorplan.user_id).maybeSingle(),
    floorplan.activiteit_id
      ? supabase.from("activiteiten").select("titel").eq("id", floorplan.activiteit_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return {
    floorplanId,
    ownerName: owner ? `${owner.first_name} ${owner.last_name}`.trim() || "Onbekende gebruiker" : "Onbekende gebruiker",
    ownerIsSelf: floorplan.user_id === currentUserId,
    activityId: floorplan.activiteit_id ?? null,
    activityTitle: (activity as { titel?: string } | null)?.titel ?? null,
  };
}
