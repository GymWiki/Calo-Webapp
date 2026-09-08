// Materialenbibliotheek (canvas-editor) — dynamisch geladen uit de
// Supabase `materials`-tabel (supabase/migrations/materials_library.sql).
// Nieuwe materialen toevoegen vereist geen codewijziging: gewoon een
// nieuwe rij (+ optioneel een foto in de 'materialen-afbeeldingen'-bucket).
// `category` is bewust een vrije tekstkolom, net als de labels hieronder —
// een nieuwe categorie in de database verschijnt in de UI onder zijn eigen
// slug als er nog geen label voor bestaat (zie getMaterialCategoryLabel).

export type Material = {
  id: string;
  name: string;
  category: string;
  image_url: string | null;
  usage_count: number;
  is_favorite: boolean;
  created_at: string;
};

// Vaste volgorde + Nederlandse labels voor de categorieën uit de
// oorspronkelijke seed — puur presentatie, geen harde constraint in de DB.
export const MATERIAL_CATEGORY_ORDER = [
  "ballen",
  "kleine_handmaterialen",
  "rackets_slagmateriaal",
  "grote_toestellen_turnmateriaal",
  "doelen_netten_mikpunten",
  "markering_organisatie_signalering",
  "rijtuigen_bewegingshulpmiddelen",
  "parachute_groepsspelmateriaal",
  "fitness_kracht",
  "water_zwemgerelateerd",
  "aangepast_inclusief_sporten",
  "veiligheid_ehbo",
] as const;

export const MATERIAL_CATEGORY_LABELS: Record<string, string> = {
  ballen: "Ballen",
  kleine_handmaterialen: "Kleine handmaterialen",
  rackets_slagmateriaal: "Rackets & slagmateriaal",
  grote_toestellen_turnmateriaal: "Grote toestellen & turnmateriaal",
  doelen_netten_mikpunten: "Doelen, netten & mikpunten",
  markering_organisatie_signalering: "Markering, organisatie & signalering",
  rijtuigen_bewegingshulpmiddelen: "Rijtuigen & bewegingshulpmiddelen",
  parachute_groepsspelmateriaal: "Parachute & groepsspelmateriaal",
  fitness_kracht: "Fitness & kracht",
  water_zwemgerelateerd: "Water- en zwemgerelateerd",
  aangepast_inclusief_sporten: "Aangepast/inclusief sporten",
  veiligheid_ehbo: "Veiligheid & EHBO",
};

export function getMaterialCategoryLabel(category: string): string {
  return (
    MATERIAL_CATEGORY_LABELS[category] ??
    category.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())
  );
}
