// 3D-tegenhanger van types/material.ts se `Material` — rijen uit
// public.material_models (supabase/migrations/material_models_3d.sql).
// Begint LEEG; gevuld via `npm run import:materials` (scripts/import-materials.ts),
// nooit automatisch afgeleid van de 2D-materialenbibliotheek. `categorie`
// is net als bij de 2D-tabel een vrije tekstkolom — nieuwe categorieën
// verschijnen in de UI onder hun eigen label zodra ze voorkomen.

export type MaterialModel = {
  id: string;
  slug: string;
  material_id: string | null;
  naam: string;
  categorie: string;
  /** Publieke URL (materials-3d-bucket), niet het rauwe storage-pad. */
  model_url: string;
  preview_url: string;
  length_m: number;
  width_m: number;
  height_m: number;
  stackable: boolean;
  sort_order: number;
  /** Alleen gezet door de dev-only placeholder-seed (zie
   * lib/devFloorplan3dSeed.ts) wanneer material_models leeg is — ItemMesh
   * rendert dan een gekleurd blokje i.p.v. useGLTF op een niet-bestaande
   * URL te proberen. Nooit gezet voor echte, geïmporteerde modellen. */
  devColor?: string;
};
