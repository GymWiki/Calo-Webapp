import type { SupabaseClient } from "@supabase/supabase-js";
import type { Material } from "@/types/material";

const MATERIAL_SELECT = "id, name, category, image_url, usage_count, is_favorite, created_at";

/**
 * Haalt de volledige materialenbibliotheek op. Wordt client-side aangeroepen
 * (GymCanvas is dynamic-imported met ssr:false, want Konva raakt `window`
 * aan), dus deze functie neemt de al-geïnitialiseerde SupabaseClient als
 * argument in plaats van er zelf een op te bouwen — werkt zo evengoed
 * server-side mocht dat ooit nodig zijn.
 */
export async function getAllMaterials(supabase: SupabaseClient): Promise<Material[]> {
  const { data, error } = await supabase
    .from("materials")
    .select(MATERIAL_SELECT)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Kon materialen niet ophalen: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Best-effort: telt hoe vaak een materiaal op het canvas is gebruikt, voor
 * de "meest gebruikt"-sectie. Een falende teller mag het slepen van een
 * materiaal naar het canvas nooit blokkeren.
 */
export async function incrementMaterialUsage(
  supabase: SupabaseClient,
  materialId: string,
): Promise<void> {
  try {
    await supabase.rpc("increment_material_usage", { p_material_id: materialId });
  } catch {
    // Best-effort — zie toelichting hierboven.
  }
}
