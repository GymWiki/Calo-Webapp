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

// `coneFields` is optioneel bij het lezen (default []) zodat plattegronden
// die vóór deze feature zijn opgeslagen gewoon blijven laden.
export const floorplan3dDataSchema = z.object({
  version: z.literal(1),
  room: floorplan3dRoomSchema,
  items: z.array(floorplan3dItemSchema),
  coneFields: z.array(coneFieldSchema).default([]),
});
export type Floorplan3dData = z.infer<typeof floorplan3dDataSchema>;

export const DEFAULT_ROOM: Floorplan3dRoom = { width_m: 15, length_m: 27 };

export function createEmptyFloorplan3dData(): Floorplan3dData {
  return { version: 1, room: DEFAULT_ROOM, items: [], coneFields: [] };
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
