// Register van 3D-omgevingen (nu: de gymzaal in drie indelingen). Elke
// indeling is één GLB (Blender-script build_gymzaal.py) waarvan de losse
// onderdelen — muren, scheidingsgordijnen, wandrekken, sportlijnen — als
// aparte nodes met vaste namen zijn geëxporteerd. Aan/uit zetten gebeurt
// dus op nodenaam; geen aparte bestanden per variant.
//
// Coördinaten: meters, glTF/three.js (Y omhoog), middelpunt op de
// oorsprong. `x` loopt naar rechts, `z` naar de kijker ("voor" = +z).

import type { Floorplan3dEnvironment, Floorplan3dRoom } from "@/types/floorplan3d";

export type GymLayoutId = "standaard" | "2x2" | "4x1";

export type WallSide = "voor" | "achter" | "links" | "rechts";

/** Een aan/uit-schakelbaar onderdeel van de omgeving (één of meer GLB-nodes). */
export type EnvironmentPart = {
  /** Stabiele id binnen de indeling, bv. "muur-voor". */
  id: string;
  label: string;
  nodes: string[];
};

export type CurtainPart = EnvironmentPart & {
  /** Lijnstuk in de plattegrond (voor het schema in het paneel). */
  from: { x: number; z: number };
  to: { x: number; z: number };
};

export type GymLayout = {
  id: GymLayoutId;
  label: string;
  description: string;
  /** Binnenmaat van de zaal(en) — gelijk aan de bounds voor items. */
  width_m: number;
  length_m: number;
  glb: string;
  zalen: { nummer: number; x: number; z: number }[];
  walls: (EnvironmentPart & { side: WallSide })[];
  curtains: CurtainPart[];
  wandrekken: EnvironmentPart;
  lijnen: EnvironmentPart[];
};

const HALL_L = 24;
const HALL_W = 14;

const SPORT_LINES: { id: string; label: string; prefix: string }[] = [
  { id: "lijnen-zaalvoetbal", label: "Zaalvoetbal / handbal", prefix: "Lijnen_Zaalvoetbal" },
  { id: "lijnen-basketbal", label: "Basketbal", prefix: "Lijnen_Basketbal" },
  { id: "lijnen-volleybal", label: "Volleybal", prefix: "Lijnen_Volleybal" },
  { id: "lijnen-badminton", label: "Badminton", prefix: "Lijnen_Badminton" },
];

function lines(nodeNames: string[]): EnvironmentPart[] {
  return SPORT_LINES.map(({ id, label, prefix }) => ({
    id,
    label,
    nodes: nodeNames.filter((name) => name.startsWith(prefix)),
  }));
}

