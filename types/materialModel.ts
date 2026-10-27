// 3D-tegenhanger van types/material.ts se `Material` — rijen uit
// public.material_models (supabase/migrations/material_models_3d.sql).
// Begint LEEG; gevuld via `npm run import:materials` (scripts/import-materials.ts),
// nooit automatisch afgeleid van de 2D-materialenbibliotheek. `categorie`
// is één van de hoofdcategorieën uit lib/constants/libraryTaxonomy.ts
// (of "personen"); de oorspronkelijke vrije-tekst categorie staat in
// `categorie_oud`. Subgroep, sporten en tags sturen filter en zoeken.

export type MaterialModel = {
  id: string;
  slug: string;
  material_id: string | null;
  naam: string;
  /** Hoofdcategorie-id (lib/constants/libraryTaxonomy.ts), of "personen". */
  categorie: string;
  /** Optionele subgroep binnen de categorie (bijv. Ballen > basketbal). */
  subgroep: string | null;
  /** Sport-id's voor het sportfilter; minstens één ("algemeen" als terugval). */
  sporten: string[];
  /** Vrije zoektermen. */
  tags: string[];
  /** Publieke URL (materials-3d-bucket), niet het rauwe storage-pad. */
  model_url: string;
  preview_url: string;
  length_m: number;
  width_m: number;
  height_m: number;
  stackable: boolean;
  sort_order: number;
  /** Alleen gezet door de dev-only placeholder-seed (zie
   * components/canvas-3d/devPlaceholderModels.ts) wanneer material_models leeg is — ItemMesh
   * rendert dan een gekleurd blokje i.p.v. useGLTF op een niet-bestaande
   * URL te proberen. Nooit gezet voor echte, geïmporteerde modellen. */
  devColor?: string;
};
