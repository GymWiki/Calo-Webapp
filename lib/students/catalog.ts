// Leerlingen in de 3D-editor: één plaatsbaar item "Leerling" met pose, kleur en grootte.
//
// Een geplaatste leerling is een gewoon plattegrond-item met `slug = leerling_pose_<poseId>` plus optionele `color` (shirt, #rrggbb)
// en `size` (klein | middel | groot). Van pose wisselen = de slug vervangen; alles wat op slug werkt (afmetingen, collision, rotatie,
// export/import, viewer) blijft daardoor gelijk. De poses staan in lib/students/poses.json (handmatig: id, label, sporten, bron-GLB)
// en lib/students/poses.generated.json (door `npm run process:students`: maten van het lichaam). Een nieuwe pose toevoegen vergt
// dus geen codewijziging — zie docs/students.md.

import posesConfig from "./poses.json" with { type: "json" };
import generated from "./poses.generated.json" with { type: "json" };
import { sportLabel } from "@/lib/constants/libraryTaxonomy";
import type { MaterialModel } from "@/types/materialModel";

export const STUDENT_SLUG_PREFIX = "leerling_pose_";
export const STUDENT_BUCKET = "materials-3d";
export const STUDENT_STORAGE_DIR = "students";
/** De standaard leerling (neutraal staand): eerste kaartje in het poseraster en de pose waarmee een nieuwe leerling start. */
export const DEFAULT_POSE_ID = "standaard";
/** Hoogte (m) waarop de GLB's zijn genormaliseerd; `size` schaalt hier vanaf. */
export const STUDENT_BASE_HEIGHT_M = 1.8;

/**
 * Beweegcategorieën van de poses (filter in het leerlingmenu). `standaard` = lopen, staan, zitten en juichen; de rest is de soort
 * beweging. Een categorie zonder poses (nu zwemmen en klimmen) verschijnt pas in het menu zodra er een pose bij komt — de categorie
 * van een pose staat in poses.json (`categorie`).
 */
export const STUDENT_CATEGORIES = [
  { id: "standaard", label: "Standaard" },
  { id: "spel", label: "Spel" },
  { id: "atletiek", label: "Atletiek" },
  { id: "turnen", label: "Turnen" },
  { id: "zelfverdediging", label: "Zelfverdediging" },
  { id: "zwemmen", label: "Zwemmen" },
  { id: "klimmen", label: "Klimmen" },
] as const;
export type StudentCategoryId = (typeof STUDENT_CATEGORIES)[number]["id"];
export const DEFAULT_STUDENT_CATEGORY: StudentCategoryId = "standaard";

export function isStudentCategory(value: unknown): value is StudentCategoryId {
  return STUDENT_CATEGORIES.some((category) => category.id === value);
}

/** Sporten die (nog) niet in de sportenlijst van de bibliotheek staan, met een nette naam. */
const EXTRA_SPORT_LABELS: Record<string, string> = { judo: "Judo", tafeltennis: "Tafeltennis" };