function numbered(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}_Zaal_${i + 1}`);
}

const SIDE_LABELS: Record<WallSide, string> = {
  voor: "Voor",
  achter: "Achter",
  links: "Links",
  rechts: "Rechts",
};

function wallParts(prefix: string): (EnvironmentPart & { side: WallSide })[] {
  return (["voor", "achter", "links", "rechts"] as const).map((side) => ({
    id: `muur-${side}`,
    label: `Muur ${SIDE_LABELS[side].toLowerCase()}`,
    side,
    nodes: [`${prefix}_${SIDE_LABELS[side]}`],
  }));
}

export const GYM_LAYOUTS: Record<GymLayoutId, GymLayout> = {
  standaard: {
    id: "standaard",
    label: "1 zaal",
    description: "Eén gymzaal van 24 × 14 m",
    width_m: HALL_L,
    length_m: HALL_W,
    glb: "gymzaal_standaard",
    zalen: [{ nummer: 1, x: 0, z: 0 }],
    walls: wallParts("Muur"),
    curtains: [],
    wandrekken: { id: "wandrekken", label: "Wandrekken", nodes: ["Wandrek_1", "Wandrek_2"] },
    lijnen: lines(["Lijnen_Zaalvoetbal_Handbal", "Lijnen_Basketbal", "Lijnen_Volleybal", "Lijnen_Badminton"]),
  },
  "2x2": {
    id: "2x2",
    label: "4 zalen (2 × 2)",
    description: "Vier zalen in een vierkant, 48 × 28 m",
    width_m: HALL_L * 2,
    length_m: HALL_W * 2,
    glb: "gymzaal_complex_2x2",
    zalen: [
      { nummer: 1, x: -HALL_L / 2, z: -HALL_W / 2 },
      { nummer: 2, x: HALL_L / 2, z: -HALL_W / 2 },
      { nummer: 3, x: -HALL_L / 2, z: HALL_W / 2 },
      { nummer: 4, x: HALL_L / 2, z: HALL_W / 2 },
    ],
    walls: wallParts("Muur_Complex"),
    curtains: [
      { id: "gordijn-1-2", label: "Zaal 1 | 2", nodes: ["Scheidingswand_1_2"], from: { x: 0, z: -HALL_W }, to: { x: 0, z: 0 } },
      { id: "gordijn-3-4", label: "Zaal 3 | 4", nodes: ["Scheidingswand_3_4"], from: { x: 0, z: 0 }, to: { x: 0, z: HALL_W } },
      { id: "gordijn-1-3", label: "Zaal 1 | 3", nodes: ["Scheidingswand_1_3"], from: { x: -HALL_L, z: 0 }, to: { x: 0, z: 0 } },
      { id: "gordijn-2-4", label: "Zaal 2 | 4", nodes: ["Scheidingswand_2_4"], from: { x: 0, z: 0 }, to: { x: HALL_L, z: 0 } },
    ],
    wandrekken: {
      id: "wandrekken",
      label: "Wandrekken",
      nodes: ["Wandrek_Zaal_1_A", "Wandrek_Zaal_1_B", "Wandrek_Zaal_2_A", "Wandrek_Zaal_2_B"],
    },
    lijnen: lines(
      ["Zaalvoetbal", "Basketbal", "Volleybal", "Badminton"].flatMap((sport) => numbered(`Lijnen_${sport}`, 4)),
    ),
  },
  "4x1": {
    id: "4x1",
    label: "4 zalen naast elkaar",
    description: "Vier zalen achter elkaar, 24 × 56 m",
    width_m: HALL_L,
    length_m: HALL_W * 4,
    glb: "gymzaal_complex_4x1",
    // Zaal 1 ligt vooraan (+z), zaal 4 achteraan — zoals in de GLB.
    zalen: [1, 2, 3, 4].map((nummer) => ({ nummer, x: 0, z: HALL_W * 2 - (nummer - 0.5) * HALL_W })),
    walls: wallParts("Muur_Complex"),
    curtains: [
      { id: "gordijn-1-2", label: "Zaal 1 | 2", nodes: ["Scheidingswand_1_2"], from: { x: -HALL_L / 2, z: HALL_W }, to: { x: HALL_L / 2, z: HALL_W } },
      { id: "gordijn-2-3", label: "Zaal 2 | 3", nodes: ["Scheidingswand_2_3"], from: { x: -HALL_L / 2, z: 0 }, to: { x: HALL_L / 2, z: 0 } },
      { id: "gordijn-3-4", label: "Zaal 3 | 4", nodes: ["Scheidingswand_3_4"], from: { x: -HALL_L / 2, z: -HALL_W }, to: { x: HALL_L / 2, z: -HALL_W } },
    ],
    wandrekken: { id: "wandrekken", label: "Wandrekken", nodes: ["Wandrek_Zaal_4_A", "Wandrek_Zaal_4_B"] },
    lijnen: lines(
      ["Zaalvoetbal", "Basketbal", "Volleybal", "Badminton"].flatMap((sport) => numbered(`Lijnen_${sport}`, 4)),
    ),
  },
};

export const GYM_LAYOUT_ORDER: GymLayoutId[] = ["standaard", "2x2", "4x1"];

export const DEFAULT_GYM_LAYOUT: GymLayoutId = "standaard";

/** De GLB's staan in dezelfde publieke bucket als het materiaal. */
export function environmentModelUrl(layout: { glb: string }): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${base}/storage/v1/object/public/materials-3d/environments/${layout.glb}.glb`;
}

export function roomForGymLayout(layout: GymLayout): Pick<Floorplan3dRoom, "width_m" | "length_m"> {
  return { width_m: layout.width_m, length_m: layout.length_m };
}

/** Standaard staan alleen de muren achter en links (een hoek): de andere twee
 * zijn verborgen zodat je vrij in de zaal kunt kijken en bouwen. */
const DEFAULT_HIDDEN_SIDES: WallSide[] = ["voor", "rechts"];

export function createGymEnvironment(layoutId: GymLayoutId): Floorplan3dEnvironment {
  const hidden = GYM_LAYOUTS[layoutId].walls
    .filter((wall) => DEFAULT_HIDDEN_SIDES.includes(wall.side))
    .flatMap((wall) => wall.nodes);
  return { type: "gymzaal", layout: layoutId, hidden };
}

// --- Aan/uit-logica (puur) ------------------------------------------------

/** Staat dit onderdeel aan? Pas als álle nodes zichtbaar zijn. */
export function isPartOn(part: EnvironmentPart, hidden: string[]): boolean {
  return part.nodes.every((node) => !hidden.includes(node));
}

export function setPartOn(hidden: string[], part: EnvironmentPart, on: boolean): string[] {
  const rest = hidden.filter((node) => !part.nodes.includes(node));
  return on ? rest : [...rest, ...part.nodes];
}

export function setPartsOn(hidden: string[], parts: EnvironmentPart[], on: boolean): string[] {
  return parts.reduce((acc, part) => setPartOn(acc, part, on), hidden);
}
