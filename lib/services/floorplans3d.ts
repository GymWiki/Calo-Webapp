import type { SupabaseClient } from "@supabase/supabase-js";
import { floorplan3dDataSchema, type Floorplan3dData } from "@/types/floorplan3d";

const PREVIEW_BUCKET = "floorplan-previews";

export type ActivityFloorplan = {
  id: string;
  naam: string;
  ownerId: string;
  data: Floorplan3dData;
  /** Publieke URL van de thumbnail; kan 404'en als er (nog) geen is — de UI valt dan terug. */
  previewUrl: string;
};

export function floorplanPreviewUrl(supabase: SupabaseClient, ownerId: string, floorplanId: string, updatedAt: string): string {
  const { publicUrl } = supabase.storage.from(PREVIEW_BUCKET).getPublicUrl(`${ownerId}/${floorplanId}.webp`).data;
  return `${publicUrl}?v=${Date.parse(updatedAt) || 0}`;
}

/**
 * De 3D-plattegrond die bij een activiteit hoort (floorplans_3d.activiteit_id)
 * — de meest recent bijgewerkte van de AUTEUR van de activiteit. Een lege
 * uitkomst (geen koppeling, geen leesrecht, nog geen migratie) is gewoon
 * `null`: de activiteitpagina toont dan niets.
 */
export async function getFloorplanForActivity(
  supabase: SupabaseClient,
  activityId: string,
  authorId: string | null,
): Promise<ActivityFloorplan | null> {
  if (!authorId) return null;

  const { data, error } = await supabase
    .from("floorplans_3d")
    .select("id, naam, user_id, data, updated_at")
    .eq("activiteit_id", activityId)
    .eq("user_id", authorId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Zelfde tolerante parse als de editor: oudere plattegronden hebben geen `coneFields`.
  const parsed = floorplan3dDataSchema.safeParse(data.data);
  if (!parsed.success) return null;

  return {
    id: data.id,
    naam: data.naam,
    ownerId: data.user_id,
    data: parsed.data,
    previewUrl: floorplanPreviewUrl(supabase, data.user_id, data.id, data.updated_at),
  };
}

/** Eigen plattegronden die al aan deze activiteit hangen — voor de eigenaar ("Bewerken in editor"). */
export async function getOwnFloorplanIdForActivity(
  supabase: SupabaseClient,
  activityId: string,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("floorplans_3d")
    .select("id")
    .eq("activiteit_id", activityId)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
