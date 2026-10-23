// Register van ALLE omgevingen in de 3D-editor: gymzaal (zie environments.ts),
// sportveld, atletiekbaan en zwembad. Elke indeling is één GLB uit de bucket
// materials-3d/environments/ met losse, benoemde nodes (Blender-scripts
// build_*.py); aan/uit zetten gebeurt dus op nodenaam via `environment.hidden`.
//
// Eén vorm voor de nieuwe omgevingen: een indeling heeft groepen van
// aan/uit-schakelbare onderdelen (EnvironmentPart). De gymzaal houdt zijn
// eigen, rijkere registratie (muren, gordijnen, zalen) in environments.ts.
//
// Maten (`width_m` langs X, `length_m` langs Z) zijn het bruikbare vlak voor
// items, afgeleid uit de GLB-bounds: de afscheiding van het veld, de perron
// rond het bad, het buitenveld van de atletiekbaan.

import { ENVIRONMENT_NODES } from "@/components/canvas-3d/environment-nodes";
import {
  DEFAULT_GYM_LAYOUT,
  GYM_LAYOUTS,
  GYM_LAYOUT_ORDER,
  createGymEnvironment,
  type EnvironmentPart,
  type GymLayoutId,
} from "@/components/canvas-3d/environments";
import type { Floorplan3dEnvironment, Floorplan3dRoom } from "@/types/floorplan3d";

export type EnvironmentKind = Floorplan3dEnvironment["type"];

export type EnvironmentGroup = {
  id: string;
  label: string;
  parts: (EnvironmentPart & { defaultHidden?: boolean })[];
};

export type EnvironmentLayout = {
  id: string;
  label: string;
  description: string;
  width_m: number;
  length_m: number;
  glb: string;
  groups: EnvironmentGroup[];
};

/** Nodenamen van een GLB die met een van de prefixen beginnen. */
function nodesWithPrefix(glb: string, ...prefixes: string[]): string[] {
  return (ENVIRONMENT_NODES[glb] ?? []).filter((name) => prefixes.some((prefix) => name.startsWith(prefix)));
}

function part(
  glb: string,
  id: string,
  label: string,
  prefixes: string[],
  options: { defaultHidden?: boolean } = {},
): EnvironmentPart & { defaultHidden?: boolean } {
  return { id, label, nodes: nodesWithPrefix(glb, ...prefixes), ...options };
}

const COMPASS = [
  { id: "noord", label: "noord" },
  { id: "oost", label: "oost" },
  { id: "zuid", label: "zuid" },
  { id: "west", label: "west" },
] as const;

// --- Sportveld ---------------------------------------------------------------

function sportveld(config: {
  id: string;
  label: string;
  description: string;
  width_m: number;
  length_m: number;
  glb: string;
  lines: { node: string; label: string; defaultHidden?: boolean }[];
}): EnvironmentLayout {
  const { glb } = config;
  return {
    id: config.id,
    label: config.label,
    description: config.description,
    width_m: config.width_m,
    length_m: config.length_m,
    glb,
    groups: [
      {
        id: "belijning",
        label: "Belijning",
        parts: config.lines.map((line) => part(glb, `lijn-${line.node}`, line.label, [line.node], { defaultHidden: line.defaultHidden })),
      },
      {
        id: "afscheiding",
        label: "Veldafscheiding",
        parts: COMPASS.map((side) => part(glb, `afscheiding-${side.id}`, `Afscheiding ${side.label}`, [`Veldafscheiding_${side.id[0].toUpperCase()}${side.id.slice(1)}`])),
      },
      {
        id: "kantplanken",
        label: "Kantplanken",
        parts: [part(glb, "kantplanken", "Kantplanken", ["Kantplank_"])],
      },
    ],
  };
}

