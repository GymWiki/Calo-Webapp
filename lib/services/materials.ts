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
 * De meest gebruikte materiaalnamen (canvas-gebruik, zie usage_count) — backt
 * de optionele "Beschikbaar materiaal"-checklist in de AI Activiteiten
 * Generator (app/(protected)/les-maken/ai-lesson-wizard.tsx): een simpele
 * checklist van veelgebruikt standaardmateriaal i.p.v. een leeg vrij veld,
 * zodat de AI geen materiaal voorschrijft dat niet voorhanden is.
 */
export async function getPopularMaterialNames(
  supabase: SupabaseClient,
  limit = 16,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("materials")
    .select("name")
    .order("usage_count", { ascending: false })
    .order("name", { ascending: true })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.name as string);
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
