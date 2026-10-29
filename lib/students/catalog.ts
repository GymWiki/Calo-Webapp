// Leerlingen in de 3D-editor: één plaatsbaar item "Leerling" met pose, kleur en grootte.
//
// Een geplaatste leerling is een gewoon plattegrond-item met `slug = leerling_pose_<poseId>` plus optionele `color` (shirt, #rrggbb)
// en `size` (klein | middel | groot). Van pose wisselen = de slug vervangen; alles wat op slug werkt (afmetingen, collision, rotatie,
// export/import, viewer) blijft daardoor gelijk. De poses staan in lib/students/poses.json (handmatig: id, label, sporten, bron-GLB)
// en lib/students/poses.generated.json (door `npm run process:students`: maten van het lichaam). Een nieuwe pose toevoegen vergt
// dus geen codewijziging — zie docs/students.md.

import posesConfig from "./poses.json" with { type: "json" };
import generated from "./poses.generated.json" with { type: "json" };
import type { MaterialModel } from "@/types/materialModel";

export const STUDENT_SLUG_PREFIX = "leerling_pose_";
export const STUDENT_BUCKET = "materials-3d";
export const STUDENT_STORAGE_DIR = "students";
export const DEFAULT_POSE_ID = "staand";
/** Hoogte (m) waarop de GLB's zijn genormaliseerd; `size` schaalt hier vanaf. */
export const STUDENT_BASE_HEIGHT_M = 1.8;

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
  /** Slug van het plattegrond-item (leerling_pose_<id>). */
  slug: string;
  length_m: number;
  width_m: number;
  height_m: number;
  sort: number;
};

type PoseConfig = { id: string; label: string; sporten: string[]; sort?: number };
type PoseDims = { length_m: number; width_m: number; height_m: number };

const dimsById = generated as Record<string, PoseDims | undefined>;

/** Alleen poses waarvan het script ook maten heeft gegenereerd (dus een verwerkt model) komen in de editor. */
export const STUDENT_POSES: readonly StudentPose[] = (posesConfig.poses as PoseConfig[])
  .filter((pose) => dimsById[pose.id])
  .map((pose) => ({
    id: pose.id,
    label: pose.label,
    sporten: pose.sporten,
    slug: studentSlug(pose.id),
    ...(dimsById[pose.id] as PoseDims),
    sort: pose.sort ?? 100,
  }))
  .sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label, "nl"));

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

export function filterPoses(poses: readonly StudentPose[], { query = "", sport = null }: { query?: string; sport?: string | null }): StudentPose[] {
  const q = query.trim().toLowerCase();
  return poses.filter((pose) => (!sport || pose.sporten.includes(sport)) && (!q || pose.label.toLowerCase().includes(q) || pose.sporten.some((s) => s.includes(q))));
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
    model_url: `${publicBaseUrl}/${STUDENT_STORAGE_DIR}/${pose.id}.glb`,
    preview_url: `${publicBaseUrl}/${STUDENT_STORAGE_DIR}/${pose.id}.png`,
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

/** Wat de sectie "Personen" in de bibliotheek toont: één "Leerling"-kaartje (poses kies je daarna in het itempaneel). Zonder poses: de oudere losse personen. */
export function libraryPersonModels(models: MaterialModel[]): MaterialModel[] {
  const card = studentLibraryModel(models);
  return card ? [card] : models.filter((model) => model.categorie === "personen");
}
