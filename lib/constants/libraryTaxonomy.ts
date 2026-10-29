// Indeling van de 3D-itembibliotheek (/plattegrond-3d): 7 hoofdcategorieën,
// subgroepen en sporten. Dit is de ENIGE plek waar de indeling vastligt —
// labels, volgorde, iconen en kleuren staan hier als data, zodat de indeling
// later zonder codewijziging in de UI aangepast kan worden (alleen deze
// config). Puur data + kleine helpers, geen React/three-imports, zodat ook
// node-scripts en tests het kunnen gebruiken.
//
// Elk item heeft precies ÉÉN hoofdcategorie, optioneel één subgroep (max. 2
// niveaus), minstens één sport (of "algemeen") en vrije tags. Personen
// (leerlingen) horen bewust niet bij het materiaal: zij hebben een eigen
// sectie ("Personen") naast de bibliotheek.

/** Naam van een lucide-icoon; de UI vertaalt dit via een vaste map. */
export type LibraryIconName =
  | "Dumbbell"
  | "Goal"
  | "CircleDot"
  | "Layers"
  | "Cone"
  | "Activity"
  | "Package"
  | "Users"
  | "Trophy";

export type LibraryCategory = {
  id: string;
  label: string;
  icon: LibraryIconName;
  /** Accentkleur (hex) voor badge/kop. */
  color: string;
  /** Beschrijving voor beheer/tooltips. */
  description: string;
  subgroups?: LibrarySubgroup[];
};

export type LibrarySubgroup = { id: string; label: string };

export type LibrarySport = { id: string; label: string };

/** De 7 materiaalcategorieën, in weergavevolgorde. */
export const LIBRARY_CATEGORIES: readonly LibraryCategory[] = [
  {
    id: "toestellen",
    label: "Toestellen",
    icon: "Trophy",
    color: "#ea580c",
    description: "Banken, bruggen, balken, klimtoestellen, kasten, springtoestellen, ringen en rekstokken",
    subgroups: [
      { id: "banken", label: "Banken" },
      { id: "kasten", label: "Kasten" },
      { id: "springen", label: "Springen" },
      { id: "hangen_zwaaien", label: "Hangen & zwaaien" },
      { id: "balanceren", label: "Balanceren" },
      { id: "klimmen", label: "Klimmen" },
    ],
  },
  {
    id: "doelen_netten",
    label: "Doelen & netten",
    icon: "Goal",
    color: "#2563eb",
    description: "Alle doelen, basket- en korfbalpalen, badminton- en volleybalnetten en -palen",
  },
  {
    id: "ballen",
    label: "Ballen",
    icon: "CircleDot",
    color: "#dc2626",
    description: "Alle ballen",
    subgroups: [
      { id: "basketbal", label: "Basketbal" },
      { id: "voetbal", label: "Voetbal" },
      { id: "volley_hand", label: "Volley/Hand" },
      { id: "overig", label: "Overig" },
    ],
  },
  {
    id: "matten",
    label: "Matten",
    icon: "Layers",
    color: "#7c3aed",
    description: "Turnmatten, lange matten, dikke matten, airtracks",
  },
  {
    id: "klein_materiaal",
    label: "Klein materiaal",
    icon: "Cone",
    color: "#16a34a",
    description: "Pionnen en dopjes, hoepels, springtouwen, fluitjes, hesjes, sticks en rackets",
    subgroups: [
      { id: "afzetten", label: "Afzetten & markeren" },
      { id: "sticks_rackets", label: "Sticks & rackets" },
      { id: "overig", label: "Overig" },
    ],
  },
  {
    id: "fitness",
    label: "Fitness",
    icon: "Dumbbell",
    color: "#0891b2",
    description: "Losse fitnessmaterialen",
  },
  {
    id: "opslag_karren",
    label: "Opslag & karren",
    icon: "Package",
    color: "#64748b",
    description: "Ballenkarren, ballenrekken, opbergers, EHBO en ander organisatiemateriaal",
  },
] as const;

/** Niet-materiaal: staat buiten de 7 categorieën, in een eigen sectie. */
export const PERSONS_CATEGORY: LibraryCategory = {
  id: "personen",
  label: "Personen",
  icon: "Users",
  color: "#db2777",
  description: "Leerlingen en leerkracht — geen materiaal",
};

