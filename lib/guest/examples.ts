import { DEFAULT_GYM_LAYOUT, GYM_LAYOUTS, createGymEnvironment, roomForGymLayout } from "@/components/canvas-3d/environments";
import type { ConeField, Floorplan3dData, Floorplan3dItem } from "@/types/floorplan3d";
import type { MaterialModel } from "@/types/materialModel";

export type GuestExampleId = "veld-afzetten" | "volleybal" | "opstelling-turnen" | "circuit";

export type GuestExample = { id: GuestExampleId; titel: string; omschrijving: string };

/** Voorbeelden op de gratis-toolpagina; de plattegrond zelf wordt bij het openen uit de echte catalogus samengesteld. */
export const GUEST_EXAMPLES: GuestExample[] = [
  { id: "veld-afzetten", titel: "Veld afzetten met pionnen", omschrijving: "Een speelveld van 12 × 20 m met gekleurde hoekpionnen." },
  { id: "volleybal", titel: "Volleybalveld in de gymzaal", omschrijving: "Een veld van 9 × 18 m met net, geschikt voor groep 6–8." },
  { id: "opstelling-turnen", titel: "Opstelling bewegingsonderwijs", omschrijving: "Matten, banken en een springplank als circuit." },
  { id: "circuit", titel: "Circuit met vier stations", omschrijving: "Vier hoeken, vier activiteiten: een overzichtelijke les voor 24 leerlingen." },
];

let counter = 0;
const nextId = (prefix: string) => `${prefix}-${++counter}`;

/** Eerste model waarvan slug, naam of tags overeenkomen met één van de patronen (volgorde = voorkeur). */
export function pickModel(models: MaterialModel[], ...patterns: RegExp[]): MaterialModel | undefined {
  for (const pattern of patterns) {
    const hit = models.find((m) => pattern.test(`${m.slug} ${m.naam} ${m.tags.join(" ")}`));
    if (hit) return hit;
  }
  return undefined;
}

function place(model: MaterialModel | undefined, x: number, z: number, rot = 0): Floorplan3dItem[] {
  if (!model) return [];
  return [{ id: nextId("v"), slug: model.slug, x, y: 0, z, rot_y_deg: rot }];
}

function coneField(width: number, length: number, x: number, z: number, color: string, corner: string | null): ConeField {
  return {
    id: nextId("cf"),
    type: "coneField",
    x,
    z,
    rot_y_deg: 0,
    width_m: width,
    length_m: length,
    interval_m: 3,
    distribution: "even",
    marker: "pion",
    color,
    corner_color: corner,
  };
}

/**
 * Bouwt een voorbeeldplattegrond. Items die (nog) niet in de catalogus bestaan worden overgeslagen,
 * zodat een voorbeeld nooit naar een onbekende slug verwijst.
 */
export function buildExamplePlan(id: GuestExampleId, models: MaterialModel[]): { naam: string; data: Floorplan3dData } {
  const room = { ...roomForGymLayout(GYM_LAYOUTS[DEFAULT_GYM_LAYOUT]), environment: createGymEnvironment(DEFAULT_GYM_LAYOUT) };
  const example = GUEST_EXAMPLES.find((e) => e.id === id)!;
  const mat = pickModel(models, /mat/i);
  const bank = pickModel(models, /turnbank|bank/i);
  const plank = pickModel(models, /springplank|plank/i);
  const kast = pickModel(models, /kast/i);
  const net = pickModel(models, /volleybal.*net|net/i);
  const bal = pickModel(models, /volleybal/i, /bal/i);
  let items: Floorplan3dItem[] = [];
  let coneFields: ConeField[] = [];

  if (id === "veld-afzetten") {
    coneFields = [coneField(12, 20, 0, 0, "#f97316", "#2563eb")];
    items = place(bal, 0, 0);
  } else if (id === "volleybal") {
    coneFields = [coneField(9, 18, 0, 0, "#f97316", "#ffffff")];
    items = [...place(net, 0, 0, 90), ...place(bal, -2, 4)];
  } else if (id === "opstelling-turnen") {
    items = [...place(mat, -3, -4), ...place(mat, 3, -4), ...place(bank, -3, 1, 90), ...place(plank, 3, 2), ...place(kast, 0, 6)];
  } else {
    items = [
      ...place(mat, -4, -7),
      ...place(bank, 4, -7, 90),
      ...place(plank, -4, 7),
      ...place(kast, 4, 7),
    ];
    coneFields = [coneField(14, 24, 0, 0, "#16a34a", null)];
  }
  return { naam: example.titel, data: { version: 1, room, items, coneFields, ropes: [] } };
}
