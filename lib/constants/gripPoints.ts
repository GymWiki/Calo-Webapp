// Greeppunten: waar de hand een object vastpakt, en welke objecten pakbaar zijn. Pure data + regels (geen React/three).
//
// Bronnen, in volgorde van voorkeur: 1. een `anchor_grip` node in het GLB (nog niet aanwezig, zie docs/grip-audit.md), 2. de overrides hieronder
// (met reden), 3. een regel op categorie en afmetingen: een bal wordt in het midden vastgepakt, een racket of stick bij het uiteinde van de lengteas.
// Coördinaten: meters in de ITEM-ruimte (pivot onderkant-midden, Y omhoog), net als de anchors voor touwen.

export type GripVec3 = [number, number, number];
export type GripInfo = { pakbaar: boolean; grip: GripVec3; bron: "config" | "afgeleid"; reden: string };

export type GripOverride = { pakbaar?: boolean; grip?: GripVec3; reden: string };

/** Uitzonderingen per slug, met reden. */
export const GRIP_OVERRIDES: Readonly<Record<string, GripOverride>> = {
  kin_ball_reuzenbal: { pakbaar: false, reden: "Reuzenbal van 1,2 m: te groot voor één hand." },
  petanque_butje: { reden: "Klein, in het midden pakbaar (standaardregel voor ballen)." },
};

/** Het grootste afmetingsdeel (m) waarboven een bal niet meer met één hand te pakken is. */
const MAX_BALL_HEIGHT_M = 0.45;
const STICK_PATTERN = /racket|stick|bat(je)?\b|knuppel|paddle|slagplank|slagballat|crosse|speer/;
const HANDLE_FROM_END_M = 0.12;

export type GripModel = { slug: string; categorie?: string | null; subgroep?: string | null; length_m: number; width_m: number; height_m: number };

export function gripOf(model: GripModel): GripInfo {
  const override = GRIP_OVERRIDES[model.slug];
  const ballCenter: GripVec3 = [0, model.height_m / 2, 0];
  const isBall = model.categorie === "ballen" && model.height_m <= MAX_BALL_HEIGHT_M;
  const isStick = model.subgroep === "sticks_rackets" || STICK_PATTERN.test(model.slug);
  let base: GripInfo;
  if (isBall) base = { pakbaar: true, grip: ballCenter, bron: "afgeleid", reden: "Bal: het midden." };
  else if (isStick && model.length_m <= 1.6) {
    base = { pakbaar: true, grip: [-model.length_m / 2 + HANDLE_FROM_END_M, model.height_m / 2, 0], bron: "afgeleid", reden: "Stick of racket: bij het uiteinde van de lengteas (handvat)." };
  } else base = { pakbaar: false, grip: ballCenter, bron: "afgeleid", reden: "Geen zinnig greeppunt (te groot of geen handmateriaal)." };
  if (!override) return base;
  return { pakbaar: override.pakbaar ?? base.pakbaar, grip: override.grip ?? base.grip, bron: "config", reden: override.reden };
}
