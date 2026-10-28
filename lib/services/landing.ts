import { SHOW_PERSONS_IN_LIBRARY, PERSONS_ID } from "@/lib/constants/libraryTaxonomy";
import { getAllPublicActivities, type PublicActivity } from "@/lib/services/publicActivities";
import { createPublicClient } from "@/utils/supabase/public";

const PREVIEW_COUNT = 6;

export type LandingSnapshot = {
  /** Publieke, indexeerbare activiteiten (public.activiteiten_publiek), of null als ze niet geladen konden worden. */
  activityCount: number | null;
  /** Aantal verschillende leerlijnen in die activiteiten. */
  leerlijnCount: number | null;
  /** Actieve 3D-materialen die in de bibliotheek van de editor staan (zonder de verborgen "personen"). */
  materialCount: number | null;
  /** Kaarten voor de hero en de bibliotheekpreview: activiteiten met 3D-plattegrond eerst, daarna de meest gewaardeerde. */
  preview: PublicActivity[];
};

/** Een activiteit met een 3D-plattegrond heeft de 3D-preview als `afbeelding` (zie lib/activities/visual.ts). */
export const hasFloorplanThumbnail = (activity: Pick<PublicActivity, "afbeelding">) => Boolean(activity.afbeelding?.includes("floorplan-previews"));

export function pickPreview(activities: PublicActivity[], count = PREVIEW_COUNT): PublicActivity[] {
  return activities
    .filter((activity) => Boolean(activity.afbeelding))
    .sort((a, b) => Number(hasFloorplanThumbnail(b)) - Number(hasFloorplanThumbnail(a)) || b.like_count - a.like_count || a.titel.localeCompare(b.titel, "nl"))
    .slice(0, count);
}

async function countMaterials(): Promise<number | null> {
  let query = createPublicClient().from("material_models").select("id", { count: "exact", head: true }).eq("active", true);
  if (!SHOW_PERSONS_IN_LIBRARY) query = query.neq("categorie", PERSONS_ID);
  const { count, error } = await query;
  return error ? null : count;
}

/**
 * Voedt de publieke landingspagina. Alles komt uit de publieke view en publieke policies (anon-client, geen service-role),
 * en elk onderdeel faalt los: een cijfer dat niet geladen kan worden is `null` en de pagina laat het dan weg.
 */
export async function getLandingSnapshot(): Promise<LandingSnapshot> {
  const [activities, materialCount] = await Promise.allSettled([getAllPublicActivities(), countMaterials()]);
  const list = activities.status === "fulfilled" ? activities.value : null;
  return {
    activityCount: list ? list.length : null,
    leerlijnCount: list ? new Set(list.map((a) => a.leerlijn).filter(Boolean)).size : null,
    materialCount: materialCount.status === "fulfilled" ? materialCount.value : null,
    preview: list ? pickPreview(list) : [],
  };
}