const SPORTVELD_LAYOUTS: EnvironmentLayout[] = [
  sportveld({
    id: "school",
    label: "Schoolveld",
    description: "Combiveld van 47 × 27 m",
    width_m: 47,
    length_m: 27,
    glb: "sportveld_school_combiveld",
    lines: [
      { node: "Belijning_Voetbal_Handbal_40x20", label: "Voetbal / handbal 40 × 20 m" },
      { node: "Belijning_Dwarsvelden_Geel", label: "Dwarsvelden (geel)", defaultHidden: true },
      { node: "Belijning_Korfbal_Blauw", label: "Korfbal (blauw)", defaultHidden: true },
    ],
  }),
  sportveld({
    id: "groot",
    label: "Groot sportveld",
    description: "Multifunctioneel veld van 108 × 68 m",
    width_m: 108,
    length_m: 68,
    glb: "sportveld_multifunctioneel",
    lines: [
      { node: "Belijning_Voetbal_100x60", label: "Voetbal 100 × 60 m" },
      { node: "Belijning_Hockey_91x55", label: "Hockey 91 × 55 m", defaultHidden: true },
      { node: "Belijning_Korfbal_2x_40x20", label: "Korfbal 2× 40 × 20 m", defaultHidden: true },
    ],
  }),
];

// --- Zwembad -----------------------------------------------------------------

function zwembad(config: {
  id: string;
  label: string;
  description: string;
  width_m: number;
  length_m: number;
  glb: string;
  extra: EnvironmentGroup[];
}): EnvironmentLayout {
  const { glb } = config;
  const lanes = [...new Set((ENVIRONMENT_NODES[glb] ?? []).map((name) => /^Banenlijn_(\d+)_/.exec(name)?.[1]).filter(Boolean))] as string[];
  return {
    id: config.id,
    label: config.label,
    description: config.description,
    width_m: config.width_m,
    length_m: config.length_m,
    glb,
    groups: [
      {
        id: "banen",
        label: "Banenlijnen",
        parts: lanes.map((lane) => part(glb, `baan-${lane}`, `Baan ${lane}`, [`Banenlijn_${lane}_`])),
      },
      {
        id: "water",
        label: "Water en bodem",
        parts: [
          part(glb, "water", "Wateroppervlak", ["Water_Oppervlak"]),
          part(glb, "bodemlijnen", "Lijnen op de bodem", ["Bodem_T_Lijnen"]),
        ],
      },
      ...config.extra,
    ],
  };
}

const ZWEMBAD_LAYOUTS: EnvironmentLayout[] = [
  zwembad({
    id: "instructiebad",
    label: "Instructiebad",
    description: "Bad van 16 × 10 m met inlooptrap",
    width_m: 24,
    length_m: 18,
    glb: "zwembad_instructiebad",
    extra: [
      {
        id: "trap",
        label: "Trap en leuningen",
        parts: [part("zwembad_instructiebad", "trap", "Inlooptrap en leuningen", ["Inlooptrap_", "Leuning_Stijl_"])],
      },
    ],
  }),
  zwembad({
    id: "wedstrijdbad",
    label: "25-meterbad",
    description: "Wedstrijdbad van 25 × 15 m",
    width_m: 33,
    length_m: 23.4,
    glb: "zwembad_25m_wedstrijdbad",
    extra: [
      {
        id: "uitrusting",
        label: "Uitrusting",
        parts: [
          part("zwembad_25m_wedstrijdbad", "trappen", "Trappen", ["Trap_"]),
          part("zwembad_25m_wedstrijdbad", "startblokken", "Startblokken en rugslagbeugels", ["Startblok", "Rugslagbeugel"]),
          part("zwembad_25m_wedstrijdbad", "vlaggen", "Vlaggenlijnen", ["Vlaggenlijn_", "Vlaggenpaal_", "Rugslagvlaggen_"]),
        ],
      },
    ],
  }),
];

// --- Atletiekbaan ------------------------------------------------------------

