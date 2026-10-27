import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidCategory } from "@/lib/constants/libraryTaxonomy";
import { classifyModel } from "@/lib/library/classify";
import type { MaterialModel } from "@/types/materialModel";

const BUCKET = "materials-3d";
const BASE_SELECT =
  "id, slug, material_id, naam, categorie, model_path, preview_path, length_m, width_m, height_m, stackable, sort_order";
// Nieuwe indelingskolommen (supabase/migrations/material_models_taxonomy.sql).
// Zolang die migratie nog niet is gedraaid, valt de service terug op BASE_SELECT
// en deelt classifyModel de items in — de bibliotheek werkt dus vóór én na de migratie.
const TAXONOMY_SELECT = `${BASE_SELECT}, categorie_oud, subgroep, sporten, tags`;

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
  categorie_oud?: string | null;
  subgroep?: string | null;
  sporten?: string[] | null;
  tags?: string[] | null;
};

/** Gebruikt de opgeslagen indeling als die compleet is, anders de automatische. */
function resolveTaxonomy(row: MaterialModelRow): Pick<MaterialModel, "categorie" | "subgroep" | "sporten" | "tags"> {
  if (isValidCategory(row.categorie) && row.sporten && row.sporten.length > 0) {
    return { categorie: row.categorie, subgroep: row.subgroep ?? null, sporten: row.sporten, tags: row.tags ?? [] };
  }
  const classification = classifyModel({
    slug: row.slug,
    naam: row.naam,
    categorie_oud: row.categorie_oud ?? row.categorie,
  });
  return {
    categorie: classification.categorie,
    subgroep: classification.subgroep,
    sporten: classification.sporten,
    tags: [...new Set([...(row.tags ?? []), ...classification.tags])],
  };
}

function toMaterialModel(supabase: SupabaseClient, row: MaterialModelRow): MaterialModel {
  return {
    id: row.id,
    slug: row.slug,
    material_id: row.material_id,
    naam: row.naam,
    ...resolveTaxonomy(row),
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
  const query = (select: string) =>
    supabase
      .from("material_models")
      .select(select)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("naam", { ascending: true });

  let { data, error } = await query(TAXONOMY_SELECT);
  // 42703 = undefined_column: de taxonomie-migratie is nog niet gedraaid.
  if (error?.code === "42703") ({ data, error } = await query(BASE_SELECT));

  if (error) {
    throw new Error(`Kon 3D-materiaalmodellen niet ophalen: ${error.message}`);
  }

  return ((data ?? []) as unknown as MaterialModelRow[]).map((row) => toMaterialModel(supabase, row));
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

  const query = (select: string) =>
    supabase
      .from("material_models")
      .select(select)
      .eq("active", true)
      .in("slug", [...new Set(slugs)]);

  let { data, error } = await query(TAXONOMY_SELECT);
  if (error?.code === "42703") ({ data, error } = await query(BASE_SELECT));

  if (error) {
    throw new Error(`Kon 3D-materiaalmodellen niet ophalen: ${error.message}`);
  }

  return ((data ?? []) as unknown as MaterialModelRow[]).map((row) => toMaterialModel(supabase, row));
}
