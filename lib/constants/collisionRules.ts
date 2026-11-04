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
  // Hangend/overspannend: netten (ook klimnetten), touwen, linten, ringen en touwladders.
  { test: /(^|_)(net|nets|bodemnet|scheidingsnet|touw|touwen|lint|linten|koord|slinger|elastiek|touwladder|zwaairingen|ringenstel)(_|$)|klimnet|klimtouw|hangend|net(_|$)|veldopstelling/, layer: "overspannend" },
  // Vaste wandonderdelen.
  { test: /(^|_)(wandrek|wandrekken|ribstoel|muur)(_|$)|basketbal_muur|rekstok_wand/, layer: "decor" },
  // Matten en vloermarkeringen (blijven op de vloer).
  { test: /(^|_)(mat|matten|valmat|landingsmat|judomat|judomatten|turnmat|fitnessmat|yogamat|lijn|lijnen|tape|markering|vloermarkering)(_|$)|(^|_)(dikke_mat|judomat)/, layer: "vloer" },
  // Klein materiaal: ballen (alles op "-bal"), pionnen, dopjes, hoepels, hesjes, rackets, sticks, knuppels, vlaggen en dergelijk.
  { test: /ball?(_|$)|football|racket|stick|paddle|(^|_)(ballen|pion|pionnen|dopje|dopjes|hoepel|hoepels|hesje|hesjes|partijhesjes|kegel|kegels|stok|stokken|shuttle|racket|rackets|stick|sticks|knuppel|honkbalknuppel|bat|batje|cricketbat|puck|ring|vlag|vlaggen|fluitje|stopwatch|handfluit|megafoon|klembord|boule|butje|skippybal|kettlebell|dumbbell|schijf|barbell|powerbag|medicijnbal|springtouw|slalompalen|stopwatch|zandlopers)(_|$)|vlaggen|bat(_|$)|batje|hoekvlag|korfbalmand/, layer: "klein" },
  // Staand materiaal: doelen, palen, torens, standaards.
  { test: /doel|(^|_)(paal|palen|standaard|basket|korfbalpaal|netpaal|toren|basketbaltoren)(_|$)|palen_|korfbalpaal|basketbaltoren/, layer: "staand" },
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
 * Stapelen: kan een item van deze laag andere items dragen (als ondergrond dienen)? Banken, kasten, bokken, trampolines en andere
 * toestellen en matten wel; ballen, pionnen, palen, netten, touwen, personen en vaste wandonderdelen niet. De `stackable`-vlag uit de
 * database wint hier niet van: die stond voor veel toestellen (springbok, evenwichtsbalk, trampoline) op "false" waardoor alles erin zakte.
 */
export function supportsOthers(layer: CollisionLayer): boolean {
  return layer === "toestel" || layer === "vloer";
}

/** Mag een item van laag `dragged` op een ondergrond van laag `base` rusten? Overspannend materiaal houdt altijd zijn eigen hoogte. */
export function canRestOn(dragged: CollisionLayer, base: CollisionLayer): boolean {
  if (dragged === "overspannend" || dragged === "decor") return false;
  // Matten en andere vloeritems blijven op de vloer (mat op mat mag, mat op een bank niet); alles anders stapelt op toestellen en matten.
  if (dragged === "vloer") return base === "vloer";
  return supportsOthers(base);
}
