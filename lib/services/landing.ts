import { createServiceClient } from "@/utils/supabase/service";
import { ACTIVITY_LIST_SELECT } from "@/lib/services/activities";
import type { LibraryListItem } from "@/components/library-item-card";
import type { Activity } from "@/types/activity";

const PREVIEW_COUNT = 6;

export type LandingSnapshot = {
  /** Totaal aantal goedgekeurde, publiek gedeelde activiteiten — het "X activiteiten en groeiend"-cijfer op de landingspagina. */
  activityCount: number;
  /** Een handvol representatieve kaarten voor de bibliotheek-preview. */
  previewItems: LibraryListItem[];
};

/**
 * Voedt de publieke (niet-ingelogde) landingspagina — daarom de
 * service-role client i.p.v. de gewone cookie-gebonden server-client: de
 * "Activiteiten: goedgekeurd of eigen"-RLS-policy geldt alleen `to
 * authenticated`, dus een anonieme bezoeker zonder sessie zou met de
 * normale client altijd 0 rijen terugkrijgen. Haalt bewust alleen de
 * velden op die LibraryItemCard al toont (via ACTIVITY_LIST_SELECT) — geen
 * volledige activiteit-inhoud wordt hier publiek blootgesteld, alleen
 * dezelfde kaart-samenvatting die de preview-slot-feature ook al aan
 * free_blocked-gebruikers toont (zie /zoeken).
 */
export async function getLandingSnapshot(): Promise<LandingSnapshot> {
  const supabase = createServiceClient();

  const [{ count }, { data: previewRows, error: previewError }] = await Promise.all([
    supabase
      .from("activiteiten")
      .select("id", { count: "exact", head: true })
      .eq("status", "approved")
      .eq("is_public", true),
    supabase
      .from("activiteiten")
      .select(ACTIVITY_LIST_SELECT)
      .eq("status", "approved")
      .eq("is_public", true)
      .or("afbeelding.not.is.null,diagram_image_url.not.is.null")
      .order("created_at", { ascending: false })
      .limit(PREVIEW_COUNT)
      .returns<Activity[]>(),
  ]);

  if (previewError) {
    throw new Error(`Kon landingspagina-preview niet ophalen: ${previewError.message}`);
  }

  const previewItems: LibraryListItem[] = (previewRows ?? []).map((activity) => ({
    id: activity.id,
    source: activity.author_id ? "public" : "gymwiki",
    activity,
  }));

  return {
    activityCount: count ?? 0,
    previewItems,
  };
}