/** Leesbare naam van een sport, ook voor sporten die alleen bij de leerlingen voorkomen. */
export function studentSportLabel(id: string): string {
  if (EXTRA_SPORT_LABELS[id]) return EXTRA_SPORT_LABELS[id];
  const label = sportLabel(id);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export type StudentSize = "klein" | "middel" | "groot";
export const STUDENT_SIZES: readonly { id: StudentSize; label: string; height_m: number }[] = [
  { id: "klein", label: "Klein", height_m: 1.2 },
  { id: "middel", label: "Middel", height_m: 1.4 },
  { id: "groot", label: "Groot", height_m: 1.6 },
];
export const DEFAULT_STUDENT_SIZE: StudentSize = "middel";

/** Teamkleuren voor het shirt; `null` = de oorspronkelijke (marineblauwe) shirtkleur van het model. */
export const STUDENT_COLORS: readonly { id: string; label: string; hex: string | null }[] = [
  { id: "standaard", label: "Standaard", hex: null },
  { id: "rood", label: "Rood", hex: "#dc2626" },
  { id: "blauw", label: "Blauw", hex: "#2563eb" },
  { id: "geel", label: "Geel", hex: "#facc15" },
  { id: "groen", label: "Groen", hex: "#16a34a" },
  { id: "oranje", label: "Oranje", hex: "#f97316" },
  { id: "wit", label: "Wit", hex: "#f8fafc" },
  { id: "zwart", label: "Zwart", hex: "#171717" },
];
export const STUDENT_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export type StudentPose = {
  id: string;
  label: string;
  sporten: string[];
  /** Beweegcategorie (filter in het leerlingmenu). */
  categorie: StudentCategoryId;
  /** Slug van het plattegrond-item (leerling_pose_<id>). */
  slug: string;
  length_m: number;
  width_m: number;
  height_m: number;
  version?: string;
  sort: number;
};

type PoseConfig = { id: string; label: string; sporten: string[]; categorie?: string; sort?: number };
type PoseDims = { length_m: number; width_m: number; height_m: number; /** Inhoudshash van het verwerkte GLB (process:students): ?v= achter de URL, zodat een gewijzigde pose direct overal laadt. */ version?: string };

const dimsById = generated as Record<string, PoseDims | undefined>;

/** Alleen poses waarvan het script ook maten heeft gegenereerd (dus een verwerkt model) komen in de editor. */
export const STUDENT_POSES: readonly StudentPose[] = (posesConfig.poses as PoseConfig[])
  .filter((pose) => dimsById[pose.id])
  .map((pose) => ({
    id: pose.id,
    label: pose.label,
    sporten: pose.sporten,
    categorie: isStudentCategory(pose.categorie) ? pose.categorie : DEFAULT_STUDENT_CATEGORY,
    slug: studentSlug(pose.id),
    ...(dimsById[pose.id] as PoseDims),
    sort: pose.sort ?? 100,
  }))
  .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "nl"));

function versionQuery(pose: { version?: string }): string {
  return pose.version ? `?v=${pose.version}` : "";
}

export function studentSlug(poseId: string): string {
  return `${STUDENT_SLUG_PREFIX}${poseId}`;
}

export function isStudentSlug(slug: string): boolean {
  return slug.startsWith(STUDENT_SLUG_PREFIX);
}

export function poseIdOfSlug(slug: string): string | null {
  return isStudentSlug(slug) ? slug.slice(STUDENT_SLUG_PREFIX.length) : null;
}

const POSE_BY_SLUG = new Map(STUDENT_POSES.map((pose) => [pose.slug, pose]));

export function poseOfSlug(slug: string): StudentPose | undefined {
  return POSE_BY_SLUG.get(slug);
}

/** Schaalfactor van de GLB (1,8 m) naar de gekozen grootte; zonder `size` de standaard (middel). */
export function studentScale(size?: StudentSize | string | null): number {
  const found = STUDENT_SIZES.find((option) => option.id === size) ?? STUDENT_SIZES.find((option) => option.id === DEFAULT_STUDENT_SIZE)!;
  return found.height_m / STUDENT_BASE_HEIGHT_M;
}

export function isStudentSize(value: unknown): value is StudentSize {
  return STUDENT_SIZES.some((option) => option.id === value);
}

/** Sporten die voorkomen in de poses, in de volgorde van de sportenlijst van de bibliotheek. */
export function studentSportIds(): string[] {
  return [...new Set(STUDENT_POSES.flatMap((pose) => pose.sporten))];
}

/** Categorieën die minstens één pose hebben, in vaste volgorde, met het aantal poses. */
export function studentCategoriesInUse(poses: readonly StudentPose[] = STUDENT_POSES): { id: StudentCategoryId; label: string; count: number }[] {
  return STUDENT_CATEGORIES.map((category) => ({ ...category, count: poses.filter((pose) => pose.categorie === category.id).length })).filter((category) => category.count > 0);
}

/** Sporten van deze poses (zonder "algemeen"), op naam gesorteerd. */
export function studentSportsOf(poses: readonly StudentPose[]): string[] {
  return [...new Set(poses.flatMap((pose) => pose.sporten))].filter((sport) => sport !== "algemeen").sort((a, b) => studentSportLabel(a).localeCompare(studentSportLabel(b), "nl"));
}

/**
 * Poses filteren op zoektekst, sport en beweegcategorie. De zoektekst zoekt in de naam van de pose, de sporten (id en naam) en de
 * categorie, zodat "judo", "turnen" of "tafeltennis" allemaal iets vinden; meerdere woorden moeten allemaal passen.
 */