/** Sporten voor het sportfilter, in weergavevolgorde. */
export const LIBRARY_SPORTS: readonly LibrarySport[] = [
  { id: "basketbal", label: "Basketbal" },
  { id: "korfbal", label: "Korfbal" },
  { id: "badminton", label: "Badminton" },
  { id: "volleybal", label: "Volleybal" },
  { id: "voetbal", label: "Voetbal" },
  { id: "handbal", label: "Handbal" },
  { id: "hockey", label: "Hockey" },
  { id: "floorball", label: "Floorball" },
  { id: "racketsport", label: "Racketsport" },
  { id: "slagspelen", label: "Slagspelen" },
  { id: "trefspelen", label: "Trefspelen" },
  { id: "turnen", label: "Turnen" },
  { id: "klimmen", label: "Klimmen" },
  { id: "atletiek", label: "Atletiek" },
  { id: "fitness", label: "Fitness" },
  { id: "algemeen", label: "Algemeen" },
] as const;

export const CATEGORY_IDS: readonly string[] = LIBRARY_CATEGORIES.map((category) => category.id);
export const SPORT_IDS: readonly string[] = LIBRARY_SPORTS.map((sport) => sport.id);
export const PERSONS_ID = PERSONS_CATEGORY.id;

/**
 * Toont de sectie "Personen" (leerlingen) in de bibliotheek. Was tijdelijk uit omdat de geskinde leerling-GLB's in een A-pose
 * stonden; de nieuwe leerlingen (lib/students) hebben hun pose in het model; de oudere laagpoly-leerlingen zijn uit de bibliotheek.
 * Een pose met skin bak je in de GLB met scripts/blender/bake-pose.py (zie docs/glb-optimization.md). Zet op false om de sectie weer te verbergen: de modellen blijven
 * in de database, zodat bestaande plattegronden ze blijven tonen.
 */
export const SHOW_PERSONS_IN_LIBRARY = true;

const CATEGORY_BY_ID = new Map<string, LibraryCategory>(
  [...LIBRARY_CATEGORIES, PERSONS_CATEGORY].map((category) => [category.id, category]),
);
const SPORT_LABEL_BY_ID = new Map(LIBRARY_SPORTS.map((sport) => [sport.id, sport.label]));

export function getCategory(id: string): LibraryCategory | undefined {
  return CATEGORY_BY_ID.get(id);
}

export function isValidCategory(id: string): boolean {
  return CATEGORY_BY_ID.has(id);
}

export function categoryLabel(id: string): string {
  return CATEGORY_BY_ID.get(id)?.label ?? id.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function subgroupLabel(categoryId: string, subgroupId: string): string {
  return (
    CATEGORY_BY_ID.get(categoryId)?.subgroups?.find((subgroup) => subgroup.id === subgroupId)?.label ??
    subgroupId.replace(/_/g, " ")
  );
}

export function sportLabel(id: string): string {
  return SPORT_LABEL_BY_ID.get(id) ?? id.replace(/_/g, " ");
}

export function isValidSubgroup(categoryId: string, subgroupId: string): boolean {
  return CATEGORY_BY_ID.get(categoryId)?.subgroups?.some((subgroup) => subgroup.id === subgroupId) ?? false;
}

export type TaxonomyFields = {
  categorie: string;
  subgroep: string | null;
  sporten: string[];
};

/**
 * Valideert de indeling van één item: verplichte categorie, minstens één
 * sport (of "algemeen") en alleen bekende waarden. Geeft een lijst fouten
 * terug (leeg = geldig). Gebruikt door het migratiescript en de CSV-import,
 * zodat nieuwe items nooit zonder categorie/sport binnenkomen.
 */
export function validateTaxonomy(fields: TaxonomyFields): string[] {
  const errors: string[] = [];
  if (!fields.categorie) errors.push("categorie ontbreekt");
  else if (!isValidCategory(fields.categorie)) errors.push(`onbekende categorie "${fields.categorie}"`);
  if (fields.subgroep && !isValidSubgroup(fields.categorie, fields.subgroep)) {
    errors.push(`onbekende subgroep "${fields.subgroep}" voor categorie "${fields.categorie}"`);
  }
  if (fields.sporten.length === 0) errors.push('minstens één sport nodig (of "algemeen")');
  for (const sport of fields.sporten) {
    if (!SPORT_LABEL_BY_ID.has(sport)) errors.push(`onbekende sport "${sport}"`);
  }
  return errors;
}
