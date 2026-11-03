// Botsingsregels per soort materiaal voor de 3D-plattegrondeditor.
// Filosofie: de editor helpt de docent, hij houdt hem niet tegen. Er is GEEN harde
// blokkade tussen items; een overlap die fysiek vreemd is geeft alleen een waarschuwing
// ("Overlapt met bank"), de plaatsing blijft zoals de docent hem neerzet. Wat WEL
// "vrij" mag overlappen (een net over een bank) geeft helemaal geen waarschuwing.
// Puur (geen React/three) zodat de editor, de tests en het audit-script dit delen.

export type CollisionLayer =
  | "vloer" //         matten, vloerlijnen, tape: platte items die onder alles liggen
  | "toestel" //       banken, kasten, bokken, karren: meubels en toestellen
  | "staand" //        palen, doelen, netpalen, standaards
  | "overspannend" //  netten, touwen, linten, scheidingsnetten (hangen tussen palen)
  | "klein" //         pionnen, ballen, hoepels, hesjes
  | "persoon" //       leerling, leerkracht
  | "decor"; //        vaste wandrekken en andere vaste inrichting

export const COLLISION_LAYERS: readonly CollisionLayer[] = ["vloer", "toestel", "staand", "overspannend", "klein", "persoon", "decor"];

export const LAYER_LABELS: Record<CollisionLayer, string> = {
  vloer: "Vloer (matten, lijnen)",
  toestel: "Meubel/toestel",
  staand: "Staand materiaal (palen, doelen)",
  overspannend: "Overspannend (netten, touwen)",
  klein: "Klein materiaal",
  persoon: "Persoon",
  decor: "Decor (vaste inrichting)",
};

/** Eigen regel voor één asset (slug); altijd met een korte reden. */
export type CollisionRuleOverride = {
  layer: CollisionLayer;
  /** Mag op/over andere items blijven op zijn eigen hoogte (stapelt niet). Standaard: alleen "overspannend". */
  noStack?: boolean;
  reason: string;
};

export const COLLISION_OVERRIDES: Record<string, CollisionRuleOverride> = {
  volleybal_veldopstelling_compleet_dames: { layer: "overspannend", noStack: true, reason: "Complete opstelling (net tussen palen): het net hangt over alles heen; de palen zijn dun." },
  volleybal_veldopstelling_compleet_heren: { layer: "overspannend", noStack: true, reason: "Complete opstelling (net tussen palen): het net hangt over alles heen; de palen zijn dun." },
  volleybal_veldopstelling_middelhoog_180cm: { layer: "overspannend", noStack: true, reason: "Complete opstelling (net tussen palen): het net hangt over alles heen; de palen zijn dun." },
  volleybal_veldopstelling_bodemnet_grond_100cm: { layer: "overspannend", noStack: true, reason: "Bodemnet tussen palen: hangt over alles heen." },
  volleybalpalen_mobiel_set: { layer: "staand", reason: "Twee netpalen op een voet: staan op de vloer en botsen alleen op de plek van de paal." },
};

// Volgorde telt: de eerste die past wint.
const SLUG_RULES: { test: RegExp; layer: CollisionLayer }[] = [
  { test: /(^|_)(leerling|leerkracht|docent|persoon|student)(_|$)/, layer: "persoon" },
  { test: /(^|_)(net|nets|bodemnet|scheidingsnet|touw|touwen|lint|linten|koord|slinger|elastiek)(_|$)/, layer: "overspannend" },
  { test: /(^|_)(mat|matten|valmat|landingsmat|lijn|lijnen|tape|markering)(_|$)/, layer: "vloer" },
  { test: /(^|_)(pion|pionnen|bal|ballen|hoepel|hoepels|hesje|hesjes|kegel|kegels|stok|stokken|tennisbal|shuttle)(_|$)|bal$/, layer: "klein" },
  { test: /(^|_)(paal|palen|doel|doelen|standaard|basket|korfbalpaal|netpaal)(_|$)/, layer: "staand" },
  { test: /(^|_)(wandrek|wandrekken|ribstoel)(_|$)/, layer: "decor" },
];

/** Laag van een asset: eerst de override, dan de naamregels, anders "toestel". Een item boven de vloer (hangend) is altijd overspannend. */
export function layerOf(slug: string, hanging = false): CollisionLayer {
  const override = COLLISION_OVERRIDES[slug];
  if (override) return override.layer;
  const lower = slug.toLowerCase();
  for (const rule of SLUG_RULES) if (rule.test.test(lower)) return rule.layer;
  return hanging ? "overspannend" : "toestel";
}

/** Items van deze laag klimmen nooit op een ander item: ze houden hun eigen hoogte. */
export function staysAtOwnHeight(slug: string, layer: CollisionLayer): boolean {
  return COLLISION_OVERRIDES[slug]?.noStack === true || layer === "overspannend";
}

/**
 * Matrix: geeft overlap tussen `dragged` en `other` een waarschuwing?
 * true = waarschuw; false = mag gewoon (netten over alles, matten onder alles, klein materiaal op alles).
 */
export function overlapWarns(dragged: CollisionLayer, other: CollisionLayer): boolean {
  if (dragged === "overspannend" || other === "overspannend") return false;
  if (dragged === "vloer" || other === "vloer") return false;
  if (dragged === "klein" || other === "klein") return false;
  // Een persoon naast alles; alleen met een andere persoon of een toestel is het een echte overlap.
  if (dragged === "persoon" || other === "persoon") return dragged === other || other === "toestel" || dragged === "toestel";
  // Toestel/staand/decor onderling: fysiek onmogelijk om door elkaar te staan.
  return true;
}
