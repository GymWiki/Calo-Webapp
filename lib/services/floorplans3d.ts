import type { SupabaseClient } from "@supabase/supabase-js";
import { floorplan3dDataSchema, type Floorplan3dData } from "@/types/floorplan3d";
import { withFloorplanThumbnail, type ActivityImageFields } from "@/lib/activities/visual";
import { createServiceClient } from "@/utils/supabase/service";

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
  const { publicUrl } = supabase.storage.from(PREVIEW_BUCKET).getPublicUrl(`${ownerId}/${floorplanId}.jpg`).data;
  return `${publicUrl}?v=${Date.parse(updatedAt) || 0}`;
}

/**
 * De 3D-plattegrond die bij een activiteit hoort (floorplans_3d.activiteit_id)
 * — de meest recent bijgewerkte van de AUTEUR van de activiteit. Een lege
 * uitkomst (geen koppeling, geen leesrecht, nog geen migratie) is gewoon
 * `null`: de activiteitpagina toont dan niets.
 */
/**
 * Id's van beheerders (admin/owner): hun plattegronden gelden naast die van de AUTEUR als "de" plattegrond van een activiteit
 * (ook bij bibliotheekactiviteiten zonder auteur). Zie supabase/migrations/floorplans_curated_by_admin.sql; zonder die migratie
 * is de uitkomst leeg en geldt alleen de auteursregel van vroeger.
 */
export async function getCuratorIds(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.rpc("curator_ids");
  return error || !Array.isArray(data) ? new Set() : new Set(data as string[]);
}

export async function getFloorplanForActivity(
  supabase: SupabaseClient,
  activityId: string,
  authorId: string | null,
): Promise<ActivityFloorplan | null> {
  const { data: rows, error } = await supabase
    .from("floorplans_3d")
    .select("id, naam, user_id, data, updated_at")
    .eq("activiteit_id", activityId)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error || !rows?.length) return null;
  // Nieuwste plattegrond van de auteur of van een beheerder (RLS laat bekijkers sowieso alleen die zien).
  const curators = await getCuratorIds(supabase);
  const data = rows.find((row) => row.user_id === authorId || curators.has(row.user_id));
  if (!data) return null;

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

type ThumbnailRow = {
  id: string;
  user_id: string;
  activiteit_id: string;
  updated_at: string;
  first_item: unknown;
  first_field: unknown;
};

type ActivityRef = { id: string; author_id: string | null };

/**
 * Thumbnails van de 3D-plattegronden bij een lijst activiteiten (kaarten, OG, PDF) in één batch-query: per activiteit de
 * meest recent bijgewerkte plattegrond van de AUTEUR of een beheerder die inhoud heeft (minstens één item of afgezet veld; alleen het
 * eerste element wordt opgehaald, niet de hele JSON). Lege uitkomst bij een fout: de lijst valt dan terug op de afbeelding.
 */
export async function getFloorplanThumbnails(
  supabase: SupabaseClient,
  activities: ActivityRef[],
): Promise<Map<string, string>> {
  const thumbs = new Map<string, string>();
  const authors = new Map(activities.map((a) => [a.id, a.author_id]));
  if (authors.size === 0) return thumbs;

  const { data, error } = await supabase
    .from("floorplans_3d")
    .select("id, user_id, activiteit_id, updated_at, first_item:data->items->0, first_field:data->coneFields->0")
    .in("activiteit_id", [...authors.keys()])
    .order("updated_at", { ascending: false })
    .returns<ThumbnailRow[]>();
  if (error || !data) return thumbs;

  const curators = data.length > 0 ? await getCuratorIds(supabase) : new Set<string>();
  for (const row of data) {
    if (thumbs.has(row.activiteit_id)) continue; // nieuwste eerst
    if (authors.get(row.activiteit_id) !== row.user_id && !curators.has(row.user_id)) continue; // auteur of beheerder
    if (row.first_item == null && row.first_field == null) continue; // leeg: niet tonen
    thumbs.set(row.activiteit_id, floorplanPreviewUrl(supabase, row.user_id, row.id, row.updated_at));
  }
  return thumbs;
}

/** Zet op elke activiteit met een geldige 3D-plattegrond de 3D-thumbnail als beeld (alleen in het geheugen). */
export async function attachFloorplanThumbnails<T extends ActivityRef & ActivityImageFields>(
  supabase: SupabaseClient,
  activities: T[],
): Promise<T[]> {
  if (activities.length === 0) return activities;
  const thumbs = await getFloorplanThumbnails(supabase, activities);
  if (thumbs.size === 0) return activities;
  return activities.map((activity) => withFloorplanThumbnail(activity, thumbs.get(activity.id)));
}

/**
 * Voor de publieke pagina's (anon, zonder leesrecht op floorplans_3d): thumbnails voor publiek zichtbare activiteiten.
 * Gebruikt de service-client voor precies deze twee smalle opzoekingen (auteur van de activiteit + plattegrond van die
 * auteur); er komt alleen een thumbnail-URL uit, nooit plattegronddata. Zonder service-sleutel of bij een fout: lege map.
 */
export async function getPublicFloorplanThumbnails(activityIds: string[]): Promise<Map<string, string>> {
  if (activityIds.length === 0) return new Map();
  try {
    const service = createServiceClient();
    const { data: owners } = await service
      .from("activiteiten")
      .select("id, author_id")
      .in("id", activityIds)
      .returns<ActivityRef[]>();
    return await getFloorplanThumbnails(service, owners ?? []);
  } catch {
    return new Map();
  }
}
