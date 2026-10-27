// Per asset: mag het gekanteld worden, hoe ver, en met welke standaardrotatie komt het binnen?
// Dit is de ENIGE plek met die regels; een uitzondering voor één asset komt in ORIENTATION_OVERRIDES
// (met reden), net als collision-overrides.ts.
//
//   allowTilt        false = alleen draaien om de verticale as (heading)
//   maxTiltDeg       maximale kanteling per as (graden, 0–180); 180 = ook op kop
//   defaultRotation  rotatie waarmee een nieuw item geplaatst wordt (bijv. matten die rechtop tegen de muur staan)
//
// Standaard mag alles kantelen, behalve materiaal waarvoor dat niet logisch is (zie FLAT_ONLY).

import { clampTilt, type ItemRotationFields, type Rotation3 } from "@/components/canvas-3d/orientation";

export type OrientationConfig = {
  allowTilt: boolean;
  maxTiltDeg: number;
  defaultRotation?: Partial<Rotation3>;
};

export type OrientationSubject = { slug: string; categorie?: string; subgroep?: string | null };

export const DEFAULT_MAX_TILT_DEG = 180;

/** Waarom iets niet kan kantelen — getoond in het itempaneel. */
type FlatRule = { test: (subject: OrientationSubject) => boolean; reason: string };

const FLAT_ONLY: FlatRule[] = [
  { test: (m) => m.categorie === "personen", reason: "Personen staan altijd rechtop op de vloer." },
  {
    test: (m) => m.categorie === "klein_materiaal" && m.subgroep === "afzetten",
    reason: "Pionnen, dopjes, slalompalen en markeringen staan altijd plat op de vloer.",
  },
  {
    test: (m) => /^(pion|dopje|vloermarkering|slalompalen|hoekvlag|cornervlag|grensrechter|partijhesjes)/.test(m.slug),
    reason: "Pionnen, dopjes, vlaggen en markeringen staan altijd plat op de vloer.",
  },
];

/** Handmatige uitzonderingen per slug (verplichte reden). Leeg: de regels hierboven volstaan. */
export const ORIENTATION_OVERRIDES: Record<string, Partial<OrientationConfig> & { reason: string }> = {
  // voorbeeld: matten_rechtop_wandmat: { reason: "Hangt altijd rechtop tegen de muur", defaultRotation: { x: 90 } },
};

export type ResolvedOrientation = OrientationConfig & {
  /** Alleen gezet als kantelen niet mag: de uitleg. */
  reason: string | null;
};

/**
 * De oriëntatie-instellingen van een asset. `elevated` = hangend materiaal (touwen, ringen, netten,
 * borden): dat hangt recht omlaag en kantelt dus niet.
 */
export function orientationFor(subject: OrientationSubject, elevated = false): ResolvedOrientation {
  const override = ORIENTATION_OVERRIDES[subject.slug];
  let allowTilt = true;
  let reason: string | null = null;

  const flat = FLAT_ONLY.find((rule) => rule.test(subject));
  if (flat) {
    allowTilt = false;
    reason = flat.reason;
  } else if (elevated) {
    allowTilt = false;
    reason = "Hangend materiaal (touwen, ringen, netten, borden) hangt altijd recht omlaag.";
  }

  if (override) {
    if (override.allowTilt !== undefined) {
      allowTilt = override.allowTilt;
      reason = allowTilt ? null : override.reason;
    }
    return {
      allowTilt,
      maxTiltDeg: override.maxTiltDeg ?? DEFAULT_MAX_TILT_DEG,
      defaultRotation: override.defaultRotation,
      reason,
    };
  }
  return { allowTilt, maxTiltDeg: DEFAULT_MAX_TILT_DEG, reason };
}

/** Beperkt een rotatie tot wat voor dit asset mag: zonder kantelen x = z = 0, anders ±maxTiltDeg. */
export function clampRotation(rot: Rotation3, config: OrientationConfig): Rotation3 {
  if (!config.allowTilt) return { x: 0, y: rot.y, z: 0 };
  return { x: clampTilt(rot.x, config.maxTiltDeg), y: rot.y, z: clampTilt(rot.z, config.maxTiltDeg) };
}

type NormalizableItem = ItemRotationFields & { lift_m?: number };

/**
 * Normalisatie bij het laden en na elke wijziging: kantelhoeken binnen de asset-limieten en
 * weggelaten als ze 0 zijn (zo blijft oude data byte-voor-byte gelijk), een ongeldige `lift_m`
 * weg. Geeft hetzelfde object terug als er niets verandert.
 */
export function normalizeItemRotation<T extends NormalizableItem>(item: T, config: OrientationConfig): T {
  const clamped = clampRotation({ x: item.rot_x_deg ?? 0, y: item.rot_y_deg, z: item.rot_z_deg ?? 0 }, config);
  const next: T = { ...item };
  if (clamped.x === 0) delete next.rot_x_deg;
  else next.rot_x_deg = clamped.x;
  if (clamped.z === 0) delete next.rot_z_deg;
  else next.rot_z_deg = clamped.z;
  if (next.lift_m !== undefined && !(Number.isFinite(next.lift_m) && next.lift_m >= 0)) delete next.lift_m;

  const same =
    next.rot_x_deg === item.rot_x_deg && next.rot_z_deg === item.rot_z_deg && next.lift_m === item.lift_m;
  return same ? item : next;
}