export function filterPoses(
  poses: readonly StudentPose[],
  { query = "", sport = null, categorie = null }: { query?: string; sport?: string | null; categorie?: string | null },
): StudentPose[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return poses.filter((pose) => {
    if (sport && !pose.sporten.includes(sport)) return false;
    if (categorie && pose.categorie !== categorie) return false;
    if (words.length === 0) return true;
    const haystack = [pose.label, pose.categorie, STUDENT_CATEGORIES.find((category) => category.id === pose.categorie)?.label ?? "", ...pose.sporten, ...pose.sporten.map(studentSportLabel)].join(" ").toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

/**
 * De poses als MaterialModel-rijen, zodat dims-lookup, collision, rotatie, export en viewer ze net als ander materiaal behandelen.
 * `publicBaseUrl` = publieke URL van de bucket (…/storage/v1/object/public/materials-3d); zonder database-rijen.
 */
export function studentModels(publicBaseUrl: string): MaterialModel[] {
  return STUDENT_POSES.map((pose) => ({
    id: pose.slug,
    slug: pose.slug,
    material_id: null,
    naam: `Leerling – ${pose.label.toLowerCase()}`,
    categorie: "personen",
    subgroep: null,
    sporten: pose.sporten,
    tags: ["leerling", "pose"],
    model_url: `${publicBaseUrl}/${STUDENT_STORAGE_DIR}/${pose.id}.glb${versionQuery(pose)}`,
    preview_url: `${publicBaseUrl}/${STUDENT_STORAGE_DIR}/${pose.id}.png${versionQuery(pose)}`,
    length_m: pose.length_m,
    width_m: pose.width_m,
    height_m: pose.height_m,
    stackable: false,
    sort_order: pose.sort,
  }));
}

/** Het ene "Leerling"-kaartje in de bibliotheek: de standaardpose onder de naam "Leerling". */
export function studentLibraryModel(models: MaterialModel[]): MaterialModel | null {
  const base = models.find((model) => model.slug === studentSlug(DEFAULT_POSE_ID)) ?? models.find((model) => isStudentSlug(model.slug));
  return base ? { ...base, naam: "Leerling" } : null;
}

/** Wat de sectie "Personen" in de bibliotheek toont: alleen het ene "Leerling"-kaartje (poses kies je daarna in het itempaneel). De oudere losse personen (laagpoly, kleurvarianten) bestaan voor de bibliotheek niet meer. */
export function libraryPersonModels(models: MaterialModel[]): MaterialModel[] {
  const card = studentLibraryModel(models);
  return card ? [card] : [];
}

// ----------------------------------------------------------------------------
// Oudere plattegronden: slugs die niet meer bestaan laden als de standaard leerling (of hardlopen), zonder de rest te veranderen.
// ----------------------------------------------------------------------------

/** Kleuren van de oude losse kleurvarianten (leerling_blauw, …) → shirtkleur. */
const LEGACY_COLOR_HEX: Record<string, string> = {
  blauw: "#2563eb",
  geel: "#facc15",
  groen: "#16a34a",
  oranje: "#f97316",
  paars: "#7c3aed",
  rood: "#dc2626",
};

/** Oude slug → pose (id) en eventueel shirtkleur. `leerling_zittend_turnbank` blijft bewust zoals hij is (de bank zit in het model). */
const LEGACY_STUDENT_SLUGS: Record<string, { pose: string; color?: string }> = {
  leerling_pose_staand: { pose: DEFAULT_POSE_ID },
  leerling_staand_rust: { pose: DEFAULT_POSE_ID },
  leerling_wandelen: { pose: DEFAULT_POSE_ID },
  leerling_rennen: { pose: "hardlopen" },
  ...Object.fromEntries(Object.entries(LEGACY_COLOR_HEX).map(([name, hex]) => [`leerling_${name}`, { pose: DEFAULT_POSE_ID, color: hex }])),
};

/** Vertaalt een oude leerling-slug naar de nieuwe pose (kleur van een oude kleurvariant wordt de shirtkleur). Andere items blijven ongewijzigd. */
export function upgradeStudentItem<T extends { slug: string; color?: string }>(item: T): T {
  const legacy = LEGACY_STUDENT_SLUGS[item.slug];
  if (!legacy) return item;
  return { ...item, slug: studentSlug(legacy.pose), ...(legacy.color && !item.color ? { color: legacy.color } : {}) };
}

export function upgradeStudentItems<T extends { slug: string; color?: string }>(items: readonly T[]): T[] {
  return items.map(upgradeStudentItem);
}