const ATLETIEK_GLB = "atletiekbaan_compleet";
const ATLETIEK_LAYOUTS: EnvironmentLayout[] = [
  {
    id: "compleet",
    label: "Atletiekbaan",
    description: "400 m-baan met alle onderdelen",
    width_m: 196,
    length_m: 106,
    glb: ATLETIEK_GLB,
    groups: [
      {
        id: "onderdelen",
        label: "Onderdelen",
        parts: [
          part(ATLETIEK_GLB, "verspringen", "Verspringen", ["Verspringbak_", "Verspringen_"]),
          part(ATLETIEK_GLB, "kogelstoten", "Kogelstoten", ["Kogelstootring_"]),
          part(ATLETIEK_GLB, "speerwerpen", "Speerwerpen", ["Speerwerpen_"]),
          part(ATLETIEK_GLB, "hoogspringen", "Hoogspringen", ["Hoogspring_"]),
          part(ATLETIEK_GLB, "werpsectoren", "Lijnen werpsectoren", ["Werpsectoren_"]),
        ],
      },
      {
        id: "baan",
        label: "Baan",
        parts: [
          part(ATLETIEK_GLB, "baanlijnen", "Baan- en startlijnen", ["Baanlijnen_"]),
          part(ATLETIEK_GLB, "wisselvakken", "Estafettewisselvakken", ["Estafette_"]),
          part(ATLETIEK_GLB, "bordesrand", "Bordesrand", ["Binnen_Bordesrand"]),
        ],
      },
    ],
  },
];

// --- Register ----------------------------------------------------------------

export type EnvironmentKindInfo = {
  id: EnvironmentKind;
  label: string;
  layouts: EnvironmentLayout[];
};

/** De nieuwe omgevingen (de gymzaal staat in environments.ts). */
export const OTHER_ENVIRONMENTS: EnvironmentKindInfo[] = [
  { id: "sportveld", label: "Sportveld", layouts: SPORTVELD_LAYOUTS },
  { id: "atletiekbaan", label: "Atletiekbaan", layouts: ATLETIEK_LAYOUTS },
  { id: "zwembad", label: "Zwembad", layouts: ZWEMBAD_LAYOUTS },
];

/** Volgorde van de keuzeknoppen in het paneel (gymzaal eerst). */
export const ENVIRONMENT_KIND_ORDER: { id: EnvironmentKind; label: string }[] = [
  { id: "gymzaal", label: "Gymzaal" },
  ...OTHER_ENVIRONMENTS.map(({ id, label }) => ({ id, label })),
];

export function layoutsOfKind(kind: Exclude<EnvironmentKind, "gymzaal">): EnvironmentLayout[] {
  return OTHER_ENVIRONMENTS.find((entry) => entry.id === kind)?.layouts ?? [];
}

export function findEnvironmentLayout(kind: EnvironmentKind, layoutId: string): EnvironmentLayout | null {
  if (kind === "gymzaal") return null;
  return layoutsOfKind(kind).find((layout) => layout.id === layoutId) ?? null;
}

export function defaultLayoutId(kind: EnvironmentKind): string {
  return kind === "gymzaal" ? DEFAULT_GYM_LAYOUT : (layoutsOfKind(kind)[0]?.id ?? "");
}

/** GLB en maten van een omgeving — voor het laden en voor de kamerafmeting. */
export function resolveEnvironment(environment: Pick<Floorplan3dEnvironment, "type" | "layout">): {
  glb: string;
  width_m: number;
  length_m: number;
} {
  if (environment.type === "gymzaal") {
    const layout = GYM_LAYOUTS[environment.layout as GymLayoutId] ?? GYM_LAYOUTS[DEFAULT_GYM_LAYOUT];
    return { glb: layout.glb, width_m: layout.width_m, length_m: layout.length_m };
  }
  const layout = findEnvironmentLayout(environment.type, environment.layout) ?? layoutsOfKind(environment.type)[0];
  return { glb: layout.glb, width_m: layout.width_m, length_m: layout.length_m };
}

/** Nieuwe omgeving met de standaardinstelling van die indeling (bv. alleen de hoofdbelijning). */
export function createEnvironment(kind: EnvironmentKind, layoutId: string = defaultLayoutId(kind)): Floorplan3dEnvironment {
  if (kind === "gymzaal") return createGymEnvironment(layoutId as GymLayoutId);
  const layout = findEnvironmentLayout(kind, layoutId) ?? layoutsOfKind(kind)[0];
  const hidden = layout.groups.flatMap((group) => group.parts.filter((p) => p.defaultHidden).flatMap((p) => p.nodes));
  return { type: kind, layout: layout.id, hidden };
}

export function roomForEnvironment(environment: Pick<Floorplan3dEnvironment, "type" | "layout">): Pick<Floorplan3dRoom, "width_m" | "length_m"> {
  const { width_m, length_m } = resolveEnvironment(environment);
  return { width_m, length_m };
}

export { GYM_LAYOUT_ORDER };
