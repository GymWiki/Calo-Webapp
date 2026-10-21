import type { SupabaseClient } from "@supabase/supabase-js";
import type { MaterialModel } from "@/types/materialModel";

const BUCKET = "materials-3d";
const MATERIAL_MODEL_SELECT =
  "id, slug, material_id, naam, categorie, model_path, preview_path, length_m, width_m, height_m, stackable, sort_order";

type MaterialModelRow = {
  id: string;
  slug: string;
  material_id: string | null;
  naam: string;
  categorie: string;
  model_path: string;
  preview_path: string;
  length_m: number;
  width_m: number;
  height_m: number;
  stackable: boolean;
  sort_order: number;
};

function toMaterialModel(supabase: SupabaseClient, row: MaterialModelRow): MaterialModel {
  return {
    id: row.id,
    slug: row.slug,
    material_id: row.material_id,
    naam: row.naam,
    categorie: row.categorie,
    model_url: supabase.storage.from(BUCKET).getPublicUrl(row.model_path).data.publicUrl,
    preview_url: supabase.storage.from(BUCKET).getPublicUrl(row.preview_path).data.publicUrl,
    length_m: Number(row.length_m),
    width_m: Number(row.width_m),
    height_m: Number(row.height_m),
    stackable: row.stackable,
    sort_order: row.sort_order,
  };
}

/**
 * Haalt alle actieve 3D-materiaalmodellen op (menu van de 3D-editor) —
 * werkt zowel server- als client-side, net als getAllMaterials
 * (lib/services/materials.ts), dus deze functie neemt een
 * al-geïnitialiseerde SupabaseClient als argument i.p.v. er zelf een te
 * maken.
 */
export async function getActiveMaterialModels(supabase: SupabaseClient): Promise<MaterialModel[]> {
  const { data, error } = await supabase
    .from("material_models")
    .select(MATERIAL_MODEL_SELECT)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("naam", { ascending: true });

  if (error) {
    throw new Error(`Kon 3D-materiaalmodellen niet ophalen: ${error.message}`);
  }

  return (data ?? []).map((row) => toMaterialModel(supabase, row as MaterialModelRow));
}

/**
 * Eén model op slug — gebruikt bij het laden van een opgeslagen
 * plattegrond om elk item tegen de op dat moment actieve modellenlijst te
 * valideren (zie Floorplan3dEditor.tsx: een onbekende ÓF inactieve slug
 * wordt een grijs "Onbekend item"-vakje, geen crash) — vandaar dezelfde
 * `active`-filter als getActiveMaterialModels: niet gevonden hier betekent
 * "niet (meer) bruikbaar", ongeacht of de rij ooit bestond.
 */
export async function getMaterialModelsBySlugs(
  supabase: SupabaseClient,
  slugs: string[],
): Promise<MaterialModel[]> {
  if (slugs.length === 0) return [];

  const { data, error } = await supabase
    .from("material_models")
    .select(MATERIAL_MODEL_SELECT)
    .eq("active", true)
    .in("slug", [...new Set(slugs)]);

  if (error) {
    throw new Error(`Kon 3D-materiaalmodellen niet ophalen: ${error.message}`);
  }

  return (data ?? []).map((row) => toMaterialModel(supabase, row as MaterialModelRow));
}
