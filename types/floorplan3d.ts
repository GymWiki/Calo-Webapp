import { z } from "zod";

// Dataformaat van floorplans_3d.data (jsonb) — zie
// supabase/migrations/material_models_3d.sql. "version" laat een latere,
// niet-compatibele wijziging van dit formaat toe zonder bestaande
// plattegronden te breken (een loader kan op version branchen). Meters,
// Y omhoog (three.js-conventie) — `y` wordt bij het laden altijd opnieuw
// berekend vanuit stapeling (zie floorplan3d-geometry.ts), dus al bewust
// wél opgeslagen (voor een snelle eerste render) maar nooit blind vertrouwd.
export const floorplan3dItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  rot_y_deg: z.number(),
  /** Vergrendeld: niet te verplaatsen, draaien of verwijderen (mobiele contextbalk). Optioneel: oudere plattegronden hebben het niet. */
  locked: z.boolean().optional(),
  /**
   * Kanteling in graden (naast `rot_y_deg` = draaien om de verticale as). Euler-volgorde YXZ: eerst heading,
   * dan kanteling. `rot_x_deg` = voor/achter, `rot_z_deg` = zijwaarts. Optioneel en weggelaten bij 0:
   * plattegronden van vóór deze feature blijven byte-voor-byte hetzelfde. Zie components/canvas-3d/orientation.ts.
   */
  rot_x_deg: z.number().min(-180).max(180).optional(),
  rot_z_deg: z.number().min(-180).max(180).optional(),
  /** "Vrij in hoogte": hoogte (m) van het laagste punt boven de ondergrond. Weggelaten = op de vloer houden. */
  lift_m: z.number().min(0).max(10).optional(),
  /** Leerling: shirtkleur (#rrggbb). Weggelaten = de oorspronkelijke kleur van het model. Zie lib/students/catalog.ts. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Leerling: grootte (klein 1,2 m, middel 1,4 m, groot 1,6 m). Weggelaten = middel. */
  size: z.enum(["klein", "middel", "groot"]).optional(),
});
export type Floorplan3dItem = z.infer<typeof floorplan3dItemSchema>;

// Optionele "omgeving" van de ruimte (gymzaal, sportveld, atletiekbaan of zwembad — elk een GLB). `hidden` zijn
// de namen van GLB-nodes die uit staan (muren, gordijnen, lijnen...) —
// zie components/canvas-3d/environments.ts voor de bekende namen per
// indeling. Ontbreekt `environment`, dan is het een gewone lege ruimte.
export const ENVIRONMENT_TYPES = ["gymzaal", "sportveld", "atletiekbaan", "zwembad"] as const;
export const floorplan3dEnvironmentSchema = z.object({
  type: z.enum(ENVIRONMENT_TYPES),
  // Indeling binnen het type (gymzaal: standaard/2x2/4x1, sportveld: school/groot, ...);
  // de geldige waarden staan in components/canvas-3d/environment-kinds.ts.
  layout: z.string().min(1),
  hidden: z.array(z.string()).default([]),
});
export type Floorplan3dEnvironment = z.infer<typeof floorplan3dEnvironmentSchema>;

export const floorplan3dRoomSchema = z.object({
  width_m: z.number().positive(),
  length_m: z.number().positive(),
  environment: floorplan3dEnvironmentSchema.optional(),
  /** Weergave van de alleen-lezen viewer bij de activiteit: "auto" (standaard, weggelaten) kiest zelf, "3d" schuin, "top" bovenaanzicht. */
  view: z.enum(["auto", "3d", "top"]).optional(),
});
export type Floorplan3dRoom = z.infer<typeof floorplan3dRoomSchema>;

// "Veld afzetten": een afgezet veld is één groep-item met parameters; de
// pionnen/dopjes zelf worden bij het renderen berekend (cone-field.ts) en
// worden dus nooit opgeslagen. Positie (x,z) is het middelpunt van het
// veld, `width_m` loopt langs de lokale X-as en `length_m` langs de
// lokale Z-as (voor rotatie).
export const CONE_MARKER_TYPES = ["pion", "pion_hoog", "pion_laag", "dopje"] as const;
export const coneFieldSchema = z.object({
  id: z.string().min(1),
  type: z.literal("coneField"),
  x: z.number(),
  z: z.number(),
  rot_y_deg: z.number(),
  width_m: z.number().positive(),
  length_m: z.number().positive(),
  interval_m: z.number().min(0.5).max(10),
  distribution: z.enum(["even", "exact"]),
  marker: z.enum(CONE_MARKER_TYPES),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  corner_color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
});
export type ConeField = z.infer<typeof coneFieldSchema>;
export type ConeMarkerType = (typeof CONE_MARKER_TYPES)[number];
export type ConeDistribution = ConeField["distribution"];

// Touw: een rood koord dat tussen twee objecten gespannen is. Beide uiteinden zitten vast aan een punt op een item (`local` = het
// punt in de lokale ruimte van het item, in meters: het reist dus mee bij verplaatsen, draaien en kantelen). Een touw is geen item:
// het heeft geen maten, botst nergens mee en stapelt dus ook niet. Zie components/canvas-3d/rope.ts.
export const ropeAnchorSchema = z.object({
  item: z.string().min(1),
  local: z.tuple([z.number(), z.number(), z.number()]),
});
export type RopeAnchor = z.infer<typeof ropeAnchorSchema>;
export const ropeSchema = z.object({
  id: z.string().min(1),
  a: ropeAnchorSchema,
  b: ropeAnchorSchema,
});
export type Rope = z.infer<typeof ropeSchema>;

// `coneFields` is optioneel bij het lezen (default []) zodat plattegronden
// die vóór deze feature zijn opgeslagen gewoon blijven laden.
export const floorplan3dDataSchema = z.object({
  version: z.literal(1),
  room: floorplan3dRoomSchema,
  items: z.array(floorplan3dItemSchema),
  coneFields: z.array(coneFieldSchema).default([]),
  /** Touwen tussen items. Optioneel bij het lezen (default []): plattegronden van vóór deze feature laden gewoon. */
  ropes: z.array(ropeSchema).default([]),
});
export type Floorplan3dData = z.infer<typeof floorplan3dDataSchema>;

export const DEFAULT_ROOM: Floorplan3dRoom = { width_m: 15, length_m: 27 };

export function createEmptyFloorplan3dData(): Floorplan3dData {
  return { version: 1, room: DEFAULT_ROOM, items: [], coneFields: [], ropes: [] };
}

// actions/floorplans3d.ts — server-actie-inputschema's.
export const saveFloorplan3dInputSchema = z.object({
  id: z.string().uuid().optional(),
  naam: z.string().trim().min(1, "Naam is verplicht.").max(100),
  activiteitId: z.string().trim().min(1).optional(),
  data: floorplan3dDataSchema,
});
export type SaveFloorplan3dInput = z.infer<typeof saveFloorplan3dInputSchema>;

export type Floorplan3dSummary = {
  id: string;
  naam: string;
  activiteit_id: string | null;
  updated_at: string;
};

export type Floorplan3dRow = Floorplan3dSummary & {
  data: Floorplan3dData;
};
